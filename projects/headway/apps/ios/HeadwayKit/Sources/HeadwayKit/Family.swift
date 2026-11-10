import Foundation

// Mirrors of @headway/core's family.ts and the Worker's /api/family responses.

/// What a member can share. Every kind is off until they turn it on and pick who sees it.
public enum ShareKind: String, Codable, CaseIterable, Hashable, Sendable {
    case trip, ride, commute, status

    public var title: String {
        switch self {
        case .trip: "Trains I track"
        case .ride: "Rides Headway detects"
        case .commute: "My usual train running late"
        case .status: "My status"
        }
    }

    public var detail: String {
        switch self {
        case .trip: "The train you track, wherever you start tracking it: where it is and when you arrive."
        case .ride: "The train Headway is sure you're on (On a train in Settings), even if you don't track it."
        case .commute: "Only that your usual morning or evening train is late or cancelled, never your stations or times."
        case .status: "A status you set here, like Running late, for as long as you choose."
        }
    }

    public var symbol: String {
        switch self {
        case .trip: "tram.fill"
        case .ride: "location.fill"
        case .commute: "clock.badge.exclamationmark"
        case .status: "text.bubble"
        }
    }

    /// The kinds that show a train.
    public var isTrain: Bool { self == .trip || self == .ride }
}

public enum StatusCode: String, Codable, CaseIterable, Hashable, Sendable {
    case onMyWay = "on_my_way", runningLate = "running_late", missedTrain = "missed_train", madeIt = "made_it", home

    public var text: String {
        switch self {
        case .onMyWay: "On my way"
        case .runningLate: "Running late"
        case .missedTrain: "Missed my train, taking the next"
        case .madeIt: "Made it"
        case .home: "Home"
        }
    }

    public var symbol: String {
        switch self {
        case .onMyWay: "figure.walk"
        case .runningLate: "tortoise.fill"
        case .missedTrain: "arrow.uturn.right"
        case .madeIt: "checkmark.circle.fill"
        case .home: "house.fill"
        }
    }

    /// How long a status may last, in minutes (the Worker accepts only these).
    public static let durations = [15, 30, 60, 120, 240]
    public static let defaultDuration = 30
}

public struct FollowPrefs: Codable, Hashable, Sendable {
    public var notify: [ShareKind]
    public var live: Bool

    public init(notify: [ShareKind] = [], live: Bool = false) {
        self.notify = notify
        self.live = live
    }
}

public struct FamilyTrain: Codable, Hashable, Sendable {
    public var source: ShareKind
    public var tripId: String
    public var serviceDate: String
    public var train: String
    public var kind: String
    public var to: StationRef
    public var next: NextStop?
    public var predArr: Double
    public var arr: Double
    public var delayMin: Int?
    public var stopsLeft: Int
    public var cancelled: Bool
    public var arrived: Bool
    public var live: Bool

    enum CodingKeys: String, CodingKey {
        case source, train, kind, to, next, arr, cancelled, arrived, live
        case tripId = "trip_id", serviceDate = "service_date", predArr = "pred_arr", delayMin = "delay_min", stopsLeft = "stops_left"
    }
}

public struct CommuteNews: Codable, Hashable, Sendable {
    public var leg: String
    public var cancelled: Bool
    public var delayMin: Int?

    enum CodingKeys: String, CodingKey { case leg, cancelled; case delayMin = "delay_min" }
}

public struct FamilyStatus: Codable, Hashable, Sendable {
    public var code: StatusCode
    public var text: String
    public var setAt: Double
    public var until: Double

    enum CodingKeys: String, CodingKey { case code, text, until; case setAt = "set_at" }
}

public struct FamilyMemberView: Codable, Hashable, Identifiable, Sendable {
    public var userId: String
    public var displayName: String
    public var role: String
    public var me: Bool
    public var sharedWithMe: [ShareKind]
    public var train: FamilyTrain?
    public var commute: CommuteNews?
    public var status: FamilyStatus?
    public var follow: FollowPrefs

    public var id: String { userId }
    public var isOwner: Bool { role == "owner" }

    enum CodingKeys: String, CodingKey {
        case role, me, train, commute, status, follow
        case userId = "user_id", displayName = "display_name", sharedWithMe = "shared_with_me"
    }
}

public struct MyShare: Codable, Hashable, Identifiable, Sendable {
    public var kind: ShareKind
    public var on: Bool
    public var viewers: [String]
    public var notified: [String]
    public var live: [String]
    public var id: ShareKind { kind }
}

public struct FamilyMe: Codable, Hashable, Sendable {
    public var displayName: String
    public var role: String
    public var shares: [MyShare]
    public var status: FamilyStatus?

    enum CodingKeys: String, CodingKey { case role, shares, status; case displayName = "display_name" }
}

public struct PendingInvite: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var email: String
    public var expiresAt: String
    enum CodingKeys: String, CodingKey { case id, email; case expiresAt = "expires_at" }
}

public struct InviteToMe: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var groupName: String
    public var fromName: String
    public var expiresAt: String
    enum CodingKeys: String, CodingKey { case id; case groupName = "group_name", fromName = "from_name", expiresAt = "expires_at" }
}

public struct FamilyGroup: Codable, Hashable, Sendable {
    public var id: String
    public var name: String
    public var owner: Bool
    public var members: [FamilyMemberView]
    public var pendingInvites: [PendingInvite]

    enum CodingKeys: String, CodingKey { case id, name, owner, members; case pendingInvites = "pending_invites" }
}

public struct FamilyState: Codable, Hashable, Sendable {
    public var email: String?
    public var suggestedName: String
    public var max: Int
    public var invites: [InviteToMe]
    public var group: FamilyGroup?
    public var me: FamilyMe?

    enum CodingKeys: String, CodingKey { case email, max, invites, group, me; case suggestedName = "suggested_name" }

    /// The others in the group.
    public var others: [FamilyMemberView] { group?.members.filter { !$0.me } ?? [] }
    public func name(of userId: String) -> String { group?.members.first { $0.userId == userId }?.displayName ?? "Someone" }
    public func share(_ kind: ShareKind) -> MyShare? { me?.shares.first { $0.kind == kind } }
}

extension Backend {
    public func family() async throws -> FamilyState { try await call("GET", "/api/family") }

    public func createFamily(name: String, displayName: String?) async throws -> FamilyState {
        struct Body: Encodable { let name: String; let display_name: String? }
        return try await call("POST", "/api/family", body: Body(name: name, display_name: displayName))
    }

    public func renameFamily(_ name: String) async throws -> FamilyState {
        struct Body: Encodable { let name: String }
        return try await call("PUT", "/api/family", body: Body(name: name))
    }

    /// Leaves the group; the owner leaving deletes it.
    public func leaveFamily() async throws -> FamilyState { try await call("DELETE", "/api/family") }

    public func invite(email: String) async throws -> FamilyState {
        struct Body: Encodable { let email: String }
        return try await call("POST", "/api/family/invites", body: Body(email: email))
    }

    public func cancelInvite(_ id: String) async throws -> FamilyState { try await call("DELETE", "/api/family/invites/\(id)") }
    public func acceptInvite(_ id: String) async throws -> FamilyState { try await call("POST", "/api/family/invites/\(id)/accept") }
    public func declineInvite(_ id: String) async throws -> FamilyState { try await call("POST", "/api/family/invites/\(id)/decline") }
    public func removeMember(_ userId: String) async throws -> FamilyState { try await call("DELETE", "/api/family/members/\(userId)") }

    /// Changes your own row: your name, who sees each share (absent: off), what you follow of whom.
    public func updateFamily(displayName: String? = nil, shares: [ShareKind: [String]]? = nil, follows: [String: FollowPrefs]? = nil) async throws -> FamilyState {
        struct Body: Encodable {
            let display_name: String?
            let shares: [String: [String]]?
            let follows: [String: FollowPrefs]?
        }
        let s = shares.map { Dictionary(uniqueKeysWithValues: $0.map { ($0.key.rawValue, $0.value) }) }
        return try await call("PUT", "/api/family/me", body: Body(display_name: displayName, shares: s, follows: follows))
    }

    public func setStatus(_ code: StatusCode, minutes: Int) async throws -> FamilyState {
        struct Body: Encodable { let code: String; let minutes: Int }
        return try await call("PUT", "/api/family/status", body: Body(code: code.rawValue, minutes: minutes))
    }

    public func clearStatus() async throws -> FamilyState { try await call("DELETE", "/api/family/status") }
}
