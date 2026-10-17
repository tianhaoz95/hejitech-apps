import ContempoCore
import Foundation

/// Deterministic keyword fallback for the capture paths that never go
/// through an LLM parse at all — Manual Entry (blank form, nothing to
/// classify until the user types) and a manually-started timer completed
/// without ever dictating what it was ("Start Timer" -> later filled in on
/// Confirm) — so these entries don't just silently sit at
/// `EntryCategory.other` forever. Voice/text/photo capture already get a
/// real LLM-inferred category (see `AgentClient.parseEntry` / `EntryTools`'
/// `RecordEntryTool`); `ConfirmViewModel` only calls this when the current
/// category is still `.other` and the user hasn't manually picked one, so a
/// genuine LLM classification (even a deliberate `.other`) is never
/// clobbered by a lower-quality guess.
enum CategoryClassifier {
    private static let keywords: [(EntryCategory, [String])] = [
        (.turnover, ["clean", "turnover", "checkout", "check-out", "linens", "laundry", "towel", "restock the", "vacuum", "sheets"]),
        (.maintenance, ["repair", "fix", "fixing", "leak", "broken", "maintenance", "hvac", "plumb", "paint", "replace", "install", "appliance"]),
        (.guestCommunication, ["guest", "message", "messaging", "reply", "replied", "check-in", "check in", "checkin", "text", "call the", "email the", "communicat"]),
        (.supplyRun, ["buy", "bought", "shopping", "store", "purchase", "restock", "supplies", "pick up", "picking up"]),
        (.admin, ["admin", "bookkeeping", "taxes", "paperwork", "invoice", "schedul", "planning", "budget", "listing", "pricing", "accounting"]),
    ]

    static func classify(_ taskText: String) -> EntryCategory? {
        let lower = taskText.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard !lower.isEmpty else { return nil }
        return keywords.first { _, terms in terms.contains { lower.contains($0) } }?.0
    }
}
