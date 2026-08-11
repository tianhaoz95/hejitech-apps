@preconcurrency import FirebaseFirestore

/// Firestore document shape for `users/{uid}/categories/{categoryId}` — a
/// user-managed roster of custom work categories, alongside the fixed
/// built-in ones in `EntryCategory`. Mirrors `ParticipantRole` exactly
/// (same shape, same "add in place" UX from Confirm/EntryDetail — see
/// `EntryCategory.displayName(for:)`'s doc comment for how a category value
/// coming from either source is rendered). Named `CustomCategory`, not
/// `Category`, to avoid colliding with `objc/runtime.h`'s `Category`
/// typedef (implicitly visible via Foundation) — same reason the role
/// roster type is `ParticipantRole`, not `Role`.
public struct CustomCategory: Codable, Identifiable, Equatable, Sendable {
    @DocumentID public var id: String?
    public var name: String
    @ServerTimestamp public var createdAt: Timestamp?

    public init(id: String? = nil, name: String = "", createdAt: Timestamp? = nil) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
    }
}
