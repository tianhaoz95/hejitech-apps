import Foundation

public protocol Transcriber: Sendable {
    func transcribe(fileURL: URL) async throws -> String
    /// The English the decision layer reads and, when the phone listens in another language, the
    /// words as spoken (nil in English).
    func transcribeSpoken(fileURL: URL) async throws -> (english: String, spoken: String?)
    func warmUp() async
}

public extension Transcriber {
    func warmUp() async {}
    func transcribeSpoken(fileURL: URL) async throws -> (english: String, spoken: String?) {
        (try await transcribe(fileURL: fileURL), nil)
    }
}

/// The transcript an entry keeps. Spoken in another language, it's both: what was said and the
/// English the decision layer read, "Pañal mojado. (Diaper, wet.)", so the log shows the parent's
/// own words and still reads in English (timeline, CSV, MCP).
public enum VoiceTranscript {
    public static func display(english: String, spoken: String?) -> String {
        let english = english.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let spoken = spoken?.trimmingCharacters(in: .whitespacesAndNewlines), !spoken.isEmpty,
              spoken.lowercased() != english.lowercased() else { return english }
        guard !english.isEmpty else { return spoken }
        return "\(spoken) (\(english))"
    }
}

/// The one write path every surface goes through on the phone (app UI, widgets, App Intents,
/// watch messages, capture processing). It validates against the registry, writes locally first
/// (zero data loss), and leaves syncing to `sync()`.
public actor LogService {
    public nonisolated let store: LogStore
    public private(set) var household: Household
    public let me: UUID
    public var interpreter: VoiceInterpreter
    public var transcriber: Transcriber?
    public var backend: SupabaseClient?
    private let registry: EventRegistry

    public init(store: LogStore, household: Household, me: UUID, interpreter: VoiceInterpreter,
                transcriber: Transcriber? = nil, backend: SupabaseClient? = nil, registry: EventRegistry = .shared) {
        self.store = store
        self.household = household
        self.me = me
        self.interpreter = interpreter
        self.transcriber = transcriber
        self.backend = backend
        self.registry = registry
    }

    public func setInterpreter(_ i: VoiceInterpreter) { interpreter = i }
    public func setTranscriber(_ t: Transcriber?) { transcriber = t }
    public func setBackend(_ b: SupabaseClient?) { backend = b }
    public func setHousehold(_ h: Household) { household = h }

    public enum LogError: Error, LocalizedError {
        case unknownType(String)
        case disabledCategory(String)
        case invalidField(String)

        public var errorDescription: String? {
            switch self {
            case .unknownType(let t): return "Unknown entry type \(t)"
            case .disabledCategory(let c): return "\(c) logging is turned off for this household"
            case .invalidField(let f): return "Invalid value for \(f)"
            }
        }
    }

    // MARK: reading

    /// The household's log, or one child's with `baby`.
    public func derived(asOf: Date? = nil, baby: UUID? = nil) throws -> DerivedLog {
        DerivedLog(events: try store.events(), registry: registry, asOf: asOf, baby: baby)
    }

    /// Every child's log from one read of the store, in display order.
    public func derivedByChild(_ babies: [Baby]? = nil) throws -> [(Baby, DerivedLog)] {
        let events = try store.events()
        return (babies ?? household.active).map { ($0, DerivedLog(events: events, registry: registry, baby: $0.id)) }
    }

    /// One child's status line (the first child's by default). Voice entries waiting on a phone
    /// count on every child's line only while there is one child; with several, Now lists them.
    public func status(baby: UUID? = nil, now: Date = Date()) throws -> StatusSnapshot {
        let caps = try store.captures()
        let single = household.active.count == 1
        return StatusSnapshot(log: try derived(baby: baby ?? household.babyId), now: now,
                              pendingCaptures: single ? caps.filter { $0.status == .pending }.count : 0,
                              pendingPicks: single ? caps.filter { $0.status == .needsReview }.count : 0)
    }

    // MARK: writing

    /// Validates and appends a typed entry for `baby` (the first child when nil).
    @discardableResult
    public func log(type: String, fields: [String: FieldValue] = [:], occurredAt: Date = Date(), provenance: Provenance,
                    supersedes: UUID? = nil, id: UUID = UUID(), sessionId: UUID? = nil, loggedBy: UUID? = nil, baby: UUID? = nil) throws -> LogEvent {
        if !SystemType.all.contains(type) {
            guard let spec = registry.type(type) else { throw LogError.unknownType(type) }
            guard household.enabled.contains(spec.category) else { throw LogError.disabledCategory(spec.category) }
            try validate(type: type, fields: fields)
        }
        let e = LogEvent(id: id, householdId: household.id, babyId: baby ?? household.babyId, type: type, fields: fields,
                         occurredAt: occurredAt, loggedAt: Date(), loggedBy: loggedBy ?? me, provenance: provenance,
                         supersedes: supersedes, sessionId: sessionId)
        try store.append(e)
        return e
    }

    func validate(type: String, fields: [String: FieldValue]) throws {
        let allowed: [String: Set<String>] = [
            "side": ["left", "right", "both"], "contents": ["formula", "breast_milk"], "kind": ["wet", "dirty", "both", "dry"],
            "amount": ["taste", "some", "most", "all"], "storage": ["fridge", "freezer", "fed"],
            "reaction": ["none", "rash", "hives", "vomiting", "diarrhea", "gas", "spit_up"],
            "stool_color": Set(StoolColor.allCases.map(\.rawValue)),
        ]
        for (k, v) in fields {
            if let set = allowed[k], !(v.string.map(set.contains) ?? false) { throw LogError.invalidField(k) }
            if ["consumed_fraction"].contains(k), !((v.number ?? -1) > 0 && (v.number ?? 2) <= 1) { throw LogError.invalidField(k) }
            if ["consumed_ml", "amount_ml", "grams", "height_cm", "head_cm"].contains(k), !((v.number ?? -1) > 0) { throw LogError.invalidField(k) }
        }
        // a watch tilt logs a diaper whose kind the iPhone asks for later (`needs_details`)
        if type == "diaper", fields["kind"] == nil, fields[LogEvent.needsDetails] != .bool(true) { throw LogError.invalidField("kind") }
        if type == "weight", fields["grams"] == nil { throw LogError.invalidField("grams") }
        if type == "height", fields["height_cm"] == nil { throw LogError.invalidField("height_cm") }
        if type == "head", fields["head_cm"] == nil { throw LogError.invalidField("head_cm") }
        for f in registry.type(type)?.fields ?? [] {   // types the spec describes field by field
            guard let v = fields[f.key] else {
                if f.isRequired { throw LogError.invalidField(f.key) }
                continue
            }
            switch f.kind {
            case "choice": if !(v.string.map { s in f.options?.contains { $0.key == s } ?? false } ?? false) { throw LogError.invalidField(f.key) }
            case "number": if !((v.number ?? -1) > 0) { throw LogError.invalidField(f.key) }
            default: if (v.string ?? "").trimmingCharacters(in: .whitespaces).isEmpty { throw LogError.invalidField(f.key) }
            }
        }
    }

    @discardableResult
    public func undo(_ id: UUID, surface: Surface = .phone) throws -> LogEvent {
        let target = try store.events().first { $0.id == id }
        return try log(type: SystemType.undo, provenance: Provenance(surface: surface, input: .tap), supersedes: id, baby: target?.babyId)
    }

    /// Edits are new events of the same type that supersede the old one. `baby` moves the entry
    /// to another child (logged for the wrong one).
    @discardableResult
    public func edit(_ id: UUID, fields: [String: FieldValue], occurredAt: Date? = nil, baby: UUID? = nil, surface: Surface = .phone) throws -> LogEvent {
        guard let old = try store.events().first(where: { $0.id == id }) else { throw LogError.invalidField("id") }
        var p = old.provenance
        p.surface = surface
        p.input = .tap
        return try log(type: old.type, fields: fields, occurredAt: occurredAt ?? old.occurredAt, provenance: p,
                       supersedes: id, sessionId: old.sessionId, baby: baby ?? old.babyId)
    }

    /// Starts a timed activity (tummy time, play, a walk): an entry marked `ongoing` until `stopTimed`.
    @discardableResult
    public func startTimed(_ type: String, at: Date = Date(), baby: UUID? = nil, fields: [String: FieldValue] = [:],
                           surface: Surface = .phone, input: InputKind = .tap) throws -> LogEvent {
        try log(type: type, fields: fields.merging(["ongoing": .bool(true)]) { $1 }, occurredAt: at,
                provenance: Provenance(surface: surface, input: input), baby: baby)
    }

    /// Stops it: an edit of the entry with its minutes (at least 1) instead of `ongoing`, so every
    /// household phone sees the same, finished entry.
    @discardableResult
    public func stopTimed(_ id: UUID, at: Date = Date(), surface: Surface = .phone) throws -> LogEvent {
        guard let e = try store.events().first(where: { $0.id == id }) else { throw LogError.invalidField("id") }
        var fields = e.fields
        fields["ongoing"] = nil
        fields["minutes"] = .number(max(1, (at.timeIntervalSince(e.occurredAt) / 60).rounded()))
        return try edit(id, fields: fields, surface: surface)
    }

    @discardableResult
    public func resolveDuplicate(original: UUID, duplicate: UUID, merge: Bool, surface: Surface = .phone) throws -> LogEvent {
        try log(type: SystemType.resolve, fields: ["original": .string(original.uuidString), "duplicate": .string(duplicate.uuidString),
                                                   "resolution": .string(merge ? "merge" : "keep_both")],
                provenance: Provenance(surface: surface, input: .tap))
    }

    @discardableResult
    public func setOnDuty(_ caregiver: UUID?, surface: Surface = .phone) throws -> LogEvent {
        try log(type: SystemType.duty, fields: caregiver.map { ["caregiver": .string($0.uuidString)] } ?? [:],
                provenance: Provenance(surface: surface, input: .tap))
    }

    /// The contextual one-tap action for a child: finish their open feed, or start their default feed.
    @discardableResult
    public func toggleFeed(baby: UUID? = nil, surface: Surface, input: InputKind = .tap, now: Date = Date(), fields extra: [String: FieldValue] = [:]) throws -> LogEvent {
        let baby = baby ?? household.babyId
        let log = try derived(baby: baby)
        let p = Provenance(surface: surface, input: input)
        if let open = log.openFeedSession() {
            return try self.log(type: open.kind == .bottle ? "feed.bottle.finish" : "feed.breast.finish", fields: extra, occurredAt: now, provenance: p, baby: baby)
        }
        if household.defaultFeed(for: baby) == "breast" && household.enabled.contains("breast") {
            let side = StatusSnapshot(log: log, now: now).nextSide ?? "left"
            return try self.log(type: "feed.breast.start", fields: ["side": .string(side)].merging(extra) { $1 }, occurredAt: now, provenance: p, baby: baby)
        }
        return try self.log(type: "feed.bottle.start", fields: extra, occurredAt: now, provenance: p, baby: baby)
    }

    @discardableResult
    public func toggleSleep(baby: UUID? = nil, surface: Surface, input: InputKind = .tap, now: Date = Date(), fields extra: [String: FieldValue] = [:]) throws -> LogEvent {
        let baby = baby ?? household.babyId
        let open = try derived(baby: baby).openSession(.sleep) != nil
        return try log(type: open ? "sleep.end" : "sleep.start", fields: extra, occurredAt: now, provenance: Provenance(surface: surface, input: input), baby: baby)
    }

    @discardableResult
    public func switchSide(baby: UUID? = nil, surface: Surface, input: InputKind = .tap, now: Date = Date(), fields extra: [String: FieldValue] = [:]) throws -> LogEvent? {
        let baby = baby ?? household.babyId
        let log = try derived(baby: baby)
        guard let open = log.openSession(.breast) else { return nil }
        let next = open.sides.last == "left" ? "right" : "left"
        return try self.log(type: "feed.breast.switch", fields: ["side": .string(next)].merging(extra) { $1 }, occurredAt: now,
                            provenance: Provenance(surface: surface, input: input), baby: baby)
    }

    /// Runs one action for several children at once ("Both" / "All"): each child gets their own
    /// event, all sharing a `group` field so Undo can take them back together. Children the
    /// action doesn't apply to (`nil` from the body) are skipped.
    public func forEach(_ babies: [UUID], _ body: @Sendable (isolated LogService, UUID, [String: FieldValue]) throws -> LogEvent?) throws -> [LogEvent] {
        let group: [String: FieldValue] = babies.count > 1 ? ["group": .string(UUID().uuidString)] : [:]
        return try babies.compactMap { try body(self, $0, group) }
    }

    /// Undoes every active entry that shares `event`'s group (or just `event` without one).
    @discardableResult
    public func undoGroup(of id: UUID, surface: Surface = .phone) throws -> [LogEvent] {
        let all = try derived()
        guard let e = all.all.first(where: { $0.id == id }), let group = e.string("group") else { return [try undo(id, surface: surface)] }
        return try all.all.filter { $0.string("group") == group && all.status[$0.id] != .undone }.map { try undo($0.id, surface: surface) }
    }

    // MARK: voice

    public struct VoiceResult: Sendable {
        public let capture: Capture
        public let interpretation: Interpretation
        /// Every event written: one per child the entry is for.
        public let events: [LogEvent]
        public var committed: LogEvent? { events.first }
    }

    /// Runs the decision layer on a transcript captured at `capturedAt` and applies the policy:
    /// auto-commit, or keep the capture in `needs_review` with its candidates. The entry is for the
    /// children the sentence names, else `babies` (the device's current children), else the first.
    /// `quickCapture` (a per-phone setting) logs the top guess instead of asking: the best candidate,
    /// or a note when "none of these" won; `reopenCapture` asks after all.
    /// `transcript` is English, what the decision layer reads; `spoken` is the sentence as said when
    /// that was another language, kept next to the English in the capture and its entries.
    public func processVoice(transcript: String, spoken: String? = nil, surface: Surface, capturedAt: Date = Date(), attachTo: UUID? = nil,
                             captureId: UUID = UUID(), loggedBy: UUID? = nil, babies: [UUID]? = nil,
                             quickCapture: Bool = false) async throws -> VoiceResult {
        let current = (babies ?? []).filter { id in household.active.contains { $0.id == id } }
        let targets = Parsers.children(in: transcript, among: household.active) ?? (current.isEmpty ? [household.babyId] : current)
        let asOf = try derived(asOf: capturedAt, baby: targets[0])
        let ctx = InterpretContext(reference: capturedAt, log: asOf, enabledCategories: household.enabled, bottleMl: household.bottleMl(for: targets[0]))
        var interp = try await interpreter.interpret(transcript, context: ctx)
        interp.babyIds = targets
        var capture = Capture(id: captureId, householdId: household.id, surface: surface, capturedAt: capturedAt,
                              loggedBy: loggedBy ?? me, transcript: VoiceTranscript.display(english: transcript, spoken: spoken), attachTo: attachTo, babyId: current.first, status: .needsReview,
                              interpretation: interp, processedBy: me, processedAt: Date())
        var events: [LogEvent] = []
        let noneWon = interp.noneConfidence != nil
        if let best = interp.best, !noneWon, interp.tier == .auto || quickCapture {
            events = try commit(best, capture: capture, interpretation: interp)
            capture.status = .done
        }
        try store.saveCapture(capture, synced: false)
        if noneWon, interp.isNotALog(policy: registry.policy) || quickCapture, let note = try dismissCapture(captureId) {
            // not a log entry: kept as a note without asking; `reopenCapture` logs it after all
            capture.status = .dismissed
            events = [note]
        }
        return VoiceResult(capture: capture, interpretation: interp, events: events)
    }

    /// "Log it" on a sentence kept as a note, or "Change" on a quick-capture guess: takes those
    /// events back and asks again with the capture's candidates.
    public func reopenCapture(_ id: UUID, undoing events: [UUID]) throws {
        guard var capture = try store.captures().first(where: { $0.id == id }) else { return }
        for e in events { try undo(e) }
        capture.status = .needsReview
        try store.saveCapture(capture, synced: false)
    }

    /// The parent picked candidate `index` (pick mode or full list).
    @discardableResult
    public func resolveCapture(_ id: UUID, candidate index: Int) throws -> [LogEvent] {
        guard var capture = try store.captures().first(where: { $0.id == id }), let interp = capture.interpretation,
              interp.candidates.indices.contains(index) else { return [] }
        var chosen = interp.candidates[index]
        chosen.probability = 1
        let events = try commit(chosen, capture: capture, interpretation: interp, tier: interp.tier)
        capture.status = .done
        try store.saveCapture(capture, synced: false)
        return events
    }

    /// Dismissed without a choice: the transcript is kept as a note, never lost.
    @discardableResult
    public func dismissCapture(_ id: UUID) throws -> LogEvent? {
        guard var capture = try store.captures().first(where: { $0.id == id }) else { return nil }
        let text = capture.transcript ?? ""
        var noteFields: [String: FieldValue] = ["transcript": .string(text)]
        if Parsers.isDoctorQuestion(text) { noteFields["for_doctor"] = .bool(true) }
        let e = try log(type: SystemType.note, fields: noteFields,
                        occurredAt: capture.capturedAt,
                        provenance: Provenance(surface: capture.surface, input: .voice, rawTranscript: capture.transcript,
                                               confidenceTier: .fullList, modelVersion: capture.interpretation?.modelVersion, captureId: capture.id),
                        id: capture.eventId)
        capture.status = .dismissed
        try store.saveCapture(capture, synced: false)
        return e
    }

    /// Writes the chosen candidate for each child the entry is for. The first child's event id is
    /// derived from the capture id (so two phones converge), the others' from the capture and child.
    private func commit(_ c: Candidate, capture: Capture, interpretation: Interpretation, tier: ConfidenceTier? = nil) throws -> [LogEvent] {
        let provenance = Provenance(surface: capture.surface, input: .voice, rawTranscript: capture.transcript ?? interpretation.transcript,
                                    confidence: interpretation.confidence, confidenceTier: tier ?? interpretation.tier,
                                    modelVersion: interpretation.modelVersion, captureId: capture.id)
        if let target = capture.attachTo, let old = try store.events().first(where: { $0.id == target }) {
            // voice adds detail to a gesture entry: an edit of that entry with the merged fields
            let supported = Set(registry.type(old.type)?.questions ?? [])
            var fields = old.fields
            for (k, v) in c.fields where Self.fieldQuestion[k].map(supported.contains) ?? false { fields[k] = v }
            return [try log(type: old.type, fields: fields, occurredAt: old.occurredAt, provenance: provenance,
                            supersedes: old.id, id: capture.eventId, sessionId: old.sessionId, loggedBy: capture.loggedBy, baby: old.babyId)]
        }
        let babies = interpretation.babyIds ?? [household.babyId]
        var fields = c.fields
        if babies.count > 1 { fields["group"] = .string(capture.id.uuidString) }
        return try babies.enumerated().map { i, baby in
            try log(type: c.type, fields: fields, occurredAt: c.occurredAt, provenance: provenance,
                    id: i == 0 ? capture.eventId : UUID.derived(from: capture.id, salt: "capture-event-\(baby.uuidString)"),
                    loggedBy: capture.loggedBy, baby: baby)
        }
    }

    static let fieldQuestion: [String: String] = [
        "consumed_fraction": "amount", "consumed_ml": "amount", "side": "side", "contents": "contents", "kind": "diaper_kind", "amount": "solids_amount",
    ]

    // MARK: sync

    public struct SyncReport: Sendable {
        public var pushed = 0
        public var pulled = 0
        public var processedCaptures = 0
    }

    /// Push the outbox, pull new events, then process captures other devices uploaded.
    @discardableResult
    public func sync() async throws -> SyncReport {
        guard let backend else { return SyncReport() }
        var report = SyncReport()
        let outbox = try store.unsyncedEvents()
        try await backend.pushEvents(outbox)
        try store.markSynced(outbox.map(\.id))
        report.pushed = outbox.count

        let caps = try store.unsyncedCaptures()
        try await backend.pushCaptures(caps)
        for c in caps { try store.saveCapture(c, synced: true) }

        var cursor = Int64(try store.value("seq") ?? "0") ?? 0
        while true {
            let (events, next) = try await backend.pullEvents(household: household.id, after: cursor)
            try store.upsertRemote(events)
            report.pulled += events.count
            if next == cursor || events.isEmpty { break }
            cursor = next
            try store.setValue(String(cursor), for: "seq")
        }
        report.processedCaptures = try await processRemoteCaptures()
        return report
    }

    /// Pending captures from glasses (and anything another phone left): download the audio,
    /// transcribe and decide on this phone, write the event, delete the audio.
    public func processRemoteCaptures() async throws -> Int {
        guard let backend else { return 0 }
        let remote = try await backend.openCaptures(household: household.id)
        var processed = 0
        for c in remote {
            if c.status == .needsReview {
                try store.saveCapture(c, synced: true)
                continue
            }
            var transcript = c.transcript
            var spoken: String?
            if transcript == nil, let path = c.audioPath, let transcriber {
                let audio = try await backend.downloadAudio(path: path)
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(c.id).wav")
                try audio.write(to: url)
                (transcript, spoken) = try await transcriber.transcribeSpoken(fileURL: url)
                try? FileManager.default.removeItem(at: url)
            }
            guard let transcript else { continue }
            let r = try await processVoice(transcript: transcript, spoken: spoken, surface: c.surface, capturedAt: c.capturedAt,
                                           attachTo: c.attachTo, captureId: c.id, loggedBy: c.loggedBy, babies: c.babyId.map { [$0] })
            var done = r.capture
            done.audioPath = nil
            try store.saveCapture(done, synced: false)
            if let path = c.audioPath { try? await backend.deleteAudio(path: path) }
            processed += 1
        }
        if processed > 0 {
            let caps = try store.unsyncedCaptures()
            try await backend.pushCaptures(caps)
            for c in caps { try store.saveCapture(c, synced: true) }
            let outbox = try store.unsyncedEvents()
            try await backend.pushEvents(outbox)
            try store.markSynced(outbox.map(\.id))
        }
        return processed
    }
}
