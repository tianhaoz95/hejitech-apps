package com.hejitech.contempo.agent

import android.app.DownloadManager
import android.content.Context
import android.graphics.Bitmap
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.hejitech.contempo.data.AiSettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

/**
 * LiteRT-LM implementation of OnDeviceLlm, running a downloaded Gemma 4 E2B
 * model — see OnDeviceLlm's kdoc for why this replaced Gemini Nano/AICore as
 * the active implementation (device coverage). The model itself isn't
 * bundled in the app (Google's own guidance: too large for an APK) — it's
 * downloaded on demand via ModelDownloader, same "download progress with
 * ETA" UX the app already had for AICore, just backed by a real HTTP
 * download this time instead of an OS-managed one.
 */
class LiteRtLlm(
    context: Context,
    aiSettingsStore: AiSettingsStore,
    private val scope: CoroutineScope,
) : OnDeviceLlm {
    private val appContext = context.applicationContext
    private val downloader = ModelDownloader(appContext)

    private val _status = MutableStateFlow<OnDeviceModelUiStatus>(OnDeviceModelUiStatus.Checking)
    override val status: StateFlow<OnDeviceModelUiStatus> = _status.asStateFlow()

    // Loading a ~2.6GB model is expensive — built once, reused for the
    // process lifetime, guarded by a mutex since generate() calls can race
    // the first load.
    private var engine: Engine? = null
    private val engineMutex = Mutex()

    init {
        scope.launch {
            aiSettingsStore.preference.collect { preference ->
                if (preference != InferencePreference.CLOUD_ONLY) {
                    checkAndMaybeDownload()
                    // Pre-warm in the background right away, rather than
                    // paying this multi-second model-load cost on the user's
                    // first actual prompt — ensureEngine() is a no-op if the
                    // model isn't downloaded yet (checked internally), so
                    // this is safe to call unconditionally here, and it
                    // re-fires (harmlessly — engine is already non-null by
                    // then) whenever the preference flow re-collects, e.g.
                    // right after switching away from Cloud only.
                    ensureEngine()
                }
            }
        }
    }

    override fun retry() {
        scope.launch {
            checkAndMaybeDownload()
            ensureEngine()
        }
    }

    private suspend fun checkAndMaybeDownload() {
        if (downloader.isDownloaded()) {
            _status.value = OnDeviceModelUiStatus.Available
            return
        }
        _status.value = OnDeviceModelUiStatus.Checking
        if (!downloader.hasEnoughFreeSpace()) {
            _status.value = OnDeviceModelUiStatus.Failed(
                "Not enough free storage for the on-device model — needs about 2.6GB free."
            )
            return
        }
        val id = downloader.activeDownloadId() ?: downloader.start()
        trackDownload(id)
    }

    private suspend fun trackDownload(id: Long) {
        _status.value = OnDeviceModelUiStatus.NotDownloaded
        var baselineBytes = 0L
        var baselineTimeMs = 0L
        while (true) {
            val snapshot = downloader.queryProgress(id)
            if (snapshot == null) {
                // DownloadManager lost track of this id (e.g. cleared via the
                // system Downloads UI, or the device rebooted and purged
                // pending downloads) — surface it as a retryable failure
                // rather than silently looping forever.
                downloader.clearDownloadId()
                _status.value = OnDeviceModelUiStatus.Failed("Download was interrupted — tap retry.")
                return
            }
            when (snapshot.status) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    downloader.clearDownloadId()
                    _status.value = OnDeviceModelUiStatus.Available
                    return
                }
                DownloadManager.STATUS_FAILED -> {
                    downloader.clearDownloadId()
                    _status.value = OnDeviceModelUiStatus.Failed("Download failed (reason ${snapshot.reason}) — tap retry.")
                    return
                }
                else -> {
                    val nowMs = System.currentTimeMillis()
                    if (baselineTimeMs == 0L) {
                        baselineBytes = snapshot.bytesDownloaded
                        baselineTimeMs = nowMs
                    }
                    val elapsedSeconds = (nowMs - baselineTimeMs) / 1000.0
                    val bytesSinceBaseline = snapshot.bytesDownloaded - baselineBytes
                    val eta = if (elapsedSeconds > 1.0 && bytesSinceBaseline > 0 && snapshot.totalBytes > 0) {
                        val bytesPerSecond = bytesSinceBaseline / elapsedSeconds
                        ((snapshot.totalBytes - snapshot.bytesDownloaded) / bytesPerSecond)
                            .toLong()
                            .coerceAtLeast(0)
                    } else {
                        null
                    }
                    _status.value = OnDeviceModelUiStatus.Downloading(
                        bytesDownloaded = snapshot.bytesDownloaded,
                        totalBytes = snapshot.totalBytes.takeIf { it > 0 } ?: ModelDownloader.MODEL_SIZE_BYTES,
                        etaSeconds = eta,
                    )
                }
            }
            delay(750)
        }
    }

    private suspend fun ensureEngine(): Engine? = engineMutex.withLock {
        engine?.let { return@withLock it }
        if (!downloader.isDownloaded()) return@withLock null
        try {
            withContext(Dispatchers.IO) {
                val config = EngineConfig(
                    modelPath = downloader.modelFile.absolutePath,
                    backend = Backend.CPU(),
                    visionBackend = Backend.CPU(),
                    audioBackend = null,
                    maxNumTokens = null,
                    maxNumImages = 1,
                    cacheDir = appContext.cacheDir.absolutePath,
                )
                Engine(config).also { it.initialize() }
            }.also { engine = it }
        } catch (e: Exception) {
            _status.value = OnDeviceModelUiStatus.Failed(e.message ?: "Couldn't load the on-device model")
            null
        }
    }

    override suspend fun generateText(prompt: String): String? = generate(Contents.of(prompt))

    override suspend fun generateFromImage(bitmap: Bitmap, prompt: String): String? {
        val jpegBytes = withContext(Dispatchers.Default) {
            ByteArrayOutputStream().use { stream ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, stream)
                stream.toByteArray()
            }
        }
        return generate(Contents.of(Content.ImageBytes(jpegBytes), Content.Text(prompt)))
    }

    private suspend fun generate(contents: Contents): String? {
        val eng = ensureEngine() ?: return null
        return try {
            withContext(Dispatchers.Default) {
                eng.createConversation().use { conversation ->
                    val response = conversation.sendMessage(contents)
                    response.contents.contents
                        .filterIsInstance<Content.Text>()
                        .joinToString("") { it.text }
                        .trim()
                        .takeIf { it.isNotBlank() }
                }
            }
        } catch (e: Exception) {
            null
        }
    }
}
