import Foundation

public protocol Transcriber: Sendable {
    func transcribe(fileURL: URL) async throws -> String
    func warmUp() async
}

public extension Transcriber {
    func warmUp() async {}
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

    public func derived(asOf: Date? = nil) throws -> DerivedLog {
        DerivedLog(events: try store.events(), registry: registry, asOf: asOf)
    }

    public func status(now: Date = Date()) throws -> StatusSnapshot {
        let caps = try store.captures()
        return StatusSnapshot(log: try derived(), now: now,
                              pendingCaptures: caps.filter { $0.status == .pending }.count,
                              pendingPicks: caps.filter { $0.status == .needsReview }.count)
    }

    // MARK: writing

    /// Validates and appends a typed entry.
    @discardableResult
    public func log(type: String, fields: [String: FieldValue] = [:], occurredAt: Date = Date(), provenance: Provenance,
                    supersedes: UUID? = nil, id: UUID = UUID(), sessionId: UUID? = nil, loggedBy: UUID? = nil) throws -> LogEvent {
        if !SystemType.all.contains(type) {
            guard let spec = registry.type(type) else { throw LogError.unknownType(type) }
            guard household.enabled.contains(spec.category) else { throw LogError.disabledCategory(spec.category) }
            try validate(type: type, fields: fields)
        }
        let e = LogEvent(id: id, householdId: household.id, babyId: household.babyId, type: type, fields: fields,
                         occurredAt: occurredAt, loggedAt: Date(), loggedBy: loggedBy ?? me, provenance: provenance,
                         supersedes: supersedes, sessionId: sessionId)
        try store.append(e)
        return e
    }

    func validate(type: String, fields: [String: FieldValue]) throws {
        let allowed: [String: Set<String>] = [
            "side": ["left", "right", "both"], "contents": ["formula", "breast_milk"], "kind": ["wet", "dirty", "both", "dry"],
            "amount": ["taste", "some", "most", "all"],
        ]
        for (k, v) in fields {
            if let set = allowed[k], !(v.string.map(set.contains) ?? false) { throw LogError.invalidField(k) }
            if ["consumed_fraction"].contains(k), !((v.number ?? -1) > 0 && (v.number ?? 2) <= 1) { throw LogError.invalidField(k) }
            if ["consumed_ml", "amount_ml", "grams", "height_cm", "head_cm"].contains(k), !((v.number ?? -1) > 0) { throw LogError.invalidField(k) }
        }
        if type == "diaper", fields["kind"] == nil { throw LogError.invalidField("kind") }
        if type == "weight", fields["grams"] == nil { throw LogError.invalidField("grams") }
        if type == "height", fields["height_cm"] == nil { throw LogError.invalidField("height_cm") }
        if type == "head", fields["head_cm"] == nil { throw LogError.invalidField("head_cm") }
    }

    @discardableResult
    public func undo(_ id: UUID, surface: Surface = .phone) throws -> LogEvent {
        try log(type: SystemType.undo, provenance: Provenance(surface: surface, input: .tap), supersedes: id)
    }

    /// Edits are new events of the same type that supersede the old one.
    @discardableResult
    public func edit(_ id: UUID, fields: [String: FieldValue], occurredAt: Date? = nil, surface: Surface = .phone) throws -> LogEvent {
        guard let old = try store.events().first(where: { $0.id == id }) else { throw LogError.invalidField("id") }
        var p = old.provenance
        p.surface = surface
        p.input = .tap
        return try log(type: old.type, fields: fields, occurredAt: occurredAt ?? old.occurredAt, provenance: p,
                       supersedes: id, sessionId: old.sessionId)
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

    /// The contextual one-tap action: finish the open feed, or start the household's default feed.
    @discardableResult
    public func toggleFeed(surface: Surface, input: InputKind = .tap, now: Date = Date()) throws -> LogEvent {
        let log = try derived()
        let p = Provenance(surface: surface, input: input)
        if let open = log.openFeedSession() {
            return try self.log(type: open.kind == .bottle ? "feed.bottle.finish" : "feed.breast.finish", occurredAt: now, provenance: p)
        }
        if household.defaultFeed == "breast" && household.enabled.contains("breast") {
            let side = StatusSnapshot(log: log, now: now).nextSide ?? "left"
            return try self.log(type: "feed.breast.start", fields: ["side": .string(side)], occurredAt: now, provenance: p)
        }
        return try self.log(type: "feed.bottle.start", occurredAt: now, provenance: p)
    }

    @discardableResult
    public func toggleSleep(surface: Surface, input: InputKind = .tap, now: Date = Date()) throws -> LogEvent {
        let open = try derived().openSession(.sleep) != nil
        return try log(type: open ? "sleep.end" : "sleep.start", occurredAt: now, provenance: Provenance(surface: surface, input: input))
    }

    @discardableResult
    public func switchSide(surface: Surface, input: InputKind = .tap, now: Date = Date()) throws -> LogEvent? {
        let log = try derived()
        guard let open = log.openSession(.breast) else { return nil }
        let next = open.sides.last == "left" ? "right" : "left"
        return try self.log(type: "feed.breast.switch", fields: ["side": .string(next)], occurredAt: now,
                            provenance: Provenance(surface: surface, input: input))
    }

    // MARK: voice

    public struct VoiceResult: Sendable {
        public let capture: Capture
        public let interpretation: Interpretation
        public let committed: LogEvent?
    }

    /// Runs the decision layer on a transcript captured at `capturedAt` and applies the policy:
    /// auto-commit, or keep the capture in `needs_review` with its candidates.
    public func processVoice(transcript: String, surface: Surface, capturedAt: Date = Date(), attachTo: UUID? = nil,
                             captureId: UUID = UUID(), loggedBy: UUID? = nil) async throws -> VoiceResult {
        let asOf = try derived(asOf: capturedAt)
        let ctx = InterpretContext(reference: capturedAt, log: asOf, enabledCategories: household.enabled, bottleMl: household.bottleMl)
        let interp = try await interpreter.interpret(transcript, context: ctx)
        var capture = Capture(id: captureId, householdId: household.id, surface: surface, capturedAt: capturedAt,
                              loggedBy: loggedBy ?? me, transcript: transcript, attachTo: attachTo, status: .needsReview,
                              interpretation: interp, processedBy: me, processedAt: Date())
        var committed: LogEvent?
        if interp.tier == .auto, let best = interp.best {
            committed = try commit(best, capture: capture, interpretation: interp)
            capture.status = .done
        }
        try store.saveCapture(capture, synced: false)
        return VoiceResult(capture: capture, interpretation: interp, committed: committed)
    }

    /// The parent picked candidate `index` (pick mode or full list).
    @discardableResult
    public func resolveCapture(_ id: UUID, candidate index: Int) throws -> LogEvent? {
        guard var capture = try store.captures().first(where: { $0.id == id }), let interp = capture.interpretation,
              interp.candidates.indices.contains(index) else { return nil }
        var chosen = interp.candidates[index]
        chosen.probability = 1
        let e = try commit(chosen, capture: capture, interpretation: interp, tier: interp.tier)
        capture.status = .done
        try store.saveCapture(capture, synced: false)
        return e
    }

    /// Dismissed without a choice: the transcript is kept as a note, never lost.
    @discardableResult
    public func dismissCapture(_ id: UUID) throws -> LogEvent? {
        guard var capture = try store.captures().first(where: { $0.id == id }) else { return nil }
        let e = try log(type: SystemType.note, fields: ["transcript": .string(capture.transcript ?? "")],
                        occurredAt: capture.capturedAt,
                        provenance: Provenance(surface: capture.surface, input: .voice, rawTranscript: capture.transcript,
                                               confidenceTier: .fullList, modelVersion: capture.interpretation?.modelVersion, captureId: capture.id),
                        id: capture.eventId)
        capture.status = .dismissed
        try store.saveCapture(capture, synced: false)
        return e
    }

    private func commit(_ c: Candidate, capture: Capture, interpretation: Interpretation, tier: ConfidenceTier? = nil) throws -> LogEvent {
        let provenance = Provenance(surface: capture.surface, input: .voice, rawTranscript: interpretation.transcript,
                                    confidence: interpretation.confidence, confidenceTier: tier ?? interpretation.tier,
                                    modelVersion: interpretation.modelVersion, captureId: capture.id)
        if let target = capture.attachTo, let old = try store.events().first(where: { $0.id == target }) {
            // voice adds detail to a gesture entry: an edit of that entry with the merged fields
            let supported = Set(registry.type(old.type)?.questions ?? [])
            var fields = old.fields
            for (k, v) in c.fields where Self.fieldQuestion[k].map(supported.contains) ?? false { fields[k] = v }
            return try log(type: old.type, fields: fields, occurredAt: old.occurredAt, provenance: provenance,
                           supersedes: old.id, id: capture.eventId, sessionId: old.sessionId, loggedBy: capture.loggedBy)
        }
        return try log(type: c.type, fields: c.fields, occurredAt: c.occurredAt, provenance: provenance, id: capture.eventId,
                       loggedBy: capture.loggedBy)
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
            if transcript == nil, let path = c.audioPath, let transcriber {
                let audio = try await backend.downloadAudio(path: path)
                let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(c.id).wav")
                try audio.write(to: url)
                transcript = try await transcriber.transcribe(fileURL: url)
                try? FileManager.default.removeItem(at: url)
            }
            guard let transcript else { continue }
            let r = try await processVoice(transcript: transcript, surface: c.surface, capturedAt: c.capturedAt,
                                           attachTo: c.attachTo, captureId: c.id, loggedBy: c.loggedBy)
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
