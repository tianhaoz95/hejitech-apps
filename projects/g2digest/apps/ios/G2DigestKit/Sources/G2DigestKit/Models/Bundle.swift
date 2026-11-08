import Foundation

public struct SourceReference: Codable, Hashable, Sendable {
    public let title: String
    public let url: String

    public init(title: String, url: String) {
        self.title = title
        self.url = url
    }
}

public struct EditionSection: Codable, Identifiable, Hashable, Sendable {
    public var id: String { sectionId }
    public let sectionId: String
    public let title: String
    public let body: String
    public let methodology: String?
    public let sources: [SourceReference]

    public enum CodingKeys: String, CodingKey {
        case sectionId = "section_id"
        case title
        case body
        case methodology
        case sources
    }

    public init(sectionId: String, title: String, body: String, methodology: String? = nil, sources: [SourceReference] = []) {
        self.sectionId = sectionId
        self.title = title
        self.body = body
        self.methodology = methodology
        self.sources = sources
    }
}

public struct Edition: Codable, Hashable, Sendable {
    public let title: String
    public let intro: String?
    public let sections: [EditionSection]

    public init(title: String, intro: String? = nil, sections: [EditionSection]) {
        self.title = title
        self.intro = intro
        self.sections = sections
    }
}

public struct CutItem: Codable, Hashable, Sendable {
    public let sectionId: String
    public let slug: String?
    public let reason: String
    public let alert: Bool?

    public enum CodingKeys: String, CodingKey {
        case sectionId = "section_id"
        case slug
        case reason
        case alert
    }

    public init(sectionId: String, slug: String? = nil, reason: String, alert: Bool? = nil) {
        self.sectionId = sectionId
        self.slug = slug
        self.reason = reason
        self.alert = alert
    }
}

public struct BundleData: Codable, Hashable, Sendable {
    public let date: String
    public let guideVersion: String
    public let briefVersion: Int
    public let edition: Edition
    public let cards: [CardInput]
    public let cut: [CutItem]?

    public enum CodingKeys: String, CodingKey {
        case date
        case guideVersion = "guide_version"
        case briefVersion = "brief_version"
        case edition
        case cards
        case cut
    }

    public init(
        date: String,
        guideVersion: String,
        briefVersion: Int,
        edition: Edition,
        cards: [CardInput],
        cut: [CutItem]? = nil
    ) {
        self.date = date
        self.guideVersion = guideVersion
        self.briefVersion = briefVersion
        self.edition = edition
        self.cards = cards
        self.cut = cut
    }
}

public struct SignedAudioEntry: Codable, Hashable, Sendable {
    public let glance: String?
    public let deepDive: String?

    public enum CodingKeys: String, CodingKey {
        case glance
        case deepDive = "deep_dive"
    }

    public init(glance: String? = nil, deepDive: String? = nil) {
        self.glance = glance
        self.deepDive = deepDive
    }
}

public struct EditionResponse: Codable, Hashable, Sendable {
    public let date: String
    public let title: String
    public let publishedAt: String
    public let guideVersion: String
    public let briefVersion: Int
    public let bundle: BundleData
    public let audio: [String: SignedAudioEntry]?
    public let previewSnapshot: String?

    public enum CodingKeys: String, CodingKey {
        case date
        case title
        case publishedAt = "published_at"
        case guideVersion = "guide_version"
        case briefVersion = "brief_version"
        case bundle
        case audio
        case previewSnapshot = "preview_snapshot"
    }

    public init(
        date: String,
        title: String,
        publishedAt: String,
        guideVersion: String,
        briefVersion: Int,
        bundle: BundleData,
        audio: [String: SignedAudioEntry]? = nil,
        previewSnapshot: String? = nil
    ) {
        self.date = date
        self.title = title
        self.publishedAt = publishedAt
        self.guideVersion = guideVersion
        self.briefVersion = briefVersion
        self.bundle = bundle
        self.audio = audio
        self.previewSnapshot = previewSnapshot
    }
}

public struct EditionSummary: Codable, Identifiable, Hashable, Sendable {
    public var id: String { date }
    public let date: String
    public let title: String
    public let publishedAt: String

    public enum CodingKeys: String, CodingKey {
        case date
        case title
        case publishedAt = "published_at"
    }

    public init(date: String, title: String, publishedAt: String) {
        self.date = date
        self.title = title
        self.publishedAt = publishedAt
    }
}
