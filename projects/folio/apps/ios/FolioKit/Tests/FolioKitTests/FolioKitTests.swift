import XCTest
@testable import FolioKit

final class FolioKitTests: XCTestCase {
    func testPostgresDates() throws {
        let d = try XCTUnwrap(FolioDate.parse("2026-11-18T05:51:45.123456+00:00"))
        XCTAssertEqual(d.timeIntervalSince1970, 1_794_981_105.123, accuracy: 0.001)
        XCTAssertNotNil(FolioDate.parse("2026-11-18T05:51:45Z"))
        XCTAssertNotNil(FolioDate.parse("2026-11-18 05:51:45.5+00"))
        XCTAssertNil(FolioDate.parse("yesterday"))
    }

    func testDecodesArtifactListAndSuggestionDetail() throws {
        let list = """
        [{"id":"a1","slug":"abc23","title":"Trip","description":"","visibility":"private","role":"owner","head_version":3,
          "open_suggestions":1,"updated_at":"2026-11-18T05:51:45.1+00:00","created_at":"2026-11-18T05:51:45+00:00","extra":true}]
        """
        let a = try JSONDecoder.folio.decode([ArtifactSummary].self, from: Data(list.utf8))
        XCTAssertEqual(a.first?.role, .owner)
        XCTAssertEqual(a.first?.open_suggestions, 1)

        let detail = """
        {"suggestion":{"id":"s","number":2,"base_version":3,"title":"Add bread","rationale":"why","status":"open","agent":"Gemini",
          "ops":[{"op":"replace","path":"a","old":"x","new":"y"}],"created_at":"2026-11-18T05:51:45+00:00","resolved_at":null},
         "files":[{"path":"app.js","status":"modified","hunks":[{"aStart":1,"aLines":1,"bStart":1,"bLines":1,
           "lines":[{"kind":"del","text":"a","a":1},{"kind":"add","text":"b","b":1}]}],"added":1,"removed":1}],
         "applies_to_head":true,"head_version":3}
        """
        let s = try JSONDecoder.folio.decode(SuggestionDetail.self, from: Data(detail.utf8))
        XCTAssertEqual(s.suggestion.status, .open)
        XCTAssertEqual(s.files.first?.hunks.first?.lines.map(\.kind), [.del, .add])
    }

    func testSessionParse() throws {
        let body = #"{"access_token":"a","refresh_token":"r","expires_in":3600,"user":{"id":"u1","email":"x@y.z"}}"#
        let now = Date(timeIntervalSince1970: 1000)
        let s = try SupabaseAuth.parseSession(Data(body.utf8), now: now)
        XCTAssertEqual(s.userId, "u1")
        XCTAssertEqual(s.expiresAt, now.addingTimeInterval(3600))
        XCTAssertThrowsError(try SupabaseAuth.parseSession(Data("{}".utf8)))
    }

    func testSharedHTMLFileStaysThePage() {
        let html = "<html><head><title>My page</title></head><body>hi</body></html>"
        let d = ShareDraft(items: [.file(name: "page.html", data: Data(html.utf8))])
        XCTAssertEqual(d.title, "My page")
        XCTAssertEqual(d.files().map(\.path), ["index.html"])
        XCTAssertEqual(d.files().first?.content, html)
    }

    func testSharedTextLinkAndImageGetAPage() throws {
        let png = Data([0x89, 0x50, 0x4E, 0x47])
        let d = ShareDraft(items: [
            .text("# Packing list\n\nLayers <for> fog"),
            .url(URL(string: "https://www.example.com/trip")!, title: nil),
            .file(name: "Photo 1.JPG", data: png),
            .file(name: "index.html", data: Data("<p>x</p>".utf8)),
        ], note: "From Gemini")
        XCTAssertEqual(d.title, "Packing list")
        let files = d.files()
        XCTAssertEqual(files.map(\.path), ["index.html", "text.md", "Photo-1.JPG", "index-2.html"])
        let page = try XCTUnwrap(files.first?.content)
        XCTAssertTrue(page.contains("Layers &lt;for&gt; fog"), "text is escaped")
        XCTAssertTrue(page.contains("href=\"https://www.example.com/trip\""))
        XCTAssertTrue(page.contains("<img src=\"Photo-1.JPG\""))
        XCTAssertTrue(page.contains("From Gemini"))
        XCTAssertEqual(files[2].data, png)
        XCTAssertEqual(ShareDraft(items: [.url(URL(string: "https://www.example.com")!, title: nil)]).title, "example.com")
    }
}
