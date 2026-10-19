import XCTest
@testable import LogCore

/// The tap-logged care, health and activity types (spec `fields`, `"model": false`).
final class CareTypesTests: XCTestCase {
    private let tap = Provenance(surface: .phone, input: .tap)

    private func service(enabled: [String]) throws -> LogService {
        var h = Household(id: H, babyId: B, bottleMl: 120, caregivers: [Caregiver(id: A, name: "Alex")])
        h.categories = enabled
        return LogService(store: try SQLiteLogStore.inMemory(), household: h, me: A,
                          interpreter: VoiceInterpreter(model: KeywordDecisionModel()))
    }

    func testNewCategoriesAreOffByDefaultAndAskedThroughTheirGroup() {
        let r = EventRegistry.shared
        let new = r.categories.filter { $0.group != nil }
        XCTAssertEqual(Set(new.map(\.id)), ["bath", "lotion", "toothbrush", "potty", "teething", "medication", "symptom",
                                            "temperature", "doctor", "vaccination", "tummy_time", "play", "walk"])
        XCTAssertTrue(new.allSatisfy { !$0.defaultEnabled })
        let all = Set(r.categories.map(\.id))
        let qs = VoiceInterpreter(model: KeywordDecisionModel()).questions(
            for: InterpretContext(reference: Date(), log: DerivedLog(events: []), enabledCategories: all))
        XCTAssertEqual(qs.first { $0.id == "category" }!.options.map(\.key),
                       ["feeding", "diaper", "sleep", "growth", "health", "care", "activity", VoiceInterpreter.noneKey])
        XCTAssertEqual(qs.first { $0.id == "health_entry" }!.options.map(\.key),
                       ["medication", "symptom", "temperature", "teething", "doctor", "vaccination"])
        XCTAssertEqual(qs.first { $0.id == "diaper_entry" }!.options.map(\.key), ["diaper", "potty"])
        // a new household: feeding (bottle, breast) needs an entry question; no care groups at all
        let core = VoiceInterpreter(model: KeywordDecisionModel()).questions(
            for: InterpretContext(reference: Date(), log: DerivedLog(events: []), enabledCategories: r.defaultCategories))
        XCTAssertEqual(core.first { $0.id == "category" }!.options.map(\.key), ["feeding", "diaper", "sleep", "growth", VoiceInterpreter.noneKey])
        XCTAssertEqual(Set(core.map(\.id)).intersection(["health_entry", "care_entry", "activity_entry", "diaper_entry"]), [])
        XCTAssertEqual(core.first { $0.id == "feeding_entry" }!.options.map(\.key), ["bottle", "breast"])
    }

    func testGroupsCoverEveryCategoryOnce() {
        let r = EventRegistry.shared
        let grouped = r.modelGroups.flatMap(\.categories)
        XCTAssertEqual(grouped.count, Set(grouped).count)
        XCTAssertEqual(Set(grouped), Set(r.categories.map(\.id)))
    }

    func testCombinesGroupEntryAndPhase() async throws {
        let s = try service(enabled: EventRegistry.shared.categories.map(\.id))
        let r = try await s.processVoice(transcript: "gave her a bath", surface: .phone)
        XCTAssertEqual(r.interpretation.best?.type, "bath")
        let m = try await s.processVoice(transcript: "gave him some infant tylenol", surface: .phone)
        XCTAssertEqual(m.interpretation.best?.type, "medication")
        XCTAssertEqual(m.interpretation.best?.fields["medicine"], .string("gave him some infant tylenol"))
    }

    func testRequiredFieldsFromTheWords() {
        func f(_ type: String, _ key: String) -> EventRegistry.FieldSpec { EventRegistry.shared.type(type)!.fields!.first { $0.key == key }! }
        XCTAssertEqual(Parsers.field(f("symptom", "symptom"), in: "runny nose again"), .string("runny_nose"))
        XCTAssertEqual(Parsers.field(f("symptom", "symptom"), in: "she's a bit off today"), .string("other"))
        XCTAssertEqual(Parsers.field(f("potty", "result"), in: "pee in the potty"), .string("pee"))
        XCTAssertEqual(Parsers.field(f("potty", "result"), in: "pee and poop on the potty"), .string("both"))
        XCTAssertNil(Parsers.field(f("potty", "result"), in: "sat on the potty"))
        XCTAssertEqual(Parsers.field(f("temperature", "temp_c"), in: "took her temperature, 38.1"), .number(38.1))
        XCTAssertEqual(Parsers.field(f("temperature", "temp_c"), in: "fever of 100.4"), .number(38.0))
        XCTAssertNil(Parsers.field(f("temperature", "temp_c"), in: "she feels warm"))
        XCTAssertEqual(Parsers.field(f("tummy_time", "minutes"), in: "tummy time for ten minutes"), .number(10))
        XCTAssertEqual(Parsers.field(f("walk", "minutes"), in: "back from a 45 min walk"), .number(45))
        XCTAssertNil(Parsers.field(f("play", "minutes"), in: "played on the mat 10 minutes ago"))
    }

    func testOptionalNumbersAreKeptWhenSaid() async throws {
        let s = try service(enabled: EventRegistry.shared.categories.map(\.id))
        let r = try await s.processVoice(transcript: "tummy time for ten minutes", surface: .phone)
        XCTAssertEqual(r.interpretation.best?.type, "tummy_time")
        XCTAssertEqual(r.interpretation.best?.fields["minutes"], .number(10))
        let m = try await s.processVoice(transcript: "gave him some infant tylenol", surface: .phone)
        XCTAssertNil(m.interpretation.best?.fields["dose"])   // an optional text isn't the sentence
    }

    func testFieldsAreValidatedFromTheSpec() async throws {
        let s = try service(enabled: ["medication", "symptom", "temperature", "potty", "tummy_time", "bath"])
        _ = try await s.log(type: "bath", provenance: tap)
        _ = try await s.log(type: "medication", fields: ["medicine": .string("Vitamin D"), "dose": .string("1 drop")], provenance: tap)
        _ = try await s.log(type: "symptom", fields: ["symptom": .string("runny_nose")], provenance: tap)
        _ = try await s.log(type: "temperature", fields: ["temp_c": .number(38.2)], provenance: tap)
        _ = try await s.log(type: "tummy_time", fields: ["minutes": .number(10)], provenance: tap)
        _ = try await s.log(type: "tummy_time", provenance: tap)                               // minutes optional
        for (type, fields) in [("medication", [:]), ("symptom", ["symptom": FieldValue.string("sneezing")]),
                               ("temperature", [:]), ("potty", ["result": .string("maybe")]),
                               ("tummy_time", ["minutes": .number(0)]), ("medication", ["medicine": .string(" ")])] {
            do {
                _ = try await s.log(type: type, fields: fields, provenance: tap)
                XCTFail("\(type) \(fields) should be rejected")
            } catch LogService.LogError.invalidField {}
        }
    }

    func testDisabledCategoryCantBeLogged() async throws {
        let s = try service(enabled: ["bath"])
        do {
            _ = try await s.log(type: "lotion", provenance: tap)
            XCTFail("lotion is off")
        } catch LogService.LogError.disabledCategory {}
    }

    func testLabelsShowTheFields() {
        let us = Locale(identifier: "en_US"), uk = Locale(identifier: "en_GB")
        XCTAssertEqual(VoiceInterpreter.label(type: "symptom", fields: ["symptom": .string("runny_nose")]), "Symptom · Runny nose")
        XCTAssertEqual(VoiceInterpreter.label(type: "medication", fields: ["medicine": .string("Vitamin D"), "dose": .string("1 drop")]),
                       "Medication · Vitamin D, 1 drop")
        XCTAssertEqual(VoiceInterpreter.label(type: "walk", fields: ["minutes": .number(30)]), "Walk outside · 30 min")
        XCTAssertEqual(VoiceInterpreter.label(type: "bath", fields: [:]), "Bath")
        XCTAssertEqual(VoiceInterpreter.numberText(38.2, unit: "celsius", locale: uk), "38.2 °C")
        XCTAssertEqual(VoiceInterpreter.numberText(38.2, unit: "celsius", locale: us), "100.8 °F")
    }
}
