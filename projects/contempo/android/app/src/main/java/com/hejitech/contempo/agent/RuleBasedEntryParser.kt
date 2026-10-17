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

    fun parse(rawText: String, knownProperties: List<String>): EntryDraft? {
        val text = fillers.replace(rawText, "").replace(Regex("\\s+"), " ").trim()
        if (text.isEmpty()) return null
        val lower = text.lowercase()
        var durationMinutes = 0.0
        hours.find(text)?.let { durationMinutes += it.groupValues[1].toDouble() * 60 }
        minutes.find(text)?.let { durationMinutes += it.groupValues[1].toDouble() }
        if (durationMinutes == 0.0) {
            when {
                "half an hour" in lower -> durationMinutes = 30.0
                Regex("\\ban hour\\b|\\bone hour\\b").containsMatchIn(lower) -> durationMinutes = 60.0
            }
        }
        return EntryDraft(
            property = knownProperties.firstOrNull { it.isNotBlank() && lower.contains(it.lowercase()) },
            task = text.replaceFirstChar { it.uppercase() },
            durationMinutes = durationMinutes.toInt().takeIf { it > 0 },
            category = CategoryClassifier.classify(text)?.firestoreValue,
            eventType = null,
            miles = miles.find(text)?.groupValues?.get(1)?.toDouble(),
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
    fun refineSmallModelDraft(model: EntryDraft, rawText: String, knownProperties: List<String>): EntryDraft {
        val rules = parse(rawText, knownProperties)
        val modelProperty = model.property?.trim()?.let { p -> knownProperties.firstOrNull { it.equals(p, ignoreCase = true) } }
        return EntryDraft(
            property = rules?.property ?: modelProperty,
            task = model.task?.takeIf { it.isNotBlank() } ?: rules?.task,
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
