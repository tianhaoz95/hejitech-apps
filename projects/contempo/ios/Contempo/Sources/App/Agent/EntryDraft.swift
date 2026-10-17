import ContempoCore
import Foundation

/// Client-side mirror of `EntryDraftSchema` in backend/functions/src/schemas.ts.
///
/// Deliberately no "needs clarification" concept: capture is supposed to be
/// fast, not a back-and-forth — the model always fills in whatever it can
/// confidently determine and leaves the rest nil, and the app always
/// proceeds straight to Confirm with that partial draft rather than blocking
/// the user with a question.
public struct EntryDraft: Codable, Equatable, Sendable {
    public var property: String?
    /// Cleaned-up description of the work performed — filler words and
    /// dictation errors already stripped by the parse prompt. Plain prose
    /// for a single task; may be a markdown bullet list ("- " lines) when
    /// the host described multiple distinct sub-tasks in one capture.
    public var task: String?
    public var durationMinutes: Int?
    public var category: String?
    /// "start"/"stop" fallback signal for the voice-timer feature — only
    /// consulted when the deterministic keyword classifier doesn't
    /// recognize the utterance.
    public var eventType: String?
    /// Business miles driven, only when the host actually states a distance.
    public var miles: Double?
    /// Absolute ISO-8601 timestamp for when the described work actually
    /// happened. Nil means no time reference was mentioned — treat as "now."
    public var resolvedActivityDateIso: String?

    public init(
        property: String? = nil,
        task: String? = nil,
        durationMinutes: Int? = nil,
        category: String? = nil,
        eventType: String? = nil,
        miles: Double? = nil,
        resolvedActivityDateIso: String? = nil
    ) {
        self.property = property
        self.task = task
        self.durationMinutes = durationMinutes
        self.category = category
        self.eventType = eventType
        self.miles = miles
        self.resolvedActivityDateIso = resolvedActivityDateIso
    }

    /// True when the model produced essentially nothing usable — no
    /// property, task, duration, event type, or miles. Distinguishes "the
    /// model ran but drew a blank on this phrasing" from a normal partial
    /// extraction (expected and fine — see this type's doc comment), so
    /// `AgentClient.parseEntry` can treat a blank on-device draft the same
    /// as an outright on-device failure and fall back to cloud instead of
    /// silently accepting nothing.
    public var isEffectivelyEmpty: Bool {
        (property?.isEmpty ?? true) && (task?.isEmpty ?? true) && durationMinutes == nil && eventType == nil && miles == nil
    }
}

public enum ParseSource: Sendable { case onDevice, cloud }

public struct ParseResult: Sendable {
    public let draft: EntryDraft
    public let source: ParseSource
}

public enum ParseOutcome: Sendable {
    case success(ParseResult)
    case failure(message: String)
}

/// Result of `AgentClient.readOdometerFromPhoto` — a plain number read, not a structured entry draft.
public enum OdometerReadOutcome: Sendable {
    case success(miles: Double, source: ParseSource)
    case failure(message: String)
}

/// Which of the two photo-capture paths a just-taken photo belongs to — see `AgentClient.classifyPhotoIntent`.
public enum PhotoIntent: Sendable {
    case odometer, work
}

/// Result of `AgentClient.classifyPhotoIntent` — a fast odometer-vs-work read
/// that decides which of `readOdometerFromPhoto`/`draftEntryFromPhoto` to run
/// next, not the extracted content itself.
public enum PhotoIntentOutcome: Sendable {
    case success(intent: PhotoIntent, source: ParseSource)
    case failure(message: String)
}

/// Result of `AgentClient.suggestCategory` — an on-device-only category guess for the entry-detail auto-detect button.
public enum CategoryOutcome: Sendable {
    case success(category: EntryCategory, source: ParseSource)
    case failure(message: String)
}

/// Bundles everything Capture hands off to Confirm: the drafted fields,
/// where the parse ran (for the "parsed on-device"/"parsed via cloud"
/// caption), how the capture itself started (for the audit-trail source
/// field), a local file URL for the photo if one was taken (Confirm uploads
/// it to Storage on save), and best-effort "said from here" location.
public struct CaptureResult: Sendable {
    public let draft: EntryDraft
    public let parseSource: String
    public let captureSource: CaptureSource
    public var photoURL: URL?
    public var captureLat: Double?
    public var captureLng: Double?

    public init(draft: EntryDraft, parseSource: String, captureSource: CaptureSource, photoURL: URL? = nil, captureLat: Double? = nil, captureLng: Double? = nil) {
        self.draft = draft
        self.parseSource = parseSource
        self.captureSource = captureSource
        self.photoURL = photoURL
        self.captureLat = captureLat
        self.captureLng = captureLng
    }
}
