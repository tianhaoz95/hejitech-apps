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
 *     types directly, so swapping runtimes doesn't touch this file. No
 *     forced JSON response schema is assumed on-device — parseEntry prompts
 *     for plain text formatted as JSON and best-effort parses it, rather
 *     than relying on a schema guarantee; askQuestion just wants plain text
 *     back, so it doesn't hit that limitation at all.
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

    suspend fun parseEntry(rawText: String, knownProperties: List<String>): ParseOutcome {
        val prompt = buildEntryPrompt(rawText, knownProperties)
        return when (inferencePreference()) {
            InferencePreference.CLOUD_ONLY ->
                cloudParseEntry(rawText, knownProperties)

            InferencePreference.ON_DEVICE_ONLY ->
                onDeviceParseEntry(prompt)
                    ?: ParseOutcome.Failure("On-device model unavailable — no cloud fallback (On-device only is selected in Settings).")

            InferencePreference.PREFER_ON_DEVICE ->
                onDeviceParseEntry(prompt)
                    ?: cloudParseEntry(rawText, knownProperties)
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

    private suspend fun onDeviceParseEntry(prompt: String): ParseOutcome? {
        return try {
            val text = onDeviceLlm.generateText(prompt) ?: return null
            val draft = json.decodeFromString<EntryDraft>(extractJsonObject(text))
            ParseOutcome.Success(ParseResult(draft, ParseSource.ON_DEVICE))
        } catch (e: Exception) {
            // Expected and non-fatal in PREFER_ON_DEVICE: model not ready
            // yet, or a response that didn't parse as JSON. In ON_DEVICE_ONLY
            // this null is what turns into the loud failure above instead.
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
        )
    }

    private fun buildEntryPrompt(rawText: String, knownProperties: List<String>): String = buildString {
        appendLine("You extract short-term-rental work-log entries from a host's own words.")
        if (knownProperties.isNotEmpty()) {
            appendLine("Known properties: ${knownProperties.joinToString(", ")}.")
        }
        appendLine("Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:")
        appendLine(
            """{"property": string|null, "task": string|null, "durationMinutes": integer|null, """ +
                """"category": one of "maintenance"|"turnover"|"guest_communication"|"supply_run"|"admin"|"other"|null}"""
        )
        appendLine("Capture is meant to be fast, not a conversation: fill in every field you can confidently determine, and leave any field you genuinely can't determine as null. Never withhold a field or ask a question — the host reviews and fills in gaps themselves afterward, so a partial entry is the correct output, not a failure.")
        appendLine("Host's message: \"$rawText\"")
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

    /** Strips markdown code fences etc. in case the on-device model adds them despite instructions not to. */
    private fun extractJsonObject(text: String): String {
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        return if (start >= 0 && end > start) text.substring(start, end + 1) else text
    }
}
