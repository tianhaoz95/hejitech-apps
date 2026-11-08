import XCTest
@testable import G2DigestKit

final class G2DigestKitTests: XCTestCase {

    func testTourCreation() {
        let tour = TourBuilder.makeTour(reason: .pair, date: "2026-11-08")
        XCTAssertEqual(tour.guideVersion, TourBuilder.tourGuideVersion)
        XCTAssertEqual(tour.edition.title, TourBuilder.tourTitle)
        XCTAssertTrue(TourBuilder.isTour(tour))
        XCTAssertFalse(tour.cards.isEmpty)

        let cover = tour.cards.first { $0.slug == "cover" }
        XCTAssertNotNil(cover)
        XCTAssertEqual(cover?.kind, .cover)

        let end = tour.cards.first { $0.slug == "end" }
        XCTAssertNotNil(end)
        XCTAssertEqual(end?.kind, .end)
    }

    func testHUDFormatterWrap() {
        let text = "This is a brief summary of top news compiled ahead of time for your commute."
        let lines = HUDFormatter.wrap(text: text, limit: 20)
        XCTAssertFalse(lines.isEmpty)
        for line in lines {
            XCTAssertLessThanOrEqual(line.count, 20)
        }
    }

    func testHUDFormatterFrame() {
        let card = CardInput(
            slug: "test-card",
            kind: .section,
            title: "Market Update",
            body: "Stocks rallied in early trading across tech and industrial sectors.",
            keyNumber: "+1.2%",
            metrics: [CardMetric(label: "Volume", value: "2.4B")]
        )

        let frame = HUDFormatter.format(card: card, index: 0, total: 5)
        XCTAssertEqual(frame.cardSlug, "test-card")
        XCTAssertEqual(frame.lines.count, HUDFormatter.maxLinesPerFrame)
        XCTAssertTrue(frame.positionDots.contains("●"))
    }

    func testBundleDecoding() throws {
        let json = """
        {
          "date": "2026-11-08",
          "guide_version": "0.2",
          "brief_version": 1,
          "edition": {
            "title": "Evening Digest",
            "sections": [
              {
                "section_id": "tech",
                "title": "Tech Update",
                "body": "Daily AI releases and papers.",
                "sources": [
                  {"title": "Open Source", "url": "https://example.com/source"}
                ]
              }
            ]
          },
          "cards": [
            {
              "slug": "cover",
              "kind": "cover",
              "title": "Daily Digest",
              "body": "Welcome to today's compiled brief."
            },
            {
              "slug": "tech-overview",
              "kind": "section",
              "section_id": "tech",
              "template": "status",
              "title": "New Model Release",
              "body": "Fast reasoning model released today.",
              "key_number": "10x faster",
              "metrics": [{"label": "Latency", "value": "12ms"}],
              "glance": {
                "script": "Fast reasoning model released today.",
                "audio_path": "2026-11-08/tech-glance.mp3",
                "duration_sec": 14.5
              }
            }
          ]
        }
        """

        let data = Data(json.utf8)
        let decoder = JSONDecoder()
        let bundle = try decoder.decode(BundleData.self, from: data)

        XCTAssertEqual(bundle.date, "2026-11-08")
        XCTAssertEqual(bundle.cards.count, 2)
        XCTAssertEqual(bundle.cards[1].keyNumber, "10x faster")
        XCTAssertEqual(bundle.cards[1].glance?.durationSec, 14.5)
    }
}
