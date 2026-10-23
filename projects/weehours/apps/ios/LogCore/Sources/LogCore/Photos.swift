import Foundation

/// A photo attached to an entry. Each is a `photo` system event naming the entry it was added to
/// (`attached_to`) and its file (`path`, relative to the household's folder in the storage bucket:
/// `photos/<id>.jpg`), so photos sync, merge and undo like everything else in the log. An edit of
/// the entry keeps its photos (they follow the edit chain); removing a photo is an undo of its event.
public struct EntryPhoto: Hashable, Sendable, Identifiable {
    /// The photo event's id (also the file name).
    public let id: UUID
    /// The entry it was added to (possibly since edited).
    public let entry: UUID
    public let householdId: UUID
    public let babyId: UUID
    public let path: String
    public let width: Int
    public let height: Int
    /// When the picture was taken (from the image), else when it was attached.
    public let takenAt: Date
    public let addedBy: UUID

    /// The object's key in the household's storage bucket.
    public var storageKey: String { "\(householdId.uuidString.lowercased())/\(path)" }

    public init?(_ e: LogEvent) {
        guard e.type == SystemType.photo, let entry = e.string(LogEvent.photoEntry).flatMap(UUID.init(uuidString:)),
              let path = e.string("path"), !path.isEmpty else { return nil }
        id = e.id
        self.entry = entry
        householdId = e.householdId
        babyId = e.babyId
        self.path = path
        width = Int(e.fields["width"]?.number ?? 0)
        height = Int(e.fields["height"]?.number ?? 0)
        takenAt = e.string("taken_at").flatMap { ISO8601DateFormatter().date(from: $0) } ?? e.occurredAt
        addedBy = e.loggedBy
    }

    /// The file name for a new photo: `photos/<id>.jpg`.
    public static func path(for id: UUID) -> String { "photos/\(id.uuidString.lowercased()).jpg" }
}

extension LogEvent {
    /// A photo event's field naming the entry it belongs to.
    public static let photoEntry = "attached_to"
}

extension DerivedLog {
    /// The photos of an entry, oldest first, including those added before it was edited.
    public func photos(for event: LogEvent) -> [EntryPhoto] {
        photosByRoot[rootOf[event.id] ?? event.id] ?? []
    }

    /// The photos of several entries (a feed's start and finish), oldest first, each once.
    public func photos(for events: [LogEvent]) -> [EntryPhoto] {
        var seen = Set<UUID>()
        return events.flatMap { photos(for: $0) }.filter { seen.insert($0.id).inserted }.sorted { $0.takenAt < $1.takenAt }
    }

    /// Every photo whose entry is still in the log, newest first.
    public var allPhotos: [EntryPhoto] {
        let live = Set(effective.compactMap { rootOf[$0.id] ?? $0.id })
        return photosByRoot.filter { live.contains($0.key) }.values.flatMap { $0 }.sorted { $0.takenAt > $1.takenAt }
    }

    /// The entry a photo belongs to now (its latest edit), nil once the entry was undone.
    public func entry(for photo: EntryPhoto) -> LogEvent? {
        let root = rootOf[photo.entry] ?? photo.entry
        return effective.last { (rootOf[$0.id] ?? $0.id) == root }
    }
}

extension LogService {
    /// Attaches a photo (already saved under `EntryPhoto.path(for: id)`) to an entry, for the
    /// entry's child. Remove it with `undo(id)`.
    @discardableResult
    public func attachPhoto(id: UUID = UUID(), to entry: LogEvent, width: Int, height: Int, takenAt: Date?, surface: Surface = .phone) throws -> LogEvent {
        var fields: [String: FieldValue] = [
            LogEvent.photoEntry: .string(entry.id.uuidString),
            "path": .string(EntryPhoto.path(for: id)),
            "width": .number(Double(width)), "height": .number(Double(height)),
        ]
        if let takenAt { fields["taken_at"] = .string(ISO8601DateFormatter().string(from: takenAt)) }
        return try log(type: SystemType.photo, fields: fields, provenance: Provenance(surface: surface, input: .tap), id: id, baby: entry.babyId)
    }
}
