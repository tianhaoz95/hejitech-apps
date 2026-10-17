package com.hejitech.contempo.agent

import android.app.DownloadManager
import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.ExperimentalApi
import com.google.ai.edge.litertlm.ExperimentalFlags
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.ToolCall
import com.google.ai.edge.litertlm.ToolProvider
import com.google.ai.edge.litertlm.tool
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.ByteArrayOutputStream
import java.io.File
import org.json.JSONObject
import java.time.Duration
import java.time.Instant

/**
 * Generous enough for getCurrentTime + up to two time-offset calls + the terminal
 * recordEntry call, with slack — while guaranteeing the manual tool loop in
 * [LiteRtLlm.extractEntryDraft] always terminates (mirrors the SDK's own
 * RECURRING_TOOL_CALL_LIMIT=25 at a scale appropriate to this task).
 */
private const val MAX_TOOL_LOOP_ITERATIONS = 6

/**
 * conversation.sendMessage() has been observed to just never return on some
 * devices — the native call gets wedged with no exception and no callback,
 * so without a bound here a single capture hangs the Capture screen forever
 * (see [Conversation.sendMessageBounded]'s kdoc). 45s is generous for a
 * single CPU-backend Gemma round (including a tool-call round, which is
 * shorter than a full prose response) while still giving up in bounded time
 * rather than leaving the user staring at a spinner indefinitely.
 */
private const val ON_DEVICE_RESPONSE_TIMEOUT_MS = 45_000L

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
/** Bundled tier: Qwen3-0.6B, shipped in the install-time `qwen_model` asset pack (scripts/fetch-models.sh). */
private const val BUNDLED_MODEL_ASSET = "Qwen3-0.6B.litertlm"

/**
 * Two tiers, the way Voxbrief does it: a small bundled model that works offline from first launch
 * (Qwen3-0.6B, copied once out of the asset pack because LiteRT-LM needs a file path), and the
 * larger Gemma model the user can download from Settings, which takes over once present and is
 * the only one that can read photos. The bundled tier is prompted for JSON (parsed by our own
 * code); tool calling stays on the large model.
 */
class LiteRtLlm(
    context: Context,
    private val scope: CoroutineScope,
) : OnDeviceLlm {
    private val appContext = context.applicationContext
    private val downloader = ModelDownloader(appContext)

    private val _status = MutableStateFlow<OnDeviceModelUiStatus>(OnDeviceModelUiStatus.Checking)
    override val status: StateFlow<OnDeviceModelUiStatus> = _status.asStateFlow()

    private val _lastCallTokenUsage = MutableStateFlow<TokenUsage?>(null)
    override val lastCallTokenUsage: StateFlow<TokenUsage?> = _lastCallTokenUsage.asStateFlow()

    /**
     * conversation.getBenchmarkInfo() reports lastPrefillTokenCount (input)/
     * lastDecodeTokenCount (output) for whatever call just ran on this
     * Conversation — every call site here creates a fresh Conversation used
     * exactly once, so there's no cross-call contamination to worry about.
     * Best-effort: a benchmark-info failure should never affect the actual
     * generation result, so this is called after the real response is
     * already in hand and any exception here is swallowed.
     */
    @OptIn(ExperimentalApi::class)
    private fun recordTokenUsage(conversation: Conversation) {
        runCatching { conversation.getBenchmarkInfo() }.getOrNull()?.let {
            _lastCallTokenUsage.value = TokenUsage(it.lastPrefillTokenCount, it.lastDecodeTokenCount)
        }
    }

    // Loading a ~2.6GB model is expensive — built once, reused for the
    // process lifetime, guarded by a mutex since generate() calls can race
    // the first load.
    private var engine: Engine? = null
    private var bundledEngine: Engine? = null
    private val engineMutex = Mutex()
    private val bundledModelFile = File(appContext.filesDir, "models/$BUNDLED_MODEL_ASSET")

    private val _bundledModelReady = MutableStateFlow(false)
    override val bundledModelReady: StateFlow<Boolean> = _bundledModelReady.asStateFlow()

    /** True while the downloaded large model is the one answering. */
    private val usingLargeModel: Boolean get() = downloader.isDownloaded()

    // Schemas derived once via reflection over EntryTools — see that file's kdoc for
    // why its function bodies are never actually invoked.
    private val entryToolProvider: ToolProvider = tool(EntryTools)

    init {
        scope.launch {
            prepareBundledModel()
            // The large model is opt-in (Settings → Download); resume one already under way.
            when {
                downloader.isDownloaded() -> _status.value = OnDeviceModelUiStatus.Available
                downloader.activeDownloadId() != null -> trackDownload(downloader.activeDownloadId()!!)
                else -> _status.value = OnDeviceModelUiStatus.NotDownloaded
            }
        }
    }

    /** Copies the bundled model out of the asset pack once (or after an app update changes its size). */
    private suspend fun prepareBundledModel() = withContext(Dispatchers.IO) {
        runCatching {
            val expected = appContext.assets.openFd(BUNDLED_MODEL_ASSET).use { it.length }
            if (!bundledModelFile.exists() || bundledModelFile.length() != expected) {
                bundledModelFile.parentFile?.mkdirs()
                val tmp = File(bundledModelFile.path + ".tmp")
                appContext.assets.open(BUNDLED_MODEL_ASSET).use { input -> tmp.outputStream().use { input.copyTo(it, 1 shl 20) } }
                tmp.renameTo(bundledModelFile)
            }
            _bundledModelReady.value = true
        }.onFailure {
            // openFd fails for compressed assets; fall back to a plain copy check.
            runCatching {
                if (!bundledModelFile.exists()) {
                    bundledModelFile.parentFile?.mkdirs()
                    appContext.assets.open(BUNDLED_MODEL_ASSET).use { input -> bundledModelFile.outputStream().use { input.copyTo(it, 1 shl 20) } }
                }
                _bundledModelReady.value = true
            }.onFailure { e -> Log.w(TAG, "bundled model unavailable", e) }
        }
    }

    /** Starts (or retries) the opt-in download of the large model. */
    override fun retry() {
        scope.launch {
            checkAndMaybeDownload()
        }
    }

    override fun deleteDownloadedModel() {
        scope.launch {
            engineMutex.withLock {
                engine?.close()
                engine = null
            }
            downloader.deleteDownloadedModel()
            // Back to the bundled model; NotDownloaded shows the Download button again.
            _status.value = OnDeviceModelUiStatus.NotDownloaded
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
                    val bytesPerSecond = if (elapsedSeconds > 1.0 && bytesSinceBaseline > 0) {
                        bytesSinceBaseline / elapsedSeconds
                    } else {
                        null
                    }
                    val eta = if (bytesPerSecond != null && snapshot.totalBytes > 0) {
                        ((snapshot.totalBytes - snapshot.bytesDownloaded) / bytesPerSecond)
                            .toLong()
                            .coerceAtLeast(0)
                    } else {
                        null
                    }
                    _status.value = OnDeviceModelUiStatus.Downloading(
                        bytesDownloaded = snapshot.bytesDownloaded,
                        totalBytes = snapshot.totalBytes.takeIf { it > 0 } ?: ModelDownloader.MODEL_SIZE_BYTES,
                        bytesPerSecond = bytesPerSecond,
                        etaSeconds = eta,
                    )
                }
            }
            delay(750)
        }
    }

    /**
     * The engine for the best available tier: the downloaded large model, else the bundled one.
     * [needsVision] calls (photos) only ever get the large model.
     */
    @OptIn(ExperimentalApi::class)
    private suspend fun ensureEngine(needsVision: Boolean = false): Engine? = engineMutex.withLock {
        if (downloader.isDownloaded()) {
            engine?.let { return@withLock it }
            bundledEngine?.close()
            bundledEngine = null
            return@withLock try {
                withContext(Dispatchers.IO) {
                    ExperimentalFlags.enableBenchmark = true
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
        if (needsVision) return@withLock null
        bundledEngine?.let { return@withLock it }
        if (!_bundledModelReady.value) return@withLock null
        try {
            withContext(Dispatchers.IO) {
                ExperimentalFlags.enableBenchmark = true
                val config = EngineConfig(
                    modelPath = bundledModelFile.absolutePath,
                    backend = Backend.CPU(),
                    visionBackend = null,
                    audioBackend = null,
                    // Converted with a 1280-token KV cache; capping keeps memory small.
                    maxNumTokens = 1280,
                    maxNumImages = null,
                    cacheDir = appContext.cacheDir.absolutePath,
                )
                Engine(config).also { it.initialize() }
            }.also { bundledEngine = it }
        } catch (e: Exception) {
            Log.w(TAG, "couldn't load the bundled model", e)
            null
        }
    }

    /** Qwen3 thinks out loud unless told not to; strip whatever thinking block it emits. */
    private fun forBundled(prompt: String): String = if (usingLargeModel) prompt else "/no_think\n$prompt"

    override suspend fun generateText(prompt: String): String? = generate(Contents.of(forBundled(prompt)))?.let(::stripThinking)

    /**
     * Uses the plain MessageCallback overload of sendMessageAsync, not the
     * Flow<Message> one — confirmed on-device that the Flow overload's
     * internal callbackFlow bridging throws a NoSuchMethodError on
     * SendChannel.close$default (a kotlinx-coroutines ABI mismatch between
     * what litertlm-android:0.14.0 was compiled against and what's in this
     * app's dependency graph). The plain callback path never goes through
     * that bridging code, and streams genuinely incrementally: confirmed
     * live, ~40 separate chunks for a two-sentence answer, each a new
     * fragment of text (not the cumulative total) arriving every ~30-90ms.
     */
    override suspend fun generateTextStream(prompt: String, onEvent: (GenerationEvent) -> Unit): String? {
        val eng = ensureEngine() ?: return null
        return try {
            withContext(Dispatchers.Default) {
                eng.createConversation().use { conversation ->
                    onEvent(GenerationEvent.Prefilling)
                    conversation.sendMessageAsyncBounded(forBundled(prompt)) { event ->
                        onEvent(if (event is GenerationEvent.Streaming) event.copy(textSoFar = stripThinking(event.textSoFar)) else event)
                    }?.let(::stripThinking).also { recordTokenUsage(conversation) }
                }
            }
        } catch (e: Exception) {
            null
        }
    }

    override suspend fun generateFromImage(bitmap: Bitmap, prompt: String): String? {
        val jpegBytes = withContext(Dispatchers.Default) {
            ByteArrayOutputStream().use { stream ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, stream)
                stream.toByteArray()
            }
        }
        return generate(Contents.of(Content.ImageBytes(jpegBytes), Content.Text(prompt)), needsVision = true)
    }

    @OptIn(ExperimentalApi::class)
    override suspend fun extractEntryDraft(rawText: String, knownProperties: List<String>): EntryDraft? {
        if (!usingLargeModel) return extractEntryDraftAsJson(rawText, knownProperties)
        val eng = ensureEngine() ?: return null
        return try {
            withContext(Dispatchers.Default) {
                val config = ConversationConfig(
                    systemInstruction = Contents.of(buildEntryToolSystemPrompt(knownProperties)),
                    tools = listOf(entryToolProvider),
                    automaticToolCalling = false,
                )
                eng.createConversation(config).use { conversation ->
                    // Summed across every sendMessageBounded round below (a
                    // tool-calling extraction is often 2+ round trips —
                    // get_current_time/convert_to_minutes before the terminal
                    // record_entry call), since getBenchmarkInfo() only
                    // reports the *last* call's tokens, not a running total —
                    // an unsummed single read would silently undercount any
                    // capture that needed more than one round.
                    var totalInputTokens = 0
                    var totalOutputTokens = 0
                    fun accumulateTokenUsage() {
                        runCatching { conversation.getBenchmarkInfo() }.getOrNull()?.let {
                            totalInputTokens += it.lastPrefillTokenCount
                            totalOutputTokens += it.lastDecodeTokenCount
                        }
                    }

                    var message = conversation.sendMessageBounded { sendMessage(rawText) }
                        ?: return@withContext null
                    accumulateTokenUsage()
                    repeat(MAX_TOOL_LOOP_ITERATIONS) {
                        val recordCall = message.toolCalls.firstOrNull { it.name == "record_entry" }
                        if (recordCall != null) {
                            _lastCallTokenUsage.value = TokenUsage(totalInputTokens, totalOutputTokens)
                            return@withContext entryDraftFromArguments(recordCall.arguments)
                        }

                        val pending = message.toolCalls
                        // Model replied in prose instead of calling a tool — no
                        // structured output to extract, same as a malformed-JSON
                        // failure in the previous text-based approach.
                        if (pending.isEmpty()) return@withContext null

                        val responses = pending.map { call ->
                            Content.ToolResponse(call.name, dispatchDeterministicTool(call))
                        }
                        message = conversation.sendMessageBounded {
                            sendMessage(Message.tool(Contents.of(*responses.toTypedArray())))
                        } ?: return@withContext null
                        accumulateTokenUsage()
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

    /**
     * The bundled tier's entry parse: one JSON object back, our own code builds the draft (the
     * Voxbrief way). Time references are resolved against the given current time rather than tools.
     */
    private suspend fun extractEntryDraftAsJson(rawText: String, knownProperties: List<String>): EntryDraft? {
        val prompt = buildString {
            append(buildEntryToolSystemPrompt(knownProperties).lineSequence().filterNot { "call " in it || "tool" in it }.joinToString("\n"))
            appendLine()
            appendLine("Current time: ${Instant.now()}. Resolve any time reference to an absolute ISO-8601 timestamp yourself.")
            appendLine("Reply with only one JSON object with these keys: property, task, duration_minutes, category (one of maintenance, turnover, guest_communication, supply_run, admin, other), event_type (start, stop or null), miles, resolved_activity_date_iso. Use null for anything you can't determine.")
            appendLine("Host's message: \"$rawText\"")
        }
        val text = generateText(prompt) ?: return null
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        if (start < 0 || end <= start) return null
        val modelDraft = runCatching {
            val o = JSONObject(text.substring(start, end + 1))
            fun str(k: String) = o.optString(k).takeIf { o.has(k) && !o.isNull(k) && it.isNotBlank() && it != "null" }
            fun num(k: String) = if (o.has(k) && !o.isNull(k)) o.optDouble(k).takeIf { !it.isNaN() } else null
            EntryDraft(
                property = str("property"),
                task = str("task"),
                durationMinutes = num("duration_minutes")?.toInt()?.takeIf { it > 0 },
                category = str("category"),
                eventType = str("event_type")?.takeIf { it == "start" || it == "stop" },
                miles = num("miles")?.takeIf { it >= 0 },
                resolvedActivityDateIso = str("resolved_activity_date_iso"),
            )
        }.getOrNull() ?: return null
        return RuleBasedEntryParser.refineSmallModelDraft(modelDraft, rawText, knownProperties)
    }

    private suspend fun generate(contents: Contents, needsVision: Boolean = false): String? {
        val eng = ensureEngine(needsVision) ?: return null
        return try {
            withContext(Dispatchers.Default) {
                eng.createConversation().use { conversation ->
                    val response = conversation.sendMessageBounded { sendMessage(contents) }
                        ?: return@withContext null
                    recordTokenUsage(conversation)
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

/**
 * conversation.sendMessage() has been observed to just never return on some
 * devices (no exception, no result) — with no timeout here, that wedges the
 * calling coroutine forever, which is exactly what made voice capture hang
 * indefinitely once it reached parsing (see ON_DEVICE_RESPONSE_TIMEOUT_MS's
 * kdoc). withTimeoutOrNull only stops *waiting* on the call, so on a timeout
 * this also calls cancelProcess() to actually unblock the native side —
 * otherwise the same wedged conversation would just time out again on every
 * later call built on top of it.
 */
private suspend fun Conversation.sendMessageBounded(block: suspend Conversation.() -> Message): Message? =
    withTimeoutOrNull(ON_DEVICE_RESPONSE_TIMEOUT_MS) { block() } ?: run {
        Log.w(TAG, "on-device response timed out after ${ON_DEVICE_RESPONSE_TIMEOUT_MS}ms — cancelling")
        runCatching { cancelProcess() }
        null
    }

/**
 * Same wedge/timeout risk as sendMessageBounded, adapted for the callback-
 * based async API: accumulates each chunk (onMessage delivers a new
 * fragment, not the running total) and fires [onEvent] live as they arrive,
 * resolving to the full accumulated text on completion. Deliberately does
 * NOT use sendMessageAsync's Flow<Message> overload — see
 * generateTextStream's kdoc for the real crash that ruled that out.
 */
private suspend fun Conversation.sendMessageAsyncBounded(
    text: String,
    onEvent: (GenerationEvent) -> Unit,
): String? {
    val accumulated = StringBuilder()
    var chunkCount = 0
    val result = withTimeoutOrNull(ON_DEVICE_RESPONSE_TIMEOUT_MS) {
        suspendCancellableCoroutine<String> { cont ->
            sendMessageAsync(
                text,
                object : MessageCallback {
                    override fun onMessage(message: Message) {
                        val chunk = message.contents.contents
                            .filterIsInstance<Content.Text>()
                            .joinToString("") { it.text }
                        accumulated.append(chunk)
                        chunkCount++
                        onEvent(GenerationEvent.Streaming(accumulated.toString(), chunkCount))
                    }

                    override fun onDone() {
                        if (cont.isActive) cont.resumeWith(Result.success(accumulated.toString()))
                    }

                    override fun onError(throwable: Throwable) {
                        if (cont.isActive) cont.resumeWith(Result.failure(throwable))
                    }
                },
                emptyMap(),
            )
        }
    }
    if (result == null) {
        Log.w(TAG, "on-device streaming response timed out after ${ON_DEVICE_RESPONSE_TIMEOUT_MS}ms — cancelling")
        runCatching { cancelProcess() }
    }
    return result
}

/** Removes Qwen3's `<think>…</think>` block (empty with /no_think) from a response. */
internal fun stripThinking(text: String): String =
    text.replace(Regex("(?s)<think>.*?(</think>|$)"), "").trim()
