package com.hejitech.contempo.agent

enum class TimerIntent { START, STOP }

/**
 * Deterministic first pass at recognizing a "starting work" / "finished
 * work" utterance, tried before ever asking the LLM (AgentClient.parseEntry
 * also carries an eventType fallback for phrasing this list doesn't cover —
 * see EntryDraft.eventType). Mirrors backend/functions/src/flows/flagRisk.ts's
 * existing "deterministic heuristics, no LLM call" pattern: this
 * classification is too load-bearing (getting it wrong means either failing
 * to open a timer, or worse, auto-closing the real one) to depend on a small
 * on-device model reliably following a new instruction with no enforced
 * response schema.
 */
object TimerIntentClassifier {
    // Bounded to near the start of the utterance (up to 3 filler words) —
    // unanchored matching would false-positive on something like "I haven't
    // finished the report yet," where "finished" appears but means the
    // opposite of done. This app's capture utterances are meant to be short
    // and lead with the intent (see AgentClient's "say it once" framing), so
    // a near-start bound catches real start/stop phrasing without matching
    // incidental words deep in an unrelated sentence.
    private const val PREAMBLE = """(?:\S+\s+){0,3}?"""

    private val startPatterns = listOf(
        // Covers both the contraction ("I'm") and the uncontracted form
        // ("I am") — a real gap caught during live testing: "I am starting
        // to work on X" was missed by an earlier i'?m-only pattern and had
        // to fall through to the (still-correct, but slower/less
        // predictable) LLM fallback tier.
        Regex("""^$PREAMBLE\bi('m| am)\s+(now\s+)?start(ing)?\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\b(starting|beginning) (to )?work\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\bclock(ing)? in\b""", RegexOption.IGNORE_CASE),
    )

    private val stopPatterns = listOf(
        Regex("""^$PREAMBLE\bi('m| am)\s+(now\s+)?(done|finished)\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\b(just )?(finished|wrapped up|wrapping up)\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\bclock(ing)? out\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\bstopping\b""", RegexOption.IGNORE_CASE),
    )

    fun classify(rawText: String): TimerIntent? {
        val trimmed = rawText.trim()
        if (trimmed.isEmpty()) return null
        if (startPatterns.any { it.containsMatchIn(trimmed) }) return TimerIntent.START
        if (stopPatterns.any { it.containsMatchIn(trimmed) }) return TimerIntent.STOP
        return null
    }
}
