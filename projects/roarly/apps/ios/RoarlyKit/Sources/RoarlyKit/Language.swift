import Foundation

/// The language a story is told in. Every language is one file, `Lexicons/<id>.json`, and nothing
/// in the code names a language: to add one, add its file (and `stories_<id>.json` for the tests).
/// The file carries the picker's title, the speech locales, every sound's names and noises, the
/// words that say something arrives, leaves, is negated or ends the story, and how the language
/// is read (plural endings, how far a negation reaches, …). The sound catalog itself
/// (`SoundCatalog`) is the same in every language.
public struct StoryLanguage: RawRepresentable, Hashable, Identifiable, Sendable {
    public let rawValue: String
    public var id: String { rawValue }

    public init?(rawValue: String) {
        guard Lexicon.catalog[rawValue] != nil else { return nil }
        self.rawValue = rawValue
    }

    /// The fallback when the phone's language has no lexicon, and the language the story-sense
    /// classifier's text is masked in.
    public static let english = StoryLanguage(rawValue: "en")!

    /// Every language with a lexicon, in picker order.
    public static var all: [StoryLanguage] {
        Lexicon.catalog.values.sorted { ($0.order, $0.id) < ($1.order, $1.id) }.compactMap { StoryLanguage(rawValue: $0.id) }
    }

    public var lexicon: Lexicon { Lexicon.catalog[rawValue]! }

    /// In its own language, for the picker ("中文（普通话）").
    public var title: String { lexicon.name }
    /// In English, for logs and messages.
    public var englishName: String { lexicon.englishName }
    /// One line for under the picker, in the language itself.
    public var hint: String { lexicon.hint }
    /// Speech locales to try, best first.
    public var speechLocales: [String] { lexicon.speechLocales }

    /// The language whose file lists this ISO 639 code ("zh", "es"), else English.
    public static func matching(languageCode code: String?) -> StoryLanguage {
        guard let code else { return .english }
        return all.first { $0.lexicon.languageCodes.contains(code) } ?? .english
    }
}

/// A cue's words in one language.
public struct CueWords: Sendable {
    public let triggers: [String]
    public let soundWords: [String]
}

/// One language's lexicon, loaded from `Lexicons/<id>.json`; phrases are normalized into token
/// sequences (`TextNormalizer.words`). Scripts without spaces are matched character by character
/// (every Han character is a token), so their phrases are character sequences and their reaches
/// are longer.
public struct Lexicon: Sendable {
    public let id: String
    let order: Int
    public let name: String
    public let englishName: String
    let languageCodes: [String]
    let speechLocales: [String]
    public let hint: String
    /// The story-sense classifier was trained on this language.
    public let storySenseClassifier: Bool
    /// Partial text can stop mid-word: a name at its very end waits for the next token.
    let holdNamesAtEndOfPartial: Bool
    /// (singular ending, plural ending): "y" → "ies".
    public let plurals: [(String, String)]
    /// A negation right after one of these is alarm, not negation ("oh no, a tiger!").
    let interjections: Set<String>
    /// Word endings that negate ("wasn't").
    let negationSuffixes: [String]

    let cueWords: [String: CueWords]
    let negations: [[String]]
    /// Phrases that start like a negation but aren't one ("不久" soon, "没想到" unexpectedly).
    let notNegations: [[String]]
    let departures: [[String]]
    let arrivals: [[String]]
    let memories: [[String]]
    /// "what does the cow say?": either part may be empty (then only the other must match).
    let askBefore: [[String]]
    let askAfter: [[String]]
    /// Words that look like a sound's name but aren't ("马上" right away, "牛奶" milk): matched
    /// like names so the longer phrase wins, then dropped.
    let blockers: [[String]]
    let stopWords: [[String]]
    let clearSkies: [[String]]
    let goodnight: [[String]]
    /// Phrases that contain an ending word but don't end the story ("por fin" finally).
    let notGoodnight: [[String]]
    /// Tokens before a mention a negation may sit at; tokens after a mention the judge reads;
    /// tokens back to look for the sentence start; tokens after needed to stop being provisional.
    let negationReach: Int
    let lookahead: Int
    let lookbehind: Int
    let settledAfter: Int

    /// The cue's names and noises in this language (none when the file doesn't list the cue).
    public func words(for cue: Cue) -> CueWords {
        cueWords[cue.id] ?? CueWords(triggers: [], soundWords: [])
    }

    /// Whether a transcript word is the phrase word or one of its plurals ("lions", "peces").
    func matches(_ word: String, _ trigger: String) -> Bool {
        TextNormalizer.matches(word, trigger, plurals: plurals)
    }

    // MARK: - Loading

    /// Every `Lexicons/*.json` in the package, by id.
    static let catalog: [String: Lexicon] = {
        guard let folder = Bundle.module.url(forResource: "Lexicons", withExtension: nil),
              let files = try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)
        else { return [:] }
        var result: [String: Lexicon] = [:]
        for url in files where url.pathExtension == "json" {
            do {
                let file = try JSONDecoder().decode(File.self, from: Data(contentsOf: url))
                result[file.id] = Lexicon(file)
            } catch {
                assertionFailure("Lexicon \(url.lastPathComponent): \(error)")
            }
        }
        return result
    }()

    struct File: Decodable {
        struct Reach: Decodable { let negation, lookahead, lookbehind, settledAfter: Int }
        struct Words: Decodable { let words: [String]; let sounds: [String]? }
        let id: String
        let order: Int
        let name, englishName, hint: String
        let languageCodes, speechLocales: [String]
        let storySenseClassifier, holdNamesAtEndOfPartial: Bool
        let plurals: [[String]]
        let interjections, negationSuffixes: [String]
        let reach: Reach
        let cues: [String: Words]
        let negations, notNegations, departures, arrivals, memories, askBefore, askAfter, blockers,
            stopWords, clearSkies, goodnight, notGoodnight: [String]
    }

    init(_ f: File) {
        func p(_ list: [String]) -> [[String]] { list.map(TextNormalizer.words).filter { !$0.isEmpty } }
        id = f.id
        order = f.order
        name = f.name
        englishName = f.englishName
        hint = f.hint
        languageCodes = f.languageCodes
        speechLocales = f.speechLocales
        storySenseClassifier = f.storySenseClassifier
        holdNamesAtEndOfPartial = f.holdNamesAtEndOfPartial
        plurals = f.plurals.compactMap { $0.count == 2 ? ($0[0], $0[1]) : nil }
        interjections = Set(f.interjections.flatMap(TextNormalizer.words))
        negationSuffixes = f.negationSuffixes
        cueWords = f.cues.mapValues { CueWords(triggers: $0.words, soundWords: $0.sounds ?? []) }
        negations = p(f.negations)
        notNegations = p(f.notNegations)
        departures = p(f.departures)
        arrivals = p(f.arrivals)
        memories = p(f.memories)
        askBefore = p(f.askBefore)
        askAfter = p(f.askAfter)
        blockers = p(f.blockers)
        stopWords = p(f.stopWords)
        clearSkies = p(f.clearSkies)
        goodnight = p(f.goodnight)
        notGoodnight = p(f.notGoodnight)
        negationReach = f.reach.negation
        lookahead = f.reach.lookahead
        lookbehind = f.reach.lookbehind
        settledAfter = f.reach.settledAfter
    }
}
