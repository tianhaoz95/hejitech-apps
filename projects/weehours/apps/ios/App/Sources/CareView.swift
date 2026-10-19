import LogCore
import SwiftUI

/// The tap-logged care, health and activity types: everything the spec describes field by field
/// (`EventType.fields`). Each gets a Now tile when its category is turned on in Settings →
/// Tracking; how the tile logs follows from the fields, so a new type needs only a spec entry.
enum Care {
    static func types(enabled: Set<String>) -> [EventRegistry.EventType] {
        EventRegistry.shared.types.filter { $0.fields != nil && enabled.contains($0.category) }
    }

    /// Settings → Tracking sections, in order: nil is the core (feeds, diapers, sleep, growth).
    static let groups: [(id: String?, title: String)] = [(nil, "Tracking"), ("care", "Care"), ("health", "Health"), ("activity", "Activities")]

    static func color(group: String?) -> Color {
        switch group {
        case "care": return Color(red: 0.40, green: 0.78, blue: 0.80)
        case "health": return Color(red: 0.94, green: 0.52, blue: 0.52)
        case "activity": return Color(red: 0.55, green: 0.80, blue: 0.45)
        default: return Theme.other
        }
    }

    static func color(type: EventRegistry.EventType) -> Color {
        color(group: EventRegistry.shared.category(type.category)?.group)
    }
}

/// One Now tile. No fields: a tap logs it. One choice field, or a number with presets: a menu.
/// Anything else (text, temperature): a sheet.
struct CareTile: View {
    let type: EventRegistry.EventType
    @EnvironmentObject var model: AppModel
    @State private var entering = false

    private var fields: [EventRegistry.FieldSpec] { type.fields ?? [] }

    var body: some View {
        let tile = Tile(title: type.label, subtitle: subtitle, icon: type.icon ?? "circle.fill", color: Care.color(type: type))
        Group {
            if fields.isEmpty {
                Button { model.log(type.id) } label: { tile }
            } else if fields.count == 1, let f = fields.first, f.kind == "choice", let options = f.options {
                Menu {
                    ForEach(options, id: \.key) { o in Button(o.label) { model.log(type.id, [f.key: .string(o.key)]) } }
                } label: { tile }
            } else if fields.count == 1, let f = fields.first, f.kind == "number", let presets = f.presets {
                Menu {
                    ForEach(presets, id: \.self) { p in
                        Button(VoiceInterpreter.numberText(p, unit: f.unit)) { model.log(type.id, [f.key: .number(p)]) }
                    }
                    if !f.isRequired { Button("Just log it") { model.log(type.id) } }
                    Button("Other…") { entering = true }
                } label: { tile }
            } else {
                Button { entering = true } label: { tile }
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("careTile-\(type.id)")
        .sheet(isPresented: $entering) { CareSheet(type: type).presentationDetents([.medium, .large]) }
    }

    /// When it was last logged for the Log-for target ("2h 10m ago"), else a hint.
    private var subtitle: String {
        let last = model.target.compactMap { model.logs[$0]?.effective.last { $0.type == type.id }?.occurredAt }.max()
        guard let last else { return "tap to log" }
        return StatusSnapshot.duration(Date().timeIntervalSince(last)) + " ago"
    }
}

/// Enter a care entry's fields: text (with recent values to pick), numbers (temperature in the
/// phone's units, stored in Celsius), choices, and when it happened.
struct CareSheet: View {
    let type: EventRegistry.EventType
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var at = Date()
    @State private var values: [String: String] = [:]
    @State private var fahrenheit = Locale.current.measurementSystem == .us
    @FocusState private var focused: String?

    private var fields: [EventRegistry.FieldSpec] { type.fields ?? [] }

    var body: some View {
        NavigationStack {
            Form {
                ForEach(fields, id: \.key) { f in
                    Section {
                        input(f)
                        if f.kind == "text" { recent(f) }
                    } header: { Text((f.label ?? f.key.capitalized) + (f.isRequired ? "" : " (optional)")) }
                }
                DatePicker("When", selection: $at, in: ...Date())
            }
            .navigationTitle(type.label)
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { focused = fields.first { $0.kind != "choice" }?.key }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Log") {
                        model.log(type.id, entered, at: at)
                        dismiss()
                    }
                    .disabled(!complete)
                    .accessibilityIdentifier("careLog")
                }
            }
        }
    }

    @ViewBuilder private func input(_ f: EventRegistry.FieldSpec) -> some View {
        let text = Binding { values[f.key] ?? "" } set: { values[f.key] = $0 }
        switch f.kind {
        case "choice":
            Picker(f.label ?? f.key.capitalized, selection: text) {
                Text("—").tag("")
                ForEach(f.options ?? [], id: \.key) { Text($0.label).tag($0.key) }
            }
        case "number":
            HStack {
                TextField(f.unit == "celsius" ? (fahrenheit ? "98.6" : "37.0") : "0", text: text)
                    .keyboardType(.decimalPad)
                    .focused($focused, equals: f.key)
                if f.unit == "celsius" {
                    Picker("Unit", selection: $fahrenheit) { Text("°C").tag(false); Text("°F").tag(true) }
                        .pickerStyle(.segmented).frame(width: 110)
                } else if f.unit == "minutes" {
                    Text("min").foregroundStyle(.secondary)
                }
            }
        default:
            TextField(f.label ?? f.key.capitalized, text: text)
                .focused($focused, equals: f.key)
                .accessibilityIdentifier("careField-\(f.key)")
        }
    }

    /// Up to four values used before for this field, newest first (medicine names, vaccines).
    @ViewBuilder private func recent(_ f: EventRegistry.FieldSpec) -> some View {
        let used = model.log.effective.reversed().filter { $0.type == type.id }.compactMap { $0.fields[f.key]?.string }
        let unique = used.reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }.prefix(4)
        if !unique.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach(Array(unique), id: \.self) { v in
                        Button(v) { values[f.key] = v }.buttonStyle(.bordered).controlSize(.small)
                    }
                }
            }
        }
    }

    private var entered: [String: FieldValue] {
        var out: [String: FieldValue] = [:]
        for f in fields {
            let raw = (values[f.key] ?? "").trimmingCharacters(in: .whitespaces)
            guard !raw.isEmpty else { continue }
            switch f.kind {
            case "number":
                guard let n = Growth.number(raw), n > 0 else { continue }
                out[f.key] = .number(f.unit == "celsius" && fahrenheit ? ((n - 32) * 5 / 9 * 10).rounded() / 10 : n)
            default: out[f.key] = .string(raw)
            }
        }
        return out
    }

    private var complete: Bool { fields.allSatisfy { !$0.isRequired || entered[$0.key] != nil } }
}
