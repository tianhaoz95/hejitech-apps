import Foundation

/// The three fields Confirm/Entry Detail treat as "required to consider this
/// entry finished" — shared by ConfirmViewModel (drives isIncomplete/"Complete
/// Later") and EntryDetailViewModel's inline quick-edit, so both compute the
/// same `Entry.missingFields` list from the same rules. Mirrors
/// EntryFieldValidation.kt on the Android side.
public enum EntryFieldValidation {
    public static let fieldProperty = "property"
    public static let fieldTask = "task"
    public static let fieldDuration = "duration"

    public static func missingFields(property: String, task: String, durationMinutes: Int) -> [String] {
        var missing: [String] = []
        if property.trimmingCharacters(in: .whitespaces).isEmpty { missing.append(fieldProperty) }
        if task.trimmingCharacters(in: .whitespaces).isEmpty { missing.append(fieldTask) }
        if durationMinutes <= 0 { missing.append(fieldDuration) }
        return missing
    }
}
