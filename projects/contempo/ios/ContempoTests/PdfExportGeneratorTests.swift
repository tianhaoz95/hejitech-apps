@testable import Contempo
import ContempoCore
import ContempoData
import XCTest

final class PdfExportGeneratorTests: XCTestCase {
    private let calendar = Calendar(identifier: .gregorian)

    private func date(_ y: Int, _ m: Int, _ d: Int) -> Date {
        calendar.date(from: DateComponents(year: y, month: m, day: d))!
    }

    private func entries(time: Int, trips: Int) -> [Entry] {
        var out: [Entry] = (0..<time).map { i in
            let d = Timestamp(date: calendar.date(byAdding: .day, value: i * 4, to: date(2026, 1, 3))!)
            return Entry(propertyName: "Harbor Loft", task: "Turnover clean", durationMinutes: 60,
                         category: "turnover", status: "confirmed", activityDate: d, loggedAt: d)
        }
        for i in 0..<trips {
            let d = Timestamp(date: calendar.date(byAdding: .day, value: i * 20, to: date(2026, 1, 4))!)
            var trip = Entry(propertyName: "Harbor Loft", task: "Drive", status: "confirmed", activityDate: d, loggedAt: d)
            trip.isTrip = true
            trip.miles = 12.5
            out.append(trip)
        }
        return out
    }

    func testMileageRateFollowsTheIrsRateForEachYear() {
        XCTAssertEqual(PdfExportGenerator.mileageRate(for: date(2024, 6, 1)), 0.67)
        XCTAssertEqual(PdfExportGenerator.mileageRate(for: date(2025, 6, 1)), 0.70)
        XCTAssertEqual(PdfExportGenerator.mileageRate(for: date(2026, 6, 1)), 0.725)
    }

    func testEveryEntryAndTripIsListed() {
        let (time, trips) = PdfExportGenerator.sections(entries(time: 60, trips: 12))
        XCTAssertEqual(time.count, 60)
        XCTAssertEqual(trips.count, 12)
    }

    func testLongLogsContinueOnMorePages() throws {
        let url = try XCTUnwrap(PdfExportGenerator.generatePdf(entries: entries(time: 120, trips: 12)))
        let pages = try XCTUnwrap(CGPDFDocument(url as CFURL)).numberOfPages
        XCTAssertGreaterThan(pages, 1)
    }

    func testColumnsLineUpWithTheHeader() {
        let row = PdfExportGenerator.timeLogRow(entries(time: 1, trips: 0)[0])
        let header = PdfExportGenerator.timeLogHeader
        XCTAssertEqual(row.distance(from: row.startIndex, to: row.range(of: "Turnover clean")!.lowerBound),
                       header.distance(from: header.startIndex, to: header.range(of: "Task / Activity")!.lowerBound))
        XCTAssertEqual(PdfExportGenerator.column("Ocean Avenue Beach Cottage", 20), "Ocean Avenue Beach …")
    }
}
