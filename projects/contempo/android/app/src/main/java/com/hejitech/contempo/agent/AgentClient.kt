package com.hejitech.contempo.agent

import android.graphics.Bitmap
import com.hejitech.contempo.data.traced
import com.hejitech.core.data.EntryRepository
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.supabase.ContempoBackend
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.Json
import java.time.Instant

/**
 * Two-tier entry parsing + chat, per reports/mvp-scope-v0.html Section 8:
 *
 *  1. Try the on-device model (see OnDeviceLlm — currently Gemma 4 E2B via
 *     LiteRT-LM) — free, no network round trip. This class only ever talks
 *     to the generic [OnDeviceLlm] interface, never a specific runtime's
 *     types directly, so swapping runtimes doesn't touch this file.
 *     parseEntry gets a real schema guarantee on-device via LiteRT-LM's
 *     tool-calling (see OnDeviceLlm.extractEntryDraft / LiteRtLlm /
 *     EntryTools) — no text-JSON parsing involved. Photo drafting
 *     (draftEntryFromPhoto) and askQuestion still just want plain text back,
 *     the former best-effort-parsed as JSON, so neither goes through the
 *     tool-calling path.
 *
 *  2. Cloud fallback: the parseEntry / askAgent Genkit flows in
 *     backend/functions/src/flows, which do get a real enforced
 *     response schema server-side (parseEntry) or a controllable prompt
 *     (askAgent).
 *
 * Which tier actually runs is governed by the caller-supplied
 * [inferencePreference] (backed by AiSettingsStore, user-controlled from
 * Settings) — see InferencePreference's kdoc. Notably, ON_DEVICE_ONLY does
 * NOT fall back to cloud on failure: a silent fallback can never prove the
 * on-device model actually works, which is the whole point of that setting.
 */
class AgentClient(
    private val onDeviceLlm: OnDeviceLlm,
    private val entryRepository: EntryRepository,
    private val inferencePreference: () -> InferencePreference,
) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    /**
     * Writes whatever [OnDeviceLlm.lastCallTokenUsage] holds right now to
     * this account's weekly on-device counters — called at the end of every
     * private onDevice* wrapper below, right after a successful (non-null)
     * result, so it always reflects the call that just happened. Cloud
     * usage needs no client-side equivalent — see EntryRepository.
     * observeCloudTokenUsage's kdoc — it's written server-side instead.
     */
    private suspend fun recordOnDeviceUsageIfAvailable() {
        onDeviceLlm.lastCallTokenUsage.value?.let {
            runCatching { entryRepository.recordOnDeviceTokenUsage(it.inputTokens, it.outputTokens) }
        }
    }

    /**
     * [onStage] is a best-effort progress signal for the caller to render
     * (see ParsingStage) — tied to which branch is actually being taken,
     * not a synthetic timer, so it stays honest about a slow on-device→
     * cloud fallback instead of just reading as hung.
     */
    suspend fun parseEntry(
        rawText: String,
        knownProperties: List<String>,
        onStage: (ParsingStage) -> Unit = {},
    ): ParseOutcome = traced("llm_parse_entry", mapOf("inference_preference" to inferencePreference().name)) {
        val outcome = when (inferencePreference()) {
            InferencePreference.CLOUD_ONLY -> {
                onStage(ParsingStage.STRUCTURING)
                putAttribute("path_taken", "cloud")
                cloudParseEntry(rawText, knownProperties)
            }

            InferencePreference.ON_DEVICE_ONLY -> {
                onStage(ParsingStage.TRYING_ON_DEVICE)
                putAttribute("path_taken", "on_device")
                onDeviceExtractEntry(rawText, knownProperties)
                    ?: ParseOutcome.Failure("On-device model unavailable — no cloud fallback (On-device only is selected in Settings).")
            }

            InferencePreference.PREFER_ON_DEVICE -> {
                onStage(ParsingStage.TRYING_ON_DEVICE)
                val onDeviceResult = onDeviceExtractEntry(rawText, knownProperties)
                    ?.takeUnless { (it as? ParseOutcome.Success)?.result?.draft?.isEffectivelyEmpty == true }
                onDeviceResult?.also { putAttribute("path_taken", "on_device") } ?: run {
                    onStage(ParsingStage.FALLING_BACK_TO_CLOUD)
                    putAttribute("path_taken", "cloud_fallback")
                    cloudParseEntry(rawText, knownProperties)
                }
            }
        }
        putAttribute("outcome", if (outcome is ParseOutcome.Success) "success" else "failure")
        outcome
    }

    /**
     * Drafts an entry from a just-taken photo — the on-device model's
     * multimodal (image) input via OnDeviceLlm.generateFromImage. There is
     * deliberately no cloud vision fallback yet (see reports/prd-status-v0
     * — "multimodal input" is flagged not-started backend-side too): a photo
     * a host takes is exactly the kind of thing that should never leave the
     * device silently, and building a real cloud vision flow is future work.
     * CLOUD_ONLY and a failed PREFER_ON_DEVICE both surface an honest
     * message instead of guessing.
     */
    suspend fun draftEntryFromPhoto(bitmap: Bitmap, knownProperties: List<String>): ParseOutcome {
        val prompt = buildPhotoEntryPrompt(knownProperties)
        return when (inferencePreference()) {
            InferencePreference.CLOUD_ONLY ->
                ParseOutcome.Failure("Photo drafting isn't available in Cloud-only mode yet — switch to On-device only or Prefer on-device in Settings, or fill in the entry manually.")

            InferencePreference.ON_DEVICE_ONLY ->
                onDeviceDraftFromPhoto(bitmap, prompt)
                    ?: ParseOutcome.Failure("On-device model unavailable for photo drafting — no cloud fallback (On-device only is selected in Settings).")

            InferencePreference.PREFER_ON_DEVICE ->
                onDeviceDraftFromPhoto(bitmap, prompt)
                    ?: ParseOutcome.Failure("This device's on-device model isn't ready for photo understanding yet, and cloud photo drafting isn't built yet — fill in the entry manually; the photo is still attached as evidence.")
        }
    }

    /**
     * Reads a single odometer number from a photo — used by the mileage-
     * trip photo capture method (see MileageTripCoordinator): the first
     * photo of a trip becomes odometerStart, the next one becomes
     * odometerEnd, and the two are diffed. Same CLOUD_ONLY/ON_DEVICE_ONLY/
     * PREFER_ON_DEVICE honesty policy as draftEntryFromPhoto — no cloud
     * vision fallback yet, so a failed attempt says so rather than guessing.
     * Deliberately its own method rather than reusing draftEntryFromPhoto:
     * this reads one plain number, not a structured EntryDraft.
     */
    suspend fun readOdometerFromPhoto(bitmap: Bitmap): OdometerReadOutcome {
        val prompt = buildOdometerPrompt()
        return when (inferencePreference()) {
            InferencePreference.CLOUD_ONLY ->
                OdometerReadOutcome.Failure("Odometer reading isn't available in Cloud-only mode yet — switch to On-device only or Prefer on-device in Settings, or enter the mileage manually.")

            InferencePreference.ON_DEVICE_ONLY ->
                onDeviceReadOdometer(bitmap, prompt)
                    ?: OdometerReadOutcome.Failure("On-device model unavailable for odometer reading — no cloud fallback (On-device only is selected in Settings).")

            InferencePreference.PREFER_ON_DEVICE ->
                onDeviceReadOdometer(bitmap, prompt)
                    ?: OdometerReadOutcome.Failure("This device's on-device model isn't ready for photo understanding yet, and cloud odometer reading isn't built yet — enter the mileage manually.")
        }
    }

    /**
     * Classifies a just-taken photo as an odometer reading or general work
     * evidence — a fast, single-word-response call that decides which of
     * readOdometerFromPhoto/draftEntryFromPhoto to run next (see
     * CaptureViewModel.processCapturedPhoto), so the host no longer has to
     * pick the right capture button before taking the photo. Same
     * CLOUD_ONLY/ON_DEVICE_ONLY/PREFER_ON_DEVICE honesty policy as the other
     * two photo methods — no cloud vision fallback yet.
     */
    suspend fun classifyPhotoIntent(bitmap: Bitmap): PhotoIntentOutcome {
        val prompt = buildPhotoIntentPrompt()
        return when (inferencePreference()) {
            InferencePreference.CLOUD_ONLY ->
                PhotoIntentOutcome.Failure("Photo capture isn't available in Cloud-only mode yet — switch to On-device only or Prefer on-device in Settings, or fill in the entry manually.")

            InferencePreference.ON_DEVICE_ONLY ->
                onDeviceClassifyPhotoIntent(bitmap, prompt)
                    ?: PhotoIntentOutcome.Failure("On-device model unavailable for photo capture — no cloud fallback (On-device only is selected in Settings).")

            InferencePreference.PREFER_ON_DEVICE ->
                onDeviceClassifyPhotoIntent(bitmap, prompt)
                    ?: PhotoIntentOutcome.Failure("This device's on-device model isn't ready for photo understanding yet — fill in the entry manually; the photo is still attached as evidence.")
        }
    }

    /**
     * Text-only variant of askQuestion that reports live generation progress
     * via [onEvent] on the on-device path (see OnDeviceLlm.generateTextStream)
     * — no image param, since photo questions don't have a verified streaming
     * story yet (see askQuestion's own image handling). Cloud calls (CLOUD_ONLY,
     * or PREFER_ON_DEVICE's fallback) never stream — [onEvent] simply won't
     * fire for those, same as an ordinary non-streaming answer.
     */
    suspend fun askQuestionStream(
        history: List<ChatMessage>,
        question: String,
        stats: UserStats,
        attachedEntries: List<Entry> = emptyList(),
        onEvent: (GenerationEvent) -> Unit,
    ): AskOutcome {
        val prompt = buildChatPrompt(history, question, stats, attachedEntries)
        return when (inferencePreference()) {
            InferencePreference.CLOUD_ONLY ->
                cloudAskQuestion(history, question, stats, attachedEntries)

            InferencePreference.ON_DEVICE_ONLY ->
                onDeviceAskQuestionStream(prompt, onEvent)
                    ?: AskOutcome.Failure("On-device model unavailable — no cloud fallback (On-device only is selected in Settings).")

            InferencePreference.PREFER_ON_DEVICE ->
                onDeviceAskQuestionStream(prompt, onEvent) ?: cloudAskQuestion(history, question, stats, attachedEntries)
        }
    }

    suspend fun askQuestion(
        history: List<ChatMessage>,
        question: String,
        stats: UserStats,
        image: Bitmap? = null,
        attachedEntries: List<Entry> = emptyList(),
    ): AskOutcome {
        val prompt = buildChatPrompt(history, question, stats, attachedEntries)
        if (image != null) {
            // Same honesty policy as draftEntryFromPhoto: no cloud vision
            // fallback yet, so CLOUD_ONLY and a failed on-device attempt both
            // surface an explicit message instead of silently dropping the
            // photo and answering text-only.
            return when (inferencePreference()) {
                InferencePreference.CLOUD_ONLY ->
                    AskOutcome.Failure("Photo questions aren't available in Cloud-only mode yet — switch to On-device only or Prefer on-device in Settings.")

                InferencePreference.ON_DEVICE_ONLY ->
                    onDeviceAskQuestionWithImage(image, prompt)
                        ?: AskOutcome.Failure("On-device model unavailable for photo questions — no cloud fallback (On-device only is selected in Settings).")

                InferencePreference.PREFER_ON_DEVICE ->
                    onDeviceAskQuestionWithImage(image, prompt)
                        ?: AskOutcome.Failure("This device's on-device model isn't ready for photo questions yet, and cloud photo questions aren't built yet.")
            }
        }
        return when (inferencePreference()) {
            InferencePreference.CLOUD_ONLY ->
                cloudAskQuestion(history, question, stats, attachedEntries)

            InferencePreference.ON_DEVICE_ONLY ->
                onDeviceAskQuestion(prompt)
                    ?: AskOutcome.Failure("On-device model unavailable — no cloud fallback (On-device only is selected in Settings).")

            InferencePreference.PREFER_ON_DEVICE ->
                onDeviceAskQuestion(prompt)
                    ?: cloudAskQuestion(history, question, stats, attachedEntries)
        }
    }

    /**
     * Cleans up a raw Whisper transcript (dictation typos, missing
     * punctuation/capitalization) before it's shown to the user or handed to
     * parseEntry. Deliberately always on-device (never gated by the user's
     * InferencePreference) — this is a lightweight formatting pass, not core
     * functionality, so on unsupported/not-yet-ready hardware the honest
     * behavior is "skip it, use the raw transcript as-is," not a silent
     * cloud call the user didn't ask for and doesn't expect billing for.
     */
    suspend fun cleanupTranscript(rawText: String): String {
        if (rawText.isBlank()) return rawText
        val cleaned = onDeviceLlm.generateText(buildCleanupPrompt(rawText)) ?: return rawText
        recordOnDeviceUsageIfAvailable()
        return cleaned
    }

    /**
     * Suggests a category for the entry-detail screen's auto-detect button,
     * from just the property/task text already on the entry — deliberately
     * on-device only regardless of the user's InferencePreference, same
     * reasoning as cleanupTranscript: this is a quality-of-life assist the
     * host can freely skip, edit, or override via the category dropdown
     * right next to it, not core parsing functionality that needs a cloud
     * fallback story.
     */
    suspend fun suggestCategory(propertyName: String, task: String): CategoryOutcome {
        val text = onDeviceLlm.generateText(buildCategoryPrompt(propertyName, task))
            ?: return CategoryOutcome.Failure("On-device model unavailable — try again in a moment.")
        recordOnDeviceUsageIfAvailable()
        val normalized = text.trim().lowercase().replace(' ', '_')
        val category = EntryCategory.entries.find { normalized.contains(it.firestoreValue) }
        return category?.let { CategoryOutcome.Success(it, ParseSource.ON_DEVICE) }
            ?: CategoryOutcome.Failure("Couldn't determine a category from this entry — try filling in more detail first.")
    }

    private fun buildCategoryPrompt(propertyName: String, task: String): String = buildString {
        appendLine("You classify a short-term-rental host's logged work into exactly one category.")
        appendLine("Categories: maintenance (repairs, upkeep), turnover (cleaning/prepping between guests), guest_communication (messaging/calls with guests), supply_run (buying/restocking supplies), admin (bookkeeping, scheduling, paperwork), other (anything else).")
        if (propertyName.isNotBlank()) appendLine("Property: $propertyName")
        appendLine("Task performed: ${task.ifBlank { "(not described)" }}")
        appendLine("Respond with ONLY one word: maintenance, turnover, guest_communication, supply_run, admin, or other. No punctuation, no commentary.")
    }

    private fun buildCleanupPrompt(rawText: String): String = buildString {
        appendLine("You clean up dictated speech-to-text for a short-term-rental host's work log entry.")
        appendLine("Fix likely transcription errors, punctuation, and capitalization.")
        appendLine("Keep the meaning and every detail exactly the same — never add or remove information.")
        appendLine("Respond with ONLY the corrected text, no commentary, no quotes, no markdown.")
        appendLine("Dictated text: \"$rawText\"")
    }

    private suspend fun onDeviceExtractEntry(rawText: String, knownProperties: List<String>): ParseOutcome? {
        // Null covers every on-device failure mode uniformly — model not
        // ready, no tool call produced, a generation error — same "expected
        // and non-fatal in PREFER_ON_DEVICE" contract the old text-JSON path
        // had. In ON_DEVICE_ONLY this null is what turns into the loud
        // failure above instead.
        val draft = onDeviceLlm.extractEntryDraft(rawText, knownProperties) ?: return null
        recordOnDeviceUsageIfAvailable()
        return ParseOutcome.Success(ParseResult(draft, ParseSource.ON_DEVICE))
    }

    /**
     * Null return here means "the model itself didn't run" (not ready, or
     * threw) — the only case readOdometerFromPhoto should override with its
     * generic "on-device model unavailable" message. A model that ran but
     * couldn't read a clear number (e.g. responded "unknown") is a distinct,
     * non-fatal outcome with its own actionable message — collapsing the two
     * into one null would tell the user to check AI Settings when the real
     * fix is just retaking the photo.
     */
    private suspend fun onDeviceReadOdometer(bitmap: Bitmap, prompt: String): OdometerReadOutcome? {
        return try {
            val text = onDeviceLlm.generateFromImage(bitmap, prompt) ?: return null
            recordOnDeviceUsageIfAvailable()
            val miles = extractNumber(text)
            if (miles != null) {
                OdometerReadOutcome.Success(miles, ParseSource.ON_DEVICE)
            } else {
                OdometerReadOutcome.Failure("Couldn't read a number from that photo — make sure the odometer digits are clearly visible and try again.")
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Null return means "the model itself didn't run" — same contract as
     * onDeviceReadOdometer. An ambiguous/unparseable reply is a distinct,
     * non-fatal Failure rather than null, so classifyPhotoIntent's caller
     * gets an actionable message instead of the generic "model unavailable"
     * one.
     */
    private suspend fun onDeviceClassifyPhotoIntent(bitmap: Bitmap, prompt: String): PhotoIntentOutcome? {
        return try {
            val text = onDeviceLlm.generateFromImage(bitmap, prompt) ?: return null
            recordOnDeviceUsageIfAvailable()
            val intent = when {
                text.contains("odometer", ignoreCase = true) -> PhotoIntent.ODOMETER
                text.contains("work", ignoreCase = true) -> PhotoIntent.WORK
                else -> null
            }
            intent?.let { PhotoIntentOutcome.Success(it, ParseSource.ON_DEVICE) }
                ?: PhotoIntentOutcome.Failure("Couldn't tell what that photo shows — try retaking it, or use manual entry.")
        } catch (e: Exception) {
            null
        }
    }

    private suspend fun onDeviceDraftFromPhoto(bitmap: Bitmap, prompt: String): ParseOutcome? {
        return try {
            val text = onDeviceLlm.generateFromImage(bitmap, prompt) ?: return null
            recordOnDeviceUsageIfAvailable()
            val draft = json.decodeFromString<EntryDraft>(extractJsonObject(text))
            ParseOutcome.Success(ParseResult(draft, ParseSource.ON_DEVICE))
        } catch (e: Exception) {
            null
        }
    }

    private suspend fun onDeviceAskQuestion(prompt: String): AskOutcome? {
        val text = onDeviceLlm.generateText(prompt) ?: return null
        recordOnDeviceUsageIfAvailable()
        return AskOutcome.Success(text, ParseSource.ON_DEVICE)
    }

    private suspend fun onDeviceAskQuestionStream(prompt: String, onEvent: (GenerationEvent) -> Unit): AskOutcome? {
        val text = onDeviceLlm.generateTextStream(prompt, onEvent) ?: return null
        recordOnDeviceUsageIfAvailable()
        return AskOutcome.Success(text, ParseSource.ON_DEVICE)
    }

    private suspend fun onDeviceAskQuestionWithImage(bitmap: Bitmap, prompt: String): AskOutcome? {
        val text = onDeviceLlm.generateFromImage(bitmap, prompt) ?: return null
        recordOnDeviceUsageIfAvailable()
        return AskOutcome.Success(text, ParseSource.ON_DEVICE)
    }

    private suspend fun cloudParseEntry(rawText: String, knownProperties: List<String>): ParseOutcome {
        return try {
            val payload = mapOf(
                "rawText" to rawText,
                "knownProperties" to knownProperties,
                "nowIso" to Instant.now().toString(),
            )
            val result = ContempoBackend.api("parse-entry", toJson(payload) as JsonObject)
            val draft = parseCallableResult(result)
                ?: return ParseOutcome.Failure("Cloud parse returned an unexpected shape")
            ParseOutcome.Success(ParseResult(draft, ParseSource.CLOUD))
        } catch (e: Exception) {
            ParseOutcome.Failure(e.message ?: "Cloud parsing failed")
        }
    }

    private suspend fun cloudAskQuestion(
        history: List<ChatMessage>,
        question: String,
        stats: UserStats,
        attachedEntries: List<Entry> = emptyList(),
    ): AskOutcome {
        return try {
            val payload = mapOf(
                "history" to history.map {
                    mapOf("role" to it.role.name.lowercase(), "text" to it.text)
                },
                "question" to question,
                "confirmedHours" to stats.confirmedHours,
                "thresholdHours" to stats.thresholdHours,
                "testName" to stats.testName,
                "attachedEntries" to attachedEntries.map { it.toChatContextMap() },
            )
            val result = ContempoBackend.api("ask-agent", toJson(payload) as JsonObject)
            val answer = (result["answer"] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
                ?: return AskOutcome.Failure("Cloud answer returned an unexpected shape")
            AskOutcome.Success(answer, ParseSource.CLOUD)
        } catch (e: Exception) {
            AskOutcome.Failure(e.message ?: "Cloud request failed")
        }
    }

    /** The Worker's parse-entry response (same shape as the old Genkit flow's EntryDraft). */
    private fun parseCallableResult(map: JsonObject): EntryDraft? {
        fun str(k: String) = (map[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
        return EntryDraft(
            property = str("property"),
            task = str("task"),
            durationMinutes = (map["durationMinutes"] as? JsonPrimitive)?.intOrNull,
            category = str("category"),
            eventType = str("eventType"),
            miles = (map["miles"] as? JsonPrimitive)?.doubleOrNull,
            resolvedActivityDateIso = str("resolvedActivityDateIso"),
        )
    }

    /** Plain Kotlin maps/lists/primitives → JSON for the Worker API. */
    private fun toJson(value: Any?): JsonElement = when (value) {
        null -> JsonNull
        is JsonElement -> value
        is Map<*, *> -> JsonObject(value.entries.associate { (k, v) -> k.toString() to toJson(v) })
        is Iterable<*> -> JsonArray(value.map(::toJson))
        is Number -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        else -> JsonPrimitive(value.toString())
    }


    private fun buildPhotoEntryPrompt(knownProperties: List<String>): String = buildString {
        appendLine("You extract a short-term-rental work-log entry from a photo a host just took of work they did.")
        if (knownProperties.isNotEmpty()) {
            appendLine("Known properties: ${knownProperties.joinToString(", ")}.")
        }
        appendLine("Look at the photo and describe the task it evidences (e.g. cleaning, a repair, a replaced part, a receipt) as a short, specific sentence.")
        appendLine("Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:")
        appendLine(
            """{"property": string|null, "task": string|null, "durationMinutes": integer|null, """ +
                """"category": one of "maintenance"|"turnover"|"guest_communication"|"supply_run"|"admin"|"other"|null}"""
        )
        appendLine("A photo alone often won't show duration or which property, and that's fine — fill in whatever you can determine (task/category are usually inferable from what's visible) and leave the rest null. Never withhold the draft to ask a question; the host reviews and fills in gaps themselves afterward.")
    }

    private fun buildChatPrompt(
        history: List<ChatMessage>,
        question: String,
        stats: UserStats,
        attachedEntries: List<Entry> = emptyList(),
    ): String = buildString {
        appendLine(
            "You are the in-app copilot for an app that helps short-term-rental hosts log hours " +
                "toward IRS material-participation tests (IRS Pub 925 / §1.469-5T). " +
                "You are not a lawyer or CPA and this is not tax or legal advice — say so plainly " +
                "for genuinely unsettled or fact-specific questions, and suggest confirming with a tax professional. " +
                "Do not fabricate case law, IRS rulings, or numbers you weren't given."
        )
        appendLine("This host is tracking toward the ${stats.testName} test: ${stats.confirmedHours} of ${stats.thresholdHours} hours confirmed so far.")
        if (attachedEntries.isNotEmpty()) {
            appendLine("The host attached these specific logged entries to ask about — ground your answer in them, don't ask which entry they mean:")
            attachedEntries.forEachIndexed { index, entry ->
                appendLine(
                    "${index + 1}. ${entry.propertyName.ifBlank { "(no property)" }} — " +
                        "${entry.task.ifBlank { "(no task)" }} (${entry.durationMinutes} min, ${entry.category}, " +
                        "${entry.activityDate.toDate().toInstant()})"
                )
            }
        }
        history.forEach { message ->
            val speaker = if (message.role == ChatRole.USER) "Host" else "You"
            appendLine("$speaker: ${message.text}")
        }
        appendLine("Host: $question")
        appendLine("Respond with plain text only — no markdown, no JSON.")
    }

    private fun Entry.toChatContextMap(): Map<String, Any?> = hashMapOf(
        "propertyName" to propertyName,
        "task" to task,
        "durationMinutes" to durationMinutes,
        "category" to category,
        "activityDate" to activityDate.toDate().toInstant().toString(),
    )

    private fun buildPhotoIntentPrompt(): String = buildString {
        appendLine("You are looking at a photo a short-term-rental host just took while logging work.")
        appendLine("Decide whether this is a close-up of a car's odometer / trip-mileage display (a dashboard gauge cluster showing a mileage number), or something else related to work performed (cleaning, a repair, a receipt, supplies, etc.).")
        appendLine("Respond with ONLY one word: odometer or work. No punctuation, no commentary.")
    }

    private fun buildOdometerPrompt(): String = buildString {
        appendLine("You are reading a car odometer or trip-mileage display from a photo.")
        appendLine("Respond with ONLY the number shown — digits only, no units, no commentary, no markdown.")
        appendLine("If you cannot clearly read a number in the photo, respond with exactly: unknown")
    }

    /** First number found in the model's response, or null (covers "unknown" and any non-numeric reply). */
    private fun extractNumber(text: String): Double? =
        Regex("""\d+(\.\d+)?""").find(text)?.value?.toDoubleOrNull()

    /** Strips markdown code fences etc. in case the on-device model adds them despite instructions not to. */
    private fun extractJsonObject(text: String): String {
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        return if (start >= 0 && end > start) text.substring(start, end + 1) else text
    }
}
