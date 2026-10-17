import Foundation
import ContempoCore

/// Firestore document shape for `users/{uid}/roles/{roleId}` — a
/// user-managed roster of *other* people who work on a property (Property
/// Manager, Co-host, Cleaner, a contractor, ...). The user's own hours are
/// the implicit default and never get a doc here — see `Entry.roleId`.
/// Named `ParticipantRole`, not `Role`, to avoid colliding with the
/// existing chat-message `Role` enum in Vendor/LiteRTLM/Message.swift.
public struct ParticipantRole: Codable, Identifiable, Equatable, Sendable {
    public var id: String?
    public var name: String
    public var createdAt: Timestamp?

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case name = "name"
        case createdAt = "created_at"
    }

    public init(id: String? = nil, name: String = "", createdAt: Timestamp? = nil) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
    }
}
