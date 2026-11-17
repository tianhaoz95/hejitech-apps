import Foundation
import AVFoundation

/// What the watch records at. "Saver" is the all-day default: speech recognition on the iPhone
/// works from 16 kHz audio anyway, so the smaller stream costs nothing downstream and is less to
/// encode, store and send.
public enum WatchRecordingQuality: String, Codable, CaseIterable, Identifiable, Sendable {
    case saver
    case standard

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .saver: return "Battery Saver"
        case .standard: return "Standard"
        }
    }

    public var detail: String {
        switch self {
        case .saver: return "16 kHz, 24 kbps"
        case .standard: return "32 kHz, 64 kbps"
        }
    }

    public var sampleRate: Double {
        switch self {
        case .saver: return 16_000
        case .standard: return 32_000
        }
    }

    public var bitRate: Int {
        switch self {
        case .saver: return 24_000
        case .standard: return 64_000
        }
    }

    public var megabytesPerHour: Double {
        Double(bitRate) / 8 * 3600 / 1_000_000
    }

    public var recorderSettings: [String: Any] {
        [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: (self == .saver ? AVAudioQuality.medium : AVAudioQuality.high).rawValue,
            AVEncoderBitRateKey: bitRate
        ]
    }
}

/// When finished pieces of a recording go to the iPhone. Sending is the radio's work, so holding
/// it until the recording is over (or the watch is on its charger) keeps it out of the session.
public enum WatchTransferPolicy: String, Codable, CaseIterable, Identifiable, Sendable {
    case afterRecording
    case rightAway

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .afterRecording: return "After Recording"
        case .rightAway: return "Right Away"
        }
    }
}

/// The watch recorder's settings, kept in UserDefaults. Each recording's battery log stores the
/// settings it ran with, so runs can be compared.
public struct WatchRecordingConfig: Codable, Equatable, Sendable {
    public var quality: WatchRecordingQuality
    public var segmentMinutes: Int
    public var transferPolicy: WatchTransferPolicy

    public static let segmentChoices = [15, 30, 60]
    public static let `default` = WatchRecordingConfig(quality: .saver, segmentMinutes: 15, transferPolicy: .afterRecording)

    public init(quality: WatchRecordingQuality, segmentMinutes: Int, transferPolicy: WatchTransferPolicy) {
        self.quality = quality
        self.segmentMinutes = segmentMinutes
        self.transferPolicy = transferPolicy
    }

    public var segmentLength: TimeInterval { TimeInterval(segmentMinutes * 60) }

    public var summary: String {
        "\(quality.detail), \(segmentMinutes) min pieces, send \(transferPolicy == .afterRecording ? "after" : "right away")"
    }

    private static let defaultsKey = "watch_recording_config"

    public static func load(from defaults: UserDefaults = .standard) -> WatchRecordingConfig {
        guard let data = defaults.data(forKey: defaultsKey),
              let config = try? JSONDecoder().decode(WatchRecordingConfig.self, from: data) else {
            return .default
        }
        return config
    }

    public func save(to defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(self) {
            defaults.set(data, forKey: Self.defaultsKey)
        }
    }
}

/// One battery reading taken while recording.
public struct BatterySample: Codable, Equatable, Sendable {
    public let date: Date
    /// 0...100, or nil when the watch would not report a level.
    public let percent: Int?
    public let charging: Bool
    /// "start", "tick", "piece", "interrupted", "resumed", "stop", "low_battery".
    public let event: String

    public init(date: Date, percent: Int?, charging: Bool, event: String) {
        self.date = date
        self.percent = percent
        self.charging = charging
        self.event = event
    }
}

/// The battery record of one recording, from start to stop.
public struct BatterySession: Codable, Identifiable, Equatable, Sendable {
    public let id: UUID
    public let startedAt: Date
    public var endedAt: Date?
    public let config: WatchRecordingConfig
    public var samples: [BatterySample]
    public var pieces: Int
    public var interruptions: Int
    public var endReason: String?

    public init(id: UUID = UUID(), startedAt: Date, config: WatchRecordingConfig) {
        self.id = id
        self.startedAt = startedAt
        self.endedAt = nil
        self.config = config
        self.samples = []
        self.pieces = 0
        self.interruptions = 0
        self.endReason = nil
    }

    /// Readings taken off the charger that carry a level: the only ones drain can be read from.
    private var usable: [BatterySample] {
        samples.filter { $0.percent != nil && !$0.charging }
    }

    public var startPercent: Int? { usable.first?.percent }
    public var endPercent: Int? { usable.last?.percent }

    public var hours: Double {
        guard let first = usable.first, let last = usable.last else { return 0 }
        return last.date.timeIntervalSince(first.date) / 3600
    }

    public var percentUsed: Int? {
        guard let start = startPercent, let end = endPercent else { return nil }
        return start - end
    }

    /// Battery percent per hour of recording. Nil until there are at least ten minutes of readings:
    /// the watch reports whole percents, so a shorter span says nothing.
    public var percentPerHour: Double? {
        guard let used = percentUsed, hours >= 1.0 / 6.0 else { return nil }
        return Double(used) / hours
    }

    /// Hours a full battery would last at this session's rate.
    public var projectedHoursOnFullCharge: Double? {
        guard let rate = percentPerHour, rate > 0 else { return nil }
        return 100 / rate
    }

    public var wasCharging: Bool { samples.contains { $0.charging } }
}
