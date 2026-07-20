/// Mirrors the `category` enum in backend/functions/src/schemas.ts (EntrySchema).
/// Keep the two in sync by hand — no shared-schema codegen at MVP scale.
public enum EntryCategory: String, Codable, CaseIterable, Sendable, Hashable {
    case maintenance
    case turnover
    case guestCommunication = "guest_communication"
    case supplyRun = "supply_run"
    case admin
    case other

    public init(firestoreValue: String) {
        self = EntryCategory(rawValue: firestoreValue) ?? .other
    }

    public var firestoreValue: String { rawValue }
}

/// How an entry was captured — kept even after confirmation, for the correction-feedback pipeline.
public enum CaptureSource: String, Codable, CaseIterable, Sendable, Hashable {
    case manual
    case voice
    case text
    case photo

    public init(firestoreValue: String) {
        self = CaptureSource(rawValue: firestoreValue) ?? .manual
    }

    public var firestoreValue: String { rawValue }
}

/// Confirm/edit review state — nothing commits without the user, per the PRD's trust principle.
public enum EntryStatus: String, Codable, CaseIterable, Sendable, Hashable {
    case pendingReview = "pending_review"
    case confirmed

    public init(firestoreValue: String) {
        self = EntryStatus(rawValue: firestoreValue) ?? .pendingReview
    }

    public var firestoreValue: String { rawValue }
}

/// Which Whisper checkpoint/config a capture should be (or was) transcribed with —
/// ENGLISH and CHINESE each need a dedicated on-device model rather than a single
/// multilingual one. Travels with a capture through the audioCaptures queue doc,
/// same reason CaptureSource/EntryCategory live here too.
public enum CaptureLanguage: String, Codable, CaseIterable, Sendable, Hashable {
    case english = "en"
    case chinese = "zh"
    case auto

    public init(firestoreValue: String) {
        self = CaptureLanguage(rawValue: firestoreValue) ?? .auto
    }

    public var firestoreValue: String { rawValue }
}
