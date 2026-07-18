package com.hejitech.contempo.agent

import android.graphics.Bitmap
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.functions.FirebaseFunctionsException
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
    private val functions: FirebaseFunctions,
    private val inferencePreference: () -> InferencePreference,
) {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

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
    ): ParseOutcome {
        return when (inferencePreference()) {
            InferencePreference.CLOUD_ONLY -> {
                onStage(ParsingStage.STRUCTURING)
                cloudParseEntry(rawText, knownProperties)
            }

            InferencePreference.ON_DEVICE_ONLY -> {
                onStage(ParsingStage.TRYING_ON_DEVICE)
                onDeviceExtractEntry(rawText, knownProperties)
                    ?: ParseOutcome.Failure("On-device model unavailable — no cloud fallback (On-device only is selected in Settings).")
            }

            InferencePreference.PREFER_ON_DEVICE -> {
                onStage(ParsingStage.TRYING_ON_DEVICE)
                onDeviceExtractEntry(rawText, knownProperties) ?: run {
                    onStage(ParsingStage.FALLING_BACK_TO_CLOUD)
                    cloudParseEntry(rawText, knownProperties)
                }
            }
        }
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

    suspend fun askQuestion(history: List<ChatMessage>, question: String, stats: UserStats, image: Bitmap? = null): AskOutcome {
        val prompt = buildChatPrompt(history, question, stats)
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
                cloudAskQuestion(history, question, stats)

            InferencePreference.ON_DEVICE_ONLY ->
                onDeviceAskQuestion(prompt)
                    ?: AskOutcome.Failure("On-device model unavailable — no cloud fallback (On-device only is selected in Settings).")

            InferencePreference.PREFER_ON_DEVICE ->
                onDeviceAskQuestion(prompt)
                    ?: cloudAskQuestion(history, question, stats)
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
        return onDeviceLlm.generateText(buildCleanupPrompt(rawText)) ?: rawText
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

    private suspend fun onDeviceDraftFromPhoto(bitmap: Bitmap, prompt: String): ParseOutcome? {
        return try {
            val text = onDeviceLlm.generateFromImage(bitmap, prompt) ?: return null
            val draft = json.decodeFromString<EntryDraft>(extractJsonObject(text))
            ParseOutcome.Success(ParseResult(draft, ParseSource.ON_DEVICE))
        } catch (e: Exception) {
            null
        }
    }

    private suspend fun onDeviceAskQuestion(prompt: String): AskOutcome? {
        val text = onDeviceLlm.generateText(prompt) ?: return null
        return AskOutcome.Success(text, ParseSource.ON_DEVICE)
    }

    private suspend fun onDeviceAskQuestionWithImage(bitmap: Bitmap, prompt: String): AskOutcome? {
        val text = onDeviceLlm.generateFromImage(bitmap, prompt) ?: return null
        return AskOutcome.Success(text, ParseSource.ON_DEVICE)
    }

    private suspend fun cloudParseEntry(rawText: String, knownProperties: List<String>): ParseOutcome {
        return try {
            val payload = hashMapOf(
                "rawText" to rawText,
                "knownProperties" to knownProperties,
                "nowIso" to Instant.now().toString(),
            )
            val result = functions.getHttpsCallable("parseEntry").call(payload).await()
            // .getData() explicitly, not the .data property shorthand — Kotlin's
            // property sugar hits a visibility mismatch against this SDK's
            // compiled metadata even though the underlying getter is public.
            val draft = parseCallableResult(result.getData())
                ?: return ParseOutcome.Failure("Cloud parse returned an unexpected shape")
            ParseOutcome.Success(ParseResult(draft, ParseSource.CLOUD))
        } catch (e: FirebaseFunctionsException) {
            ParseOutcome.Failure(e.message ?: "Cloud parsing failed")
        } catch (e: Exception) {
            ParseOutcome.Failure(e.message ?: "Cloud parsing failed")
        }
    }

    private suspend fun cloudAskQuestion(history: List<ChatMessage>, question: String, stats: UserStats): AskOutcome {
        return try {
            val payload = hashMapOf(
                "history" to history.map {
                    hashMapOf("role" to it.role.name.lowercase(), "text" to it.text)
                },
                "question" to question,
                "confirmedHours" to stats.confirmedHours,
                "thresholdHours" to stats.thresholdHours,
                "testName" to stats.testName,
            )
            val result = functions.getHttpsCallable("askAgent").call(payload).await()
            @Suppress("UNCHECKED_CAST")
            val answer = (result.getData() as? Map<String, Any?>)?.get("answer") as? String
                ?: return AskOutcome.Failure("Cloud answer returned an unexpected shape")
            AskOutcome.Success(answer, ParseSource.CLOUD)
        } catch (e: FirebaseFunctionsException) {
            AskOutcome.Failure(e.message ?: "Cloud request failed")
        } catch (e: Exception) {
            AskOutcome.Failure(e.message ?: "Cloud request failed")
        }
    }

    @Suppress("UNCHECKED_CAST")
    private fun parseCallableResult(data: Any?): EntryDraft? {
        val map = data as? Map<String, Any?> ?: return null
        return EntryDraft(
            property = map["property"] as? String,
            task = map["task"] as? String,
            durationMinutes = (map["durationMinutes"] as? Number)?.toInt(),
            category = map["category"] as? String,
            eventType = map["eventType"] as? String,
            miles = (map["miles"] as? Number)?.toDouble(),
            resolvedActivityDateIso = map["resolvedActivityDateIso"] as? String,
        )
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

    private fun buildChatPrompt(history: List<ChatMessage>, question: String, stats: UserStats): String = buildString {
        appendLine(
            "You are the in-app copilot for an app that helps short-term-rental hosts log hours " +
                "toward IRS material-participation tests (IRS Pub 925 / §1.469-5T). " +
                "You are not a lawyer or CPA and this is not tax or legal advice — say so plainly " +
                "for genuinely unsettled or fact-specific questions, and suggest confirming with a tax professional. " +
                "Do not fabricate case law, IRS rulings, or numbers you weren't given."
        )
        appendLine("This host is tracking toward the ${stats.testName} test: ${stats.confirmedHours} of ${stats.thresholdHours} hours confirmed so far.")
        history.forEach { message ->
            val speaker = if (message.role == ChatRole.USER) "Host" else "You"
            appendLine("$speaker: ${message.text}")
        }
        appendLine("Host: $question")
        appendLine("Respond with plain text only — no markdown, no JSON.")
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
