package com.hejitech.contempo.agent

import android.graphics.Bitmap
import com.hejitech.contempo.data.traced
import com.hejitech.core.data.EntryRepository
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
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
 * Everything runs on the device (no cloud inference, by product decision 2026-10-16): the bundled
 * Qwen3-0.6B model is always available from first launch, and the larger downloadable Gemma
 * model takes over once present — it's also the only tier that can read photos (see LiteRtLlm).
 * When the model can't help, callers fall back to manual entry; nothing leaves the device.
 */
private const val PHOTO_MODEL_MISSING =
    "Reading photos needs the larger on-device model — download it in Settings → On-device AI."

class AgentClient(
    private val onDeviceLlm: OnDeviceLlm,
    private val entryRepository: EntryRepository,
) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    /** Writes [OnDeviceLlm.lastCallTokenUsage] to this account's weekly on-device counters. */
    private suspend fun recordOnDeviceUsageIfAvailable() {
        onDeviceLlm.lastCallTokenUsage.value?.let {
            runCatching { entryRepository.recordOnDeviceTokenUsage(it.inputTokens, it.outputTokens) }
        }
    }

    /** [onStage] is a best-effort progress signal for the caller to render (see ParsingStage). */
    suspend fun parseEntry(
        rawText: String,
        knownProperties: List<String>,
        onStage: (ParsingStage) -> Unit = {},
    ): ParseOutcome = traced("llm_parse_entry") {
        onStage(ParsingStage.TRYING_ON_DEVICE)
        val outcome = onDeviceExtractEntry(rawText, knownProperties)
            ?.takeUnless { (it as? ParseOutcome.Success)?.result?.draft?.isEffectivelyEmpty == true }
            ?: RuleBasedEntryParser.parse(rawText, knownProperties)?.let { ParseOutcome.Success(ParseResult(it, ParseSource.RULES)) }
            ?: ParseOutcome.Failure("Couldn't read this one — fill in the entry manually.")
        putAttribute("outcome", if (outcome is ParseOutcome.Success) "success" else "failure")
        outcome
    }

    /** Drafts an entry from a just-taken photo (needs the downloaded multimodal model). */
    suspend fun draftEntryFromPhoto(bitmap: Bitmap, knownProperties: List<String>): ParseOutcome =
        onDeviceDraftFromPhoto(bitmap, buildPhotoEntryPrompt(knownProperties))
            ?: ParseOutcome.Failure(PHOTO_MODEL_MISSING + " Fill in the entry manually; the photo is still attached as evidence.")

    /** Reads one odometer number from a photo (mileage trips' photo method). */
    suspend fun readOdometerFromPhoto(bitmap: Bitmap): OdometerReadOutcome =
        onDeviceReadOdometer(bitmap, buildOdometerPrompt())
            ?: OdometerReadOutcome.Failure(PHOTO_MODEL_MISSING + " Enter the mileage manually.")

    /** Odometer reading or general work evidence — decides which photo flow runs next. */
    suspend fun classifyPhotoIntent(bitmap: Bitmap): PhotoIntentOutcome =
        onDeviceClassifyPhotoIntent(bitmap, buildPhotoIntentPrompt())
            ?: PhotoIntentOutcome.Failure(PHOTO_MODEL_MISSING + " Fill in the entry manually; the photo is still attached as evidence.")

    /** Text chat with live generation progress via [onEvent]. */
    suspend fun askQuestionStream(
        history: List<ChatMessage>,
        question: String,
        stats: UserStats,
        attachedEntries: List<Entry> = emptyList(),
        onEvent: (GenerationEvent) -> Unit,
    ): AskOutcome =
        onDeviceAskQuestionStream(buildChatPrompt(history, question, stats, attachedEntries), onEvent)
            ?: AskOutcome.Failure("The on-device model isn't available right now — try again in a moment.")

    suspend fun askQuestion(
        history: List<ChatMessage>,
        question: String,
        stats: UserStats,
        image: Bitmap? = null,
        attachedEntries: List<Entry> = emptyList(),
    ): AskOutcome {
        val prompt = buildChatPrompt(history, question, stats, attachedEntries)
        if (image != null) {
            return onDeviceAskQuestionWithImage(image, prompt) ?: AskOutcome.Failure(PHOTO_MODEL_MISSING)
        }
        return onDeviceAskQuestion(prompt)
            ?: AskOutcome.Failure("The on-device model isn't available right now — try again in a moment.")
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
