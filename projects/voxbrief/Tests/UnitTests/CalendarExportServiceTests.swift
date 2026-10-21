import XCTest
@testable import Voxbrief

final class CalendarExportServiceTests: XCTestCase {
    func testDetectDateFromTitleAndBody() {
        let textWithDate = "Dentist appointment tomorrow at 3pm"
        let detected = CalendarExportService.detectDate(in: textWithDate)
        XCTAssertNotNil(detected)

        let note = VoiceNote(
            id: UUID(),
            createdAt: Date(),
            duration: 10,
            rawTranscription: "Dentist appointment next Friday at 2pm",
            cleanedNote: "Meeting with doctor next Friday at 2pm",
            summary: "Dentist visit",
            title: "Dentist appointment tomorrow at 3pm",
            keyPoints: [],
            actionItems: [],
            audioRelativePath: "audio.m4a"
        )

        let resolved = CalendarExportService.resolvedStartDate(for: note)
        XCTAssertNotNil(resolved)
    }

    func testDetectDateFallbackWhenNoDateMentioned() {
        let noDate = "Just a general observation about swift macros"
        let detected = CalendarExportService.detectDate(in: noDate)
        XCTAssertNil(detected)

        let note = VoiceNote(
            id: UUID(),
            createdAt: Date(),
            duration: 10,
            rawTranscription: "Just a general observation",
            cleanedNote: "Notes on swift macros",
            summary: "General observation",
            title: "Swift Macros",
            keyPoints: [],
            actionItems: [],
            audioRelativePath: "audio.m4a"
        )
        let fallback = Date().addingTimeInterval(7200)
        let resolved = CalendarExportService.resolvedStartDate(for: note, fallbackDate: fallback)
        XCTAssertEqual(resolved.timeIntervalSince1970, fallback.timeIntervalSince1970, accuracy: 1.0)
    }
}
