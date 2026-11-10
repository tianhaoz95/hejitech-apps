import Foundation

// The brief config, mirroring `packages/core/src/types.ts` (Brief, Section). Every field is editable
// on the phone as on the web; `checkBrief` mirrors core's `checkBrief` so problems show while typing,
// and the Worker checks again before it saves.

public enum SourceKind: String, Codable, CaseIterable, Sendable {
    case webNews = "web_news"
    case rss
    case finance
    case calendar
    case feed

    public var label: String {
        switch self {
        case .webNews: "Web news"
        case .rss: "RSS feeds"
        case .finance: "Finance quotes"
        case .calendar: "Calendar"
        case .feed: "Other feed"
        }
    }

    public var help: String {
        switch self {
        case .webNews: "web search for news"
        case .rss: "the RSS feeds you list"
        case .finance: "quotes for the entities"
        case .calendar: "your calendar"
        case .feed: "another structured feed (URLs)"
        }
    }

    /// RSS and feed sources read the URLs you list (at least one).
    public var needsURLs: Bool { self == .rss || self == .feed }
}

public enum QuietBehavior: String, Codable, CaseIterable, Sendable {
    case showStatus = "show_status"
    case omit
    case showLast = "show_last"

    public var label: String {
        switch self {
        case .showStatus: "Say nothing changed"
        case .omit: "Leave it out"
        case .showLast: "Repeat the last card"
        }
    }
}

public enum DeepDivePolicy: String, Codable, CaseIterable, Sendable {
    case required
    case onAlert = "on_alert"
    case never

    public var label: String {
        switch self {
        case .required: "Every card"
        case .onAlert: "Only on alerts"
        case .never: "Never"
        }
    }
}

public enum Weekday: String, Codable, CaseIterable, Sendable {
    case mon, tue, wed, thu, fri, sat, sun

    public var short: String { rawValue.prefix(1).uppercased() + rawValue.dropFirst() }
}

extension CardTemplate: CaseIterable {
    public static var allCases: [CardTemplate] { [.status, .discovery, .metric, .agenda, .note] }

    public var help: String {
        switch self {
        case .status: "a tracked thing changed or didn't"
        case .discovery: "ranked new items (with a method keyword)"
        case .metric: "up to three numbers and one driver"
        case .agenda: "time-ordered items"
        case .note: "a single free item"
        }
    }
}

public struct SectionSource: Codable, Hashable, Sendable {
    public var kind: SourceKind
    public var entities: [String]?
    public var query: String?
    public var urls: [String]?

    public init(kind: SourceKind, entities: [String]? = nil, query: String? = nil, urls: [String]? = nil) {
        self.kind = kind
        self.entities = entities
        self.query = query
        self.urls = urls
    }
}

public struct SectionAudioRule: Codable, Hashable, Sendable {
    public var glance: Bool
    public var deepDive: DeepDivePolicy

    public enum CodingKeys: String, CodingKey {
        case glance
        case deepDive = "deep_dive"
    }

    public init(glance: Bool, deepDive: DeepDivePolicy) {
        self.glance = glance
        self.deepDive = deepDive
    }
}

public struct BriefSection: Codable, Identifiable, Hashable, Sendable {
    public var id: String
    public var title: String
    public var template: CardTemplate
    public var source: SectionSource
    public var instructions: String
    public var maxCards: Int
    public var quietBehavior: QuietBehavior
    public var audio: SectionAudioRule

    public enum CodingKeys: String, CodingKey {
        case id
        case title
        case template
        case source
        case instructions
        case maxCards = "max_cards"
        case quietBehavior = "quiet_behavior"
        case audio
    }

    public init(
        id: String,
        title: String,
        template: CardTemplate,
        source: SectionSource,
        instructions: String,
        maxCards: Int,
        quietBehavior: QuietBehavior,
        audio: SectionAudioRule
    ) {
        self.id = id
        self.title = title
        self.template = template
        self.source = source
        self.instructions = instructions
        self.maxCards = maxCards
        self.quietBehavior = quietBehavior
        self.audio = audio
    }

    /// A new section, as the web's Add section makes it (core's `starterSection`).
    public static func starter(_ n: Int) -> BriefSection {
        BriefSection(
            id: "section-\(n)", title: "Section \(n)", template: .discovery,
            source: SectionSource(kind: .webNews, entities: [], query: ""),
            instructions: "Describe what counts for this section, how to rank it, and what a quiet day looks like.",
            maxCards: 3, quietBehavior: .omit, audio: SectionAudioRule(glance: true, deepDive: .required))
    }
}

public struct BriefUnits: Codable, Hashable, Sendable {
    public var temperature: String
    public var distance: String

    public init(temperature: String = "C", distance: String = "km") {
        self.temperature = temperature
        self.distance = distance
    }
}

public struct BriefGlossaryItem: Codable, Hashable, Sendable {
    public var term: String
    public var gloss: String

    public init(term: String, gloss: String) {
        self.term = term
        self.gloss = gloss
    }
}

public struct BriefDelivery: Codable, Hashable, Sendable {
    public var time: String
    public var timezone: String
    public var days: [Weekday]

    public init(time: String, timezone: String, days: [Weekday]) {
        self.time = time
        self.timezone = timezone
        self.days = days
    }
}

public struct Brief: Codable, Hashable, Sendable {
    public var title: String
    public var tldr: Bool
    public var totalCardBudget: Int
    public var totalAudioBudgetSec: Int
    public var language: String
    public var units: BriefUnits
    public var glossary: [BriefGlossaryItem]
    public var noGloss: [String]
    public var delivery: BriefDelivery
    public var sections: [BriefSection]

    public enum CodingKeys: String, CodingKey {
        case title
        case tldr
        case totalCardBudget = "total_card_budget"
        case totalAudioBudgetSec = "total_audio_budget_sec"
        case language
        case units
        case glossary
        case noGloss = "no_gloss"
        case delivery
        case sections
    }

    public init(
        title: String,
        tldr: Bool,
        totalCardBudget: Int,
        totalAudioBudgetSec: Int,
        language: String,
        units: BriefUnits,
        glossary: [BriefGlossaryItem],
        noGloss: [String],
        delivery: BriefDelivery,
        sections: [BriefSection]
    ) {
        self.title = title
        self.tldr = tldr
        self.totalCardBudget = totalCardBudget
        self.totalAudioBudgetSec = totalAudioBudgetSec
        self.language = language
        self.units = units
        self.glossary = glossary
        self.noGloss = noGloss
        self.delivery = delivery
        self.sections = sections
    }

    /// The next free `section-N` id, as the web's Add section picks it.
    public func nextSectionNumber() -> Int {
        var n = sections.count + 1
        while sections.contains(where: { $0.id == "section-\(n)" }) { n += 1 }
        return n
    }
}

/// `GET /api/brief`: the brief and its version (a save sends the version it started from).
public struct BriefResponse: Codable, Hashable, Sendable {
    public var brief: Brief
    public var briefVersion: Int

    public enum CodingKeys: String, CodingKey {
        case brief
        case briefVersion = "brief_version"
    }
}

/// `PUT /api/brief`'s answer.
public struct BriefSaveResult: Codable, Hashable, Sendable {
    public var briefVersion: Int
    public var changed: Bool

    public enum CodingKeys: String, CodingKey {
        case briefVersion = "brief_version"
        case changed
    }
}

/// One problem with a brief (the Worker sends the same shape on a refused save).
public struct BriefIssue: Codable, Hashable, Sendable {
    public var code: String
    public var message: String

    public init(code: String, message: String) {
        self.code = code
        self.message = message
    }
}

/// Core's `checkBrief`, in Swift: the same rules and messages, so the editor can show problems live.
public func checkBrief(_ b: Brief) -> [BriefIssue] {
    var out: [BriefIssue] = []
    func bad(_ code: String, _ m: String) { out.append(BriefIssue(code: code, message: m)) }
    if b.title.trimmingCharacters(in: .whitespaces).isEmpty { bad("B_TITLE", "title is required") }
    if !(3...40).contains(b.totalCardBudget) { bad("B_CARD_BUDGET", "total_card_budget must be a whole number from 3 to 40 (Cover, TL;DR and End count)") }
    if !(0...7200).contains(b.totalAudioBudgetSec) { bad("B_AUDIO_BUDGET", "total_audio_budget_sec must be 0–7200 seconds") }
    if b.language.range(of: #"^[a-z]{2}(-[A-Z]{2})?$"#, options: .regularExpression) == nil { bad("B_LANGUAGE", "language must be a code like en or en-GB") }
    if !["C", "F"].contains(b.units.temperature) || !["km", "mi"].contains(b.units.distance) { bad("B_UNITS", "units must be { temperature: C|F, distance: km|mi }") }
    if !b.glossary.allSatisfy({ !$0.term.trimmingCharacters(in: .whitespaces).isEmpty && !$0.gloss.trimmingCharacters(in: .whitespaces).isEmpty }) {
        bad("B_GLOSSARY", "glossary entries need a term and a gloss")
    }
    if b.delivery.time.range(of: #"^([01]\d|2[0-3]):[0-5]\d$"#, options: .regularExpression) == nil {
        bad("B_DELIVERY", "delivery.time must be HH:MM (24h)")
    } else {
        if TimeZone(identifier: b.delivery.timezone) == nil { bad("B_DELIVERY", "delivery.timezone must be an IANA zone like America/Los_Angeles") }
        if b.delivery.days.isEmpty { bad("B_DELIVERY", "delivery.days must list at least one of mon…sun") }
    }
    if b.sections.isEmpty {
        bad("B_SECTIONS", "a brief needs at least one section")
        return out
    }
    var ids = Set<String>()
    for (i, s) in b.sections.enumerated() {
        func at(_ m: String) -> String { "sections[\(i)]: \(m)" }
        if s.id.range(of: #"^[a-z0-9]+(-[a-z0-9]+)*$"#, options: .regularExpression) == nil { bad("B_SECTION_ID", at("id must be lowercase-kebab-case")) }
        else if ids.contains(s.id) { bad("B_SECTION_ID", at("id \"\(s.id)\" is used twice")) }
        else { ids.insert(s.id) }
        if s.title.trimmingCharacters(in: .whitespaces).isEmpty || s.title.count > 18 { bad("B_SECTION_TITLE", at("title is required, at most 18 characters (it's the card kicker)")) }
        if let urls = s.source.urls, !urls.allSatisfy({ $0.hasPrefix("http://") || $0.hasPrefix("https://") }) { bad("B_SOURCE", at("source.urls must be http(s) URLs")) }
        if s.source.kind.needsURLs && (s.source.urls ?? []).isEmpty { bad("B_SOURCE", at("a \(s.source.kind.rawValue) source needs at least one URL")) }
        if !(1...10).contains(s.maxCards) { bad("B_MAX_CARDS", at("max_cards must be 1–10")) }
        if s.template == .metric && s.audio.deepDive == .required { bad("B_AUDIO", at("a metric section can't require deep dives (there's no methodology to tell)")) }
    }
    return out
}
