package com.hejitech.contempo.agent

enum class TripIntent { START, STOP }

/**
 * Deterministic first pass at recognizing a "starting a drive" / "arrived"
 * utterance for GPS mileage-trip tracking — directly parallel to
 * TimerIntentClassifier (same PREAMBLE-bounded, near-start-of-utterance
 * matching rationale: getting this wrong means either failing to start GPS
 * tracking, or worse, ending a trip mid-drive). Kept as its own classifier
 * rather than folded into TimerIntentClassifier since a trip and a work
 * timer are independently open/closeable (see MileageTripCoordinator) — the
 * two intents must never be conflated.
 */
object TripIntentClassifier {
    private const val PREAMBLE = """(?:\S+\s+){0,3}?"""

    private val startPatterns = listOf(
        Regex("""^$PREAMBLE\b(starting|heading out on|heading out for) (a )?drive\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\bi('m| am)\s+(now\s+)?(heading out|on the road|driving)\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\bstart(ing)? (a )?trip\b""", RegexOption.IGNORE_CASE),
    )

    private val stopPatterns = listOf(
        Regex("""^$PREAMBLE\bi('ve| have)\s+(just )?arrived\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\b(just )?arrived\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\btrip('s)? (is )?(done|over)\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\b(done|finished) driving\b""", RegexOption.IGNORE_CASE),
        Regex("""^$PREAMBLE\bstop(ping)? (the )?trip\b""", RegexOption.IGNORE_CASE),
    )

    fun classify(rawText: String): TripIntent? {
        val trimmed = rawText.trim()
        if (trimmed.isEmpty()) return null
        if (startPatterns.any { it.containsMatchIn(trimmed) }) return TripIntent.START
        if (stopPatterns.any { it.containsMatchIn(trimmed) }) return TripIntent.STOP
        return null
    }
}
