import XCTest
@testable import RoarlyKit

final class TextTests: XCTestCase {
    func testTokensAndClauses() {
        let t = TextNormalizer.tokens("The lion's den. Suddenly, a T-Rex!")
        XCTAssertEqual(t.map(\.text), ["the", "lion", "den", "suddenly", "a", "t", "rex"])
        XCTAssertTrue(t[2].endsSentence)
        XCTAssertTrue(t[3].endsClause)
        XCTAssertFalse(t[3].endsSentence)
    }

    func testInflections() {
        XCTAssertTrue(TextNormalizer.matches("lions", "lion"))
        XCTAssertTrue(TextNormalizer.matches("puppies", "puppy"))
        XCTAssertTrue(TextNormalizer.matches("wolves", "wolf"))
        XCTAssertFalse(TextNormalizer.matches("lionel", "lion"))
    }
}

final class MatcherTests: XCTestCase {
    func testLongestPhraseWins() {
        let m = CueMatcher().mentions(in: TextNormalizer.tokens("a grizzly bear appeared"))
        XCTAssertEqual(m.map(\.cueID), ["bear"])
        XCTAssertEqual(m.first?.range, 1..<3)
    }

    func testSharedSoundWordGoesToRecentCue() {
        let m = CueMatcher().mentions(in: TextNormalizer.tokens("and then he roared"), recentCueIDs: ["dog", "tiger"])
        XCTAssertEqual(m.map(\.cueID), ["tiger"])
        XCTAssertTrue(m[0].isSoundWord)
    }

    func testSharedSoundWordWithoutContextIsDropped() {
        XCTAssertTrue(CueMatcher().mentions(in: TextNormalizer.tokens("something roared")).isEmpty)
    }

    func testUniqueSoundWord() {
        XCTAssertEqual(CueMatcher().mentions(in: TextNormalizer.tokens("woof woof")).map(\.cueID), ["dog", "dog"])
    }

    func testCustomTrigger() {
        let m = CueMatcher(customTriggers: ["lion": ["mister whiskers"]]).mentions(in: TextNormalizer.tokens("here comes mister whiskers"))
        XCTAssertEqual(m.map(\.cueID), ["lion"])
    }
}

final class CatalogTests: XCTestCase {
    func testIDsUniqueAndFreeSetSane() {
        XCTAssertEqual(Set(SoundCatalog.all.map(\.id)).count, SoundCatalog.all.count)
        XCTAssertGreaterThanOrEqual(SoundCatalog.freeCues.count, 10)
        for cue in SoundCatalog.all {
            XCTAssertFalse(StoryLanguage.english.lexicon.words(for: cue).triggers.isEmpty, cue.id)
            XCTAssertFalse(cue.files.isEmpty, cue.id)
        }
    }
}

final class SoundFileTests: XCTestCase {
    /// Every file the catalog names is bundled (apps/ios/App/Resources/Sounds), and nothing extra.
    func testEveryCueHasItsSoundFiles() throws {
        let dir = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("App/Resources/Sounds")
        let present = Set(try FileManager.default.contentsOfDirectory(atPath: dir.path).filter { $0.hasSuffix(".m4a") }.map { String($0.dropLast(4)) })
        let named = Set(SoundCatalog.allFiles)
        XCTAssertEqual(named.subtracting(present), [], "catalog names files that aren't bundled")
        XCTAssertEqual(present.subtracting(named), [], "bundled files no cue uses")
    }
}

final class StoryEngineTests: XCTestCase {
    struct Case: Decodable {
        let lines: [String]
        let play: [String]?
        let suggest: [String]?
        let never: [String]?
    }
    struct Suite: Decodable { let cases: [Case] }

    func played(_ actions: [StoryAction]) -> Set<String> {
        Set(actions.compactMap {
            switch $0 {
            case .play(let id, _), .startAmbient(let id, _): return id
            default: return nil
            }
        })
    }

    func suggested(_ actions: [StoryAction]) -> Set<String> {
        Set(actions.compactMap { if case .suggest(let s) = $0 { return s.cueID } else { return nil } })
    }

    /// The story eval: every line read as a finished utterance.
    /// Every language's stories (`stories_<id>.json`); a language without one fails.
    func testStoryEvalEveryLanguage() throws {
        XCTAssertGreaterThanOrEqual(StoryLanguage.all.count, 3)
        for language in StoryLanguage.all { try runEval("stories_\(language.rawValue)", language) }
    }

    func runEval(_ name: String, _ language: StoryLanguage) throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "json"), "missing \(name).json")
        let suite = try JSONDecoder().decode(Suite.self, from: Data(contentsOf: url))
        var failures: [String] = []
        for c in suite.cases {
            let engine = StoryEngine(settings: .init(mode: .play, automation: .balanced, language: language))
            var all: [StoryAction] = []
            var t = Date()
            for line in c.lines {
                t += 3
                all += engine.ingest(line, isFinal: true, at: t)
            }
            let p = played(all), s = suggested(all)
            for id in c.play ?? [] where !p.contains(id) { failures.append("\(c.lines.joined(separator: " ")) → expected \(id) to play (suggested: \(s.contains(id)))") }
            for id in c.suggest ?? [] where !p.contains(id) && !s.contains(id) { failures.append("\(c.lines.joined(separator: " ")) → expected \(id) offered") }
            for id in c.never ?? [] where p.contains(id) { failures.append("\(c.lines.joined(separator: " ")) → \(id) must not play") }
        }
        XCTAssertTrue(failures.isEmpty, "[\(language.englishName)]\n" + failures.joined(separator: "\n"))
    }

    func testVolatileSuggestionWithdrawnWhenTigerLeaves() {
        let e = StoryEngine(settings: .init(mode: .play, automation: .balanced))
        let t0 = Date()
        let a1 = e.ingest("look the tiger", isFinal: false, at: t0)
        XCTAssertEqual(suggested(a1), ["tiger"])
        let a2 = e.ingest("look the tiger is running away from us", isFinal: false, at: t0 + 1)
        XCTAssertTrue(a2.contains { if case .withdraw = $0 { return true } else { return false } })
        let a3 = e.ingest("Look, the tiger is running away from us.", isFinal: true, at: t0 + 2)
        XCTAssertTrue(played(a3).isEmpty)
        XCTAssertTrue(e.suggestions.isEmpty)
    }

    func testSoundWordPlaysFromPartialText() {
        let e = StoryEngine(settings: .init(mode: .play))
        let t = Date()
        _ = e.ingest("There was a lion.", isFinal: true, at: t)
        let a = e.ingest("and he roared", isFinal: false, at: t + 10)
        XCTAssertEqual(played(a), ["lion"])
        // The final text doesn't play it again.
        XCTAssertTrue(played(e.ingest("And he roared.", isFinal: true, at: t + 11)).isEmpty)
    }

    func testCooldownAndTapReplays() {
        let e = StoryEngine(settings: .init(mode: .play))
        let t = Date()
        XCTAssertEqual(played(e.ingest("The dog barked.", isFinal: true, at: t)), ["dog"])
        XCTAssertTrue(played(e.ingest("The dog barked again.", isFinal: true, at: t + 2)).isEmpty)
        XCTAssertEqual(played(e.tap(cueID: "dog", at: t + 3)), ["dog"])
        XCTAssertEqual(played(e.ingest("The dog barked again.", isFinal: true, at: t + 10)), ["dog"])
    }

    func testSoundWordRepeatsSoonAfterAppearance() {
        let e = StoryEngine(settings: .init(mode: .play))
        let t = Date()
        XCTAssertEqual(played(e.ingest("Suddenly, a big lion jumped out!", isFinal: true, at: t)), ["lion"])
        XCTAssertEqual(played(e.ingest("He opened his mouth and roared.", isFinal: true, at: t + 4)), ["lion"])
    }

    func testAmbientStartsAndStops() {
        let e = StoryEngine(settings: .init(mode: .bedtime))
        XCTAssertEqual(played(e.ingest("And then it started to rain.", isFinal: true)), ["rain"])
        XCTAssertEqual(e.activeAmbients, ["rain"])
        let stop = e.ingest("Then the sun came out.", isFinal: true)
        XCTAssertTrue(stop.contains(.stopAmbient(cueID: "rain")))
        XCTAssertTrue(e.activeAmbients.isEmpty)
    }

    func testRainStoppedStopsRain() {
        let e = StoryEngine()
        _ = e.ingest("It started raining.", isFinal: true)
        let a = e.ingest("Finally the rain stopped.", isFinal: true)
        XCTAssertTrue(a.contains(.stopAmbient(cueID: "rain")))
    }

    func testGoodnightFadesAll() {
        let e = StoryEngine()
        _ = e.ingest("It started raining.", isFinal: true)
        XCTAssertTrue(e.ingest("The end. Good night!", isFinal: true).contains(.fadeAll))
    }

    func testReviewResolution() {
        let e = StoryEngine(settings: .init(mode: .play, automation: .balanced))
        let a = e.ingest("All the animals were quiet, even the lion.", isFinal: true)
        XCTAssertTrue(played(a).isEmpty)
        // "quiet" comes before the lion here, so the judge is unsure: a suggestion and a review.
        guard let review = e.reviews.first else { return XCTFail("expected a review") }
        XCTAssertEqual(review.cueID, "lion")
        XCTAssertEqual(played(e.resolve(reviewID: review.id, play: true)), ["lion"])
        XCTAssertTrue(e.suggestions.isEmpty)
    }

    func testSuggestionsExpire() {
        let e = StoryEngine(settings: .init(mode: .play, automation: .ask))
        let t = Date()
        _ = e.ingest("There was a cow.", isFinal: true, at: t)
        XCTAssertEqual(e.suggestions.count, 1)
        let a = e.tick(at: t + 30)
        XCTAssertTrue(a.contains { if case .withdraw = $0 { return true } else { return false } })
        XCTAssertTrue(e.suggestions.isEmpty)
    }

    func testFreeTierOnlyMatchesAllowedCues() {
        let e = StoryEngine(settings: .init(mode: .play, allowedCueIDs: Set(SoundCatalog.freeCues.map(\.id))))
        XCTAssertTrue(played(e.ingest("The wolf howled.", isFinal: true)).isEmpty)
        XCTAssertEqual(played(e.ingest("The lion roared.", isFinal: true)), ["lion"])
    }

    func testBedtimeIsQuieter() {
        let lion = SoundCatalog.cue("lion")!
        XCTAssertLessThan(StoryEngine(settings: .init(mode: .bedtime)).volume(for: lion), StoryEngine(settings: .init(mode: .play)).volume(for: lion))
    }
}

final class DirectorTests: XCTestCase {
    func testParse() {
        XCTAssertEqual(DirectorPrompt.parse("Yes."), true)
        XCTAssertEqual(DirectorPrompt.parse("<think>\n</think>\nno"), false)
        XCTAssertNil(DirectorPrompt.parse("maybe"))
    }

    func testMaskedReplacesTheSoundsWords() {
        let r = StoryEngine.Review(id: UUID(), cueID: "dog", utterance: "The puppies ran to the Dog house.", story: [], score: 0.5)
        XCTAssertEqual(DirectorPrompt.masked(r), "The THING ran to the THING house.")
        let l = StoryEngine.Review(id: UUID(), cueID: "lion", utterance: "The king of the jungle yawned.", story: [], score: 0.5)
        XCTAssertEqual(DirectorPrompt.masked(l), "The THING yawned.")
    }

    func testQuestionNamesTheSound() {
        let r = StoryEngine.Review(id: UUID(), cueID: "tiger", utterance: "The tiger is near.", story: ["Once upon a time."], score: 0.5)
        let q = DirectorPrompt.question(for: r)
        XCTAssertTrue(q.contains("the tiger"))
        XCTAssertTrue(q.contains("Once upon a time."))
    }
}

extension StoryLanguage {
    static let zh = StoryLanguage(rawValue: "zh")!
    static let es = StoryLanguage(rawValue: "es")!
}

final class LanguageTests: XCTestCase {
    func played(_ actions: [StoryAction]) -> Set<String> {
        Set(actions.compactMap { if case .play(let id, _) = $0 { return id }; if case .startAmbient(let id, _) = $0 { return id }; return nil })
    }

    func testEveryCueHasWordsInEveryLanguage() {
        for language in StoryLanguage.all {
            let lex = language.lexicon
            for cue in SoundCatalog.all {
                XCTAssertFalse(lex.words(for: cue).triggers.isEmpty, "\(language.englishName) has no words for \(cue.id)")
            }
            for id in lex.cueWords.keys { XCTAssertNotNil(SoundCatalog.cue(id), "\(language) lists unknown cue \(id)") }
        }
    }

    func testHanCharactersAreTokens() {
        let t = TextNormalizer.tokens("狮子，吼！")
        XCTAssertEqual(t.map(\.text), ["狮", "子", "吼"])
        XCTAssertTrue(t[1].endsClause)
        XCTAssertTrue(t[2].endsSentence)
    }

    func testTraditionalBecomesSimplified() {
        XCTAssertEqual(TextNormalizer.words("獅子"), TextNormalizer.words("狮子"))
    }

    func testAccentsFold() {
        XCTAssertEqual(TextNormalizer.words("León rugió"), ["leon", "rugio"])
        XCTAssertTrue(TextNormalizer.matches("leones", "leon"))
        XCTAssertTrue(StoryLanguage.es.lexicon.matches("peces", "pez"))
        XCTAssertFalse(TextNormalizer.matches("peces", "pez"))
    }

    func testBlockersAreDropped() {
        let m = CueMatcher(language: .zh)
        XCTAssertTrue(m.mentions(in: TextNormalizer.tokens("我们马上出发")).isEmpty)
        XCTAssertEqual(m.mentions(in: TextNormalizer.tokens("一匹马")).map(\.cueID), ["horse"])
        XCTAssertEqual(m.mentions(in: TextNormalizer.tokens("猫头鹰")).map(\.cueID), ["owl"])
    }

    func testMandarinRainStopsAndGoodnight() {
        let e = StoryEngine(settings: .init(mode: .play, language: .zh))
        XCTAssertEqual(played(e.ingest("开始下雨了。", isFinal: true)), ["rain"])
        XCTAssertTrue(e.ingest("后来雨停了。", isFinal: true).contains(.stopAmbient(cueID: "rain")))
        _ = e.ingest("开始下雨了。", isFinal: true)
        XCTAssertTrue(e.ingest("晚安，宝贝。", isFinal: true).contains(.fadeAll))
    }

    func testStopOnlyInItsSentence() {
        let e = StoryEngine(settings: .init(mode: .play, language: .es))
        _ = e.ingest("Había un perrito en el bosque. Y empezó a llover.", isFinal: false)
        let a = e.ingest("Había un perrito en el bosque. Y empezó a llover. Por fin, la lluvia paró.", isFinal: true)
        XCTAssertTrue(a.contains(.stopAmbient(cueID: "rain")))
        XCTAssertFalse(a.contains(.stopAmbient(cueID: "forest")))
    }

    func testSpanishGoodnight() {
        let e = StoryEngine(settings: .init(mode: .play, language: .es))
        XCTAssertEqual(played(e.ingest("Y empezó a llover.", isFinal: true)), ["rain"])
        XCTAssertFalse(e.ingest("Por fin, la lluvia paró.", isFinal: true).contains(.fadeAll))
        _ = e.ingest("Y empezó a llover.", isFinal: true)
        XCTAssertTrue(e.ingest("Fin. Buenas noches.", isFinal: true).contains(.fadeAll))
        _ = e.ingest("Y empezó a llover.", isFinal: true)
        XCTAssertTrue(e.ingest("Colorín colorado, este cuento se ha acabado.", isFinal: true).contains(.fadeAll))
    }

    func testEnglishWordsDontCountInMandarin() {
        let e = StoryEngine(settings: .init(mode: .play, language: .zh))
        XCTAssertTrue(played(e.ingest("The lion roared.", isFinal: true)).isEmpty)
    }
}

final class MandarinPartialTests: XCTestCase {
    func testNameAtEndOfPartialWaits() {
        let e = StoryEngine(settings: .init(mode: .play, language: .zh))
        let t = Date()
        XCTAssertTrue(e.ingest("我们马", isFinal: false, at: t).isEmpty)
        XCTAssertTrue(e.ingest("我们马上就到家了", isFinal: false, at: t + 1).isEmpty)
    }
}
