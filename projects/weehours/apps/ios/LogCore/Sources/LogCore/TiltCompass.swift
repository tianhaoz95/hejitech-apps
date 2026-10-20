import Foundation

/// The watch's tilt mode: four directions, each holding one action the iPhone assigns (Settings →
/// Apple Watch). Tilting the wrist rolls a ball into a direction; holding it there locks the
/// action, and a double pinch logs it. Shared by the phone (which sends the layout as application
/// context) and the watch (which reads it and runs `TiltLock`).
public enum TiltCompass {
    public enum Direction: String, CaseIterable, Identifiable, Sendable {
        case north, east, south, west
        public var id: String { rawValue }
        /// How the caregiver moves the wrist: the ball rolls toward the lower edge of the screen.
        public var gesture: String {
            [.north: "Tilt forward", .east: "Tilt right", .south: "Tilt back", .west: "Tilt left"][self]!
        }
    }

    /// What one direction does: `feed` and `sleep` toggle like the watch's buttons, `diaper` logs a
    /// diaper whose kind is asked later on the iPhone, `care` logs (or starts/stops) a care type.
    public struct Slot: Equatable, Sendable {
        public var direction: Direction
        public var action: String        // feed | diaper | sleep | care
        public var type: String          // the care type's id; the action otherwise
        public var label: String
        public var icon: String
        public var runningId: String     // a running timed activity, which the slot then stops

        public init(direction: Direction, action: String, type: String = "", label: String, icon: String, runningId: String = "") {
            self.direction = direction
            self.action = action
            self.type = type.isEmpty ? action : type
            self.label = label
            self.icon = icon
            self.runningId = runningId
        }

        public var context: [String: String] {
            ["dir": direction.rawValue, "action": action, "type": type, "label": label, "icon": icon, "runningId": runningId]
        }

        public init?(context c: [String: Any]) {
            guard let dir = (c["dir"] as? String).flatMap(Direction.init(rawValue:)), let action = c["action"] as? String,
                  let label = c["label"] as? String else { return nil }
            self.init(direction: dir, action: action, type: c["type"] as? String ?? "", label: label,
                      icon: c["icon"] as? String ?? "circle.fill", runningId: c["runningId"] as? String ?? "")
        }
    }

    /// The layout a new install starts with: feed forward, diaper right, sleep back, and the first
    /// care type that can be logged blind on the left.
    public static func defaultAssignment(_ d: Direction, choices: [String]) -> String {
        switch d {
        case .north: return "feed"
        case .east: return "diaper"
        case .south: return "sleep"
        case .west: return choices.first { !["feed", "diaper", "sleep"].contains($0) } ?? ""
        }
    }

    /// What a direction can hold for this household: feed, diaper and sleep when tracked, and every
    /// enabled care, health or activity type that logs without typing anything (a medicine's name
    /// can't be entered with a tilt), in the spec's order.
    public static func choices(registry: EventRegistry = .shared, enabled: Set<String>) -> [String] {
        var out: [String] = []
        if enabled.contains("bottle") || enabled.contains("breast") { out.append("feed") }
        if enabled.contains("diaper") { out.append("diaper") }
        if enabled.contains("sleep") { out.append("sleep") }
        let grouped = Set(registry.categories.filter { $0.group != nil }.map(\.id))
        for t in registry.types where grouped.contains(t.category) && enabled.contains(t.category) {
            if !(t.fields ?? []).contains(where: \.isRequired) { out.append(t.id) }
        }
        return out
    }
}

/// Turns gravity into a locked direction. Readings are degrees of tilt relative to the posture the
/// wrist was in when tilt mode started (`x` toward the screen's right edge, `y` toward its top), so
/// an arm cradling a baby is the centre. A direction counts once the tilt passes `enter` degrees
/// and the wrist is steady (rotation under `maxRotation`, which ignores rocking and walking); held
/// there for `dwell` seconds it locks.
public struct TiltLock: Sendable {
    public struct Config: Sendable {
        public var enter: Double = 18
        public var exit: Double = 12
        public var dwell: TimeInterval = 1.0
        public var maxRotation: Double = 1.0
        public init() {}
    }

    public enum Phase: Equatable, Sendable {
        case idle
        case aiming(TiltCompass.Direction, since: Date)
        case locked(TiltCompass.Direction)
    }

    public var config: Config
    public private(set) var phase: Phase = .idle
    /// Directions that have something on them; tilting toward an empty one does nothing.
    public var available: Set<TiltCompass.Direction>

    public init(available: Set<TiltCompass.Direction> = Set(TiltCompass.Direction.allCases), config: Config = Config()) {
        self.available = available
        self.config = config
    }

    /// The direction a tilt points at, or nil inside the dead zone. Once aiming, the ball has to
    /// fall back under `exit` degrees to leave, so it doesn't flicker on the edge.
    public func direction(x: Double, y: Double) -> TiltCompass.Direction? {
        let magnitude = (x * x + y * y).squareRoot()
        let current: TiltCompass.Direction? = if case .aiming(let d, _) = phase { d } else { nil }
        let d: TiltCompass.Direction = abs(y) >= abs(x) ? (y > 0 ? .north : .south) : (x > 0 ? .east : .west)
        if let current, magnitude >= config.exit, d == current || magnitude < config.enter { return current }
        return magnitude >= config.enter && available.contains(d) ? d : nil
    }

    /// How far the dwell is, 0…1, for drawing the ring.
    public func progress(at now: Date) -> Double {
        switch phase {
        case .idle: return 0
        case .locked: return 1
        case .aiming(_, let since): return min(1, max(0, now.timeIntervalSince(since) / config.dwell))
        }
    }

    /// Feeds one reading; returns the direction when it has just locked.
    public mutating func update(x: Double, y: Double, rotation: Double, at now: Date) -> TiltCompass.Direction? {
        if case .locked = phase { return nil }
        guard let d = direction(x: x, y: y) else { phase = .idle; return nil }
        guard case .aiming(let current, let since) = phase, current == d else {
            phase = .aiming(d, since: now)
            return nil
        }
        // a moving wrist restarts the dwell rather than counting toward it
        if rotation > config.maxRotation { phase = .aiming(d, since: now); return nil }
        if now.timeIntervalSince(since) >= config.dwell {
            phase = .locked(d)
            return d
        }
        return nil
    }

    /// Back to aiming after a log or a cancel.
    public mutating func reset() { phase = .idle }
}
