import XCTest
@testable import FolioKit

final class HomeSectionsTests: XCTestCase {
    private var calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        return c
    }()
    /// Saturday Nov 21 2026, 7 pm in Los Angeles.
    private let now = Date(timeIntervalSince1970: 1_795_316_400)

    private func artifact(_ id: String, hoursAgo: Double, suggestions: Int = 0, role: String = "owner", favorite: Bool = false, comments: Int? = nil, agent: String? = nil) throws -> ArtifactSummary {
        let updated = ISO8601DateFormatter().string(from: now.addingTimeInterval(-hoursAgo * 3600))
        var json = """
        {"id":"\(id)","slug":"\(id)","title":"\(id)","description":"","visibility":"private","role":"\(role)","head_version":1,
         "open_suggestions":\(suggestions),"favorite":\(favorite),"updated_at":"\(updated)","created_at":"\(updated)"
        """
        if let comments { json += #","unresolved_comments":\#(comments)"# }
        if let agent { json += #","review_agent":"\#(agent)""# }
        return try JSONDecoder.folio.decode(ArtifactSummary.self, from: Data((json + "}").utf8))
    }

    func testEveryArtifactLandsInOneSection() throws {
        let list = [
            try artifact("review", hoursAgo: 1, suggestions: 2, favorite: true, comments: 3, agent: "Claude Code"),
            try artifact("viewerSugg", hoursAgo: 2, suggestions: 1, role: "viewer", comments: 1),
            try artifact("fav", hoursAgo: 30, favorite: true),
            try artifact("today", hoursAgo: 3),
            try artifact("yesterday", hoursAgo: 24),
            try artifact("sixDays", hoursAgo: 24 * 6),
            try artifact("old", hoursAgo: 24 * 9),
        ]
        let home = HomeSections(list, now: now, calendar: calendar)

        XCTAssertEqual(home.review.map(\.id), ["review"], "A favorite with suggestions shows in review; a viewer can't review")
        XCTAssertEqual(home.favorites.map(\.id), ["fav"])
        XCTAssertEqual(home.today.map(\.id), ["viewerSugg", "today"])
        XCTAssertEqual(home.thisWeek.map(\.id), ["yesterday", "sixDays"])
        XCTAssertEqual(home.earlier.map(\.id), ["old"])
        XCTAssertEqual(home.dayGroups.map(\.title), ["Today", "This week", "Earlier"])
        XCTAssertEqual(home.suggestionsToReview, 2)
        XCTAssertEqual(home.changedToday, 3)
        XCTAssertEqual(home.openComments, 4)
        XCTAssertEqual(home.review.first?.review_agent, "Claude Code")
    }

    func testCommentsAreUnknownOnAnOlderServer() throws {
        let home = HomeSections([try artifact("a", hoursAgo: 1)], now: now, calendar: calendar)
        XCTAssertNil(home.openComments)
        XCTAssertEqual(home.dayGroups.map(\.title), ["Today"])
    }

    func testShortTimes() {
        let en = Locale(identifier: "en_US")
        func t(_ hours: Double) -> String {
            HomeSections.shortTime(now.addingTimeInterval(-hours * 3600), now: now, calendar: calendar, locale: en)
        }
        XCTAssertEqual(t(0.005), "Now")
        XCTAssertEqual(t(0.2), "12m")
        XCTAssertEqual(t(5), "5h")
        XCTAssertEqual(t(24), "Yesterday")
        XCTAssertEqual(t(72), "Wed")
        XCTAssertEqual(t(24 * 10), "Nov 11")
        XCTAssertEqual(t(24 * 400), "Oct 17, 2025")
    }
}
