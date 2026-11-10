import Foundation
import XCTest
@testable import G2DigestKit

final class BriefTests: XCTestCase {
    /// `GET /api/brief` as the Worker sends it (starter brief, `loadBrief`).
    let response = #"""
    {"brief":{"title":"My brief","tldr":true,"total_card_budget":12,"total_audio_budget_sec":1200,"language":"en",
    "units":{"temperature":"C","distance":"km"},"glossary":[],"no_gloss":[],
    "delivery":{"time":"07:00","timezone":"America/Los_Angeles","days":["mon","tue","wed","thu","fri"]},
    "sections":[{"id":"section-1","title":"Section 1","template":"discovery","source":{"kind":"web_news","entities":[],"query":""},
    "instructions":"Describe what counts.","max_cards":3,"quiet_behavior":"omit","audio":{"glance":true,"deep_dive":"required"}}]},
    "brief_version":4}
    """#

    func brief() throws -> Brief { try JSONDecoder().decode(BriefResponse.self, from: Data(response.utf8)).brief }

    func testReadsTheWorkersBriefResponse() throws {
        let r = try JSONDecoder().decode(BriefResponse.self, from: Data(response.utf8))
        XCTAssertEqual(r.briefVersion, 4)
        XCTAssertEqual(r.brief.sections.first?.maxCards, 3)
        XCTAssertEqual(r.brief.delivery.days, [.mon, .tue, .wed, .thu, .fri])
        XCTAssertTrue(checkBrief(r.brief).isEmpty)
    }

    func testSavesWithTheWebsKeysAndLeavesUnsetOptionalsOut() throws {
        var b = try brief()
        b.sections[0].source.query = nil
        b.sections[0].maxCards = 5
        let obj = try JSONSerialization.jsonObject(with: JSONEncoder().encode(b)) as! [String: Any]
        XCTAssertEqual(obj["total_card_budget"] as? Int, 12)
        XCTAssertNotNil(obj["no_gloss"])
        let s = (obj["sections"] as! [[String: Any]])[0]
        XCTAssertEqual(s["max_cards"] as? Int, 5)
        XCTAssertEqual(s["quiet_behavior"] as? String, "omit")
        XCTAssertEqual((s["audio"] as! [String: Any])["deep_dive"] as? String, "required")
        XCTAssertNil((s["source"] as! [String: Any])["query"], "an unset optional is left out, as the web leaves it undefined")
    }

    func testFlagsWhatCoreFlags() throws {
        var b = try brief()
        b.totalCardBudget = 2
        b.sections[0].maxCards = 11
        b.sections[0].title = String(repeating: "x", count: 19)
        b.sections[0].source.kind = .rss
        b.delivery.days = []
        b.sections.append(b.sections[0])
        let codes = Set(checkBrief(b).map(\.code))
        XCTAssertTrue(codes.isSuperset(of: ["B_CARD_BUDGET", "B_MAX_CARDS", "B_SECTION_TITLE", "B_SOURCE", "B_DELIVERY", "B_SECTION_ID"]))
    }

    func testAMetricSectionCantRequireDeepDives() throws {
        var b = try brief()
        b.sections[0].template = .metric
        XCTAssertEqual(checkBrief(b).map(\.code), ["B_AUDIO"])
        b.sections[0].audio.deepDive = .onAlert
        XCTAssertTrue(checkBrief(b).isEmpty)
    }

    func testAddSectionPicksTheNextFreeId() throws {
        var b = try brief()
        b.sections.append(.starter(b.nextSectionNumber()))
        XCTAssertEqual(b.sections.map(\.id), ["section-1", "section-2"])
        XCTAssertTrue(checkBrief(b).isEmpty)
    }
}
