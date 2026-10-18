import LogCore
import SwiftUI

struct TimelineView: View {
    @EnvironmentObject var model: AppModel
    @State private var editing: LogEvent?
    @State private var showUndone = false

    private var days: [(Date, [LogEvent])] {
        let events = model.log.all
            .filter { !SystemType.all.contains($0.type) || $0.type == SystemType.note }
            .filter { showUndone || model.log.status[$0.id] != .undone }
            .filter { model.log.status[$0.id] != .superseded }
            .sorted { $0.occurredAt > $1.occurredAt }
        let groups = Dictionary(grouping: events) { Calendar.current.startOfDay(for: $0.occurredAt) }
        return groups.keys.sorted(by: >).map { ($0, groups[$0]!) }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(days, id: \.0) { day, events in
                    Section(day.formatted(date: .complete, time: .omitted)) {
                        ForEach(events) { e in
                            EventRow(event: e, status: model.log.status[e.id] ?? .active, who: model.household.caregiverName(e.loggedBy),
                                     ml: model.household.milliliters(e))
                                .contentShape(Rectangle())
                                .onTapGesture { editing = e }
                                .swipeActions {
                                    if model.log.status[e.id] != .undone {
                                        Button("Undo", role: .destructive) { model.undo(e.id) }
                                    }
                                }
                        }
                    }
                }
            }
            .overlay {
                if days.isEmpty {
                    ContentUnavailableView {
                        Label("Nothing logged yet", systemImage: "list.bullet.rectangle")
                    } description: {
                        Text(showUndone
                             ? "There are no entries, undone or not."
                             : "Feeds, diapers, sleep and measurements show up here as soon as they're logged: hold the mic and say it, or tap a button on Now.")
                    }
                }
            }
            .navigationTitle("Timeline")
            .toolbar {
                Toggle(isOn: $showUndone) { Image(systemName: "arrow.uturn.backward.circle") }
                    .toggleStyle(.button)
                    .accessibilityLabel("Show undone entries")
            }
            .sheet(item: $editing) { e in EditEventView(event: e) }
        }
    }
}

struct EventRow: View {
    let event: LogEvent
    let status: EventStatus
    let who: String
    let ml: Double?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: Theme.icon(for: event.type))
                .foregroundStyle(Theme.color(for: event.type))
                .frame(width: 28, height: 28)
                .background(Theme.color(for: event.type).opacity(0.15), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(event.type == "note" ? "Note" : VoiceInterpreter.label(type: event.type, fields: event.fields))
                        .strikethrough(status == .undone)
                    if let ml, event.type.hasPrefix("feed.bottle") { Text("\(Int(ml)) ml").foregroundStyle(.secondary) }
                }
                if let t = event.provenance.rawTranscript {
                    Text("“\(t)”").font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
                HStack(spacing: 6) {
                    Text(event.occurredAt.formatted(date: .omitted, time: .shortened))
                    Text("·")
                    Text(who)
                    Text("·")
                    Image(systemName: Self.surfaceIcon(event.provenance.surface))
                    if let tier = event.provenance.confidenceTier { Text(tier.rawValue.replacingOccurrences(of: "_", with: " ")) }
                    if status == .duplicateUnresolved { Text("duplicate?").foregroundStyle(.orange) }
                    if status == .undone { Text("undone").foregroundStyle(.red) }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
        }
        .opacity(status == .undone || status == .merged ? 0.5 : 1)
    }

    static func surfaceIcon(_ s: Surface) -> String {
        switch s {
        case .phone: return "iphone"
        case .watch: return "applewatch"
        case .glasses: return "eyeglasses"
        case .ring: return "circle.circle"
        case .mcp: return "sparkles"
        case .widget: return "square.grid.2x2"
        case .siri: return "waveform"
        }
    }
}

struct EditEventView: View {
    /// Growth entries edit their one number (stored in grams or centimeters).
    static let measureField = ["weight": "grams", "height": "height_cm", "head": "head_cm"]
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let event: LogEvent
    @State private var at = Date()
    @State private var fraction = 0.5
    @State private var kind = "wet"
    @State private var side = "left"
    @State private var measure = ""

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("When", selection: $at)
                if event.type == "feed.bottle.finish" || event.type == "feed.bottle.single" {
                    Picker("Drank", selection: $fraction) {
                        Text("¼").tag(0.25); Text("½").tag(0.5); Text("¾").tag(0.75); Text("All").tag(1.0)
                    }
                    .pickerStyle(.segmented)
                }
                if event.type == "diaper" {
                    Picker("Kind", selection: $kind) { ForEach(["wet", "dirty", "both", "dry"], id: \.self) { Text($0) } }
                        .pickerStyle(.segmented)
                }
                if event.fields["side"] != nil {
                    Picker("Side", selection: $side) { Text("Left").tag("left"); Text("Right").tag("right") }.pickerStyle(.segmented)
                }
                if let field = Self.measureField[event.type] {
                    LabeledContent(field == "grams" ? "Weight" : "Length") {
                        HStack(spacing: 6) {
                            TextField("—", text: $measure)
                                .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                            Text(field == "grams" ? "kg" : "cm").foregroundStyle(.secondary)
                        }
                    }
                }
                Section("Provenance") {
                    LabeledContent("Logged by", value: model.household.caregiverName(event.loggedBy))
                    LabeledContent("From", value: "\(event.provenance.surface.rawValue) · \(event.provenance.input.rawValue)")
                    if let m = event.provenance.modelVersion { LabeledContent("Model", value: m) }
                    ForEach(event.provenance.confidence.sorted(by: { $0.key < $1.key }), id: \.key) { k, v in
                        LabeledContent(k, value: String(format: "%.0f%%", v * 100))
                    }
                }
                Section {
                    Button("Undo this entry", role: .destructive) { model.undo(event.id); dismiss() }
                }
            }
            .navigationTitle(VoiceInterpreter.label(type: event.type, fields: [:]))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        var f = event.fields
                        if f["consumed_fraction"] != nil || event.type.hasPrefix("feed.bottle.finish") || event.type == "feed.bottle.single" {
                            f["consumed_fraction"] = .number(fraction)
                            f["consumed_ml"] = nil
                        }
                        if event.type == "diaper" { f["kind"] = .string(kind) }
                        if f["side"] != nil { f["side"] = .string(side) }
                        if let field = Self.measureField[event.type], let m = Growth.number(measure), m > 0 {
                            f[field] = .number(field == "grams" ? (m * 1000).rounded() : (m * 10).rounded() / 10)
                        }
                        model.edit(event, fields: f, at: at)
                        dismiss()
                    }
                }
            }
            .onAppear {
                at = event.occurredAt
                fraction = event.number("consumed_fraction") ?? 0.5
                kind = event.string("kind") ?? "wet"
                side = event.string("side") ?? "left"
                if let field = Self.measureField[event.type], let v = event.number(field) {
                    measure = (field == "grams" ? v / 1000 : v).formatted(.number.precision(.fractionLength(0...2)).grouping(.never))
                }
            }
        }
    }
}
