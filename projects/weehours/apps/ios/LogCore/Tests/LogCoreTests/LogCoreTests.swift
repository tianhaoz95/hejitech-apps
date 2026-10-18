import XCTest
@testable import LogCore

let H = UUID(uuidString: "00000000-0000-4000-8000-0000000000aa")!
let B = UUID(uuidString: "00000000-0000-4000-8000-0000000000bb")!
let A = UUID(uuidString: "00000000-0000-4000-8000-00000000000a")!
let P2 = UUID(uuidString: "00000000-0000-4000-8000-00000000000b")!

func fixedNow() -> Date { LogCoding.parseISO("2026-10-14T15:00:00Z")! }

// MARK: - Shared fixtures (same file as the TypeScript core tests)

final class FixtureTests: XCTestCase {
    func testStatusFixtures() throws {
        let url = Bundle.module.url(forResource: "status", withExtension: "json", subdirectory: "Fixtures")!
        let root = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
        let now = LogCoding.parseISO(root["now"] as! String)!
        let givers = (root["caregivers"] as! [String: String]).mapValues { UUID(uuidString: $0)! }
        for c in root["cases"] as! [[String: Any]] {
            let name = c["name"] as! String
            var ids: [String: UUID] = [:]
            func id(_ s: String) -> UUID {
                if let u = givers[s] { return u }
                if let u = ids[s] { return u }
                let u = UUID(); ids[s] = u; return u
            }
            var events: [LogEvent] = []
            for e in c["events"] as! [[String: Any]] {
                var fields: [String: FieldValue] = [:]
                for (k, v) in e["fields"] as? [String: Any] ?? [:] {
                    if let n = v as? NSNumber { fields[k] = .number(n.doubleValue) }
                    else if let s = v as? String { fields[k] = .string(["original", "duplicate", "caregiver"].contains(k) ? id(s).uuidString : s) }
                }
                let occurred = now.addingTimeInterval(-60 * (e["minutes_ago"] as! Double))
                let logged = (e["logged_minutes_ago"] as? Double).map { now.addingTimeInterval(-60 * $0) } ?? occurred
                events.append(LogEvent(id: id(e["id"] as! String), householdId: H, babyId: (e["baby"] as? String).map(id) ?? B, type: e["type"] as! String, fields: fields,
                                       occurredAt: occurred, loggedAt: logged, loggedBy: id(e["by"] as! String),
                                       provenance: Provenance(surface: Surface(rawValue: e["surface"] as? String ?? "phone")!, input: .tap),
                                       supersedes: (e["supersedes"] as? String).map(id)))
            }
            let log = DerivedLog(events: events, baby: (c["for_baby"] as? String).map(id))
            let status = StatusSnapshot(log: log, now: now)
            let expect = c["expect"] as! [String: Any]
            if let line = expect["line"] as? String { XCTAssertEqual(status.line(now: now), line, name) }
            if let r = expect["to_review"] as? Int { XCTAssertEqual(status.toReview, r, name) }
            if let k = expect["last_feed_kind"] as? String { XCTAssertEqual(status.lastFeedKind, k, name) }
            if let k = expect["open_feed_kind"] as? String { XCTAssertEqual(status.openFeedKind, k, name) }
            if let s = expect["next_side"] as? String { XCTAssertEqual(status.nextSide, s, name) }
            if let s = expect["sleeping"] as? Bool { XCTAssertEqual(status.sleepingSince != nil, s, name) }
            if let n = expect["sessions"] as? Int { XCTAssertEqual(log.sessions.count, n, name) }
            if let d = expect["on_duty"] as? String { XCTAssertEqual(status.onDuty, id(d), name) }
            for (k, v) in expect["status"] as? [String: String] ?? [:] {
                XCTAssertEqual(log.status[id(k)]?.rawValue, v, "\(name): \(k)")
            }
        }
    }
}

// MARK: - Helpers

func service(categories: [String]? = nil, defaultFeed: String = "bottle") throws -> LogService {
    var h = Household(id: H, babyId: B, bottleMl: 120, defaultFeed: defaultFeed,
                      caregivers: [Caregiver(id: A, name: "Alex"), Caregiver(id: P2, name: "Sam")])
    if let categories { h.categories = categories } else { h.categories = EventRegistry.shared.categories.map(\.id) }
    return LogService(store: try SQLiteLogStore.inMemory(), household: h, me: A,
                      interpreter: VoiceInterpreter(model: KeywordDecisionModel()))
}

func commit(_ s: LogService, _ r: LogService.VoiceResult) async throws -> LogEvent {
    if let e = r.committed { return e }
    let e = try await s.resolveCapture(r.capture.id, candidate: 0).first
    return try XCTUnwrap(e)
}

// MARK: - Acceptance criteria from the PRD

final class AcceptanceTests: XCTestCase {
    func testStartThenFinishHalfMakesOneSessionWithDuration() async throws {
        let s = try service()
        let t0 = Date().addingTimeInterval(-1200)
        let r1 = try await s.processVoice(transcript: "start drinking", surface: .phone, capturedAt: t0)
        XCTAssertEqual(r1.interpretation.best?.type, "feed.bottle.start")
        if r1.committed == nil { try await s.resolveCapture(r1.capture.id, candidate: 0) }
        let r2 = try await s.processVoice(transcript: "finished, drank half a bottle", surface: .phone, capturedAt: t0.addingTimeInterval(900))
        XCTAssertEqual(r2.interpretation.best?.type, "feed.bottle.finish")
        if r2.committed == nil { try await s.resolveCapture(r2.capture.id, candidate: 0) }
        let log = try await s.derived()
        let bottle = log.sessions.filter { $0.kind == .bottle }
        XCTAssertEqual(bottle.count, 1)
        XCTAssertEqual(bottle[0].consumedFraction, 0.5)
        XCTAssertEqual(bottle[0].duration ?? 0, 900, accuracy: 1)
        let h = await s.household
        let finish = log.effective.first { $0.type == "feed.bottle.finish" }!
        XCTAssertEqual(h.milliliters(finish), 60)
    }

    func testQuarterLeftLogsSeventyFivePercent() async throws {
        let s = try service()
        let r = try await s.processVoice(transcript: "finished, a quarter left", surface: .phone)
        XCTAssertEqual(r.interpretation.best?.fields["consumed_fraction"], .number(0.75))
    }

    func testUndoKeepsHistoryAsUndone() async throws {
        let s = try service()
        let e = try await s.log(type: "diaper", fields: ["kind": .string("wet")], provenance: Provenance(surface: .phone, input: .tap))
        let before = try await s.status().line(now: Date())
        XCTAssertTrue(before.contains("diaper"))
        try await s.undo(e.id)
        let log = try await s.derived()
        XCTAssertEqual(log.status[e.id], .undone)
        let after = try await s.status().line(now: Date())
        XCTAssertFalse(after.contains("diaper"))
        XCTAssertTrue(log.all.contains { $0.id == e.id })
    }

    func testEveryVoiceEventHasCompleteProvenance() async throws {
        let s = try service()
        let r = try await s.processVoice(transcript: "wet diaper", surface: .watch)
        let e = try await commit(s, r)
        XCTAssertEqual(e.provenance.surface, .watch)
        XCTAssertEqual(e.provenance.input, .voice)
        XCTAssertEqual(e.provenance.rawTranscript, "wet diaper")
        XCTAssertNotNil(e.provenance.confidenceTier)
        XCTAssertEqual(e.provenance.modelVersion, "keywords-1")
        XCTAssertFalse(e.provenance.confidence.isEmpty)
        XCTAssertEqual(e.provenance.captureId, r.capture.id)
    }

    func testFeedReminderFiresAtIntervalAndIsDismissedByLogging() async throws {
        let s = try service()
        var h = await s.household
        h.reminders.feedEveryMinutes = 180
        await s.setHousehold(h)
        let fed = Date().addingTimeInterval(-3600)
        try await s.log(type: "feed.bottle.single", fields: ["consumed_fraction": .number(1)], occurredAt: fed, provenance: Provenance(surface: .phone, input: .tap))
        var plan = ReminderPlanner.plan(log: try await s.derived(), household: h, me: A, now: Date())
        XCTAssertEqual(plan.first?.kind, .feed)
        XCTAssertEqual(plan.first!.fireAt.timeIntervalSince(fed), 180 * 60, accuracy: 1)
        XCTAssertEqual(plan.count, 2)   // haptic first, sound after the overdue margin
        // logging a new feed moves the reminder: the old one is gone
        try await s.log(type: "feed.bottle.start", provenance: Provenance(surface: .phone, input: .tap))
        plan = ReminderPlanner.plan(log: try await s.derived(), household: h, me: A, now: Date())
        XCTAssertTrue(plan.isEmpty)     // open session: no feed reminder
    }
}

// MARK: - Decision layer

final class InterpreterTests: XCTestCase {
    func ctx(_ events: [LogEvent] = [], at: Date = fixedNow()) -> InterpretContext {
        InterpretContext(reference: at, log: DerivedLog(events: events), enabledCategories: Set(EventRegistry.shared.categories.map(\.id)))
    }

    func testHierarchicalQuestionsAreShort() {
        let i = VoiceInterpreter(model: KeywordDecisionModel())
        let qs = i.questions(for: ctx())
        XCTAssertEqual(qs.first?.id, "category")
        XCTAssertTrue(qs.allSatisfy { $0.options.count <= 9 })
        XCTAssertFalse(qs.contains { $0.id == "when" })   // times are parsed deterministically
    }

    func testCombinePhaseWithinCategory() {
        let i = VoiceInterpreter(model: KeywordDecisionModel())
        let c = ctx()
        let cat = DecisionAnswer(options: ["bottle", "diaper", VoiceInterpreter.noneKey], probabilities: [0.9, 0.05, 0.05])
        let phase = DecisionAnswer(options: ["start", "switch", "finish", "single"], probabilities: [0.1, 0.05, 0.8, 0.05])
        let t = i.combine(["category": cat, "phase": phase], context: c)
        XCTAssertEqual(t.top.key, "feed.bottle.finish")
        XCTAssertEqual(t.p("diaper"), 0.05, accuracy: 0.001)
    }

    func testPolicyTiers() {
        let i = VoiceInterpreter(model: KeywordDecisionModel())
        func interp(_ typeP: Double) -> Interpretation {
            let types = EventRegistry.shared.types.map(\.id) + [VoiceInterpreter.noneKey]
            var probs = Array(repeating: (1 - typeP) / Double(types.count - 1), count: types.count)
            probs[types.firstIndex(of: "sleep.start")!] = typeP
            return i.build(transcript: "she fell asleep", answers: ["event_type": DecisionAnswer(options: types, probabilities: probs)], context: ctx())
        }
        XCTAssertEqual(interp(0.95).tier, .auto)
        XCTAssertEqual(interp(0.7).tier, .pick)
        XCTAssertEqual(interp(0.7).candidates.count, 2)
        XCTAssertEqual(interp(0.3).tier, .fullList)
    }

    func testNoneOfTheseGoesToFullList() async throws {
        let i = VoiceInterpreter(model: KeywordDecisionModel())
        let r = try await i.interpret("call the pediatrician tomorrow", context: ctx())
        XCTAssertEqual(r.tier, .fullList)
    }

    func testGrowthMeasurementsPickTheirType() async throws {
        let i = VoiceInterpreter(model: KeywordDecisionModel())
        let height = try await i.interpret("she is 52 cm tall", context: ctx())
        XCTAssertEqual(height.best?.type, "height")
        XCTAssertEqual(height.best?.fields["height_cm"]?.number, 52)
        let head = try await i.interpret("head circumference is 35.5 cm", context: ctx())
        XCTAssertEqual(head.best?.type, "head")
        XCTAssertEqual(head.best?.fields["head_cm"]?.number, 35.5)
        let weight = try await i.interpret("she weighs 4.2 kilos", context: ctx())
        XCTAssertEqual(weight.best?.type, "weight")
        XCTAssertEqual(weight.best?.fields["grams"]?.number, 4200)
        XCTAssertEqual(VoiceInterpreter.label(type: "head", fields: ["head_cm": .number(35.5)]), "Head size · 35.5 cm")
    }

    func testDiaperKindIsRequired() async throws {
        let r = try await VoiceInterpreter(model: KeywordDecisionModel()).interpret("changed his diaper", context: ctx())
        XCTAssertEqual(r.best?.type, "diaper")
        XCTAssertNotEqual(r.tier, .auto)
    }

    func testRelativeAndExplicitTimes() async throws {
        let i = VoiceInterpreter(model: KeywordDecisionModel())
        let r = try await i.interpret("wet diaper fifteen minutes ago", context: ctx())
        XCTAssertEqual(r.best!.occurredAt.timeIntervalSince(fixedNow()), -900, accuracy: 1)
        let r2 = try await i.interpret("fell asleep at 2:10", context: ctx())
        let comps = Calendar.current.dateComponents([.hour, .minute], from: r2.best!.occurredAt)
        XCTAssertEqual(comps.minute, 10)
        XCTAssertLessThanOrEqual(r2.best!.occurredAt, fixedNow())
    }

    func testCalibrationSharpensAndFlattens() {
        let a = DecisionAnswer(options: ["x", "y"], probabilities: [0.6, 0.4])
        XCTAssertGreaterThan(Calibration(temperatures: ["q": 0.5]).apply(a, question: "q").p("x"), 0.6)
        XCTAssertLessThan(Calibration(temperatures: ["q": 2]).apply(a, question: "q").p("x"), 0.6)
    }

    func testBundledCalibrationLoads() throws {
        XCTAssertNotNil(Calibration.bundled.temperatures["category"])
    }

    func testSystemOneBodyKeepsOptionOrder() throws {
        let q = DecisionQuestion(id: "q", instructions: "Which?", options: [.init(key: "zeta", description: nil), .init(key: "alpha", description: "first \"quoted\"")])
        let body = String(decoding: DecisionRequest(state: "s", questions: [q]).systemOneJSON(), as: UTF8.self)
        XCTAssertLessThan(body.range(of: "zeta")!.lowerBound, body.range(of: "alpha")!.lowerBound)
        XCTAssertNoThrow(try JSONSerialization.jsonObject(with: Data(body.utf8)))
    }

    func testParseServerAnswer() throws {
        let q = DecisionQuestion(id: "q", instructions: "?", options: [.init(key: "a", description: nil), .init(key: "b", description: nil)])
        let json = #"{"answers":{"q":{"type":"choice","choice":"b","probabilities":{"a":0.2,"b":0.8},"confidence":0.6}}}"#
        let a = try SystemOneHTTPModel.parse(Data(json.utf8), questions: [q])
        XCTAssertEqual(a["q"]?.top.key, "b")
    }
}

final class ParserTests: XCTestCase {
    func testVolumes() {
        XCTAssertEqual(Parsers.milliliters(in: "drank 90 ml"), 90)
        XCTAssertEqual(Parsers.milliliters(in: "pumped four ounces"), 118)
        XCTAssertNil(Parsers.milliliters(in: "drank half"))
    }

    func testWeights() {
        XCTAssertEqual(Parsers.grams(in: "she weighs 4.2 kilos"), 4200)
        XCTAssertEqual(Parsers.grams(in: "8 pounds 3 ounces"), 3714)
        XCTAssertEqual(Parsers.grams(in: "weight is 5100 grams"), 5100)
    }

    func testLengths() {
        XCTAssertEqual(Parsers.centimeters(in: "she's 52 cm long"), 52)
        XCTAssertEqual(Parsers.centimeters(in: "head is 35.5 centimeters"), 35.5)
        XCTAssertEqual(Parsers.centimeters(in: "twenty inches"), 50.8)
        XCTAssertEqual(Parsers.centimeters(in: "1 foot 8 inches tall"), 50.8)
        XCTAssertNil(Parsers.centimeters(in: "fed at 4 in the morning"))
    }

    func testGrowthMeasure() {
        XCTAssertEqual(Parsers.growthMeasure(in: "head circumference 35 cm"), "head")
        XCTAssertEqual(Parsers.growthMeasure(in: "she's 52 cm tall"), "height")
        XCTAssertEqual(Parsers.growthMeasure(in: "she weighs 4.2 kilos"), "weight")
        XCTAssertNil(Parsers.growthMeasure(in: "changed a wet diaper"))
    }

    func testMinutesAgo() {
        XCTAssertEqual(Parsers.minutesAgo(in: "half an hour ago"), 30)
        XCTAssertEqual(Parsers.minutesAgo(in: "about fifteen minutes ago"), 15)
        XCTAssertEqual(Parsers.minutesAgo(in: "two hours ago"), 120)
        XCTAssertNil(Parsers.minutesAgo(in: "just now"))
    }

    func testExplicitTimePicksMostRecent() {
        let ref = fixedNow()
        let t = Parsers.explicitTime(in: "at 11:50 pm", reference: ref)!
        XCTAssertLessThan(t, ref)
        XCTAssertGreaterThan(t, ref.addingTimeInterval(-86400))
    }
}

final class LayaPromptTests: XCTestCase {
    func testRenderMatchesTemplate() {
        let q = DecisionQuestion(id: "q", instructions: "Which?", options: [.init(key: "a", description: "first"), .init(key: "b", description: nil)])
        XCTAssertEqual(LayaPrompt.render(state: "hello [MASK]", question: q),
                       "[CLS]choice question: Which?[SEP][MASK] a: first[MASK] b[SEP]hello  [SEP]")
    }

    func testLayoutCutsOptionsToBudget() throws {
        // [cls] q q q [sep] [m] o o o o o o [m] o o [sep] s s [sep]
        let cls: Int32 = 1, sep: Int32 = 2, mask: Int32 = 3
        let toks: [Int32] = [cls, 10, 11, 12, sep, mask, 20, 21, 22, 23, 24, 25, mask, 30, 31, sep, 40, 41, sep]
        let l = try LayaPrompt.layout(tokens: toks, mask: mask, sep: sep, nOptions: 2, maxHeadTokens: 24, maxOptionTokens: 3)
        XCTAssertEqual(l.markers.count, 2)
        XCTAssertEqual(l.tokens[l.markers[0]], mask)
        XCTAssertEqual(l.tokens[l.markers[1]], mask)
        XCTAssertEqual(l.tokens.last, sep)
        XCTAssertEqual(l.markers[1] - l.markers[0], 4)   // option cut to marker + 3 tokens
    }

    func testTemperatureBuckets() {
        XCTAssertEqual(LayaPrompt.temperatureKey(options: 2), "choice.2")
        XCTAssertEqual(LayaPrompt.temperatureKey(options: 8), "choice.6_10")
        XCTAssertEqual(LayaPrompt.temperatureKey(options: 13), "choice.11")
    }
}

// MARK: - Service, captures, store

final class ServiceTests: XCTestCase {
    func testValidationRejectsDisabledAndInvalid() async throws {
        let s = try service(categories: ["diaper"])
        do {
            try await s.log(type: "feed.bottle.start", provenance: Provenance(surface: .phone, input: .tap))
            XCTFail("expected disabled category")
        } catch {}
        do {
            try await s.log(type: "diaper", fields: ["kind": .string("purple")], provenance: Provenance(surface: .phone, input: .tap))
            XCTFail("expected invalid field")
        } catch {}
    }

    func testGrowthMeasurementsNeedTheirNumber() async throws {
        let s = try service(categories: ["growth"])
        let p = Provenance(surface: .phone, input: .tap)
        for (type, field) in [("height", "height_cm"), ("head", "head_cm")] {
            do { try await s.log(type: type, provenance: p); XCTFail("expected \(field) required") } catch {}
            do { try await s.log(type: type, fields: [field: .number(-3)], provenance: p); XCTFail("expected positive \(field)") } catch {}
            let e = try await s.log(type: type, fields: [field: .number(50.5)], provenance: p)
            XCTAssertEqual(e.fields[field]?.number, 50.5)
        }
    }

    func testCaptureEventIdIsDeterministicAcrossPhones() async throws {
        let capture = UUID()
        let s1 = try service(), s2 = try service()
        let r1 = try await s1.processVoice(transcript: "big poop", surface: .glasses, captureId: capture, loggedBy: P2)
        let r2 = try await s2.processVoice(transcript: "big poop", surface: .glasses, captureId: capture, loggedBy: P2)
        let e1 = try await commit(s1, r1)
        let e2 = try await commit(s2, r2)
        XCTAssertEqual(e1.id, e2.id)
        XCTAssertEqual(e1.loggedBy, P2)
    }

    func testVoiceAttachesDetailToGestureEntry() async throws {
        let s = try service()
        try await s.toggleFeed(surface: .ring, input: .gesture)                      // start
        let finish = try await s.toggleFeed(surface: .ring, input: .gesture)         // finish, no amount
        XCTAssertEqual(finish.type, "feed.bottle.finish")
        let r = try await s.processVoice(transcript: "drank half", surface: .glasses, attachTo: finish.id)
        let e = try await commit(s, r)
        XCTAssertEqual(e.supersedes, finish.id)
        XCTAssertEqual(e.type, "feed.bottle.finish")
        XCTAssertEqual(e.fields["consumed_fraction"], .number(0.5))
        let log = try await s.derived()
        XCTAssertEqual(log.sessions.filter { $0.kind == .bottle }.first?.consumedFraction, 0.5)
    }

    func testDismissKeepsTranscriptAsNote() async throws {
        let s = try service()
        let r = try await s.processVoice(transcript: "we're out of wipes", surface: .phone)
        XCTAssertNil(r.committed)
        let note = try await s.dismissCapture(r.capture.id)
        XCTAssertEqual(note?.type, "note")
        XCTAssertEqual(note?.string("transcript"), "we're out of wipes")
    }

    func testToggleFeedUsesHouseholdDefaultAndNextSide() async throws {
        let s = try service(defaultFeed: "breast")
        let e = try await s.toggleFeed(surface: .ring, input: .gesture)
        XCTAssertEqual(e.type, "feed.breast.start")
        XCTAssertEqual(e.string("side"), "left")
        let sw = try await s.switchSide(surface: .ring, input: .gesture)
        XCTAssertEqual(sw?.string("side"), "right")
    }

    func testStoreOutboxAndAppendOnly() throws {
        let store = try SQLiteLogStore.inMemory()
        let e = LogEvent(householdId: H, babyId: B, type: "diaper", fields: ["kind": .string("wet")], occurredAt: Date(), loggedBy: A,
                         provenance: Provenance(surface: .phone, input: .tap))
        try store.append(e)
        var changed = e
        changed.fields["kind"] = .string("dirty")
        try store.append(changed)  // same id: ignored, never overwritten
        XCTAssertEqual(try store.events().first?.string("kind"), "wet")
        XCTAssertEqual(try store.unsyncedEvents().count, 1)
        try store.markSynced([e.id])
        XCTAssertEqual(try store.unsyncedEvents().count, 0)
        try store.setValue("42", for: "seq")
        XCTAssertEqual(try store.value("seq"), "42")
    }

    func testRehomeMovesOnlyUnsyncedRows() throws {
        let store = try SQLiteLogStore.inMemory()
        let local = UUID(), account = UUID(), newHousehold = UUID(), newBaby = UUID()
        let synced = LogEvent(householdId: H, babyId: B, type: "diaper", fields: ["kind": .string("wet")], occurredAt: Date(), loggedBy: local,
                              provenance: Provenance(surface: .phone, input: .tap))
        let pending = LogEvent(householdId: H, babyId: B, type: "duty", fields: ["caregiver": .string(local.uuidString)], occurredAt: Date(), loggedBy: local,
                               provenance: Provenance(surface: .phone, input: .tap))
        try store.append(synced)
        try store.markSynced([synced.id])
        try store.append(pending)
        try store.rehome(household: newHousehold, baby: { _ in newBaby }, caregiver: (local, account))
        let all = Dictionary(uniqueKeysWithValues: try store.events().map { ($0.id, $0) })
        XCTAssertEqual(all[synced.id]?.householdId, H)
        XCTAssertEqual(all[pending.id]?.householdId, newHousehold)
        XCTAssertEqual(all[pending.id]?.babyId, newBaby)
        XCTAssertEqual(all[pending.id]?.loggedBy, account)
        XCTAssertEqual(all[pending.id]?.string("caregiver"), account.uuidString)
    }

    func testServiceWithoutBackendWorksOffline() async throws {
        let s = try service()                       // no backend: local-only mode
        try await s.log(type: "diaper", fields: ["kind": .string("wet")], provenance: Provenance(surface: .phone, input: .tap))
        let report = try await s.sync()             // a no-op, not an error
        XCTAssertEqual(report.pushed, 0)
        let processed = try await s.processRemoteCaptures()
        XCTAssertEqual(processed, 0)
        let line = try await s.status().line(now: Date())
        XCTAssertTrue(line.contains("diaper just now"))
    }

    func testEventJSONRoundTripsWithSnakeCase() throws {
        let e = LogEvent(householdId: H, babyId: B, type: "feed.bottle.finish", fields: ["consumed_fraction": .number(0.5)],
                         occurredAt: fixedNow(), loggedAt: fixedNow(), loggedBy: A, provenance: Provenance(surface: .glasses, input: .voice, rawTranscript: "x", confidence: ["amount": 0.9], confidenceTier: .auto))
        let data = try LogCoding.encoder.encode(e)
        let s = String(decoding: data, as: UTF8.self)
        XCTAssertTrue(s.contains("\"occurred_at\""))
        XCTAssertTrue(s.contains("\"confidence_tier\":\"auto\""))
        XCTAssertEqual(try LogCoding.decoder.decode(LogEvent.self, from: data), e)
    }
}

final class BillingAndExportTests: XCTestCase {
    func testTrialSubscriptionLifetime() {
        let start = fixedNow()
        var e = Entitlement(trialStartedAt: start)
        XCTAssertEqual(e.access(now: start.addingTimeInterval(86400)), .trial(daysLeft: 13))
        XCTAssertEqual(e.access(now: start.addingTimeInterval(15 * 86400)), .expired)
        XCTAssertTrue(e.allows(.tapLogging, now: start.addingTimeInterval(30 * 86400)))
        XCTAssertFalse(e.allows(.voice, now: start.addingTimeInterval(30 * 86400)))
        e.plan = .yearly
        e.expiresAt = start.addingTimeInterval(365 * 86400)
        XCTAssertEqual(e.access(now: start.addingTimeInterval(30 * 86400)), .subscribed(.yearly, until: e.expiresAt))
        e.plan = .lifetime
        e.expiresAt = nil
        XCTAssertEqual(e.access(now: start.addingTimeInterval(9999 * 86400)), .lifetime)
    }

    func testCSVExport() {
        let h = Household(id: H, babyId: B, bottleMl: 120, caregivers: [Caregiver(id: A, name: "Alex")])
        let e = LogEvent(householdId: H, babyId: B, type: "feed.bottle.single", fields: ["consumed_fraction": .number(0.5)],
                         occurredAt: fixedNow(), loggedBy: A, provenance: Provenance(surface: .phone, input: .voice, rawTranscript: "drank half, ok"))
        let csv = CSVExport.csv(log: DerivedLog(events: [e]), household: h)
        XCTAssertTrue(csv.contains(",60,Alex,phone,voice,\"drank half, ok\","))
    }

    func testAdaptiveSuggestion() {
        let now = fixedNow()
        let events = (0..<6).map { i in
            LogEvent(householdId: H, babyId: B, type: "feed.bottle.single", fields: ["consumed_fraction": .number(1)],
                     occurredAt: now.addingTimeInterval(TimeInterval(-i * 170 * 60)), loggedBy: A, provenance: Provenance(surface: .phone, input: .tap))
        }
        XCTAssertEqual(ReminderPlanner.suggestedFeedInterval(log: DerivedLog(events: events), now: now), 165)
    }

    func testRemindersRouteToOnDutyOnly() {
        let now = fixedNow()
        var h = Household(id: H, babyId: B, caregivers: [Caregiver(id: A, name: "Alex"), Caregiver(id: P2, name: "Sam")])
        h.reminders.feedEveryMinutes = 120
        let feed = LogEvent(householdId: H, babyId: B, type: "feed.bottle.single", fields: [:], occurredAt: now.addingTimeInterval(-3600), loggedBy: A, provenance: Provenance(surface: .phone, input: .tap))
        let duty = LogEvent(householdId: H, babyId: B, type: "duty", fields: ["caregiver": .string(P2.uuidString)], occurredAt: now.addingTimeInterval(-60), loggedBy: P2, provenance: Provenance(surface: .phone, input: .tap))
        let log = DerivedLog(events: [feed, duty])
        XCTAssertTrue(ReminderPlanner.plan(log: log, household: h, me: A, now: now).isEmpty)
        XCTAssertFalse(ReminderPlanner.plan(log: log, household: h, me: P2, now: now).isEmpty)
    }
}

// MARK: - Several children

let MIA = UUID(uuidString: "00000000-0000-4000-8000-0000000000a1")!
let LEO = UUID(uuidString: "00000000-0000-4000-8000-0000000000b2")!

func twins() throws -> LogService {
    var h = Household(id: H, babies: [Baby(id: MIA, name: "Mia", position: 0), Baby(id: LEO, name: "Leo", bottleMl: 150, position: 1)],
                      bottleMl: 120, caregivers: [Caregiver(id: A, name: "Alex"), Caregiver(id: P2, name: "Sam")])
    h.categories = EventRegistry.shared.categories.map(\.id)
    return LogService(store: try SQLiteLogStore.inMemory(), household: h, me: A, interpreter: VoiceInterpreter(model: KeywordDecisionModel()))
}

final class ChildrenTests: XCTestCase {
    func testOlderHouseholdJSONHasOneChild() throws {
        let json = #"{"id":"\#(H.uuidString)","name":"Ours","baby_id":"\#(B.uuidString)","baby_name":"Mia","birth_date":"2026-09-26","bottle_ml":90}"#
        let h = try LogCoding.decoder.decode(Household.self, from: Data(json.utf8))
        XCTAssertEqual(h.babies.map(\.name), ["Mia"])
        XCTAssertEqual(h.babyId, B)
        XCTAssertNotNil(h.birthDate)
        let again = try LogCoding.decoder.decode(Household.self, from: LogCoding.encoder.encode(h))
        XCTAssertEqual(again, h)
    }

    func testArchivedChildrenLeaveActive() {
        let h = Household(babies: [Baby(id: MIA, name: "Mia", archived: true), Baby(id: LEO, name: "Leo", position: 1)])
        XCTAssertEqual(h.active.map(\.id), [LEO])
        XCTAssertEqual(h.babyId, LEO)
        XCTAssertEqual(Household.names([Baby(name: "Mia"), Baby(name: "Leo"), Baby(name: "Ava")]), "Mia, Leo & Ava")
    }

    func testNamesInASentence() {
        let kids = [Baby(id: MIA, name: "Mia"), Baby(id: LEO, name: "Leo")]
        XCTAssertEqual(Parsers.children(in: "Leo had 90 ml", among: kids), [LEO])
        XCTAssertEqual(Parsers.children(in: "changed Mia's diaper", among: kids), [MIA])
        XCTAssertEqual(Parsers.children(in: "the twins fell asleep", among: kids), [MIA, LEO])
        XCTAssertEqual(Parsers.children(in: "Mia and Leo both ate", among: kids), [MIA, LEO])
        XCTAssertNil(Parsers.children(in: "wet and dirty, both", among: kids))
        XCTAssertNil(Parsers.children(in: "fed on both sides", among: kids))
        XCTAssertNil(Parsers.children(in: "Leo had 90 ml", among: [Baby(id: LEO, name: "Leo")]))
        XCTAssertNil(Parsers.children(in: "Leonard is here", among: kids))
    }

    func testEachChildHasTheirOwnFeed() async throws {
        let s = try twins()
        try await s.toggleFeed(baby: MIA, surface: .phone)
        try await s.toggleFeed(baby: LEO, surface: .phone)
        let leoFinish = try await s.toggleFeed(baby: LEO, surface: .phone)
        XCTAssertEqual(leoFinish.type, "feed.bottle.finish")
        XCTAssertEqual(leoFinish.babyId, LEO)
        let (mia, leo, all) = (try await s.status(baby: MIA), try await s.status(baby: LEO), try await s.derived())
        XCTAssertNotNil(mia.openFeedSince)
        XCTAssertNil(leo.openFeedSince)
        XCTAssertEqual(all.duplicates.count, 0)
    }

    func testVoiceGoesToTheNamedChildOrTheCurrentOne() async throws {
        let s = try twins()
        let named = try await s.processVoice(transcript: "Leo had a wet diaper", surface: .phone, babies: [MIA])
        let n = try await commit(s, named)
        XCTAssertEqual(n.babyId, LEO)
        let current = try await s.processVoice(transcript: "wet diaper", surface: .phone, babies: [LEO])
        let c = try await commit(s, current)
        XCTAssertEqual(c.babyId, LEO)
        let fallback = try await s.processVoice(transcript: "dirty diaper", surface: .phone)
        let f = try await commit(s, fallback)
        XCTAssertEqual(f.babyId, MIA)
    }

    func testBothChildrenFromOneSentenceUndoTogether() async throws {
        let s = try twins()
        let r = try await s.processVoice(transcript: "the twins fell asleep", surface: .phone)
        var events = r.events
        if events.isEmpty { events = try await s.resolveCapture(r.capture.id, candidate: 0) }
        XCTAssertEqual(Set(events.map(\.babyId)), [MIA, LEO])
        XCTAssertEqual(Set(events.map { $0.string("group") }).count, 1)
        XCTAssertNotEqual(events[0].id, events[1].id)
        try await s.undoGroup(of: events[0].id)
        let (mia, leo) = (try await s.status(baby: MIA), try await s.status(baby: LEO))
        XCTAssertNil(mia.sleepingSince)
        XCTAssertNil(leo.sleepingSince)
    }

    func testGroupActionAndPerChildBottle() async throws {
        let s = try twins()
        let events = try await s.forEach([MIA, LEO]) { s, baby, group in
            try s.log(type: "feed.bottle.single", fields: ["consumed_fraction": .number(0.5)].merging(group) { $1 },
                      provenance: Provenance(surface: .phone, input: .tap), baby: baby)
        }
        XCTAssertEqual(events.count, 2)
        let h = await s.household
        XCTAssertEqual(events.map { h.milliliters($0) }, [60, 75])
        let csv = CSVExport.csv(log: try await s.derived(), household: h)
        XCTAssertTrue(csv.contains(",Leo,feed.bottle.single,"))
    }

    func testRemindersPerChild() async throws {
        let s = try twins()
        var h = await s.household
        h.reminders.diaperEveryMinutes = 120
        try await s.log(type: "diaper", fields: ["kind": .string("wet")], provenance: Provenance(surface: .phone, input: .tap), baby: MIA)
        try await s.log(type: "diaper", fields: ["kind": .string("wet")], provenance: Provenance(surface: .phone, input: .tap), baby: LEO)
        let plan = ReminderPlanner.plan(logs: try await s.derivedByChild(), household: h, me: A, now: Date())
        XCTAssertEqual(Set(plan.compactMap(\.baby)), [MIA, LEO])
        XCTAssertTrue(plan.contains { $0.message.hasPrefix("Leo · ") })
    }

    func testMovingAnEntryToTheOtherChild() async throws {
        let s = try twins()
        let e = try await s.log(type: "diaper", fields: ["kind": .string("dirty")], provenance: Provenance(surface: .phone, input: .tap), baby: MIA)
        try await s.edit(e.id, fields: e.fields, baby: LEO)
        let (mia, leo) = (try await s.status(baby: MIA), try await s.status(baby: LEO))
        XCTAssertNil(mia.lastDiaperAt)
        XCTAssertNotNil(leo.lastDiaperAt)
    }
}
