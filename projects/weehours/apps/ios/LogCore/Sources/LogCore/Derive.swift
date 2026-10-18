import Foundation

public enum EventStatus: String, Codable, Sendable {
    case active, undone, superseded, merged
    case duplicateUnresolved = "duplicate_unresolved"
}

public struct DuplicateFlag: Hashable, Sendable {
    public let original: UUID
    public let duplicate: UUID
}

public struct Session: Hashable, Sendable {
    public enum Kind: String, Sendable { case bottle, breast, sleep }
    public let kind: Kind
    /// The child the session belongs to.
    public var babyId: UUID?
    public var start: Date?
    public var end: Date?
    public var startEvent: UUID?
    public var endEvent: UUID?
    public var sides: [String] = []
    public var consumedFraction: Double?
    public var consumedMl: Double?
    public var contents: String?
    /// A start that was followed by another start of the same kind without a finish.
    public var abandoned = false

    public var isOpen: Bool { start != nil && end == nil && !abandoned }
    /// Best known time the session began (falls back to the end for finish-only sessions).
    public var anchor: Date { start ?? end ?? .distantPast }
    public var duration: TimeInterval? {
        guard let start, let end else { return nil }
        return end.timeIntervalSince(start)
    }
}

public struct DutyState: Hashable, Sendable {
    public let caregiver: UUID?
    public let since: Date
}

/// Everything shown anywhere is derived from the log by this one function; it is pure and
/// mirrored by the TypeScript core, with shared fixtures keeping the two in step.
///
/// With `baby`, the log is one child's: their data events, sessions and duplicates (system events
/// such as undo and duty stay household-wide). Without it, the household's: every child's events,
/// with sessions paired per child. Undo, edits and duplicate resolutions are always resolved over
/// the whole household, so an edit that moves an entry to another child removes it from the first.
public struct DerivedLog: Sendable {
    public let baby: UUID?
    public let all: [LogEvent]
    public let status: [UUID: EventStatus]
    /// Active data events (not system events), ordered by `occurredAt`.
    public let effective: [LogEvent]
    public let duplicates: [DuplicateFlag]
    public let sessions: [Session]
    public let duty: DutyState?

    public init(events: [LogEvent], registry: EventRegistry = .shared, asOf: Date? = nil, baby: UUID? = nil) {
        let visible = asOf.map { cutoff in events.filter { $0.occurredAt <= cutoff } } ?? events
        let ordered = visible.sorted { ($0.loggedAt, $0.id.uuidString) < ($1.loggedAt, $1.id.uuidString) }
        self.baby = baby
        func mine(_ e: LogEvent) -> Bool { baby == nil || SystemType.all.contains(e.type) || e.babyId == baby }
        all = ordered.filter(mine)
        let byId = Dictionary(ordered.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })

        // 1. undo events (an undo of an undo restores the target)
        var undone = Set<UUID>()
        for e in ordered where e.type == SystemType.undo {
            guard let target = e.supersedes else { continue }
            if undone.contains(e.id) { continue }
            if undone.contains(target) { undone.remove(target) } else { undone.insert(target) }
        }

        // 2. edits: an active event that supersedes another replaces it
        var superseded = Set<UUID>()
        for e in ordered where !SystemType.all.contains(e.type) && !undone.contains(e.id) {
            if let target = e.supersedes, byId[target] != nil { superseded.insert(target) }
        }

        // 3. duplicate resolutions
        var merged = Set<UUID>()
        var resolvedPairs = Set<String>()
        for e in ordered where e.type == SystemType.resolve && !undone.contains(e.id) {
            guard let a = e.string("original").flatMap(UUID.init(uuidString:)),
                  let b = e.string("duplicate").flatMap(UUID.init(uuidString:)) else { continue }
            resolvedPairs.insert(Self.pairKey(a, b))
            if e.string("resolution") == "merge" { merged.insert(b) }
        }

        var status: [UUID: EventStatus] = [:]
        for e in ordered {
            if undone.contains(e.id) { status[e.id] = .undone }
            else if superseded.contains(e.id) { status[e.id] = .superseded }
            else if merged.contains(e.id) { status[e.id] = .merged }
            else { status[e.id] = .active }
        }

        let data = ordered
            .filter { !SystemType.all.contains($0.type) && status[$0.id] == .active }
            .sorted { ($0.occurredAt, $0.loggedAt) < ($1.occurredAt, $1.loggedAt) }

        // 4. duplicate flags: same child and type, close in time, from another caregiver or another surface
        var flags: [DuplicateFlag] = []
        let lineage = Self.lineage(ordered)
        for (i, a) in data.enumerated() {
            for b in data[(i + 1)...] {
                let window = registry.type(a.type)?.session?.role == "start" ? registry.duplicateWindowStart : registry.duplicateWindowDefault
                if b.occurredAt.timeIntervalSince(a.occurredAt) > window { break }
                guard a.type == b.type, a.babyId == b.babyId else { continue }
                guard a.loggedBy != b.loggedBy || a.provenance.surface != b.provenance.surface else { continue }
                if lineage[a.id] == lineage[b.id] { continue }
                if resolvedPairs.contains(Self.pairKey(a.id, b.id)) { continue }
                let (first, second) = a.loggedAt <= b.loggedAt ? (a, b) : (b, a)
                if flags.contains(where: { $0.duplicate == second.id }) { continue }
                flags.append(DuplicateFlag(original: first.id, duplicate: second.id))
                status[second.id] = .duplicateUnresolved
            }
        }
        let own = data.filter(mine)
        let ownIds = Set(own.map(\.id))
        duplicates = flags.filter { ownIds.contains($0.duplicate) }
        self.status = status
        effective = own
        let active = own.filter { status[$0.id] == .active }
        let children = Dictionary(grouping: active, by: \.babyId)
        sessions = children.count <= 1 ? Self.pairSessions(active, registry: registry)
            : children.values.flatMap { Self.pairSessions($0, registry: registry) }.sorted { ($0.anchor, $0.babyId?.uuidString ?? "") < ($1.anchor, $1.babyId?.uuidString ?? "") }

        // 5. on-duty: the latest duty event wins
        if let d = ordered.last(where: { $0.type == SystemType.duty && status[$0.id] == .active }) {
            duty = DutyState(caregiver: d.string("caregiver").flatMap(UUID.init(uuidString:)), since: d.occurredAt)
        } else {
            duty = nil
        }
    }

    /// Events that count for the status line (excludes unresolved duplicates).
    public var counted: [LogEvent] { effective.filter { status[$0.id] == .active } }

    public func openSession(_ kind: Session.Kind? = nil) -> Session? {
        sessions.last { $0.isOpen && (kind == nil || $0.kind == kind!) }
    }

    public func openFeedSession() -> Session? {
        sessions.last { $0.isOpen && ($0.kind == .bottle || $0.kind == .breast) }
    }

    private static func pairKey(_ a: UUID, _ b: UUID) -> String {
        [a.uuidString, b.uuidString].sorted().joined(separator: "|")
    }

    /// Root id of each event's edit chain, so an edit is never a duplicate of what it replaced.
    private static func lineage(_ events: [LogEvent]) -> [UUID: UUID] {
        let byId = Dictionary(events.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var out: [UUID: UUID] = [:]
        for e in events {
            var root = e.id
            var cur = e
            var hops = 0
            while let s = cur.supersedes, let next = byId[s], hops < 64 { root = next.id; cur = next; hops += 1 }
            out[e.id] = root
        }
        return out
    }

    static func pairSessions(_ events: [LogEvent], registry: EventRegistry) -> [Session] {
        var sessions: [Session] = []
        var open: [Session.Kind: Int] = [:]

        func kind(for type: String) -> Session.Kind? {
            if type.hasPrefix("feed.bottle") { return .bottle }
            if type.hasPrefix("feed.breast") { return .breast }
            if type.hasPrefix("sleep") { return .sleep }
            return nil
        }

        for e in events {
            guard let k = kind(for: e.type) else { continue }
            if e.type == "feed.bottle.single" {
                var s = Session(kind: .bottle, start: e.occurredAt, end: e.occurredAt, startEvent: e.id, endEvent: e.id)
                s.babyId = e.babyId
                s.consumedFraction = e.number("consumed_fraction")
                s.consumedMl = e.number("consumed_ml")
                s.contents = e.string("contents")
                sessions.append(s)
                continue
            }
            let role = registry.type(e.type)?.session?.role ?? "start"
            switch role {
            case "start":
                if let i = open[k] { sessions[i].abandoned = true; open[k] = nil }  // end stays unknown
                var s = Session(kind: k, start: e.occurredAt, startEvent: e.id)
                s.babyId = e.babyId
                if let side = e.string("side") { s.sides.append(side) }
                s.contents = e.string("contents")
                sessions.append(s)
                open[k] = sessions.count - 1
                // a start while another feed kind is open closes nothing; parents can run both
            case "switch":
                if let i = open[k] {
                    if let side = e.string("side") { sessions[i].sides.append(side) }
                } else {
                    var s = Session(kind: k, start: e.occurredAt, startEvent: e.id)
                    s.babyId = e.babyId
                    if let side = e.string("side") { s.sides.append(side) }
                    sessions.append(s)
                    open[k] = sessions.count - 1
                }
            default: // finish
                if let i = open[k] {
                    sessions[i].end = e.occurredAt
                    sessions[i].endEvent = e.id
                    sessions[i].consumedFraction = e.number("consumed_fraction")
                    sessions[i].consumedMl = e.number("consumed_ml")
                    open[k] = nil
                } else {
                    var s = Session(kind: k, start: nil, end: e.occurredAt, endEvent: e.id)
                    s.babyId = e.babyId
                    s.consumedFraction = e.number("consumed_fraction")
                    s.consumedMl = e.number("consumed_ml")
                    sessions.append(s)
                }
            }
        }
        return sessions
    }
}
