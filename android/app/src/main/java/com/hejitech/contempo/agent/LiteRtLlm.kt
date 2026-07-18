package com.hejitech.contempo.agent

import android.app.DownloadManager
import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.ToolCall
import com.google.ai.edge.litertlm.ToolProvider
import com.google.ai.edge.litertlm.tool
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
import java.time.Duration
import java.time.Instant

/**
 * Generous enough for getCurrentTime + up to two time-offset calls + the terminal
 * recordEntry call, with slack — while guaranteeing the manual tool loop in
 * [LiteRtLlm.extractEntryDraft] always terminates (mirrors the SDK's own
 * RECURRING_TOOL_CALL_LIMIT=25 at a scale appropriate to this task).
 */
private const val MAX_TOOL_LOOP_ITERATIONS = 6

private const val TAG = "LiteRtLlm"

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

    // Schemas derived once via reflection over EntryTools — see that file's kdoc for
    // why its function bodies are never actually invoked.
    private val entryToolProvider: ToolProvider = tool(EntryTools)

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

    override suspend fun extractEntryDraft(rawText: String, knownProperties: List<String>): EntryDraft? {
        val eng = ensureEngine() ?: return null
        return try {
            withContext(Dispatchers.Default) {
                val config = ConversationConfig(
                    systemInstruction = Contents.of(buildEntryToolSystemPrompt(knownProperties)),
                    tools = listOf(entryToolProvider),
                    automaticToolCalling = false,
                )
                eng.createConversation(config).use { conversation ->
                    var message = conversation.sendMessage(rawText)
                    repeat(MAX_TOOL_LOOP_ITERATIONS) {
                        val recordCall = message.toolCalls.firstOrNull { it.name == "record_entry" }
                        if (recordCall != null) return@withContext entryDraftFromArguments(recordCall.arguments)

                        val pending = message.toolCalls
                        // Model replied in prose instead of calling a tool — no
                        // structured output to extract, same as a malformed-JSON
                        // failure in the previous text-based approach.
                        if (pending.isEmpty()) return@withContext null

                        val responses = pending.map { call ->
                            Content.ToolResponse(call.name, dispatchDeterministicTool(call))
                        }
                        message = conversation.sendMessage(Message.tool(Contents.of(*responses.toTypedArray())))
                    }
                    Log.w(TAG, "extractEntryDraft: exceeded MAX_TOOL_LOOP_ITERATIONS ($MAX_TOOL_LOOP_ITERATIONS) without a record_entry call")
                    null
                }
            }
        } catch (e: Exception) {
            // Expected and non-fatal in PREFER_ON_DEVICE (same contract as
            // generateText's failure modes) — logged (unlike generateText)
            // because a tool-calling failure here is more likely to indicate
            // a real integration bug (e.g. a tool/param name mismatch against
            // what ReflectionTool actually advertises — see EntryTools.kt)
            // than ordinary "model not ready" churn.
            Log.w(TAG, "extractEntryDraft failed", e)
            null
        }
    }

    /**
     * [call] is always get_current_time/convert_to_minutes/compute_time_before/
     * compute_time_after here — record_entry is handled by the caller before this is
     * reached. Tool and param names arrive snake_cased (LiteRT-LM's ReflectionTool
     * converts the Kotlin camelCase declarations in EntryTools.kt before advertising
     * them to the model — confirmed empirically on-device, e.g. getCurrentTime ->
     * get_current_time) — matching that here rather than fighting it via the
     * (Experimental, unstable) ExperimentalFlags.convertCamelToSnakeCaseInToolDescription
     * toggle.
     */
    private fun dispatchDeterministicTool(call: ToolCall): Any = when (call.name) {
        "get_current_time" -> Instant.now().toString()
        "convert_to_minutes" -> convertToMinutes(call.arguments)
        "compute_time_before" -> offsetIso(call.arguments, forward = false)
        "compute_time_after" -> offsetIso(call.arguments, forward = true)
        else -> throw IllegalArgumentException("Unexpected tool call: ${call.name}")
    }

    private fun convertToMinutes(args: Map<String, Any?>): Int {
        val amount = (args["amount"] as Number).toInt()
        return when (args["unit"] as String) {
            "hours" -> amount * 60
            "days" -> amount * 1440
            else -> amount // "minutes", or anything unrecognized: identity
        }
    }

    private fun offsetIso(args: Map<String, Any?>, forward: Boolean): String {
        val reference = Instant.parse(args["reference_iso"] as String)
        val amountMinutes = (args["amount_minutes"] as Number).toLong().let { if (forward) it else -it }
        return reference.plus(Duration.ofMinutes(amountMinutes)).toString()
    }

    private fun entryDraftFromArguments(arguments: Map<String, Any?>): EntryDraft = EntryDraft(
        property = arguments["property"] as? String,
        task = arguments["task"] as? String,
        durationMinutes = (arguments["duration_minutes"] as? Number)?.toInt(),
        category = arguments["category"] as? String,
        eventType = arguments["event_type"] as? String,
        miles = (arguments["miles"] as? Number)?.toDouble(),
        resolvedActivityDateIso = arguments["resolved_activity_date_iso"] as? String,
    )

    private fun buildEntryToolSystemPrompt(knownProperties: List<String>): String = buildString {
        appendLine("You extract short-term-rental work-log entries from a host's own words.")
        if (knownProperties.isNotEmpty()) {
            appendLine("Known properties: ${knownProperties.joinToString(", ")}.")
        }
        appendLine("The host's message is dictated speech, not typed text — clean it up before extracting \"task\": remove filler words and disfluencies (\"uh\", \"um\", false starts, mid-sentence restarts) that carry no information, and fix likely transcription errors, punctuation, and capitalization. Never change the meaning or drop a real detail.")
        appendLine("Format \"task\" as plain prose by default. Only use a markdown bullet list (lines starting with \"- \") when the host clearly describes multiple distinct sub-tasks in one capture — a single task never needs a bullet. Never use headers, tables, or bold; a bullet list is the only formatting ever appropriate here, and only when it actually makes several items easier to scan than a sentence would.")
        appendLine("Set event_type only if the host is opening or closing a start/stop timer rather than describing a complete task: \"start\" for phrasing like 'I'm starting to work on X' / 'beginning work now' / 'clocking in', \"stop\" for phrasing like 'I just finished' / 'wrapping up' / 'clocking out'. Leave event_type null for a normal complete description of work already done — most messages are this case. When event_type is \"start\", duration_minutes should be null.")
        appendLine("Set miles if the host states a distance driven (e.g. 'drove 12 miles to pick up supplies') — a separate business-mileage tax deduction, not the hours above, so extract it whenever mentioned even alongside a normal task/duration. Leave miles null if no distance is mentioned.")
        appendLine("If the host mentions when the work happened relative to now (e.g. \"4 hours ago\", \"this morning\", \"last night\", \"yesterday\") or at a specific clock time (e.g. \"at 3pm\"), call get_current_time first. compute_time_before/compute_time_after take amount_minutes only — always minutes, never hours or days — so if the host's amount isn't already in minutes, call convert_to_minutes first (e.g. \"4 hours\" -> convert_to_minutes(amount=4, unit=\"hours\")) and use its result as amount_minutes. Never compute any of this arithmetic yourself — always call the tools. Leave resolved_activity_date_iso null if the host mentions no time reference at all — most messages are this case.")
        appendLine("Capture is meant to be fast, not a conversation: fill in every field you can confidently determine, and leave any field you genuinely can't determine as null. Never withhold a field or ask a question — the host reviews and fills in gaps themselves afterward, so a partial entry is the correct output, not a failure.")
        appendLine("Once you have everything you can determine, call record_entry exactly once with the final result.")
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
