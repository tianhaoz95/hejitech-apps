@preconcurrency import FirebaseFirestore

/// Firestore document shape for `users/{uid}/properties/{propertyId}`.
public struct Property: Codable, Identifiable, Equatable, Sendable {
    @DocumentID public var id: String?
    public var name: String
    @ServerTimestamp public var createdAt: Timestamp?

    public init(id: String? = nil, name: String = "", createdAt: Timestamp? = nil) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
    }
}
