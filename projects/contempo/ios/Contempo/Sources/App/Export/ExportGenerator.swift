import ContempoCore
import ContempoData
import Foundation

/// Ports Android's `ExportViewModel`'s CSV generation verbatim — same column
/// headers/order, same section layout, same mileage-deduction constant —
/// so a CPA gets an identical file regardless of which platform produced it.
enum ExportGenerator {
    /// IRS standard mileage rate — illustrative, needs an annual update; see
    /// Android's `ExportViewModel` for the same caveat.
    private static let mileageRatePerMile = 0.67

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    static func generateCsv(entries: [Entry]) -> String {
        var lines: [String] = []
        lines.append("Contempo hours & mileage export — generated \(dateFormatter.string(from: Date()))")
        lines.append("Contemporaneity is assessed under Treas. Reg. §1.469-5T(f)(4) — records made at or near the time of the activity.")
        lines.append("")

        lines.append(contentsOf: summarySection(entries: entries))
        lines.append("")
        lines.append(contentsOf: timeLogSection(entries: entries))
        lines.append("")
        lines.append(contentsOf: mileageLogSection(entries: entries))
        lines.append("")
        lines.append(contentsOf: flaggedSection(entries: entries))

        return lines.joined(separator: "\n")
    }

    private static func summarySection(entries: [Entry]) -> [String] {
        var lines = ["SUMMARY", "property,confirmed_hours,pending_hours"]

        let byProperty = Dictionary(grouping: entries.filter { !$0.inProgress && !$0.isTrip }) { entry in
            entry.propertyName.isEmpty ? "(no property)" : entry.propertyName
        }
        var totalConfirmed = 0.0
        var totalPending = 0.0
        for property in byProperty.keys.sorted() {
            let propertyEntries = byProperty[property] ?? []
            let confirmed = propertyEntries.filter { $0.statusEnum == .confirmed }.reduce(0.0) { $0 + Double($1.durationMinutes) } / 60.0
            let pending = propertyEntries.filter { $0.statusEnum == .pendingReview }.reduce(0.0) { $0 + Double($1.durationMinutes) } / 60.0
            totalConfirmed += confirmed
            totalPending += pending
            lines.append(csvRow([property, formatHours(confirmed), formatHours(pending)]))
        }
        lines.append(csvRow(["All properties", formatHours(totalConfirmed), formatHours(totalPending)]))
        lines.append("")

        let threshold = MaterialParticipationTest.thresholdHours
        if totalConfirmed >= Double(threshold) {
            lines.append("\(MaterialParticipationTest.name) threshold met: \(formatHours(totalConfirmed)) of \(threshold) hours confirmed.")
        } else {
            let remaining = Double(threshold) - totalConfirmed
            lines.append("\(MaterialParticipationTest.name) threshold not yet met: \(formatHours(totalConfirmed)) of \(threshold) hours confirmed, \(formatHours(remaining)) still needed.")
        }
        return lines
    }

    private static func timeLogSection(entries: [Entry]) -> [String] {
        var lines = ["TIME LOG", "date,property,activity,duration_minutes,category,status,logged_at,contemporaneity"]
        let logEntries = entries.filter { !$0.inProgress && !$0.isTrip }
            .sorted { $0.activityDate.dateValue() < $1.activityDate.dateValue() }
        for entry in logEntries {
            lines.append(csvRow([
                dateFormatter.string(from: entry.activityDate.dateValue()),
                entry.propertyName,
                entry.task,
                String(entry.durationMinutes),
                entry.category,
                entry.status,
                dateFormatter.string(from: entry.loggedAt.dateValue()),
                contemporaneityLabel(daysLate: entry.daysLate),
            ]))
        }
        return lines
    }

    private static func mileageLogSection(entries: [Entry]) -> [String] {
        var lines = [
            "MILEAGE LOG (separate deduction under IRC Section 274(d) — keep alongside, not merged into, your hours log)",
            "date,property,business_purpose,miles,capture_method,deduction_usd",
        ]
        let mileageEntries = entries.filter { $0.miles > 0 && !$0.inProgress }
            .sorted { $0.activityDate.dateValue() < $1.activityDate.dateValue() }
        var totalMiles = 0.0
        var totalDeduction = 0.0
        for entry in mileageEntries {
            totalMiles += entry.miles
            let deduction = entry.miles * mileageRatePerMile
            totalDeduction += deduction
            let purpose = entry.propertyName.isEmpty
                ? "(no property specified — add detail before filing)"
                : "Property management — \(entry.propertyName)"
            lines.append(csvRow([
                dateFormatter.string(from: entry.activityDate.dateValue()),
                entry.propertyName,
                purpose,
                formatHours(entry.miles),
                entry.mileageCaptureMethod,
                formatHours(deduction),
            ]))
        }
        lines.append(csvRow(["Total", "", "", formatHours(totalMiles), "", formatHours(totalDeduction)]))
        return lines
    }

    private static func flaggedSection(entries: [Entry]) -> [String] {
        var lines = ["FLAGGED FOR REVIEW", "date,property,activity,reasons"]
        let flagged = entries.filter { $0.riskFlags.hasWarning }
            .sorted { $0.activityDate.dateValue() < $1.activityDate.dateValue() }
        if flagged.isEmpty {
            lines.append("(none)")
            return lines
        }
        for entry in flagged {
            var reasons: [String] = []
            if entry.isVague { reasons.append("vague description") }
            if entry.isBackfilled { reasons.append(contemporaneityLabel(daysLate: entry.daysLate)) }
            reasons.append(contentsOf: entry.riskReasons)
            lines.append(csvRow([
                dateFormatter.string(from: entry.activityDate.dateValue()),
                entry.propertyName,
                entry.task,
                reasons.joined(separator: "; "),
            ]))
        }
        return lines
    }

    private static func contemporaneityLabel(daysLate: Int) -> String {
        if daysLate <= 0 { return "logged same day" }
        if daysLate == 1 { return "logged 1 day late" }
        return "logged \(daysLate) days late"
    }

    private static func formatHours(_ value: Double) -> String {
        String(format: "%.2f", value)
    }

    private static func csvRow(_ fields: [String]) -> String {
        fields.map(csvField).joined(separator: ",")
    }

    private static func csvField(_ value: String) -> String {
        guard value.contains(",") || value.contains("\"") || value.contains("\n") else { return value }
        return "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\""
    }
}
