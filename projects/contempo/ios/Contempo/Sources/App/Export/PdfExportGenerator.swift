import ContempoCore
import ContempoData
import Foundation
#if canImport(UIKit)
import UIKit
#endif

public enum PdfExportGenerator {
    public static let disclaimerText = """
    DISCLAIMER (BETA FEATURE): This document is generated for contemporaneous record-keeping under \
    Treas. Reg. §1.469-5T(f)(4). It is provided as a beta feature for documentation assistance only and \
    does not constitute legal, tax, or financial advice. Consult a certified CPA or tax attorney \
    for audit defense and tax filing determinations.
    """

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    /// IRS business standard mileage rate for the year of `date` (USD per mile): 2024 IR-2023-239,
    /// 2025 IR-2024-312, 2026 IR-2025-128. Later years use the newest known rate until it's updated.
    public static func mileageRate(for date: Date) -> Double {
        let year = Calendar.current.component(.year, from: date)
        switch year {
        case ..<2024: return 0.655
        case 2024: return 0.67
        case 2025: return 0.70
        default: return 0.725
        }
    }

    /// Pads or cuts `text` to exactly `width` characters, ending a cut with "…".
    static func column(_ text: String, _ width: Int) -> String {
        if text.count > width { return String(text.prefix(width - 1)) + "…" }
        return text.padding(toLength: width, withPad: " ", startingAt: 0)
    }

    static func timeLogRow(_ entry: Entry) -> String {
        let date = dateFormatter.string(from: entry.activityDate.dateValue())
        let property = column(entry.propertyName.isEmpty ? "-" : entry.propertyName, 20)
        let task = column(entry.task.isEmpty ? "Management" : entry.task, 30)
        let category = column(EntryCategory.displayName(for: entry.category), 14)
        let hours = String(format: "%5.1f", Double(entry.durationMinutes) / 60.0)
        let status = entry.statusEnum == .confirmed ? "Confirmed" : "Pending"
        return "\(date)  \(property)  \(task)  \(category)  \(hours)  \(status)"
    }

    static let timeLogHeader =
        "\(column("Date", 10))  \(column("Property", 20))  \(column("Task / Activity", 30))  \(column("Category", 14))  Hours  Status"

    static func mileageRow(_ entry: Entry) -> String {
        let date = entry.activityDate.dateValue()
        let rate = mileageRate(for: date)
        return "\(dateFormatter.string(from: date))  \(column(entry.propertyName.isEmpty ? "-" : entry.propertyName, 20))  "
            + "\(String(format: "%7.1f", entry.miles)) mi @ $\(String(format: "%.3f", rate))/mi = $\(String(format: "%.2f", entry.miles * rate))"
    }

    /// The entries the binder lists: every finished time entry and every finished trip, oldest first.
    static func sections(_ entries: [Entry]) -> (time: [Entry], trips: [Entry]) {
        let byDate: (Entry, Entry) -> Bool = { $0.activityDate.dateValue() < $1.activityDate.dateValue() }
        return (entries.filter { !$0.inProgress && !$0.isTrip }.sorted(by: byDate),
                entries.filter { $0.miles > 0 && !$0.inProgress }.sorted(by: byDate))
    }

    public static func generatePdf(entries: [Entry]) -> URL? {
        #if canImport(UIKit)
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792) // US Letter
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let tempUrl = FileManager.default.temporaryDirectory.appendingPathComponent("Contempo-Audit-Binder.pdf")

        let margin: CGFloat = 36
        let bottom = pageRect.height - margin - 14 // room for the page footer
        let contentWidth = pageRect.width - margin * 2
        let rowFont = UIFont.monospacedSystemFont(ofSize: 7.5, weight: .regular)
        let headerFont = UIFont.monospacedSystemFont(ofSize: 7.5, weight: .bold)
        let h1Font = UIFont.boldSystemFont(ofSize: 13)
        let rowHeight: CGFloat = 11
        let (timeEntries, trips) = sections(entries)

        do {
            try renderer.writePDF(to: tempUrl) { context in
                var page = 0
                var y: CGFloat = margin
                func draw(_ text: String, _ font: UIFont, _ color: UIColor = .darkGray, x: CGFloat = margin) {
                    (text as NSString).draw(at: CGPoint(x: x, y: y), withAttributes: [.font: font, .foregroundColor: color])
                }
                func newPage() {
                    context.beginPage()
                    page += 1
                    y = margin
                    let footer = "Contempo Audit Binder · page \(page)"
                    (footer as NSString).draw(at: CGPoint(x: margin, y: pageRect.height - margin), withAttributes: [
                        .font: UIFont.systemFont(ofSize: 7), .foregroundColor: UIColor.gray,
                    ])
                }
                /// Starts a new page when `height` more points don't fit; repeats `header` on it.
                func ensure(_ height: CGFloat, header: String? = nil) {
                    guard y + height > bottom else { return }
                    newPage()
                    if let header {
                        draw(header, headerFont, .black)
                        y += rowHeight + 1
                    }
                }

                newPage()
                draw("Contempo STR Material Participation Audit Binder", .boldSystemFont(ofSize: 20), .black)
                y += 28
                draw("Generated on \(dateFormatter.string(from: Date())) · Treas. Reg. §1.469-5T(f)(4) Contemporaneous Log", .systemFont(ofSize: 10))
                y += 18

                // Disclaimer box (beta feature notice)
                let boxRect = CGRect(x: margin, y: y, width: contentWidth, height: 46)
                UIColor(white: 0.95, alpha: 1.0).setFill()
                UIRectFill(boxRect)
                UIColor.lightGray.setStroke()
                UIRectFrame(boxRect)
                (disclaimerText as NSString).draw(in: boxRect.insetBy(dx: 6, dy: 4), withAttributes: [
                    .font: UIFont.italicSystemFont(ofSize: 8), .foregroundColor: UIColor.darkGray,
                ])
                y += 56

                // 1. Summary
                draw("1. MATERIAL PARTICIPATION SUMMARY", h1Font, .black)
                y += 18
                let confirmed = timeEntries.filter { $0.statusEnum == .confirmed }.reduce(0.0) { $0 + Double($1.durationMinutes) } / 60.0
                let pending = timeEntries.filter { $0.statusEnum == .pendingReview }.reduce(0.0) { $0 + Double($1.durationMinutes) } / 60.0
                let threshold = MaterialParticipationTest.thresholdHours
                draw("Confirmed Hours: \(String(format: "%.1f", confirmed)) hrs  |  Pending Review: \(String(format: "%.1f", pending)) hrs  |  Goal (\(MaterialParticipationTest.name)): \(threshold) hrs",
                     .systemFont(ofSize: 10), confirmed >= Double(threshold) ? .systemGreen : .systemOrange, x: margin + 8)
                y += 14
                draw("\(timeEntries.count) time entries and \(trips.count) trips, all listed below.", .systemFont(ofSize: 9), x: margin + 8)
                y += 22

                // 2. Time log: every entry, continued across pages with the header repeated
                ensure(18 + rowHeight * 3)
                draw("2. CONTEMPORANEOUS TIME LOG (HOURS)", h1Font, .black)
                y += 18
                draw(timeLogHeader, headerFont, .black)
                y += rowHeight + 1
                for entry in timeEntries {
                    ensure(rowHeight, header: timeLogHeader)
                    draw(timeLogRow(entry), rowFont)
                    y += rowHeight
                }
                y += 16

                // 3. Mileage log: every trip
                if !trips.isEmpty {
                    ensure(16 + rowHeight * 2)
                    draw("3. BUSINESS MILEAGE LOG (IRC §274(d))", h1Font, .black)
                    y += 16
                    for trip in trips {
                        ensure(rowHeight)
                        draw(mileageRow(trip), rowFont)
                        y += rowHeight
                    }
                }
            }
            return tempUrl
        } catch {
            return nil
        }
        #else
        return nil
        #endif
    }
}
