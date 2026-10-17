@preconcurrency import FirebaseFirestore

/// Firestore document shape for `users/{uid}/roles/{roleId}` — a
/// user-managed roster of *other* people who work on a property (Property
/// Manager, Co-host, Cleaner, a contractor, ...). The user's own hours are
/// the implicit default and never get a doc here — see `Entry.roleId`.
/// Named `ParticipantRole`, not `Role`, to avoid colliding with the
/// existing chat-message `Role` enum in Vendor/LiteRTLM/Message.swift.
public struct ParticipantRole: Codable, Identifiable, Equatable, Sendable {
    @DocumentID public var id: String?
    public var name: String
    @ServerTimestamp public var createdAt: Timestamp?

    public init(id: String? = nil, name: String = "", createdAt: Timestamp? = nil) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
    }
}
