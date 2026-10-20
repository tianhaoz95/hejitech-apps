import Foundation

/// What the Daily Brief widget shows, written by the app into the shared App Group
/// (`KeyboardHandoff.appGroupID`) whenever notes change and read by `VoxbriefWidgets`. The notes
/// store itself stays private to the app; the widget only ever sees this summary.
public struct DailyBriefSnapshot: Codable, Equatable, Sendable {
    public struct Item: Codable, Equatable, Sendable {
        public let text: String
        public let noteTitle: String
        /// "high", "medium", "low" or nil, as `VoiceNote.actionItemPriorities` stores it.
        public let priority: String?

        public init(text: String, noteTitle: String, priority: String?) {
            self.text = text
            self.noteTitle = noteTitle
            self.priority = priority
        }
    }

    public let openCount: Int
    public let highCount: Int
    /// The first few open items, high priority first.
    public let items: [Item]
    /// Notes recorded in the last 24 hours.
    public let recentNoteCount: Int
    public let updatedAt: Date

    public init(openCount: Int, highCount: Int, items: [Item], recentNoteCount: Int, updatedAt: Date) {
        self.openCount = openCount
        self.highCount = highCount
        self.items = items
        self.recentNoteCount = recentNoteCount
        self.updatedAt = updatedAt
    }

    public static let widgetKind = "DailyBrief"
    /// How many items the largest widget lists.
    public static let maxItems = 4
    private static let storageKey = "daily_brief_snapshot"

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: KeyboardHandoff.appGroupID)
    }

    /// The last snapshot the app wrote, or nil before the app has run with the widget installed.
    public static func load() -> DailyBriefSnapshot? {
        guard let data = defaults?.data(forKey: storageKey) else { return nil }
        return try? JSONDecoder().decode(DailyBriefSnapshot.self, from: data)
    }

    /// Saves the snapshot; returns false when it matches what's stored (ignoring `updatedAt`),
    /// so the caller can skip reloading the widget.
    @discardableResult
    public func save() -> Bool {
        guard let defaults = Self.defaults else { return false }
        if let current = Self.load(), current.sameContent(as: self) { return false }
        guard let data = try? JSONEncoder().encode(self) else { return false }
        defaults.set(data, forKey: Self.storageKey)
        return true
    }

    public func sameContent(as other: DailyBriefSnapshot) -> Bool {
        openCount == other.openCount && highCount == other.highCount && items == other.items
            && recentNoteCount == other.recentNoteCount
    }
}
