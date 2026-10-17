import Foundation
import ContempoCore

/// Firestore document shape for `users/{uid}/properties/{propertyId}`.
public struct Property: Codable, Identifiable, Equatable, Sendable {
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
