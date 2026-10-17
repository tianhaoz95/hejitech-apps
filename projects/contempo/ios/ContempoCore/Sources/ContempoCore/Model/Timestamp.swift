import Foundation

/// A point in time with the Firestore Timestamp API the app was written against
/// (`Timestamp(date:)`, `dateValue()`, `seconds`, `nanoseconds`), so models and screens keep
/// working after the move to Supabase. Encoded as an ISO-8601 string (Postgres timestamptz).
public struct Timestamp: Codable, Equatable, Hashable, Comparable, Sendable {
    public let seconds: Int64
    public let nanoseconds: Int32

    public init(seconds: Int64, nanoseconds: Int32) {
        self.seconds = seconds
        self.nanoseconds = nanoseconds
    }

    public init(date: Date) {
        let interval = date.timeIntervalSince1970
        let whole = interval.rounded(.down)
        self.init(seconds: Int64(whole), nanoseconds: Int32(((interval - whole) * 1_000_000_000).rounded()))
    }

    public init() { self.init(date: Date()) }

    public func dateValue() -> Date {
        Date(timeIntervalSince1970: TimeInterval(seconds) + TimeInterval(nanoseconds) / 1_000_000_000)
    }

    public static func < (lhs: Timestamp, rhs: Timestamp) -> Bool {
        (lhs.seconds, lhs.nanoseconds) < (rhs.seconds, rhs.nanoseconds)
    }

    public var iso8601: String { Timestamp.formatter.string(from: dateValue()) }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let text = try container.decode(String.self)
        guard let date = Timestamp.parse(text) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Not an ISO-8601 timestamp: \(text)")
        }
        self.init(date: date)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(iso8601)
    }

    /// Postgres returns microseconds and "+00:00"; ISO8601DateFormatter wants at most milliseconds.
    static func parse(_ text: String) -> Date? {
        if let date = formatter.date(from: text) ?? plainFormatter.date(from: text) { return date }
        let trimmed = text.replacingOccurrences(of: #"(\.\d{3})\d+"#, with: "$1", options: .regularExpression)
        return formatter.date(from: trimmed) ?? plainFormatter.date(from: trimmed)
    }

    nonisolated(unsafe) private static let formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    nonisolated(unsafe) private static let plainFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
