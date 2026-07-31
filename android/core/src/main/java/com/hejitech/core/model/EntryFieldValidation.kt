package com.hejitech.core.model

/**
 * The three fields Confirm/Entry Detail treat as "required to consider this
 * entry finished" — shared by ConfirmViewModel (drives isIncomplete/"Complete
 * Later") and EntryDetailViewModel's inline quick-edit, so both compute the
 * same [Entry.missingFields] list from the same rules.
 */
object EntryFieldValidation {
    const val FIELD_PROPERTY = "property"
    const val FIELD_TASK = "task"
    const val FIELD_DURATION = "duration"

    fun missingFields(property: String, task: String, durationMinutes: Int): List<String> =
        buildList {
            if (property.isBlank()) add(FIELD_PROPERTY)
            if (task.isBlank()) add(FIELD_TASK)
            if (durationMinutes <= 0) add(FIELD_DURATION)
        }
}
