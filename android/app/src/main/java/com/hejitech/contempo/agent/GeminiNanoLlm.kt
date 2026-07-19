package com.hejitech.contempo.agent

import android.graphics.Bitmap
import com.google.firebase.Firebase
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceExtension
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.Content
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.hejitech.contempo.data.AiSettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Firebase AI Logic / Gemini Nano (AICore) implementation of OnDeviceLlm —
 * the original on-device path. Not wired into ServiceLocator anymore (see
 * OnDeviceLlm's kdoc: AICore's device coverage is too narrow — this app's
 * own physical test device supports neither text nor vision Nano), but kept
 * compiling and intact in case AICore's coverage becomes worth revisiting.
 *
 * Folds together what used to be two separate things: OnDeviceModelMonitor
 * (status/download tracking) and AgentClient's own onDeviceModel()-based
 * generateContent() calls — now both live behind the OnDeviceLlm interface.
 *
 * Real, documented on-device constraints as of mid-2026: foreground-only,
 * English/Korean only, ~4000 token cap, no function-calling support.
 */
class GeminiNanoLlm(
    aiSettingsStore: AiSettingsStore,
    private val scope: CoroutineScope,
) : OnDeviceLlm {
    private val _status = MutableStateFlow<OnDeviceModelUiStatus>(OnDeviceModelUiStatus.Checking)
    override val status: StateFlow<OnDeviceModelUiStatus> = _status.asStateFlow()

    init {
        // Re-check (and start tracking a download, if needed) whenever the
        // user picks a preference that can use on-device at all — not just
        // ON_DEVICE_ONLY, since PREFER_ON_DEVICE benefits from the model
        // being ready too, it just doesn't hard-block on it.
        scope.launch {
            aiSettingsStore.preference.collect { preference ->
                if (preference != InferencePreference.CLOUD_ONLY) {
                    checkAndMaybeDownload()
                }
            }
        }
    }

    override fun retry() {
        scope.launch { checkAndMaybeDownload() }
    }

    @OptIn(PublicPreviewAPI::class)
    private fun model(): GenerativeModel =
        Firebase.ai(backend = GenerativeBackend.googleAI())
            .generativeModel(
                modelName = "gemini-flash-latest",
                onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE),
            )

    @OptIn(PublicPreviewAPI::class)
    override suspend fun generateText(prompt: String): String? = try {
        model().generateContent(prompt).text?.trim()?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
        null
    }

    @OptIn(PublicPreviewAPI::class)
    override suspend fun generateFromImage(bitmap: Bitmap, prompt: String): String? = try {
        // Content.Builder's Kotlin-facing member names are "image"/"text" —
        // "addImage"/"addText" are only the @JvmName-remapped names visible
        // to Java callers (confirmed via javap -v against the real AAR).
        val requestContent = Content.Builder().apply {
            image(bitmap)
            text(prompt)
        }.build()
        model().generateContent(requestContent).text?.trim()?.takeIf { it.isNotBlank() }
    } catch (e: Exception) {
        // Image input on-device needs materially more RAM/SoC than
        // text-only Nano, so this fails on more devices in practice.
        null
    }

    // Not supported — this implementation is currently unused/kept in reserve (see
    // OnDeviceLlm's kdoc); LiteRtLlm is the only implementation with real tool-calling.
    override suspend fun extractEntryDraft(rawText: String, knownProperties: List<String>): EntryDraft? = null

    // No real streaming support in this (currently unused) implementation —
    // graceful degrade rather than null, so chat still works if this backend
    // were ever swapped back in, just without a live per-chunk indicator.
    override suspend fun generateTextStream(prompt: String, onEvent: (GenerationEvent) -> Unit): String? {
        onEvent(GenerationEvent.Prefilling)
        val text = generateText(prompt) ?: return null
        onEvent(GenerationEvent.Streaming(text, 1))
        return text
    }

    @OptIn(PublicPreviewAPI::class)
    private suspend fun checkAndMaybeDownload() {
        _status.value = OnDeviceModelUiStatus.Checking
        val extension = model().onDeviceExtension
        if (extension == null) {
            _status.value = OnDeviceModelUiStatus.Unavailable
            return
        }
        val initial = try {
            extension.checkStatus()
        } catch (e: Exception) {
            _status.value = OnDeviceModelUiStatus.Failed(e.message ?: "Couldn't check on-device model status")
            return
        }
        when (initial) {
            OnDeviceModelStatus.AVAILABLE -> _status.value = OnDeviceModelUiStatus.Available
            OnDeviceModelStatus.UNAVAILABLE -> _status.value = OnDeviceModelUiStatus.Unavailable
            // DOWNLOADABLE or DOWNLOADING: either way, calling download() is
            // the only way to observe progress (and it's what actually
            // triggers the download when status is DOWNLOADABLE) — the SDK
            // doesn't expose a separate "just watch, don't start" call.
            else -> trackDownload(extension)
        }
    }

    @OptIn(PublicPreviewAPI::class)
    private suspend fun trackDownload(extension: OnDeviceExtension) {
        _status.value = OnDeviceModelUiStatus.NotDownloaded
        var totalBytes = 0L
        var baselineBytes = 0L
        var baselineTimeMs = 0L
        try {
            extension.download().collect { downloadStatus ->
                val nowMs = System.currentTimeMillis()
                when (downloadStatus) {
                    is DownloadStatus.DownloadStarted -> {
                        totalBytes = downloadStatus.bytesToDownload
                        baselineBytes = 0L
                        baselineTimeMs = nowMs
                        _status.value = OnDeviceModelUiStatus.Downloading(0, totalBytes, null)
                    }
                    is DownloadStatus.DownloadInProgress -> {
                        if (baselineTimeMs == 0L) {
                            baselineBytes = downloadStatus.totalBytesDownloaded
                            baselineTimeMs = nowMs
                        }
                        val elapsedSeconds = (nowMs - baselineTimeMs) / 1000.0
                        val bytesSinceBaseline = downloadStatus.totalBytesDownloaded - baselineBytes
                        val eta = if (elapsedSeconds > 1.0 && bytesSinceBaseline > 0 && totalBytes > 0) {
                            val bytesPerSecond = bytesSinceBaseline / elapsedSeconds
                            ((totalBytes - downloadStatus.totalBytesDownloaded) / bytesPerSecond)
                                .toLong()
                                .coerceAtLeast(0)
                        } else {
                            null
                        }
                        _status.value = OnDeviceModelUiStatus.Downloading(
                            bytesDownloaded = downloadStatus.totalBytesDownloaded,
                            totalBytes = totalBytes.coerceAtLeast(downloadStatus.totalBytesDownloaded),
                            etaSeconds = eta,
                        )
                    }
                    is DownloadStatus.DownloadCompleted -> _status.value = OnDeviceModelUiStatus.Available
                    is DownloadStatus.DownloadFailed -> _status.value =
                        OnDeviceModelUiStatus.Failed(downloadStatus.exception.message ?: "Download failed")
                }
            }
        } catch (e: Exception) {
            _status.value = OnDeviceModelUiStatus.Failed(e.message ?: "Download failed")
        }
    }
}
