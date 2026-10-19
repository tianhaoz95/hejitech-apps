import Foundation

// MARK: - The decision model contract (mirrors the TypeSafe / llama.cpp `/v1/systemone` shape)

public struct DecisionQuestion: Sendable, Hashable {
    public let id: String
    public let instructions: String
    public let options: [Option]

    public struct Option: Sendable, Hashable {
        public let key: String
        public let description: String?
        public init(key: String, description: String?) { self.key = key; self.description = description }
    }

    public init(id: String, instructions: String, options: [Option]) {
        self.id = id
        self.instructions = instructions
        self.options = options
    }
}

public struct DecisionRequest: Sendable {
    public let state: String
    public let questions: [DecisionQuestion]
    public init(state: String, questions: [DecisionQuestion]) { self.state = state; self.questions = questions }

    /// The JSON body for a `/v1/systemone` server. Serialized by hand because option order matters
    /// to the model and llama.cpp keeps the key order it receives.
    public func systemOneJSON() -> Data {
        func str(_ s: String) -> String {
            let d = try! JSONSerialization.data(withJSONObject: [s], options: [])
            return String(String(decoding: d, as: UTF8.self).dropFirst().dropLast())
        }
        var qs: [String] = []
        for q in questions {
            let criteria = q.options.map { "\(str($0.key)):\($0.description.map(str) ?? "null")" }.joined(separator: ",")
            qs.append("\(str(q.id)):{\"type\":\"choice\",\"instructions\":\(str(q.instructions)),\"criteria\":{\(criteria)}}")
        }
        return Data("{\"state\":\(str(state)),\"questions\":{\(qs.joined(separator: ","))}}".utf8)
    }
}

public struct DecisionAnswer: Sendable, Hashable, Codable {
    /// Probabilities in the question's option order.
    public let options: [String]
    public let probabilities: [Double]

    public init(options: [String], probabilities: [Double]) {
        self.options = options
        self.probabilities = probabilities
    }

    public var top: (key: String, p: Double) {
        let i = probabilities.indices.max { probabilities[$0] < probabilities[$1] } ?? 0
        return (options[i], probabilities[i])
    }

    public func ranked() -> [(key: String, p: Double)] {
        zip(options, probabilities).sorted { $0.1 > $1.1 }.map { ($0.0, $0.1) }
    }

    public func p(_ key: String) -> Double { options.firstIndex(of: key).map { probabilities[$0] } ?? 0 }
}

public protocol DecisionModel: Sendable {
    var version: String { get }
    func decide(_ request: DecisionRequest) async throws -> [String: DecisionAnswer]
    /// Start loading weights early (e.g. when push-to-talk begins). Default: no-op.
    func warmUp() async
}

public extension DecisionModel {
    func warmUp() async {}
}

public enum DecisionError: Error, LocalizedError {
    case unavailable(String)
    case badResponse(String)
    public var errorDescription: String? {
        switch self {
        case .unavailable(let s): return "Decision model unavailable: \(s)"
        case .badResponse(let s): return "Decision model returned an unexpected response: \(s)"
        }
    }
}

// MARK: - Calibration

/// Per-question temperature applied on top of the model's own probabilities:
/// p' ∝ p^(1/T). Fit by the eval harness on labeled utterances (`spec/calibration.json`).
public struct Calibration: Codable, Sendable {
    public var temperatures: [String: Double]
    public var modelVersion: String?

    public init(temperatures: [String: Double] = [:], modelVersion: String? = nil) {
        self.temperatures = temperatures
        self.modelVersion = modelVersion
    }

    public static let identity = Calibration()

    /// The temperatures fitted by the eval harness and shipped with the app.
    public static let bundled: Calibration = {
        guard let url = Bundle.module.url(forResource: "calibration", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let c = try? JSONDecoder().decode(Calibration.self, from: data) else { return .identity }
        return c
    }()

    public func apply(_ answer: DecisionAnswer, question: String) -> DecisionAnswer {
        guard let t = temperatures[question], t > 0, t != 1 else { return answer }
        let logs = answer.probabilities.map { log(max($0, 1e-9)) / t }
        let m = logs.max() ?? 0
        let ex = logs.map { exp($0 - m) }
        let s = ex.reduce(0, +)
        return DecisionAnswer(options: answer.options, probabilities: ex.map { $0 / s })
    }
}

// MARK: - HTTP backend (llama-server / hosted decision models)

/// Calls any `/v1/systemone` server. In development the iOS simulator points this at
/// `llama-server -m Laya-Q8_0.gguf` on the Mac, so the real model runs without a device.
public struct SystemOneHTTPModel: DecisionModel {
    public let endpoint: URL
    public let apiKey: String?
    public let version: String
    public let session: URLSession

    public init(endpoint: URL, apiKey: String? = nil, version: String = "laya-q8_0@http", session: URLSession = .shared) {
        self.endpoint = endpoint
        self.apiKey = apiKey
        self.version = version
        self.session = session
    }

    public func decide(_ request: DecisionRequest) async throws -> [String: DecisionAnswer] {
        var req = URLRequest(url: endpoint.appendingPathComponent("v1/systemone"))
        req.httpMethod = "POST"
        req.timeoutInterval = 8
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let apiKey { req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization") }
        req.httpBody = request.systemOneJSON()
        let (data, resp) = try await session.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
            throw DecisionError.unavailable("HTTP \((resp as? HTTPURLResponse)?.statusCode ?? -1)")
        }
        return try Self.parse(data, questions: request.questions)
    }

    public static func parse(_ data: Data, questions: [DecisionQuestion]) throws -> [String: DecisionAnswer] {
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let answers = root["answers"] as? [String: Any] else {
            throw DecisionError.badResponse(String(decoding: data.prefix(200), as: UTF8.self))
        }
        var out: [String: DecisionAnswer] = [:]
        for q in questions {
            guard let a = answers[q.id] as? [String: Any], let probs = a["probabilities"] as? [String: Double] else { continue }
            let keys = q.options.map(\.key)
            out[q.id] = DecisionAnswer(options: keys, probabilities: keys.map { probs[$0] ?? 0 })
        }
        return out
    }
}

// MARK: - Keyword backend (deterministic; tests, previews and the no-model fallback)

/// A small rule-based scorer with the same contract as the real model. It is the fallback when
/// the on-device model is not downloaded yet, and it makes UI and pipeline tests deterministic.
public struct KeywordDecisionModel: DecisionModel {
    public let version = "keywords-1"
    public init() {}

    static let lexicon: [String: [String]] = [
        "feed.bottle.start": ["start bottle", "starting bottle", "started bottle", "start drinking", "started drinking", "starting a bottle", "started a bottle", "giving a bottle", "begin bottle", "start feeding", "started feeding", "bottle start"],
        "feed.bottle.finish": ["finished drinking", "done drinking", "finished bottle", "finished the bottle", "bottle done", "finished, drank", "drank", "left in the bottle", "left over", "finished feeding", "done with the bottle", "finished a bottle", "quarter left", "half left", "quarters left", "of the bottle"],
        "feed.bottle.single": ["had a bottle", "gave a bottle", "had a full bottle", "bottle earlier", "fed a bottle"],
        "feed.breast.start": ["nursing", "start nursing", "breastfeeding", "breast feeding", "latched", "on the left", "on the right", "start feeding left", "start feeding right"],
        "feed.breast.switch": ["switch", "switched", "other side", "swapped"],
        "feed.breast.finish": ["done nursing", "finished nursing", "stopped nursing", "done breastfeeding", "finished breastfeeding", "unlatched"],
        "feed.solids": ["puree", "cereal", "solids", "ate", "banana", "avocado", "oatmeal"],
        "diaper": ["diaper", "nappy", "poop", "pee", "wet", "dirty", "poopy", "blowout"],
        "sleep.start": ["asleep", "fell asleep", "down for a nap", "sleeping", "nap time", "went to sleep", "put her down", "put him down"],
        "sleep.end": ["woke up", "awake", "is up", "woke", "up from nap"],
        "pump": ["pumped", "pumping", "pump"],
        "weight": ["weighs", "weighed", "weight", "kilos", "pounds", "kg", "lbs"],
        "height": ["height", "tall", "length", "inches", "centimeters", "cm"],
        "head": ["head", "circumference", "head size"],
    ]

    /// The care, health and activity categories (their `<group>_entry` options).
    static let careLexicon: [String: [String]] = [
        "bath": ["bath", "bathed", "bathtub"], "lotion": ["lotion", "cream", " ointment", "moisturiz"],   // " ointment": not "appointment"
        "toothbrush": ["brushed her teeth", "brushed his teeth", "brush teeth", "brushed teeth", "toothbrush"],
        "potty": ["potty", "toilet"], "teething": ["teething", "tooth coming", "new tooth", "gums"],
        "medication": ["medicine", "medication", "drops", "vitamin", "tylenol", "ibuprofen", "dose", "antibiotic"],
        "symptom": ["cough", "runny nose", "congest", "rash", "vomit", "threw up", "diarrhea", "sneez", "spit up", "spat up"],
        "temperature": ["temperature", "fever", "degrees", "thermometer"],
        // visits, not mentions ("call the pediatrician tomorrow" isn't one)
        "doctor": ["back from the doctor", "back from the pediatrician", "saw the doctor", "saw the pediatrician", "at the doctor",
                   "at the pediatrician", "doctor says", "pediatrician says", "doctor visit", "checkup", "check-up"],
        "vaccination": ["vaccine", "vaccination", "shots", "jab", "immuniz"],
        "tummy_time": ["tummy time", "on her tummy", "on his tummy"], "play": ["played", "playing", "play time", "playtime"],
        "walk": ["walk", "stroller", "pram", "outside"],
    ]

    static let fieldLexicon: [String: [String: [String]]] = [
        "amount": [
            "quarter": ["drank a quarter", "quarter of", "a quarter"],
            "half": ["drank half", "half a bottle", "half of", "half"],
            "three_quarters": ["three quarters", "three-quarters", "most of"],
            "full": ["whole bottle", "all of it", "full bottle", "finished it all", "the whole", "everything", "full"],
            "quarter_left": ["quarter left", "quarter is left", "quarter of it left"],
            "half_left": ["half left", "half is left", "half of it left"],
            "three_quarters_left": ["three quarters left", "three-quarters left"],
        ],
        "side": ["left": ["left"], "right": ["right"], "both": ["both sides", "both"]],
        "contents": ["formula": ["formula"], "breast_milk": ["breast milk", "breastmilk", "pumped milk", "expressed"]],
        "diaper_kind": ["wet": ["wet", "pee"], "dirty": ["dirty", "poop", "poopy", "soiled", "blowout"], "both": ["both", "wet and dirty", "pee and poop"], "dry": ["dry", "clean"]],
        "solids_amount": ["taste": ["taste", "a bite"], "some": ["some", "a little"], "most": ["most"], "all": ["all of it", "everything", "all"]],
        "when": ["5": ["five minutes ago", "5 minutes ago", "few minutes ago", "couple minutes ago"], "15": ["fifteen minutes ago", "15 minutes ago", "little while ago"], "30": ["half an hour ago", "thirty minutes ago", "30 minutes ago"], "60": ["an hour ago", "one hour ago", "60 minutes ago"]],
    ]

    static let categoryPrefixes: [String: [String]] = [
        "bottle": ["feed.bottle"], "breast": ["feed.breast"], "pumping": ["pump"], "solids": ["feed.solids"],
        "diaper": ["diaper"], "sleep": ["sleep"], "growth": ["weight", "height", "head"],
    ]

    static let phaseLexicon: [String: [String]] = [
        "start": ["start", "started", "starting", "began", "begin", "giving", "fell asleep", "asleep", "nursing on", "latched", "down for", "nap time", "dozed", "out like", "now"],
        "switch": ["switch", "switched", "swapped", "other side"],
        "finish": ["finished", "done", "woke", "awake", "drank", "left over", "unlatched", "is up", "'s up", "gone", "all done"],
        "single": ["had a bottle", "gave him a full", "gave her a full", "fed a bottle", "earlier"],
    ]

    /// Per category: the core categories' type words, and the care lexicon for the others.
    static var categoryWords: [String: [String]] {
        var out = careLexicon
        for (cat, prefixes) in categoryPrefixes {
            out[cat] = lexicon.filter { k, _ in prefixes.contains { k.hasPrefix($0) } }.flatMap(\.value)
        }
        return out
    }

    /// Per model group (the category question): its categories' words together.
    static var groupLexicon: [String: [String]] {
        let words = categoryWords
        return Dictionary(uniqueKeysWithValues: EventRegistry.shared.modelGroups.map { g in (g.id, g.categories.flatMap { words[$0] ?? [] }) })
    }

    public func decide(_ request: DecisionRequest) async throws -> [String: DecisionAnswer] {
        let text = " " + request.state.lowercased() + " "
        var out: [String: DecisionAnswer] = [:]
        for q in request.questions {
            let lex: [String: [String]]
            switch q.id {
            case "event_type": lex = Self.lexicon
            case "category": lex = Self.groupLexicon
            case "phase": lex = Self.phaseLexicon
            case let id where id.hasSuffix("_entry"): lex = Self.categoryWords
            default: lex = Self.fieldLexicon[q.id] ?? [:]
            }
            var scores = q.options.map { opt -> Double in
                let phrases = lex[opt.key] ?? []
                // longest matching phrase wins, so "half left" beats "half"
                return phrases.filter { text.contains($0) }.map { Double($0.count) }.max() ?? 0
            }
            if scores.allSatisfy({ $0 == 0 }) {
                let fallback = q.options.firstIndex { ["not_stated", "now", "none_of_these"].contains($0.key) }
                // no keyword is no evidence it isn't an entry: keep "none" below the auto bar, so
                // the sentence is asked about rather than kept as a note (Interpretation.isNotALog)
                if let fallback { scores[fallback] = q.options[fallback].key == "none_of_these" ? 3 : 6 }
            }
            let m = scores.max() ?? 0
            let ex = scores.map { exp(($0 - m) / 1.5) }
            let s = ex.reduce(0, +)
            out[q.id] = DecisionAnswer(options: q.options.map(\.key), probabilities: ex.map { $0 / s })
        }
        return out
    }
}

// MARK: - Deterministic parsers (times and numbers never go through the model)

public enum Parsers {
    /// "at 2:10", "2:10 am", "at 14:05" → the most recent such time not after `reference`.
    public static func explicitTime(in text: String, reference: Date, calendar: Calendar = .current) -> Date? {
        let pattern = #"(?:\bat\s+)?\b(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?"#
        guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let hr = Range(m.range(at: 1), in: text), let mr = Range(m.range(at: 2), in: text),
              var hour = Int(text[hr]), let minute = Int(text[mr]), hour < 24, minute < 60 else { return nil }
        if let ar = Range(m.range(at: 3), in: text) {
            let ampm = text[ar].lowercased()
            if ampm.hasPrefix("p") && hour < 12 { hour += 12 }
            if ampm.hasPrefix("a") && hour == 12 { hour = 0 }
            return mostRecent(hour: hour, minute: minute, before: reference, calendar: calendar)
        }
        // no am/pm: choose whichever 12h reading is most recent
        let candidates = hour > 12 ? [hour] : [hour % 12, hour % 12 + 12]
        return candidates.compactMap { mostRecent(hour: $0, minute: minute, before: reference, calendar: calendar) }.max()
    }

    private static func mostRecent(hour: Int, minute: Int, before ref: Date, calendar: Calendar) -> Date? {
        guard var d = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: ref) else { return nil }
        if d > ref.addingTimeInterval(60) { d = calendar.date(byAdding: .day, value: -1, to: d) ?? d }
        return d
    }

    /// Minutes ago from relative phrases: "15 minutes ago", "half an hour ago", "an hour ago",
    /// "a few minutes ago", "two hours ago". Returns nil when no relative time is stated.
    public static func minutesAgo(in text: String) -> Int? {
        let t = text.lowercased()
        let fixed: [(String, Int)] = [("half an hour ago", 30), ("an hour and a half ago", 90), ("an hour ago", 60),
                                      ("one hour ago", 60), ("a few minutes ago", 5), ("few minutes ago", 5),
                                      ("couple of minutes ago", 3), ("couple minutes ago", 3), ("a minute ago", 1),
                                      ("a little while ago", 15), ("little while ago", 15), ("quarter of an hour ago", 15)]
        for (phrase, m) in fixed where t.contains(phrase) { return m }
        if let n = number(before: ["minutes ago", "mins ago", "min ago", "minute ago"], in: t) { return Int(n) }
        if let n = number(before: ["hours ago", "hour ago"], in: t) { return Int(n * 60) }
        return nil
    }

    /// True when the sentence hints at a past time the parsers could not resolve.
    public static func mentionsVagueTime(_ text: String) -> Bool {
        let t = text.lowercased()
        return t.contains(" ago") || t.contains("earlier") || t.contains("before")
    }

    /// Volume in ml from "90 ml", "3 oz", "3 ounces".
    public static func milliliters(in text: String) -> Double? {
        let t = text.lowercased()
        if let v = number(before: ["ml", "mls", "milliliters", "millilitres", "mil"], in: t) { return v }
        if let v = number(before: ["oz", "ounces", "ounce"], in: t) { return (v * 29.5735).rounded() }
        return nil
    }

    /// Weight in grams from "4.2 kilos", "4200 grams", "8 pounds 3 ounces", "8 lb".
    public static func grams(in text: String) -> Double? {
        let t = text.lowercased()
        if let kg = number(before: ["kg", "kilos", "kilograms", "kilo"], in: t) { return (kg * 1000).rounded() }
        if let g = number(before: ["g", "grams", "gram"], in: t) { return g }
        if let lb = number(before: ["lb", "lbs", "pounds", "pound"], in: t) {
            let oz = number(before: ["oz", "ounces", "ounce"], in: t) ?? 0
            return ((lb * 16 + oz) * 28.3495).rounded()
        }
        return nil
    }

    /// Length in centimeters from "52 cm", "52.5 centimeters", "20 inches", "1 foot 8 inches".
    /// (A bare "in" is not a unit here: "4 in the morning".)
    public static func centimeters(in text: String) -> Double? {
        let t = text.lowercased()
        if let cm = number(before: ["cm", "centimeters", "centimetres", "centimeter", "centimetre"], in: t) { return cm }
        let feet = number(before: ["feet", "foot", "ft"], in: t)
        let inches = number(before: ["inches", "inch"], in: t)
        if feet != nil || inches != nil { return (((feet ?? 0) * 12 + (inches ?? 0)) * 2.54 * 10).rounded() / 10 }
        return nil
    }

    /// Which growth measurement a sentence is about, from its words and units: head size when the
    /// head is mentioned, height for a length, weight for a weight. Nil when it doesn't say.
    public static func growthMeasure(in text: String) -> String? {
        let t = text.lowercased()
        if t.contains("head") || t.contains("circumference") { return "head" }
        if grams(in: t) != nil { return "weight" }
        if centimeters(in: t) != nil || t.contains("tall") || t.contains("length") || t.contains("height") { return "height" }
        return nil
    }

    /// Phrases that mean every child ("both" alone is not one: "wet and dirty, both", "both sides").
    static let everyChild = ["the twins", "twins", "both babies", "both kids", "both of them", "both girls", "both boys",
                             "all of them", "all three", "all the kids", "all the babies", "everyone", "everybody", "the babies", "the kids"]

    /// The children a sentence names ("Mia had 90 ml", "Leo's diaper"), or every child for "the
    /// twins" / "both of them" / "everyone". Nil when it names none, so the caller's current child
    /// applies. Names match whole words, case-insensitively.
    public static func children(in text: String, among babies: [Baby]) -> [UUID]? {
        guard babies.count > 1 else { return nil }
        let t = " " + text.lowercased().replacingOccurrences(of: "’", with: "'") + " "
        if everyChild.contains(where: { t.contains(" \($0) ") || t.contains(" \($0),") || t.contains(" \($0).") || t.contains(" \($0)'") }) {
            return babies.map(\.id)
        }
        let named = babies.filter { b in
            let name = NSRegularExpression.escapedPattern(for: b.name.lowercased().trimmingCharacters(in: .whitespaces))
            guard !name.isEmpty else { return false }
            return t.range(of: #"\b"# + name + #"\b"#, options: .regularExpression) != nil
        }
        return named.isEmpty ? nil : named.map(\.id)
    }

    static let wordNumbers: [String: Double] = [
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12, "fifteen": 15, "a": 1, "an": 1, "forty-five": 45, "twenty-five": 25, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60,
        "seventy": 70, "eighty": 80, "ninety": 90, "hundred": 100,
    ]

    /// A required spec field from what was said, so a voice entry is complete: text fields take the
    /// sentence ("gave him some infant tylenol" as the medicine), a choice the option whose words
    /// appear (else "other" where there is one), a temperature the number said (°F above 45).
    /// nil when it can't be told: the entry is then asked about, not logged.
    public static func field(_ f: EventRegistry.FieldSpec, in text: String) -> FieldValue? {
        let t = " " + text.lowercased() + " "
        switch f.kind {
        case "text":
            let s = text.trimmingCharacters(in: .whitespacesAndNewlines)
            return s.isEmpty ? nil : .string(s)
        case "choice":
            let options = f.options ?? []
            let said = options.filter { o in
                let words = [o.label.lowercased(), o.key.replacingOccurrences(of: "_", with: " ")]
                return words.contains { t.contains(" " + $0) }
            }
            if said.count == 1 { return .string(said[0].key) }
            if f.key == "result", t.contains(" pee") && t.contains(" poop") { return .string("both") }
            return options.contains { $0.key == "other" } && said.isEmpty ? .string("other") : nil
        case "number" where f.unit == "celsius":
            guard let n = firstNumber(in: t) else { return nil }
            let c = n > 45 ? (n - 32) * 5 / 9 : n
            return (30...45).contains(c) ? .number((c * 10).rounded() / 10) : nil
        default:
            return nil
        }
    }

    static func firstNumber(in t: String) -> Double? {
        guard let r = t.range(of: #"\d+(\.\d+)?"#, options: .regularExpression) else { return nil }
        return Double(t[r])
    }

    static func number(before units: [String], in t: String) -> Double? {
        for u in units {
            let pattern = #"(\d+(?:\.\d+)?|[a-z]+)\s*"# + NSRegularExpression.escapedPattern(for: u) + #"(?:\b|$)"#
            guard let re = try? NSRegularExpression(pattern: pattern),
                  let m = re.firstMatch(in: t, range: NSRange(t.startIndex..., in: t)),
                  let r = Range(m.range(at: 1), in: t) else { continue }
            let token = String(t[r])
            if let v = Double(token) { return v }
            if let v = wordNumbers[token] { return v }
        }
        return nil
    }
}
