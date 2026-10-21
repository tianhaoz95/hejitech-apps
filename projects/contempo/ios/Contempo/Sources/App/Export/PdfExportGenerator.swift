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

    public static func mileageRate(for date: Date) -> Double {
        let year = Calendar.current.component(.year, from: date)
        switch year {
        case ..<2024: return 0.655
        case 2024: return 0.67
        case 2025: return 0.70
        default: return 0.705
        }
    }

    public static func generatePdf(entries: [Entry]) -> URL? {
        #if canImport(UIKit)
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792) // US Letter
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        let tempUrl = FileManager.default.temporaryDirectory.appendingPathComponent("Contempo-Audit-Binder.pdf")

        do {
            try renderer.writePDF(to: tempUrl) { context in
                context.beginPage()

                let margin: CGFloat = 36
                var y: CGFloat = margin
                let contentWidth = pageRect.width - (margin * 2)

                // Title
                let titleFont = UIFont.boldSystemFont(ofSize: 20)
                let title = "Contempo STR Material Participation Audit Binder"
                (title as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: [
                    .font: titleFont,
                    .foregroundColor: UIColor.black
                ])
                y += 28

                // Subtitle / Date
                let subFont = UIFont.systemFont(ofSize: 10)
                let sub = "Generated on \(dateFormatter.string(from: Date())) · Treas. Reg. §1.469-5T(f)(4) Contemporaneous Log"
                (sub as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: [
                    .font: subFont,
                    .foregroundColor: UIColor.darkGray
                ])
                y += 18

                // Disclaimer box (Beta feature notice)
                let boxRect = CGRect(x: margin, y: y, width: contentWidth, height: 46)
                UIColor(white: 0.95, alpha: 1.0).setFill()
                UIRectFill(boxRect)
                UIColor.lightGray.setStroke()
                UIRectFrame(boxRect)

                let discFont = UIFont.italicSystemFont(ofSize: 8)
                let discRect = boxRect.insetBy(dx: 6, dy: 4)
                (disclaimerText as NSString).draw(in: discRect, withAttributes: [
                    .font: discFont,
                    .foregroundColor: UIColor.darkGray
                ])
                y += 56

                // Section 1: Participation Summary
                let h1Font = UIFont.boldSystemFont(ofSize: 13)
                ("1. MATERIAL PARTICIPATION SUMMARY" as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: [
                    .font: h1Font,
                    .foregroundColor: UIColor.black
                ])
                y += 18

                let nonTrip = entries.filter { !$0.inProgress && !$0.isTrip }
                let totalConfirmed = nonTrip.filter { $0.statusEnum == .confirmed }.reduce(0.0) { $0 + Double($1.durationMinutes) } / 60.0
                let totalPending = nonTrip.filter { $0.statusEnum == .pendingReview }.reduce(0.0) { $0 + Double($1.durationMinutes) } / 60.0
                let threshold = MaterialParticipationTest.thresholdHours

                let summaryLine = "Confirmed Hours: \(String(format: "%.1f", totalConfirmed)) hrs  |  Pending Review: \(String(format: "%.1f", totalPending)) hrs  |  Goal (\(MaterialParticipationTest.name)): \(threshold) hrs"
                (summaryLine as NSString).draw(at: CGPoint(x: margin + 8, y: y), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 10),
                    .foregroundColor: totalConfirmed >= Double(threshold) ? UIColor.systemGreen : UIColor.systemOrange
                ])
                y += 24

                // Section 2: Time Log (Recent entries)
                ("2. CONTEMPORANEOUS TIME LOG (HOURS)" as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: [
                    .font: h1Font,
                    .foregroundColor: UIColor.black
                ])
                y += 18

                let header = "Date          Property              Task / Activity                          Category       Hours   Status"
                (header as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: [
                    .font: UIFont.boldSystemFont(ofSize: 8),
                    .foregroundColor: UIColor.black
                ])
                y += 12

                for entry in nonTrip.prefix(20) {
                    let dStr = dateFormatter.string(from: entry.activityDate.dateValue())
                    let pStr = (entry.propertyName.isEmpty ? "-" : entry.propertyName).padding(toLength: 16, withPad: " ", startingAt: 0)
                    let tStr = (entry.task.isEmpty ? "Management" : entry.task).prefix(28).padding(toLength: 28, withPad: " ", startingAt: 0)
                    let cStr = entry.category.prefix(12).padding(toLength: 12, withPad: " ", startingAt: 0)
                    let hStr = String(format: "%5.1f", Double(entry.durationMinutes) / 60.0)
                    let sStr = entry.statusEnum == .confirmed ? "Confirmed" : "Pending"
                    let row = "\(dStr)    \(pStr)    \(tStr)    \(cStr)    \(hStr)    \(sStr)"

                    (row as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: [
                        .font: UIFont.monospacedSystemFont(ofSize: 8, weight: .regular),
                        .foregroundColor: UIColor.darkGray
                    ])
                    y += 12
                    if y > pageRect.height - 120 { break }
                }
                y += 16

                // Section 3: Mileage Log (IRC §274(d))
                let mileageEntries = entries.filter { $0.miles > 0 && !$0.inProgress }
                if !mileageEntries.isEmpty && y < pageRect.height - 100 {
                    ("3. BUSINESS MILEAGE LOG (IRC §274(d))" as NSString).draw(at: CGPoint(x: margin, y: y), withAttributes: [
                        .font: h1Font,
                        .foregroundColor: UIColor.black
                    ])
                    y += 16

                    for mEntry in mileageEntries.prefix(8) {
                        let mDate = mEntry.activityDate.dateValue()
                        let rate = mileageRate(for: mDate)
                        let ded = mEntry.miles * rate
                        let mRow = "\(dateFormatter.string(from: mDate)) · \(mEntry.propertyName) · \(String(format: "%.1f", mEntry.miles)) mi @ $\(String(format: "%.3f", rate))/mi = $\(String(format: "%.2f", ded)) deduction"
                        (mRow as NSString).draw(at: CGPoint(x: margin + 8, y: y), withAttributes: [
                            .font: UIFont.monospacedSystemFont(ofSize: 8, weight: .regular),
                            .foregroundColor: UIColor.darkGray
                        ])
                        y += 12
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
