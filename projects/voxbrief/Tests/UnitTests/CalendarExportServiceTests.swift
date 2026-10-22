import XCTest
@testable import Voxbrief

final class CalendarExportServiceTests: XCTestCase {
    private func note(title: String, body: String = "") -> VoiceNote {
        VoiceNote(duration: 10, title: title, summary: "", rawTranscript: body, cleanedNote: body)
    }

    private func components(_ date: Date) -> DateComponents {
        Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
    }

    func testDetectsADateInTheTitle() {
        let resolved = CalendarExportService.resolvedStartDate(for: note(title: "Dentist tomorrow at 3pm"))
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        XCTAssertEqual(components(resolved).day, components(tomorrow).day)
        XCTAssertEqual(components(resolved).hour, 15)
    }

    func testFallsBackToTheNoteBodyThenTheDefault() {
        let year = Calendar.current.component(.year, from: Date()) + 1
        let fromBody = CalendarExportService.resolvedStartDate(for: note(title: "Team sync", body: "Meet on March 3, \(year) at 10:30."))
        XCTAssertEqual(components(fromBody).year, year)
        XCTAssertEqual(components(fromBody).month, 3)
        XCTAssertEqual(components(fromBody).minute, 30)

        let fallback = Date().addingTimeInterval(7200)
        let none = CalendarExportService.resolvedStartDate(for: note(title: "Groceries", body: "Milk and bread."), fallbackDate: fallback)
        XCTAssertEqual(none.timeIntervalSince1970, fallback.timeIntervalSince1970, accuracy: 1)
    }

    func testSkipsDatesThatAreOver() {
        let year = Calendar.current.component(.year, from: Date())
        let text = "Last time we shipped on August 14, \(year - 1); this time aim for December 1, \(year + 1)."
        let detected = CalendarExportService.detectDate(in: text)
        XCTAssertEqual(detected.map { components($0).year }, year + 1)

        XCTAssertNil(CalendarExportService.detectDate(in: "We shipped on August 14, \(year - 1)."))
    }

    func testIgnoresVersionNumbers() {
        XCTAssertNil(CalendarExportService.detectDate(in: "Release notes for 1.2.3, build 4.15"))
    }
}
