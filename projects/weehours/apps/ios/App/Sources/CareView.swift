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
            if type.id == "doctor_visit" {
                Button { entering = true } label: { tile }
            } else if type.isTimed, !running.isEmpty {
                // running: one tap stops it (for every child it was started for)
                Button { model.stopTimed(running) } label: {
                    Tile(title: "Stop \(type.label.lowercased())", subtitle: runningText, icon: type.icon ?? "timer", color: Care.color(type: type))
                }
            } else if type.isTimed {
                Menu {
                    Button { model.startTimed(type.id) } label: { Label("Start now", systemImage: "play.fill") }
                    if let f = fields.first, let presets = f.presets {
                        Section("Already done") {
                            ForEach(presets, id: \.self) { p in
                                Button(VoiceInterpreter.numberText(p, unit: f.unit)) { model.log(type.id, [f.key: .number(p)]) }
                            }
                        }
                    }
                } label: { tile }
            } else if fields.isEmpty {
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
        .contextMenu {
            if fields.isEmpty {
                Button { model.log(type.id) } label: { Label("Just now", systemImage: "clock") }
                ForEach([5, 10, 15, 30], id: \.self) { mins in
                    Button {
                        model.log(type.id, at: Date().addingTimeInterval(-Double(mins * 60)))
                    } label: {
                        Label("\(mins) min ago", systemImage: "clock.arrow.circlepath")
                    }
                }
            } else {
                Button { entering = true } label: { Label("Open \(type.label.lowercased())…", systemImage: "square.and.pencil") }
            }
        }
        .accessibilityIdentifier("careTile-\(type.id)")
        .sheet(isPresented: $entering) {
            if type.id == "doctor_visit" {
                DoctorVisitSheet().presentationDetents([.large])
            } else {
                CareSheet(type: type).presentationDetents([.medium, .large])
            }
        }
    }

    /// This type's running entries for the Log-for target.
    private var running: [LogEvent] {
        model.target.compactMap { model.logs[$0]?.effective.last { $0.type == type.id && $0.fields["ongoing"] == .bool(true) } }
    }

    private var runningText: String {
        guard let since = running.map(\.occurredAt).min() else { return "" }
        return "running " + StatusSnapshot.duration(Date().timeIntervalSince(since))
    }

    /// Rich subtitle for medication (last medicine, elapsed, 24h count), temperature (latest + delta),
    /// doctor visit (queued questions count), or when it was last logged.
    private var subtitle: String {
        let log = model.target.first.flatMap { model.logs[$0] } ?? model.log
        if type.id == "medication" {
            let meds = log.effective.filter { $0.type == "medication" }
            guard let last = meds.last else { return "tap to log" }
            let name = last.string("medicine") ?? "Medicine"
            let count24h = meds.filter { Date().timeIntervalSince($0.occurredAt) <= 86_400 }.count
            let ago = StatusSnapshot.duration(Date().timeIntervalSince(last.occurredAt))
            return "\(name) \(ago) ago · \(count24h) in 24h"
        }
        if type.id == "temperature" {
            let temps = log.effective.filter { $0.type == "temperature" }
            guard let last = temps.last, let c = last.number("celsius") else { return "tap to log" }
            let ago = StatusSnapshot.duration(Date().timeIntervalSince(last.occurredAt))
            let prev = temps.dropLast().last?.number("celsius")
            let delta = prev.map { d -> String in
                let diff = ((c - d) * 10).rounded() / 10
                return diff == 0 ? "" : (diff > 0 ? " (+\(diff)°)" : " (\(diff)°)")
            } ?? ""
            return "\(VoiceInterpreter.numberText(c, unit: "celsius"))\(delta) · \(ago) ago"
        }
        if type.id == "doctor_visit" {
            let pack = log.doctorVisitPack(household: model.household)
            if !pack.questions.isEmpty {
                return "\(pack.questions.count) question\(pack.questions.count == 1 ? "" : "s") queued"
            }
        }
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

    /// Recent (medicine, dose) pairs for 1-tap repeat on Medication.
    private var recentMedPairs: [(medicine: String, dose: String, lastAt: Date)] {
        guard type.id == "medication" else { return [] }
        let log = model.target.first.flatMap { model.logs[$0] } ?? model.log
        var seen: Set<String> = []
        var out: [(String, String, Date)] = []
        for e in log.effective.reversed() where e.type == "medication" {
            guard let med = e.string("medicine"), !med.isEmpty else { continue }
            let dose = e.string("dose") ?? ""
            let key = "\(med.lowercased())|\(dose.lowercased())"
            if seen.insert(key).inserted {
                out.append((med, dose, e.occurredAt))
                if out.count >= 4 { break }
            }
        }
        return out
    }

    var body: some View {
        NavigationStack {
            Form {
                if type.id == "medication", !recentMedPairs.isEmpty {
                    Section("1-tap repeat") {
                        ForEach(Array(recentMedPairs.enumerated()), id: \.offset) { _, pair in
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(pair.dose.isEmpty ? pair.medicine : "\(pair.medicine) · \(pair.dose)")
                                        .font(.subheadline.weight(.semibold))
                                    Text("Last given \(StatusSnapshot.duration(Date().timeIntervalSince(pair.lastAt))) ago (\(pair.lastAt.formatted(date: .omitted, time: .shortened)))")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button("Log now") {
                                    var f: [String: FieldValue] = ["medicine": .string(pair.medicine)]
                                    if !pair.dose.isEmpty { f["dose"] = .string(pair.dose) }
                                    model.log("medication", f, at: at)
                                    dismiss()
                                }
                                .buttonStyle(.borderedProminent).controlSize(.small)
                            }
                        }
                    }
                }
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

/// Pediatrician Visit Fact Sheet & Question Queue (`doctor_visit`).
struct DoctorVisitSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var newQuestion = ""
    @State private var visitNotes = ""
    @State private var at = Date()
    @State private var copied = false

    var body: some View {
        let log = model.target.first.flatMap { model.logs[$0] } ?? model.log
        let babyName = model.targetBabies.first?.name ?? model.household.babyName
        let pack = log.doctorVisitPack(household: model.household)
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Feeds / day (7d)", value: String(format: "%.1f", pack.feedsPerDay7d))
                    if pack.bottleMlPerDay7d > 0 {
                        LabeledContent("Bottle / day (7d)", value: "\(Int(pack.bottleMlPerDay7d)) ml")
                    }
                    LabeledContent("Diapers / day (7d)", value: String(format: "%.1f wet · %.1f dirty", pack.wetDiapersPerDay7d, pack.dirtyDiapersPerDay7d))
                    if let w = pack.latestWeightGrams {
                        let deltaText = pack.weightDeltaGrams.map { d in
                            let sign = d >= 0 ? "+" : ""
                            return " (\(sign)\(Int(d)) g)"
                        } ?? ""
                        LabeledContent("Weight", value: String(format: "%.2f kg%@", w / 1000, deltaText))
                    }
                    if let h = pack.latestHeightCm {
                        LabeledContent("Height", value: String(format: "%.1f cm", h))
                    }
                    if let hc = pack.latestHeadCm {
                        LabeledContent("Head", value: String(format: "%.1f cm", hc))
                    }
                    Button {
                        UIPasteboard.general.string = pack.plainTextSummary(babyName: babyName, household: model.household)
                        copied = true
                    } label: {
                        Label(copied ? "Copied fact sheet" : "Copy fact sheet", systemImage: copied ? "checkmark.circle.fill" : "doc.on.doc")
                    }
                } header: {
                    Text(pack.lastVisitAt.map { "Fact sheet since \($0.formatted(date: .abbreviated, time: .omitted))" } ?? "7-day fact sheet")
                }

                Section("Questions for the doctor (\(pack.questions.count))") {
                    ForEach(pack.questions) { q in
                        HStack {
                            Text(q.string("transcript") ?? "")
                            Spacer()
                            Button {
                                model.undo(q.id)
                            } label: {
                                Image(systemName: "checkmark.circle").foregroundStyle(.green)
                            }
                            .buttonStyle(.borderless)
                            .accessibilityLabel("Mark answered")
                        }
                    }
                    HStack {
                        TextField("Add a question to ask…", text: $newQuestion)
                        if !newQuestion.trimmingCharacters(in: .whitespaces).isEmpty {
                            Button("Add") {
                                let text = newQuestion.trimmingCharacters(in: .whitespacesAndNewlines)
                                model.log("note", ["transcript": .string(text), "for_doctor": .bool(true)])
                                newQuestion = ""
                            }
                        }
                    }
                }

                if !pack.healthEvents.isEmpty {
                    Section("Health entries since last visit") {
                        ForEach(pack.healthEvents.suffix(5).reversed()) { e in
                            HStack {
                                Text(VoiceInterpreter.label(type: e.type, fields: e.fields))
                                Spacer()
                                Text(e.occurredAt.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section("Log today's visit") {
                    TextField("Visit notes (optional)", text: $visitNotes)
                    DatePicker("When", selection: $at, in: ...Date())
                }
            }
            .navigationTitle("Doctor visit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Log visit") {
                        var f: [String: FieldValue] = [:]
                        let clean = visitNotes.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !clean.isEmpty { f["notes"] = .string(clean) }
                        model.log("doctor_visit", f, at: at)
                        dismiss()
                    }
                    .accessibilityIdentifier("doctorVisitLog")
                }
            }
        }
    }
}
