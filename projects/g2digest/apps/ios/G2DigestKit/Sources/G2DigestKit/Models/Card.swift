import Foundation

public enum CardKind: String, Codable, Sendable {
    case cover
    case tldr
    case section
    case end
}

public enum CardTemplate: String, Codable, Sendable {
    case status
    case discovery
    case metric
    case agenda
    case note
}

public struct CardMetric: Codable, Hashable, Sendable {
    public let label: String
    public let value: String

    public init(label: String, value: String) {
        self.label = label
        self.value = value
    }
}

public struct CardAudio: Codable, Hashable, Sendable {
    public let script: String
    public let audioPath: String
    public let durationSec: Double

    public enum CodingKeys: String, CodingKey {
        case script
        case audioPath = "audio_path"
        case durationSec = "duration_sec"
    }

    public init(script: String, audioPath: String, durationSec: Double) {
        self.script = script
        self.audioPath = audioPath
        self.durationSec = durationSec
    }
}

public struct CardInput: Codable, Identifiable, Hashable, Sendable {
    public var id: String { slug }
    public let slug: String
    public let kind: CardKind
    public let sectionId: String?
    public let template: CardTemplate?
    public let title: String
    public let body: String
    public let keyNumber: String?
    public let methodKeyword: String?
    public let metrics: [CardMetric]?
    public let alert: Bool?
    public let quiet: Bool?
    public let carriedFrom: String?
    public let sourceURL: String?
    public let glance: CardAudio?
    public let deepDive: CardAudio?

    public enum CodingKeys: String, CodingKey {
        case slug
        case kind
        case sectionId = "section_id"
        case template
        case title
        case body
        case keyNumber = "key_number"
        case methodKeyword = "method_keyword"
        case metrics
        case alert
        case quiet
        case carriedFrom = "carried_from"
        case sourceURL = "source_url"
        case glance
        case deepDive = "deep_dive"
    }

    public init(
        slug: String,
        kind: CardKind,
        sectionId: String? = nil,
        template: CardTemplate? = nil,
        title: String,
        body: String,
        keyNumber: String? = nil,
        methodKeyword: String? = nil,
        metrics: [CardMetric]? = nil,
        alert: Bool? = nil,
        quiet: Bool? = nil,
        carriedFrom: String? = nil,
        sourceURL: String? = nil,
        glance: CardAudio? = nil,
        deepDive: CardAudio? = nil
    ) {
        self.slug = slug
        self.kind = kind
        self.sectionId = sectionId
        self.template = template
        self.title = title
        self.body = body
        self.keyNumber = keyNumber
        self.methodKeyword = methodKeyword
        self.metrics = metrics
        self.alert = alert
        self.quiet = quiet
        self.carriedFrom = carriedFrom
        self.sourceURL = sourceURL
        self.glance = glance
        self.deepDive = deepDive
    }
}
