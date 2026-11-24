import Foundation

public struct BookmarkItem: Codable, Hashable, Identifiable, Sendable {
    public var id: String { "\(editionDate)-\(cardSlug)" }
    public let editionDate: String
    public let cardSlug: String
    public let cardTitle: String
    public let sectionTitle: String?
    public let body: String
    public let sourceUrl: String?
    public let createdAt: String?

    public enum CodingKeys: String, CodingKey {
        case editionDate = "edition_date"
        case cardSlug = "card_slug"
        case cardTitle = "card_title"
        case sectionTitle = "section_title"
        case body
        case sourceUrl = "source_url"
        case createdAt = "created_at"
    }

    public init(editionDate: String, cardSlug: String, cardTitle: String, sectionTitle: String? = nil, body: String, sourceUrl: String? = nil, createdAt: String? = nil) {
        self.editionDate = editionDate
        self.cardSlug = cardSlug
        self.cardTitle = cardTitle
        self.sectionTitle = sectionTitle
        self.body = body
        self.sourceUrl = sourceUrl
        self.createdAt = createdAt
    }
}

public struct BuildRunError: Codable, Hashable, Sendable {
    public let code: String
    public let message: String
    public let card: String?
}

public struct BuildRunItem: Codable, Hashable, Identifiable, Sendable {
    public let id: String
    public let action: String
    public let editionDate: String?
    public let status: String
    public let errorCount: Int
    public let warningCount: Int
    public let errors: [BuildRunError]
    public let agentName: String?
    public let createdAt: String

    public enum CodingKeys: String, CodingKey {
        case id, action, status, errors
        case editionDate = "edition_date"
        case errorCount = "error_count"
        case warningCount = "warning_count"
        case agentName = "agent_name"
        case createdAt = "created_at"
    }
}

public struct SearchHitItem: Codable, Hashable, Identifiable, Sendable {
    public var id: String { "\(date)-\(cardSlug)" }
    public let date: String
    public let editionTitle: String
    public let cardSlug: String
    public let cardTitle: String
    public let sectionTitle: String?
    public let snippet: String
    public let sourceUrl: String?

    public enum CodingKeys: String, CodingKey {
        case date, snippet
        case editionTitle = "edition_title"
        case cardSlug = "card_slug"
        case cardTitle = "card_title"
        case sectionTitle = "section_title"
        case sourceUrl = "source_url"
    }
}

public struct ShareLinkResult: Codable, Hashable, Sendable {
    public let id: String
    public let token: String
    public let url: String
    public let expiresAt: String?

    public enum CodingKeys: String, CodingKey {
        case id, token, url
        case expiresAt = "expires_at"
    }
}

public struct DeliveryStatus: Codable, Hashable, Sendable {
    public let missed: Bool
    public let expectedDate: String
    public let deliveryTime: String
    public let timezone: String
    public let latestEditionDate: String?

    public enum CodingKeys: String, CodingKey {
        case missed, timezone
        case expectedDate = "expected_date"
        case deliveryTime = "delivery_time"
        case latestEditionDate = "latest_edition_date"
    }
}

public struct OnboardingStatus: Codable, Hashable, Sendable {
    public let briefConfigured: Bool
    public let agentConnected: Bool
    public let firstValidationPassed: Bool
    public let firstEditionPublished: Bool
    public let delivery: DeliveryStatus

    public enum CodingKeys: String, CodingKey {
        case delivery
        case briefConfigured = "brief_configured"
        case agentConnected = "agent_connected"
        case firstValidationPassed = "first_validation_passed"
        case firstEditionPublished = "first_edition_published"
    }
}

/// Shared summary written for WidgetKit & Siri App Intents (no private brief data).
public struct WidgetEditionSnapshot: Codable, Hashable, Sendable {
    public let date: String
    public let title: String
    public let cardCount: Int
    public let alertCount: Int
    public let leadTitle: String?
    public let leadBody: String?
    public let updatedAt: Date

    public init(date: String, title: String, cardCount: Int, alertCount: Int, leadTitle: String?, leadBody: String?, updatedAt: Date = Date()) {
        self.date = date
        self.title = title
        self.cardCount = cardCount
        self.alertCount = alertCount
        self.leadTitle = leadTitle
        self.leadBody = leadBody
        self.updatedAt = updatedAt
    }

    public static let storageKey = "g2digest_widget_snapshot"

    public static func from(bundle: BundleData) -> WidgetEditionSnapshot {
        let first = bundle.cards.first(where: { $0.kind == .section })
        let alerts = bundle.cards.filter { $0.alert == true }.count
        return WidgetEditionSnapshot(
            date: bundle.date,
            title: bundle.edition.title,
            cardCount: bundle.cards.count,
            alertCount: alerts,
            leadTitle: first?.title,
            leadBody: first?.body
        )
    }
}
