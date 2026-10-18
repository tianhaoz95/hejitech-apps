import LogCore
import SwiftUI

/// Growth measurements: weight, height and head size each have their own tile on the Now tab and
/// their own one-field sheet. Values are stored in grams and centimeters; the units shown follow the
/// phone's measurement system.
enum Growth {
    static let types = ["weight", "height", "head"]
    static var usesImperial: Bool { Locale.current.measurementSystem == .us }

    static func title(_ type: String) -> String {
        switch type {
        case "weight": return "Weight"
        case "height": return "Height"
        default: return "Head size"
        }
    }

    static func icon(_ type: String) -> String {
        switch type {
        case "weight": return "scalemass.fill"
        case "height": return "ruler.fill"
        default: return "circle.dashed"
        }
    }

    /// The stored field: grams for weight, centimeters for the lengths.
    static func field(_ type: String) -> String {
        switch type {
        case "weight": return "grams"
        case "height": return "height_cm"
        default: return "head_cm"
        }
    }

    static func unit(_ type: String) -> String {
        type == "weight" ? (usesImperial ? "lb" : "kg") : (usesImperial ? "in" : "cm")
    }

    /// The newest active entry of a growth type.
    static func latest(_ type: String, in log: DerivedLog) -> LogEvent? {
        log.all.filter { $0.type == type && log.status[$0.id] == .active }.max { $0.occurredAt < $1.occurredAt }
    }

    /// "4.20 kg" or "21.5 in" for the latest entry of a type, or nil when it wasn't measured yet.
    static func latestText(_ type: String, in log: DerivedLog) -> String? {
        guard let v = latest(type, in: log)?.number(field(type)) else { return nil }
        return type == "weight" ? weightText(grams: v) : lengthText(cm: v)
    }

    static func weightText(grams: Double) -> String {
        usesImperial ? String(format: "%.1f lb", grams / 453.592) : String(format: "%.2f kg", grams / 1000)
    }

    static func lengthText(cm: Double) -> String {
        usesImperial ? String(format: "%.1f in", cm / 2.54) : String(format: "%.1f cm", cm)
    }

    /// A typed number in the phone's locale ("4,2" too), or nil when the field is empty or not a number.
    /// Fields keep their text and parse it on every keystroke, so Save follows what's on screen.
    static func number(_ text: String) -> Double? {
        let t = text.trimmingCharacters(in: .whitespaces)
        return t.isEmpty ? nil : try? Double(t, format: .number)
    }

    /// The stored value for a number typed in the shown unit.
    static func stored(_ type: String, _ v: Double) -> Double {
        if type == "weight" { return (usesImperial ? v * 453.592 : v * 1000).rounded() }
        return ((usesImperial ? v * 2.54 : v) * 10).rounded() / 10
    }
}

/// Logs one measurement: the tile picked the type, so the sheet asks for one number per child
/// being logged for (one field, or one per child when logging for several).
struct GrowthSheet: View {
    let type: String
    let babies: [Baby]
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var at = Date()
    @State private var values: [UUID: String] = [:]
    @FocusState private var focused: UUID?

    private var amounts: [(UUID, Double)] {
        babies.compactMap { b in Growth.number(values[b.id] ?? "").flatMap { $0 > 0 ? (b.id, $0) : nil } }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach(babies) { b in
                        LabeledContent {
                            HStack(spacing: 6) {
                                TextField(Growth.latestText(type, in: model.logs[b.id] ?? model.log).map { "last \($0)" } ?? "—",
                                          text: Binding { values[b.id] ?? "" } set: { values[b.id] = $0 })
                                    .keyboardType(.decimalPad)
                                    .multilineTextAlignment(.trailing)
                                    .focused($focused, equals: b.id)
                                Text(Growth.unit(type)).foregroundStyle(.secondary)
                            }
                        } label: { Text(babies.count > 1 ? b.name : Growth.title(type)) }
                        .accessibilityIdentifier("growth-\(type)-\(b.name)")
                    }
                } footer: {
                    Text(babies.count > 1 ? "Fill in who you measured; empty fields are skipped." : "You can also say it: “\(example)”.")
                }
                DatePicker("Measured", selection: $at, in: ...Date())
            }
            .navigationTitle(Growth.title(type))
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { focused = babies.first?.id }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let entries = Dictionary(uniqueKeysWithValues: amounts)
                        let field = Growth.field(type)
                        model.performEach(amounts.map(\.0)) { [type, at] s, baby, group in
                            try s.log(type: type, fields: [field: .number(Growth.stored(type, entries[baby]!))].merging(group) { $1 },
                                      occurredAt: at, provenance: Provenance(surface: .phone, input: .tap), baby: baby)
                        }
                        dismiss()
                    }
                    .disabled(amounts.isEmpty)
                }
            }
        }
    }

    private var example: String {
        switch type {
        case "weight": return Growth.usesImperial ? "she weighs 9 pounds" : "she weighs 4.2 kilos"
        case "height": return "she's 52 centimeters long"
        default: return "head is 35 centimeters"
        }
    }
}
