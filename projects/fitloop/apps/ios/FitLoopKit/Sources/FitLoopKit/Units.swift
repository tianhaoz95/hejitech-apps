import Foundation

/// Converts canonical metric vitals (kg, cm, L) for display and manual entry according to `settings.units`.
public enum UnitFormat {
    private static let lbPerKg = 2.2046226218
    private static let cmPerIn = 2.54
    private static let flOzPerL = 33.8140227

    private static let names: [String: String] = [
        "weight": "Weight",
        "waist": "Waist",
        "body_fat": "Body fat",
        "energy": "Energy",
        "mood": "Mood",
        "soreness": "Soreness",
        "sleep_hours": "Sleep",
        "resting_hr": "Resting HR",
        "hrv": "HRV",
        "steps": "Steps",
        "active_energy": "Active energy",
    ]

    public static func unit(for metric: String, units: String) -> String {
        let imperial = units == "imperial"
        switch metric {
        case "weight": return imperial ? "lb" : "kg"
        case "waist": return imperial ? "in" : "cm"
        case "body_fat": return "%"
        case "energy", "mood", "soreness": return "1-5"
        case "sleep_hours": return "h"
        case "resting_hr": return "bpm"
        case "hrv": return "ms"
        case "steps": return "steps"
        case "active_energy": return "kcal"
        default: return ""
        }
    }

    public static func label(for metric: String, units: String) -> String {
        let name = names[metric] ?? metric
        let u = unit(for: metric, units: units)
        return u.isEmpty ? name : "\(name) (\(u))"
    }

    public static func toDisplay(_ value: Double, metric: String, units: String) -> Double {
        guard units == "imperial" else { return value }
        switch metric {
        case "weight": return (value * lbPerKg * 10).rounded() / 10
        case "waist": return ((value / cmPerIn) * 10).rounded() / 10
        default: return value
        }
    }

    public static func fromDisplay(_ value: Double, metric: String, units: String) -> Double {
        guard units == "imperial" else { return value }
        switch metric {
        case "weight": return ((value / lbPerKg) * 100).rounded() / 100
        case "waist": return (value * cmPerIn * 100).rounded() / 100
        default: return value
        }
    }

    public static func format(_ value: Double, metric: String, units: String) -> String {
        let v = toDisplay(value, metric: metric, units: units)
        return v.formatted(.number.precision(.fractionLength(0...1)))
    }

    public static func water(_ liters: Double, units: String) -> String {
        if units == "imperial" {
            return "\(Int((liters * flOzPerL).rounded())) fl oz water"
        }
        let rounded = (liters * 10).rounded() / 10
        return "\(rounded.formatted(.number.precision(.fractionLength(0...1)))) L water"
    }
}
