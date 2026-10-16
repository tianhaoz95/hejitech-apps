import LogCore
import SwiftUI

/// Growth measurements (weight, height, head size): one sheet from the Now tab. Values are stored in
/// grams and centimeters; the units shown follow the phone's measurement system.
enum Growth {
    static let types = ["weight", "height", "head"]
    static var usesImperial: Bool { Locale.current.measurementSystem == .us }

    /// The newest active entry of a growth type.
    static func latest(_ type: String, in log: DerivedLog) -> LogEvent? {
        log.all.filter { $0.type == type && log.status[$0.id] == .active }.max { $0.occurredAt < $1.occurredAt }
    }

    static func weightText(grams: Double) -> String {
        usesImperial ? String(format: "%.1f lb", grams / 453.592) : String(format: "%.2f kg", grams / 1000)
    }

    static func lengthText(cm: Double) -> String {
        usesImperial ? String(format: "%.1f in", cm / 2.54) : String(format: "%.1f cm", cm)
    }

    /// "4.20 kg · 52.0 cm · 35.5 cm" from the latest entries, or nil when nothing was measured yet.
    static func summary(_ log: DerivedLog) -> String? {
        var parts: [String] = []
        if let g = latest("weight", in: log)?.number("grams") { parts.append(weightText(grams: g)) }
        if let cm = latest("height", in: log)?.number("height_cm") { parts.append(lengthText(cm: cm)) }
        if let cm = latest("head", in: log)?.number("head_cm") { parts.append("head \(lengthText(cm: cm))") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

struct GrowthSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var at = Date()
    @State private var weight: Double?
    @State private var height: Double?
    @State private var head: Double?

    private var imperial: Bool { Growth.usesImperial }
    private var weightUnit: String { imperial ? "lb" : "kg" }
    private var lengthUnit: String { imperial ? "in" : "cm" }

    private var entries: [(String, [String: FieldValue])] {
        var out: [(String, [String: FieldValue])] = []
        if let w = weight, w > 0 { out.append(("weight", ["grams": .number((imperial ? w * 453.592 : w * 1000).rounded())])) }
        if let h = height, h > 0 { out.append(("height", ["height_cm": .number(centimeters(h))])) }
        if let c = head, c > 0 { out.append(("head", ["head_cm": .number(centimeters(c))])) }
        return out
    }

    private func centimeters(_ v: Double) -> Double { ((imperial ? v * 2.54 : v) * 10).rounded() / 10 }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    measure("Weight", unit: weightUnit, value: $weight, last: Growth.latest("weight", in: model.log)?.number("grams").map(Growth.weightText))
                    measure("Height", unit: lengthUnit, value: $height, last: Growth.latest("height", in: model.log)?.number("height_cm").map(Growth.lengthText))
                    measure("Head size", unit: lengthUnit, value: $head, last: Growth.latest("head", in: model.log)?.number("head_cm").map(Growth.lengthText))
                } footer: {
                    Text("Fill in what you measured; empty fields are skipped. You can also say it: “she's 52 centimeters long”.")
                }
                DatePicker("Measured", selection: $at, in: ...Date())
            }
            .navigationTitle("Growth")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        for (type, fields) in entries { model.log(type, fields, at: at) }
                        dismiss()
                    }
                    .disabled(entries.isEmpty)
                }
            }
        }
    }

    private func measure(_ title: String, unit: String, value: Binding<Double?>, last: String?) -> some View {
        LabeledContent {
            HStack(spacing: 6) {
                TextField(last.map { "last \($0)" } ?? "—", value: value, format: .number.precision(.fractionLength(0...2)))
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                Text(unit).foregroundStyle(.secondary)
            }
        } label: { Text(title) }
        .accessibilityIdentifier("growth-\(title)")
    }
}
