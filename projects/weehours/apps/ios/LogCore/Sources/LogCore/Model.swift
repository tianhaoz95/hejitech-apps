import Foundation

/// A flat, typed field value. Event fields are deliberately flat (no nesting) so every surface,
/// the Supabase `jsonb` column and the MCP tools agree on one simple shape.
public enum FieldValue: Codable, Hashable, Sendable, CustomStringConvertible {
    case string(String)
    case number(Double)
    case bool(Bool)

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let b = try? c.decode(Bool.self) { self = .bool(b); return }
        if let n = try? c.decode(Double.self) { self = .number(n); return }
        self = .string(try c.decode(String.self))
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let s): try c.encode(s)
        case .number(let n): try c.encode(n)
        case .bool(let b): try c.encode(b)
        }
    }

    public var string: String? { if case .string(let s) = self { return s }; return nil }
    public var number: Double? { if case .number(let n) = self { return n }; return nil }

    public var description: String {
        switch self {
        case .string(let s): return s
        case .number(let n): return n == n.rounded() ? String(Int(n)) : String(format: "%.2f", n)
        case .bool(let b): return b ? "yes" : "no"
        }
    }
}

public enum Surface: String, Codable, Sendable, CaseIterable {
    case phone, watch, glasses, ring, mcp, widget, siri
}

public enum InputKind: String, Codable, Sendable {
    case voice, gesture, tap, agent
}

public enum ConfidenceTier: String, Codable, Sendable {
    case auto, pick, fullList = "full_list"
}

public struct Provenance: Codable, Hashable, Sendable {
    public var surface: Surface
    public var input: InputKind
    public var rawTranscript: String?
    /// Calibrated probability of the chosen option, per decided question.
    public var confidence: [String: Double]
    public var confidenceTier: ConfidenceTier?
    public var modelVersion: String?
    public var captureId: UUID?
    /// For MCP writes: the client that called the tool.
    public var caller: String?

    public init(surface: Surface, input: InputKind, rawTranscript: String? = nil, confidence: [String: Double] = [:],
                confidenceTier: ConfidenceTier? = nil, modelVersion: String? = nil, captureId: UUID? = nil, caller: String? = nil) {
        self.surface = surface
        self.input = input
        self.rawTranscript = rawTranscript
        self.confidence = confidence
        self.confidenceTier = confidenceTier
        self.modelVersion = modelVersion
        self.captureId = captureId
        self.caller = caller
    }

    enum CodingKeys: String, CodingKey {
        case surface, input, confidence, caller
        case rawTranscript = "raw_transcript"
        case confidenceTier = "confidence_tier"
        case modelVersion = "model_version"
        case captureId = "capture_id"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        surface = try c.decode(Surface.self, forKey: .surface)
        input = try c.decode(InputKind.self, forKey: .input)
        rawTranscript = try c.decodeIfPresent(String.self, forKey: .rawTranscript)
        confidence = try c.decodeIfPresent([String: Double].self, forKey: .confidence) ?? [:]
        confidenceTier = try c.decodeIfPresent(ConfidenceTier.self, forKey: .confidenceTier)
        modelVersion = try c.decodeIfPresent(String.self, forKey: .modelVersion)
        captureId = try c.decodeIfPresent(UUID.self, forKey: .captureId)
        caller = try c.decodeIfPresent(String.self, forKey: .caller)
    }
}

/// One immutable entry of the append-only household log. Edits, undos, duplicate resolutions and
/// duty handoffs are events too; nothing is ever updated in place.
public struct LogEvent: Codable, Identifiable, Hashable, Sendable {
    public var id: UUID
    public var householdId: UUID
    public var babyId: UUID
    public var type: String
    public var fields: [String: FieldValue]
    public var occurredAt: Date
    public var loggedAt: Date
    public var loggedBy: UUID
    public var provenance: Provenance
    /// For edits (same type, replaces the target) and system events (undo targets).
    public var supersedes: UUID?
    /// Optional explicit session grouping, set by surfaces that know the open session.
    public var sessionId: UUID?

    public init(id: UUID = UUID(), householdId: UUID, babyId: UUID, type: String, fields: [String: FieldValue] = [:],
                occurredAt: Date, loggedAt: Date = Date(), loggedBy: UUID, provenance: Provenance,
                supersedes: UUID? = nil, sessionId: UUID? = nil) {
        self.id = id
        self.householdId = householdId
        self.babyId = babyId
        self.type = type
        self.fields = fields
        self.occurredAt = occurredAt
        self.loggedAt = loggedAt
        self.loggedBy = loggedBy
        self.provenance = provenance
        self.supersedes = supersedes
        self.sessionId = sessionId
    }

    enum CodingKeys: String, CodingKey {
        case id, type, fields, provenance, supersedes
        case householdId = "household_id"
        case babyId = "baby_id"
        case occurredAt = "occurred_at"
        case loggedAt = "logged_at"
        case loggedBy = "logged_by"
        case sessionId = "session_id"
    }

    public func string(_ key: String) -> String? { fields[key]?.string }
    public func number(_ key: String) -> Double? { fields[key]?.number }
}

public enum SystemType {
    public static let note = "note"
    public static let undo = "undo"
    public static let resolve = "resolve"
    public static let duty = "duty"
    /// A photo attached to an entry (`attached_to`, `path`); removing it is an undo.
    public static let photo = "photo"
    public static let all: Set<String> = [note, undo, resolve, duty, "settings", photo]
}

/// One voice entry from any device. Audio is processed on a household phone; the resulting event
/// gets an id derived from the capture id, so two phones processing the same capture converge.
public struct Capture: Codable, Identifiable, Hashable, Sendable {
    public enum Status: String, Codable, Sendable {
        case pending, needsReview = "needs_review", done, dismissed, failed
    }

    public var id: UUID
    public var householdId: UUID
    public var surface: Surface
    public var capturedAt: Date
    public var loggedBy: UUID
    /// Storage object path for remote captures (glasses), or nil when transcript is already known.
    public var audioPath: String?
    public var transcript: String?
    /// An event this capture adds detail to (e.g. ring "finish feed" then voice "drank half").
    public var attachTo: UUID?
    /// The child the capturing device was set to (the glasses' focus); a name in the transcript wins.
    public var babyId: UUID?
    public var status: Status
    public var interpretation: Interpretation?
    public var processedBy: UUID?
    public var processedAt: Date?

    public init(id: UUID = UUID(), householdId: UUID, surface: Surface, capturedAt: Date, loggedBy: UUID,
                audioPath: String? = nil, transcript: String? = nil, attachTo: UUID? = nil, babyId: UUID? = nil, status: Status = .pending,
                interpretation: Interpretation? = nil, processedBy: UUID? = nil, processedAt: Date? = nil) {
        self.id = id
        self.householdId = householdId
        self.surface = surface
        self.capturedAt = capturedAt
        self.loggedBy = loggedBy
        self.audioPath = audioPath
        self.transcript = transcript
        self.attachTo = attachTo
        self.babyId = babyId
        self.status = status
        self.interpretation = interpretation
        self.processedBy = processedBy
        self.processedAt = processedAt
    }

    enum CodingKeys: String, CodingKey {
        case id, surface, transcript, status, interpretation
        case householdId = "household_id"
        case capturedAt = "captured_at"
        case loggedBy = "logged_by"
        case audioPath = "audio_path"
        case attachTo = "attach_to"
        case babyId = "baby_id"
        case processedBy = "processed_by"
        case processedAt = "processed_at"
    }

    /// The id of the event produced from this capture (deterministic, see type docs).
    public var eventId: UUID { UUID.derived(from: id, salt: "capture-event") }
}

public extension UUID {
    /// Deterministic UUID (v5-style layout) from a base id and a salt, so independent devices
    /// derive the same id for the same work.
    static func derived(from base: UUID, salt: String) -> UUID {
        var bytes = withUnsafeBytes(of: base.uuid) { Array($0) }
        let saltBytes = Array(salt.utf8)
        // FNV-1a mix of salt into the 16 bytes; good enough for id derivation, not for security.
        var h: UInt64 = 0xcbf29ce484222325
        for b in saltBytes { h = (h ^ UInt64(b)) &* 0x100000001b3 }
        for i in 0..<16 {
            h = (h ^ UInt64(bytes[i])) &* 0x100000001b3
            bytes[i] = UInt8(truncatingIfNeeded: h >> 24)
        }
        bytes[6] = (bytes[6] & 0x0F) | 0x50
        bytes[8] = (bytes[8] & 0x3F) | 0x80
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
    }
}

public enum LogCoding {
    public static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .custom { date, enc in
            var c = enc.singleValueContainer()
            try c.encode(isoString(date))
        }
        e.outputFormatting = [.sortedKeys]
        return e
    }()

    public static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { dec in
            let c = try dec.singleValueContainer()
            let s = try c.decode(String.self)
            guard let date = parseISO(s) else {
                throw DecodingError.dataCorruptedError(in: c, debugDescription: "bad date \(s)")
            }
            return date
        }
        return d
    }()

    public static func isoString(_ date: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: date)
    }

    public static func parseISO(_ s: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: s) { return d }
        // Postgres style: "2026-10-14 03:10:00.123+00"
        let pg = DateFormatter()
        pg.locale = Locale(identifier: "en_US_POSIX")
        for fmt in ["yyyy-MM-dd HH:mm:ss.SSSSSSXXXXX", "yyyy-MM-dd HH:mm:ss.SSSXXXXX", "yyyy-MM-dd HH:mm:ssXXXXX",
                    "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXXXX", "yyyy-MM-dd"] {
            pg.dateFormat = fmt
            if let d = pg.date(from: s) { return d }
        }
        return nil
    }
}

/// A dirty diaper's optional colour (`stool_color`), added from the entry's details, never asked
/// when logging. Same list as `STOOL_COLORS` in `@weehours/core`.
public enum StoolColor: String, CaseIterable, Sendable {
    case yellow, brown, green, black, red, white

    public var label: String {
        switch self {
        case .yellow: return "Mustard"
        case .brown: return "Brown"
        case .green: return "Green"
        case .black: return "Black"
        case .red: return "Red"
        case .white: return "Pale/white"
        }
    }

    /// Colours on the stool colour cards pediatricians hand out as ones to call about (black only
    /// after the first few days, when it is no longer meconium).
    public func isFlagged(ageDays: Int?) -> Bool {
        switch self {
        case .red, .white: return true
        case .black: return (ageDays ?? 99) > 4
        default: return false
        }
    }
}

extension LogEvent {
    /// `needs_details: true` marks an entry logged blind (a watch tilt) that still misses an answer,
    /// such as a diaper's kind or how much of a bottle went down; the iPhone asks for it later and
    /// the answer is an edit without the flag.
    public static let needsDetails = "needs_details"
    public var needsDetails: Bool { fields[Self.needsDetails] == .bool(true) }
}
