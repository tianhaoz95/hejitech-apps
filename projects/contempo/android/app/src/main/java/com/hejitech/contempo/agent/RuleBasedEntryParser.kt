package com.hejitech.contempo.agent

/**
 * The last-resort parse when no on-device model can run (the bundled model still being prepared
 * on first launch, or a generation failure): plain pattern matching for duration, miles, a known
 * property name and the category, so a capture still becomes a usable draft instead of an empty
 * form. Same role as Voxbrief's rule-based transformer.
 */
object RuleBasedEntryParser {
    private val fillers = Regex("\\b(um+|uh+|erm|like,|you know,)\\s*", RegexOption.IGNORE_CASE)
    private val hours = Regex("(\\d+(?:\\.\\d+)?)\\s*(?:hours?|hrs?|h)\\b", RegexOption.IGNORE_CASE)
    private val minutes = Regex("(\\d+)\\s*(?:minutes?|mins?|m)\\b", RegexOption.IGNORE_CASE)
    private val miles = Regex("(\\d+(?:\\.\\d+)?)\\s*(?:-\\s*)?(?:miles?|mi)\\b", RegexOption.IGNORE_CASE)

    private val units = listOf(
        "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
        "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
    )
    private val tens = listOf("twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety")
    private val compoundNumber = Regex("\\b(${tens.joinToString("|")})(?:[\\s-](${units.take(9).joinToString("|")}))?\\b")
    private val unitNumber = Regex("\\b(${units.joinToString("|")})\\b")

    /**
     * Spoken numbers as digits, for matching durations and distances only (the task keeps the
     * words): "two hours" → "2 hours", "forty-five minutes" → "45 minutes", "an hour and a half"
     * → "1.5 hours". Whisper transcribes small numbers as words.
     */
    internal fun spokenNumbersAsDigits(lower: String): String {
        var t = compoundNumber.replace(lower) { m ->
            val n = (tens.indexOf(m.groupValues[1]) + 2) * 10 + (units.indexOf(m.groupValues[2]) + 1)
            n.toString()
        }
        t = unitNumber.replace(t) { m -> (units.indexOf(m.groupValues[1]) + 1).toString() }
        t = t.replace(Regex("\\ba couple(?: of)?\\b"), "2")
            .replace(Regex("\\b(?:an?|1) (hour|mile) and a half\\b"), "1.5 $1s")
            .replace(Regex("\\b(\\d+) and a half (hours?|miles?)\\b"), "$1.5 $2")
            .replace(Regex("\\b(?:a )?half (?:an )?hour\\b"), "30 minutes")
        return t
    }

    fun parse(rawText: String, knownProperties: List<String>): EntryDraft? {
        val text = fillers.replace(rawText, "").replace(Regex("\\s+"), " ").trim()
        if (text.isEmpty()) return null
        val lower = text.lowercase()
        val numeric = spokenNumbersAsDigits(lower)
        var durationMinutes = 0.0
        hours.find(numeric)?.let { durationMinutes += it.groupValues[1].toDouble() * 60 }
        minutes.find(numeric)?.let { durationMinutes += it.groupValues[1].toDouble() }
        if (durationMinutes == 0.0) {
            when {
                Regex("\\ban hour\\b").containsMatchIn(numeric) -> durationMinutes = 60.0
            }
        }
        return EntryDraft(
            property = knownProperties.firstOrNull { it.isNotBlank() && lower.contains(it.lowercase()) },
            task = text.replaceFirstChar { it.uppercase() },
            durationMinutes = durationMinutes.toInt().takeIf { it > 0 },
            category = CategoryClassifier.classify(text)?.firestoreValue,
            eventType = null,
            miles = miles.find(numeric)?.groupValues?.get(1)?.toDouble(),
            resolvedActivityDateIso = null,
        )
    }

    private val validCategories = setOf("maintenance", "turnover", "guest_communication", "supply_run", "admin", "other")

    /**
     * Checks a small model's draft against what can be read deterministically, the Voxbrief way
     * (the bundled 0.6B model's fields aren't trusted on their own): a stated duration/distance
     * and a known property named in the text win; the property must be one of the host's; the
     * timer intent comes from TimerIntentClassifier; time references are dropped (the host sets
     * the date when it isn't "now").
     */
    /** The small model sometimes answers with one stray word ("start"): keep its task only if it's a phrase drawn from the capture. */
    private fun plausibleTask(task: String, rawText: String): Boolean {
        if ('_' in task || ' ' !in task.trim()) return false
        val words = Regex("[a-z]{3,}").findAll(task.lowercase()).map { it.value }.toList()
        val said = Regex("[a-z]{3,}").findAll(rawText.lowercase()).map { it.value }.toSet()
        return words.size >= 2 && words.count { it in said } * 2 >= words.size
    }

    fun refineSmallModelDraft(model: EntryDraft, rawText: String, knownProperties: List<String>): EntryDraft {
        val rules = parse(rawText, knownProperties)
        val modelProperty = model.property?.trim()?.let { p -> knownProperties.firstOrNull { it.equals(p, ignoreCase = true) } }
        return EntryDraft(
            property = rules?.property ?: modelProperty,
            task = model.task?.takeIf { plausibleTask(it, rawText) } ?: rules?.task,
            durationMinutes = rules?.durationMinutes ?: model.durationMinutes,
            category = model.category?.takeIf { it in validCategories } ?: rules?.category,
            eventType = when (TimerIntentClassifier.classify(rawText)) {
                TimerIntent.START -> "start"
                TimerIntent.STOP -> "stop"
                null -> null
            },
            miles = rules?.miles ?: model.miles?.takeIf { it > 0 },
            resolvedActivityDateIso = null,
        )
    }
}
