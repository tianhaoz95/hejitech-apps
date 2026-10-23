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
    public var switchEvents: [UUID] = []
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
    /// Every constituent event id in chronological order.
    public var eventIds: [UUID] {
        var ids: [UUID] = []
        if let startEvent { ids.append(startEvent) }
        ids.append(contentsOf: switchEvents)
        if let endEvent, endEvent != startEvent { ids.append(endEvent) }
        return ids
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
                    sessions[i].switchEvents.append(e.id)
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
                    if let c = e.string("contents"), sessions[i].contents == nil { sessions[i].contents = c }
                    open[k] = nil
                } else {
                    var s = Session(kind: k, start: nil, end: e.occurredAt, endEvent: e.id)
                    s.babyId = e.babyId
                    s.consumedFraction = e.number("consumed_fraction")
                    s.consumedMl = e.number("consumed_ml")
                    s.contents = e.string("contents")
                    sessions.append(s)
                }
            }
        }
        return sessions
    }

    // MARK: - Feature derivations (pure facts from the log)

    /// Factual digest of a duty shift (either the previous completed shift right after a hand-off,
    /// or the ongoing shift when `includeCurrent` is true).
    public func shiftSummary(household: Household, now: Date = Date(), includeCurrent: Bool = false) -> ShiftSummary? {
        let duties = all.filter { $0.type == SystemType.duty && status[$0.id] == .active }
            .sorted { $0.occurredAt < $1.occurredAt }
        let startAt: Date
        let endAt: Date
        let caregiver: UUID?
        if duties.count >= 2 && !includeCurrent {
            let prev = duties[duties.count - 2]
            let last = duties[duties.count - 1]
            startAt = prev.occurredAt
            endAt = last.occurredAt
            caregiver = prev.string("caregiver").flatMap(UUID.init(uuidString:))
        } else if let last = duties.last {
            startAt = last.occurredAt
            endAt = now
            caregiver = last.string("caregiver").flatMap(UUID.init(uuidString:))
        } else {
            return nil
        }
        let inWindow = counted.filter { $0.occurredAt >= startAt && $0.occurredAt <= endAt }
        let feedSessions = sessions.filter { ($0.kind == .bottle || $0.kind == .breast) && $0.anchor >= startAt && $0.anchor <= endAt }
        let solidsCount = inWindow.filter { $0.type == "feed.solids" }.count
        let feedCount = feedSessions.count + solidsCount
        let bottleMl = inWindow.filter { $0.type == "feed.bottle.finish" || $0.type == "feed.bottle.single" }
            .compactMap { household.milliliters($0) }.reduce(0, +)
        let diapers = inWindow.filter { $0.type == "diaper" }
        let wetDiapers = diapers.filter { let k = $0.string("kind"); return k == "wet" || k == "both" }.count
        let dirtyDiapers = diapers.filter { let k = $0.string("kind"); return k == "dirty" || k == "both" }.count
        let sleepList = sessions.filter { $0.kind == .sleep && ($0.end ?? now) > startAt && ($0.start ?? startAt) < endAt }
        let sleepSeconds = sleepList.reduce(0.0) { sum, s in
            let a = max(s.start ?? startAt, startAt)
            let b = min(s.end ?? now, endAt)
            return sum + max(0, b.timeIntervalSince(a))
        }
        let meds: [ShiftSummary.MedEntry] = inWindow.filter { $0.type == "medication" }.map { e in
            ShiftSummary.MedEntry(id: e.id, medicine: e.string("medicine") ?? "Medication", dose: e.string("dose"), occurredAt: e.occurredAt)
        }
        let notes: [ShiftSummary.NoteEntry] = all.filter {
            $0.type == SystemType.note && status[$0.id] == .active && $0.occurredAt >= startAt && $0.occurredAt <= endAt
        }.compactMap { e in
            let text = (e.string("transcript") ?? e.provenance.rawTranscript ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return text.isEmpty ? nil : ShiftSummary.NoteEntry(id: e.id, text: text, occurredAt: e.occurredAt, by: e.loggedBy)
        }
        return ShiftSummary(caregiver: caregiver, startedAt: startAt, endedAt: endAt, feedCount: feedCount,
                            bottleMl: bottleMl, wetDiapers: wetDiapers, dirtyDiapers: dirtyDiapers,
                            sleepSeconds: sleepSeconds, sleepStretches: sleepList.count,
                            medications: meds, notes: notes)
    }

    /// FIFO breast-milk stash in the fridge and freezer, derived from `pump` and `breast_milk` bottle entries,
    /// tracked against CDC safe storage guidelines (room 4h, fridge 4d, freezer 6mo).
    public func milkStash(household: Household, now: Date = Date()) -> MilkStash {
        struct Lot { var ml: Double; var at: Date }
        var fridge: [Lot] = []
        var freezer: [Lot] = []
        // map start event id -> contents so a finish event inherits `breast_milk` from its start
        var startContents: [UUID: String] = [:]
        for s in sessions where s.kind == .bottle {
            if let endId = s.endEvent, let c = s.contents { startContents[endId] = c }
        }
        for e in counted {
            if e.type == "pump" {
                let ml = e.number("amount_ml") ?? household.bottleMl(for: e.babyId)
                guard ml > 0 else { continue }
                let storage = e.string("storage") ?? "fridge"
                if storage == "freezer" {
                    if e.fields["from_fridge"] == .bool(true) {
                        var rem = ml
                        while rem > 0, !fridge.isEmpty {
                            let take = min(fridge[0].ml, rem)
                            fridge[0].ml -= take
                            rem -= take
                            if fridge[0].ml <= 0.1 { fridge.removeFirst() }
                        }
                    }
                    freezer.append(Lot(ml: ml, at: e.occurredAt))
                } else if storage == "fridge" {
                    fridge.append(Lot(ml: ml, at: e.occurredAt))
                }
            } else if e.type == "feed.bottle.finish" || e.type == "feed.bottle.single" {
                let contents = e.string("contents") ?? startContents[e.id]
                guard contents == "breast_milk" else { continue }
                var rem = household.milliliters(e) ?? household.bottleMl(for: e.babyId)
                while rem > 0, !fridge.isEmpty {
                    let take = min(fridge[0].ml, rem)
                    fridge[0].ml -= take
                    rem -= take
                    if fridge[0].ml <= 0.1 { fridge.removeFirst() }
                }
            }
        }
        let fridgeMl = fridge.map(\.ml).reduce(0, +).rounded()
        let freezerMl = freezer.map(\.ml).reduce(0, +).rounded()

        var batchList: [MilkStash.Batch] = []
        var expiringSoon = 0
        var expired = 0

        // CDC guidelines: fridge safe up to 4 days (4 * 86400s)
        for lot in fridge {
            let exp = lot.at.addingTimeInterval(4 * 24 * 3600)
            let isExp = now > exp
            let isSoon = !isExp && exp.timeIntervalSince(now) <= 24 * 3600
            if isExp { expired += 1 }
            else if isSoon { expiringSoon += 1 }
            batchList.append(MilkStash.Batch(ml: lot.ml.rounded(), at: lot.at, location: "fridge", expiresAt: exp, isExpiringSoon: isSoon, isExpired: isExp))
        }

        // CDC guidelines: freezer safe up to 6 months (180 * 86400s)
        for lot in freezer {
            let exp = lot.at.addingTimeInterval(180 * 24 * 3600)
            let isExp = now > exp
            let isSoon = !isExp && exp.timeIntervalSince(now) <= 7 * 24 * 3600
            if isExp { expired += 1 }
            else if isSoon { expiringSoon += 1 }
            batchList.append(MilkStash.Batch(ml: lot.ml.rounded(), at: lot.at, location: "freezer", expiresAt: exp, isExpiringSoon: isSoon, isExpired: isExp))
        }

        return MilkStash(fridgeMl: fridgeMl, freezerMl: freezerMl, fridgeLots: fridge.count, freezerBags: freezer.count,
                         oldestFridgeAt: fridge.first?.at, oldestFreezerAt: freezer.first?.at,
                         batches: batchList, expiringSoonCount: expiringSoon, expiredCount: expired)
    }

    /// Summary of solid foods tried, Top-9 allergen exposure counts, and any logged reactions.
    public func solidsSummary() -> SolidsSummary {
        var counts: [String: Int] = [:]
        var orderedFoods: [String] = []
        var allergenCounts: [String: Int] = Dictionary(uniqueKeysWithValues: SolidsSummary.topAllergens.map { ($0.key, 0) })
        var reactions: [SolidsSummary.ReactionRecord] = []
        for e in counted where e.type == "feed.solids" {
            let raw = e.string("foods") ?? ""
            let items = raw.split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            for item in items {
                let canonical = item.prefix(1).uppercased() + item.dropFirst().lowercased()
                if counts[canonical] == nil { orderedFoods.append(canonical) }
                counts[canonical, default: 0] += 1
                let lower = canonical.lowercased()
                for a in SolidsSummary.topAllergens where a.keywords.contains(where: { lower.contains($0) }) {
                    allergenCounts[a.key, default: 0] += 1
                }
            }
            if let r = e.string("reaction"), r != "none", !r.isEmpty {
                let foodLabel = items.isEmpty ? "Solids" : items.joined(separator: ", ")
                reactions.append(.init(id: e.id, foods: foodLabel, reaction: r, occurredAt: e.occurredAt))
            }
        }
        return SolidsSummary(triedFoods: orderedFoods, foodCounts: counts, allergenCounts: allergenCounts, reactions: reactions)
    }

    /// Factual summary since the last doctor visit (or last 14 days) + queued questions for the pediatrician.
    public func doctorVisitPack(household: Household, now: Date = Date()) -> DoctorVisitPack {
        let visits = counted.filter { $0.type == "doctor_visit" }
        let lastVisit = visits.last
        let since = lastVisit?.occurredAt ?? now.addingTimeInterval(-14 * 86400)
        let sevenDaysAgo = now.addingTimeInterval(-7 * 86400)
        let spanDays = max(1.0, min(7.0, now.timeIntervalSince( min(counted.first?.occurredAt ?? now, sevenDaysAgo) ) / 86400))

        let recentFeeds = sessions.filter { ($0.kind == .bottle || $0.kind == .breast) && $0.anchor >= sevenDaysAgo }
        let recentSolids = counted.filter { $0.type == "feed.solids" && $0.occurredAt >= sevenDaysAgo }
        let recentBottleMl = counted.filter { ($0.type == "feed.bottle.finish" || $0.type == "feed.bottle.single") && $0.occurredAt >= sevenDaysAgo }
            .compactMap { household.milliliters($0) }.reduce(0, +)
        let recentDiapers = counted.filter { $0.type == "diaper" && $0.occurredAt >= sevenDaysAgo }
        let wet7d = recentDiapers.filter { let k = $0.string("kind"); return k == "wet" || k == "both" }.count
        let dirty7d = recentDiapers.filter { let k = $0.string("kind"); return k == "dirty" || k == "both" }.count

        func measure(_ type: String, _ key: String) -> (latest: Double?, delta: Double?) {
            let list = counted.filter { $0.type == type }.compactMap { e -> (Date, Double)? in
                guard let v = e.number(key) else { return nil }
                return (e.occurredAt, v)
            }
            guard let latest = list.last else { return (nil, nil) }
            let baseline = list.last { $0.0 <= since } ?? (list.count >= 2 ? list[list.count - 2] : nil)
            let delta = baseline.flatMap { b in b.0 == latest.0 ? nil : latest.1 - b.1 }
            return (latest.1, delta)
        }

        let w = measure("weight", "grams")
        let h = measure("height", "height_cm")
        let hd = measure("head", "head_cm")
        let healthTypes: Set<String> = ["medication", "symptom", "temperature", "vaccination", "teething"]
        let healthEvents = counted.filter { healthTypes.contains($0.type) && $0.occurredAt >= since }

        let questions = all.filter { e in
            guard e.type == SystemType.note && status[e.id] == .active else { return false }
            if e.fields["for_doctor"] == .bool(true) || e.string("for_doctor") == "yes" { return true }
            let text = (e.string("transcript") ?? e.provenance.rawTranscript ?? "").lowercased()
            return text.contains("ask the doctor") || text.contains("ask the pediatrician") || text.contains("ask doctor") || text.contains("ask pediatrician")
        }.sorted { $0.occurredAt > $1.occurredAt }

        return DoctorVisitPack(
            lastVisitAt: lastVisit?.occurredAt,
            lastVisitReason: lastVisit?.string("reason"),
            latestWeightGrams: w.latest, weightDeltaGrams: w.delta,
            latestHeightCm: h.latest, heightDeltaCm: h.delta,
            latestHeadCm: hd.latest, headDeltaCm: hd.delta,
            feedsPerDay7d: Double(recentFeeds.count + recentSolids.count) / spanDays,
            bottleMlPerDay7d: recentBottleMl / spanDays,
            wetDiapersPerDay7d: Double(wet7d) / spanDays,
            dirtyDiapersPerDay7d: Double(dirty7d) / spanDays,
            healthEvents: healthEvents,
            questions: questions
        )
    }
}

public struct ShiftSummary: Codable, Hashable, Sendable {
    public struct MedEntry: Codable, Hashable, Sendable, Identifiable {
        public let id: UUID
        public let medicine: String
        public let dose: String?
        public let occurredAt: Date
    }
    public struct NoteEntry: Codable, Hashable, Sendable, Identifiable {
        public let id: UUID
        public let text: String
        public let occurredAt: Date
        public let by: UUID
    }
    public var caregiver: UUID?
    public var startedAt: Date
    public var endedAt: Date
    public var feedCount: Int
    public var bottleMl: Double
    public var wetDiapers: Int
    public var dirtyDiapers: Int
    public var sleepSeconds: Double
    public var sleepStretches: Int
    public var medications: [MedEntry]
    public var notes: [NoteEntry]
}

public struct MilkStash: Codable, Hashable, Sendable {
    public struct Batch: Codable, Hashable, Sendable, Identifiable {
        public var id: String { "\(location)-\(Int(at.timeIntervalSince1970))-\(Int(ml))" }
        public var ml: Double
        public var at: Date
        public var location: String // "fridge" | "freezer"
        public var expiresAt: Date
        public var isExpiringSoon: Bool
        public var isExpired: Bool

        public init(ml: Double, at: Date, location: String, expiresAt: Date, isExpiringSoon: Bool, isExpired: Bool) {
            self.ml = ml
            self.at = at
            self.location = location
            self.expiresAt = expiresAt
            self.isExpiringSoon = isExpiringSoon
            self.isExpired = isExpired
        }
    }

    public var fridgeMl: Double
    public var freezerMl: Double
    public var fridgeLots: Int
    public var freezerBags: Int
    public var oldestFridgeAt: Date?
    public var oldestFreezerAt: Date?
    public var batches: [Batch]
    public var expiringSoonCount: Int
    public var expiredCount: Int

    public init(fridgeMl: Double, freezerMl: Double, fridgeLots: Int, freezerBags: Int,
                oldestFridgeAt: Date?, oldestFreezerAt: Date?,
                batches: [Batch] = [], expiringSoonCount: Int = 0, expiredCount: Int = 0) {
        self.fridgeMl = fridgeMl
        self.freezerMl = freezerMl
        self.fridgeLots = fridgeLots
        self.freezerBags = freezerBags
        self.oldestFridgeAt = oldestFridgeAt
        self.oldestFreezerAt = oldestFreezerAt
        self.batches = batches
        self.expiringSoonCount = expiringSoonCount
        self.expiredCount = expiredCount
    }
}

public struct SolidsSummary: Hashable, Sendable {
    public struct AllergenSpec: Sendable {
        public let key: String
        public let label: String
        public let keywords: [String]
    }
    public struct ReactionRecord: Hashable, Sendable, Identifiable {
        public let id: UUID
        public let foods: String
        public let reaction: String
        public let occurredAt: Date
    }
    public static let topAllergens: [AllergenSpec] = [
        .init(key: "egg", label: "Egg", keywords: ["egg"]),
        .init(key: "peanut", label: "Peanut", keywords: ["peanut"]),
        .init(key: "dairy", label: "Dairy", keywords: ["yogurt", "cheese", "milk", "butter", "dairy", "cottage"]),
        .init(key: "tree_nut", label: "Tree nut", keywords: ["almond", "cashew", "walnut", "pecan", "hazelnut", "pistachio"]),
        .init(key: "soy", label: "Soy", keywords: ["tofu", "soy", "edamame"]),
        .init(key: "wheat", label: "Wheat", keywords: ["wheat", "bread", "toast", "pasta", "noodle", "cereal", "oatmeal"]),
        .init(key: "fish", label: "Fish", keywords: ["salmon", "cod", "tuna", "fish", "tilapia", "sardine"]),
        .init(key: "shellfish", label: "Shellfish", keywords: ["shrimp", "prawn", "crab", "lobster", "shellfish"]),
        .init(key: "sesame", label: "Sesame", keywords: ["sesame", "tahini", "hummus"]),
    ]
    public var triedFoods: [String]
    public var foodCounts: [String: Int]
    public var allergenCounts: [String: Int]
    public var reactions: [ReactionRecord]
}

public struct DoctorVisitPack: Hashable, Sendable {
    public var lastVisitAt: Date?
    public var lastVisitReason: String?
    public var latestWeightGrams: Double?
    public var weightDeltaGrams: Double?
    public var latestHeightCm: Double?
    public var heightDeltaCm: Double?
    public var latestHeadCm: Double?
    public var headDeltaCm: Double?
    public var feedsPerDay7d: Double
    public var bottleMlPerDay7d: Double
    public var wetDiapersPerDay7d: Double
    public var dirtyDiapersPerDay7d: Double
    public var healthEvents: [LogEvent]
    public var questions: [LogEvent]

    public func plainTextSummary(babyName: String, household: Household) -> String {
        var lines: [String] = ["\(babyName) — Pediatrician Fact Sheet"]
        if let lastVisitAt {
            lines.append("Since last visit on \(lastVisitAt.formatted(date: .abbreviated, time: .omitted)):")
        } else {
            lines.append("Recent 7-day summary:")
        }
        var meas: [String] = []
        if let w = latestWeightGrams {
            let d = weightDeltaGrams.map { String(format: " (%+.0f g)", $0) } ?? ""
            meas.append(String(format: "Weight: %.2f kg%@", w / 1000, d))
        }
        if let h = latestHeightCm {
            let d = heightDeltaCm.map { String(format: " (%+.1f cm)", $0) } ?? ""
            meas.append(String(format: "Length: %.1f cm%@", h, d))
        }
        if let hd = latestHeadCm {
            let d = headDeltaCm.map { String(format: " (%+.1f cm)", $0) } ?? ""
            meas.append(String(format: "Head: %.1f cm%@", hd, d))
        }
        if !meas.isEmpty { lines.append("• " + meas.joined(separator: " · ")) }
        lines.append(String(format: "• Feeds (7d avg): %.1f/day · %.0f ml/day bottle", feedsPerDay7d, bottleMlPerDay7d))
        lines.append(String(format: "• Diapers (7d avg): %.1f wet/day · %.1f dirty/day", wetDiapersPerDay7d, dirtyDiapersPerDay7d))
        if !healthEvents.isEmpty {
            let summary = healthEvents.suffix(5).map {
                "\(VoiceInterpreter.label(type: $0.type, fields: $0.fields)) (\($0.occurredAt.formatted(date: .abbreviated, time: .shortened)))"
            }.joined(separator: "; ")
            lines.append("• Health entries: \(summary)")
        }
        if !questions.isEmpty {
            lines.append("Questions for the doctor:")
            for q in questions {
                let text = q.string("transcript") ?? q.provenance.rawTranscript ?? ""
                if !text.isEmpty { lines.append("  - \(text)") }
            }
        }
        return lines.joined(separator: "\n")
    }
}
