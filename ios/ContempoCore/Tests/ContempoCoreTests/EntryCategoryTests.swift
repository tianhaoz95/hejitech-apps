import ContempoCore
import XCTest

final class EntryCategoryTests: XCTestCase {
    func testEntryCategoryEnumMapping() {
        XCTAssertEqual(EntryCategory(firestoreValue: "guest_communication"), .guestCommunication)
        XCTAssertEqual(EntryCategory(firestoreValue: "supply_run"), .supplyRun)
        XCTAssertEqual(EntryCategory(firestoreValue: "maintenance"), .maintenance)
        XCTAssertEqual(EntryCategory(firestoreValue: "turnover"), .turnover)
        XCTAssertEqual(EntryCategory(firestoreValue: "admin"), .admin)
        XCTAssertEqual(EntryCategory(firestoreValue: "other"), .other)
        XCTAssertEqual(EntryCategory(firestoreValue: "unknown_value"), .other)
    }

    func testCaptureSourceEnumMapping() {
        XCTAssertEqual(CaptureSource(firestoreValue: "manual"), .manual)
        XCTAssertEqual(CaptureSource(firestoreValue: "voice"), .voice)
        XCTAssertEqual(CaptureSource(firestoreValue: "text"), .text)
        XCTAssertEqual(CaptureSource(firestoreValue: "photo"), .photo)
        XCTAssertEqual(CaptureSource(firestoreValue: "invalid"), .manual)
    }

    func testEntryStatusEnumMapping() {
        XCTAssertEqual(EntryStatus(firestoreValue: "pending_review"), .pendingReview)
        XCTAssertEqual(EntryStatus(firestoreValue: "confirmed"), .confirmed)
        XCTAssertEqual(EntryStatus(firestoreValue: "unknown"), .pendingReview)
    }

    func testCaptureLanguageEnumMapping() {
        XCTAssertEqual(CaptureLanguage(firestoreValue: "en"), .english)
        XCTAssertEqual(CaptureLanguage(firestoreValue: "zh"), .chinese)
        XCTAssertEqual(CaptureLanguage(firestoreValue: "auto"), .auto)
        XCTAssertEqual(CaptureLanguage(firestoreValue: "fr"), .auto)
    }
}
