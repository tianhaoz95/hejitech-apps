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

    func testNewCategoriesAreOffByDefaultAndAskedThroughCare() {
        let r = EventRegistry.shared
        let new = r.categories.filter { $0.group != nil }
        XCTAssertEqual(Set(new.map(\.id)), ["bath", "lotion", "toothbrush", "potty", "teething", "medication", "symptom",
                                            "temperature", "doctor", "vaccination", "tummy_time", "play", "walk"])
        XCTAssertTrue(new.allSatisfy { !$0.defaultEnabled })
        let all = Set(r.categories.map(\.id))
        let qs = VoiceInterpreter(model: KeywordDecisionModel()).questions(
            for: InterpretContext(reference: Date(), log: DerivedLog(events: []), enabledCategories: all))
        let options = Set(qs.first { $0.id == "category" }!.options.map(\.key))
        XCTAssertTrue(options.isDisjoint(with: new.map(\.id)))
        XCTAssertTrue(options.contains(VoiceInterpreter.careKey))
        XCTAssertEqual(Set(qs.first { $0.id == "care_type" }!.options.map(\.key)), Set(new.map(\.id)))
        // none enabled: no care option, no care question (the prompt stays what it was)
        let core = VoiceInterpreter(model: KeywordDecisionModel()).questions(
            for: InterpretContext(reference: Date(), log: DerivedLog(events: []), enabledCategories: r.defaultCategories))
        XCTAssertFalse(core.contains { $0.id == "care_type" || $0.options.contains { $0.key == VoiceInterpreter.careKey } })
        for t in r.types where new.contains(where: { $0.id == t.category }) {
            XCTAssertNotNil(t.icon, t.id)
            XCTAssertNotNil(t.fields, t.id)
        }
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
