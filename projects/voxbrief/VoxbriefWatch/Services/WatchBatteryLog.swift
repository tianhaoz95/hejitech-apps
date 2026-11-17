import Foundation
import WatchKit

/// Records the battery level while a recording runs, so the cost of recording can be read off the
/// watch afterwards (Settings → Battery Log). Readings are taken when the recorder is awake anyway
/// (start, each housekeeping tick, stop), so the log adds no wake-ups of its own.
@MainActor
public final class WatchBatteryLog: ObservableObject {
    public static let shared = WatchBatteryLog()

    @Published public private(set) var sessions: [BatterySession] = []

    private let storageURL: URL
    private static let keptSessions = 40

    public init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        self.storageURL = docs.appendingPathComponent("battery_log.json")
        WKInterfaceDevice.current().isBatteryMonitoringEnabled = true
        load()
        // A session still open at launch belongs to a recording that never reached stop.
        if let idx = sessions.firstIndex(where: { $0.endedAt == nil }) {
            sessions[idx].endedAt = sessions[idx].samples.last?.date ?? sessions[idx].startedAt
            sessions[idx].endReason = "ended unexpectedly"
            persist()
        }
    }

    public var current: BatterySession? { sessions.first(where: { $0.endedAt == nil }) }

    public static func reading(event: String) -> BatterySample {
        let device = WKInterfaceDevice.current()
        let level = device.batteryLevel
        let charging = device.batteryState == .charging || device.batteryState == .full
        return BatterySample(
            date: Date(),
            percent: level >= 0 ? Int((level * 100).rounded()) : nil,
            charging: charging,
            event: event
        )
    }

    public func begin(config: WatchRecordingConfig) {
        var session = BatterySession(startedAt: Date(), config: config)
        session.samples.append(Self.reading(event: "start"))
        sessions.insert(session, at: 0)
        if sessions.count > Self.keptSessions { sessions.removeLast(sessions.count - Self.keptSessions) }
        persist()
    }

    /// Adds a reading to the open session and returns it.
    @discardableResult
    public func sample(event: String) -> BatterySample {
        let reading = Self.reading(event: event)
        guard let idx = sessions.firstIndex(where: { $0.endedAt == nil }) else { return reading }
        sessions[idx].samples.append(reading)
        if event == "piece" { sessions[idx].pieces += 1 }
        if event == "interrupted" { sessions[idx].interruptions += 1 }
        persist()
        return reading
    }

    public func end(reason: String) {
        guard let idx = sessions.firstIndex(where: { $0.endedAt == nil }) else { return }
        sessions[idx].samples.append(Self.reading(event: reason == "low battery" ? "low_battery" : "stop"))
        sessions[idx].endedAt = Date()
        sessions[idx].endReason = reason
        persist()
    }

    public func clear() {
        sessions.removeAll { $0.endedAt != nil }
        persist()
    }

    private func load() {
        guard let data = try? Data(contentsOf: storageURL),
              let loaded = try? JSONDecoder().decode([BatterySession].self, from: data) else { return }
        sessions = loaded
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(sessions) {
            try? data.write(to: storageURL, options: .atomic)
        }
    }
}
