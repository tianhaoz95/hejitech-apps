import Foundation

public enum SourceKind: String, Codable, Sendable {
    case webNews = "web_news"
    case rss
    case finance
    case calendar
    case feed
}

public enum QuietBehavior: String, Codable, Sendable {
    case showStatus = "show_status"
    case omit
    case showLast = "show_last"
}

public enum DeepDivePolicy: String, Codable, Sendable {
    case required
    case onAlert = "on_alert"
    case never
}

public enum Weekday: String, Codable, Sendable {
    case mon, tue, wed, thu, fri, sat, sun
}

public struct SectionSource: Codable, Hashable, Sendable {
    public let kind: SourceKind
    public let entities: [String]?
    public let query: String?
    public let urls: [String]?

    public init(kind: SourceKind, entities: [String]? = nil, query: String? = nil, urls: [String]? = nil) {
        self.kind = kind
        self.entities = entities
        self.query = query
        self.urls = urls
    }
}

public struct SectionAudioRule: Codable, Hashable, Sendable {
    public let glance: Bool
    public let deepDive: DeepDivePolicy

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
    public let title: String
    public let template: CardTemplate
    public let source: SectionSource
    public let instructions: String
    public let maxCards: Int
    public let quietBehavior: QuietBehavior
    public let audio: SectionAudioRule

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
}

public struct BriefUnits: Codable, Hashable, Sendable {
    public let temperature: String
    public let distance: String

    public init(temperature: String = "C", distance: String = "km") {
        self.temperature = temperature
        self.distance = distance
    }
}

public struct BriefGlossaryItem: Codable, Hashable, Sendable {
    public let term: String
    public let gloss: String

    public init(term: String, gloss: String) {
        self.term = term
        self.gloss = gloss
    }
}

public struct BriefDelivery: Codable, Hashable, Sendable {
    public let time: String
    public let timezone: String
    public let days: [Weekday]

    public init(time: String, timezone: String, days: [Weekday]) {
        self.time = time
        self.timezone = timezone
        self.days = days
    }
}

public struct Brief: Codable, Hashable, Sendable {
    public let title: String
    public let tldr: Bool
    public let totalCardBudget: Int
    public let totalAudioBudgetSec: Int
    public let language: String
    public let units: BriefUnits
    public let glossary: [BriefGlossaryItem]
    public let noGloss: [String]
    public let delivery: BriefDelivery
    public let sections: [BriefSection]

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
}
