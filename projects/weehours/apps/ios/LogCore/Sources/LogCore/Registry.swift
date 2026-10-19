import Foundation

/// The closed vocabulary, loaded from `spec/event-types.json` (bundled as a resource and shared
/// with the TypeScript core and the eval harness).
public struct EventRegistry: Sendable {
    public struct Category: Decodable, Sendable, Hashable {
        public let id: String
        public let label: String
        public let voice: String?
        public let defaultEnabled: Bool
        /// Settings section: nil for the core categories, else care | health | activity.
        public let group: String?
        /// false: logged by tap (and MCP) only, never offered to the decision model, which hasn't
        /// been trained on it yet (the option texts are part of its prompt).
        public let model: Bool?

        public var inModel: Bool { model ?? true }
    }

    /// One field of a type whose fields the spec describes (`fields`): validated, labelled and
    /// entered from it, on the phone and in the TypeScript core.
    public struct FieldSpec: Decodable, Sendable, Hashable {
        public struct Option: Decodable, Sendable, Hashable { public let key: String, label: String }
        public let key: String
        public let kind: String          // choice | number | text
        public let required: Bool?
        public let options: [Option]?
        public let unit: String?         // minutes | celsius
        public let label: String?
        public let presets: [Double]?    // quick picks for a number (Home tile menu)

        public var isRequired: Bool { required ?? false }
    }

    public struct SessionSpec: Decodable, Sendable, Hashable {
        public let kind: String   // feed | sleep
        public let role: String   // start | switch | finish
    }

    public struct EventType: Decodable, Sendable, Hashable {
        public let id: String
        public let category: String
        public let label: String
        public let voice: String
        public let session: SessionSpec?
        public let questions: [String]
        public let numbers: [String]?
        /// SF Symbol for types the spec gives one (the newer, tap-logged ones).
        public let icon: String?
        public let fields: [FieldSpec]?
        /// Started and stopped from Now (an entry with `ongoing: true` until Stop records its
        /// minutes), with a "still going?" reminder after `remindAfterMinutes`.
        public let timed: Bool?
        public let remindAfterMinutes: Int?

        public var isTimed: Bool { timed ?? false }

        public var isFeed: Bool { id.hasPrefix("feed.") }
    }

    public struct OptionSpec: Decodable, Sendable, Hashable {
        public let description: String?
        public let fraction: Double?
        public let minutesAgo: Int?
    }

    public struct QuestionSpec: Sendable {
        public let id: String
        public let instructions: String
        /// Ordered as in the spec file.
        public let options: [(key: String, spec: OptionSpec)]
    }

    public struct Policy: Decodable, Sendable {
        public let auto: Double
        public let pick: Double
    }

    public let version: Int
    public let categories: [Category]
    public let types: [EventType]
    public let questions: [String: QuestionSpec]
    public let policy: Policy
    /// Minutes after which an open session (bottle, breast, sleep) asks "still going?".
    public let sessionReminders: [String: Int]
    public let duplicateWindowDefault: TimeInterval
    public let duplicateWindowStart: TimeInterval

    public func type(_ id: String) -> EventType? { types.first { $0.id == id } }

    public func types(enabled categories: Set<String>) -> [EventType] {
        types.filter { categories.contains($0.category) }
    }

    /// The enabled types the decision model may be asked about (`Category.model`).
    public func modelTypes(enabled categories: Set<String>) -> [EventType] {
        let asked = Set(self.categories.filter(\.inModel).map(\.id))
        return types(enabled: categories).filter { asked.contains($0.category) }
    }

    public func category(_ id: String) -> Category? { categories.first { $0.id == id } }

    public var defaultCategories: Set<String> {
        Set(categories.filter(\.defaultEnabled).map(\.id))
    }

    public static let shared: EventRegistry = {
        guard let url = Bundle.module.url(forResource: "event-types", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let reg = try? EventRegistry(json: data) else {
            fatalError("event-types.json missing or invalid")
        }
        return reg
    }()

    public init(json data: Data) throws {
        let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        let dec = JSONDecoder()
        func decode<T: Decodable>(_ t: T.Type, _ any: Any?) throws -> T {
            try dec.decode(T.self, from: JSONSerialization.data(withJSONObject: any ?? NSNull(), options: [.fragmentsAllowed]))
        }
        version = root["version"] as? Int ?? 1
        categories = try decode([Category].self, root["categories"])
        types = try decode([EventType].self, root["types"])
        policy = try decode(Policy.self, root["policy"])
        sessionReminders = (root["sessionReminders"] as? [String: Any] ?? [:]).compactMapValues { $0 as? Int }
        let windows = root["duplicateWindowsMinutes"] as? [String: Double] ?? [:]
        duplicateWindowDefault = (windows["default"] ?? 5) * 60
        duplicateWindowStart = (windows["start"] ?? 10) * 60

        // JSONSerialization loses key order, so recover option order from the raw text.
        let text = String(decoding: data, as: UTF8.self)
        var qs: [String: QuestionSpec] = [:]
        for (qid, raw) in root["questions"] as? [String: Any] ?? [:] {
            let q = raw as? [String: Any] ?? [:]
            let opts = q["options"] as? [String: Any] ?? [:]
            let ordered = opts.keys.sorted { a, b in
                Self.position(of: a, question: qid, in: text) < Self.position(of: b, question: qid, in: text)
            }
            let parsed = try ordered.map { key in (key: key, spec: try decode(OptionSpec.self, opts[key])) }
            qs[qid] = QuestionSpec(id: qid, instructions: q["instructions"] as? String ?? qid, options: parsed)
        }
        questions = qs
    }

    private static func position(of key: String, question: String, in text: String) -> Int {
        guard let qRange = text.range(of: "\"\(question)\": {") else { return Int.max }
        let tail = text[qRange.upperBound...]
        guard let r = tail.range(of: "\"\(key)\": {") else { return Int.max }
        return text.distance(from: text.startIndex, to: r.lowerBound)
    }
}
