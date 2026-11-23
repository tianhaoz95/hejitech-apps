import XCTest
@testable import Voxbrief

/// Siri and Shortcuts (`NoteIntents.swift`): open to-dos, Ask handing its question to the app,
/// and no "Apple" in anything App Store processing reads (ITMS-90626).
@MainActor
final class NoteIntentsTests: XCTestCase {

    private func note(_ title: String, daysAgo: Double, items: [String], done: [String] = []) -> VoiceNote {
        var n = VoiceNote(
            createdAt: Date().addingTimeInterval(-daysAgo * 86_400),
            duration: 60,
            audioFileName: "\(title).m4a",
            title: title,
            summary: "",
            rawTranscript: "x",
            status: .ready
        )
        n.actionItems = items
        n.completedActionItems = done
        return n
    }

    func testOpenTodosAreNewestFirstWithoutCheckedOffItems() {
        let todos = OpenTodosIntent.openTodos([
            note("Older", daysAgo: 3, items: ["Call the shop"]),
            note("Newer", daysAgo: 1, items: ["Renew passport", "Book hotel"], done: ["Book hotel"]),
        ])
        XCTAssertEqual(todos.map(\.item), ["Renew passport", "Call the shop"])
        XCTAssertEqual(todos.first?.note, "Newer")
    }

    func testAskHandsTheQuestionToTheApp() async throws {
        XCTAssertTrue(AskVoxbriefIntent.openAppWhenRun, "The on-device model only runs with the app open")
        let expectation = expectation(forNotification: .voxbriefNavigate, object: nil) { n in
            (n.userInfo?["screen"] as? String) == "ask" && (n.userInfo?["question"] as? String) == "What did Priya promise?"
        }
        var intent = AskVoxbriefIntent()
        intent.question = "What did Priya promise?"
        _ = try await intent.perform()
        await fulfillment(of: [expectation], timeout: 2)
        // `pending` is cleared by the list once it opens Ask (the test host's list may already have).
        AskVoxbriefIntent.pending = nil
    }

    func testNoAppleInIntentText() {
        let texts: [String] = [
            String(localized: AskVoxbriefIntent.title), String(localized: FindNotesIntent.title),
            String(localized: OpenTodosIntent.title), String(localized: GetNoteTextIntent.title),
            String(localized: OpenNoteIntent.title),
        ]
        for t in texts { XCTAssertFalse(t.localizedCaseInsensitiveContains("apple"), t) }
    }
}
