import LogCore
import SwiftUI

/// Which screen the watch app opens on: today's buttons, or tilt mode (tilt to an action, hold,
/// double pinch). Per iPhone; the paired watch reads it from the application context.
enum WatchStartMode: String, CaseIterable, Identifiable {
    case buttons, tilt
    static let key = "watchStartMode"
    var id: String { rawValue }
    var title: String { self == .buttons ? "Buttons" : "Tilt" }
}

/// What each tilt direction logs on the watch (Settings → Apple Watch), per iPhone.
enum WatchCompassSettings {
    static func key(_ d: TiltCompass.Direction) -> String { "watchCompass.\(d.rawValue)" }

    /// The saved choice (empty: nothing there), else the default layout. A choice the household
    /// stopped tracking leaves the direction empty.
    static func assignment(_ d: TiltCompass.Direction, choices: [String]) -> String {
        guard let saved = UserDefaults.standard.string(forKey: key(d)) else { return TiltCompass.defaultAssignment(d, choices: choices) }
        return saved.isEmpty || choices.contains(saved) ? saved : ""
    }

    static func label(_ id: String) -> String {
        switch id {
        case "feed": "Feed"
        case "diaper": "Diaper"
        case "sleep": "Sleep"
        default: EventRegistry.shared.type(id)?.label ?? id
        }
    }

    static func icon(_ id: String) -> String {
        switch id {
        case "feed": "drop.fill"
        case "diaper": "humidity.fill"
        case "sleep": "moon.zzz.fill"
        default: EventRegistry.shared.type(id)?.icon ?? "circle.fill"
        }
    }

    static func color(_ id: String) -> Color {
        switch id {
        case "feed": Theme.feed
        case "diaper": Theme.diaper
        case "sleep": Theme.sleep
        default: Theme.other
        }
    }

    /// The layout as the watch gets it. Feed and sleep take their label from the child's state on
    /// the watch (Start feed / Finish feed); a running timed activity becomes "Stop …".
    @MainActor
    static func slots(enabled: Set<String>, log: DerivedLog) -> [TiltCompass.Slot] {
        let choices = TiltCompass.choices(enabled: enabled)
        return TiltCompass.Direction.allCases.compactMap { d in
            let id = assignment(d, choices: choices)
            guard !id.isEmpty else { return nil }
            if ["feed", "diaper", "sleep"].contains(id) {
                return TiltCompass.Slot(direction: d, action: id, label: label(id), icon: icon(id))
            }
            let running = log.effective.last { $0.type == id && $0.fields["ongoing"] == .bool(true) }
            return TiltCompass.Slot(direction: d, action: "care", type: id,
                                    label: running != nil ? "Stop \(label(id).lowercased())" : label(id), icon: icon(id),
                                    runningId: running?.id.uuidString ?? "")
        }
    }
}

struct WatchSettingsView: View {
    @EnvironmentObject var model: AppModel
    @AppStorage(WatchStartMode.key) private var startMode = WatchStartMode.buttons
    @State private var layout: [TiltCompass.Direction: String] = [:]

    private var choices: [String] { TiltCompass.choices(enabled: model.household.enabled) }

    var body: some View {
        Form {
            Section {
                Picker("Opens in", selection: $startMode) {
                    ForEach(WatchStartMode.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
                .accessibilityIdentifier("watchStartMode")
            } header: { Text("Watch app opens in") } footer: {
                Text("Tilt mode logs with the arm wearing the watch, while the other one holds the baby: tilt your wrist so the ball rolls into an action, hold it there for a second, then double pinch your thumb and index finger. Either screen has a button to switch to the other.")
            }
            Section {
                CompassPreview(layout: layout)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                ForEach(TiltCompass.Direction.allCases) { d in
                    Picker(d.gesture, selection: binding(d)) {
                        Text("Nothing").tag("")
                        ForEach(choices, id: \.self) { Label(WatchCompassSettings.label($0), systemImage: WatchCompassSettings.icon($0)).tag($0) }
                    }
                    .accessibilityIdentifier("watchCompass-\(d.rawValue)")
                }
            } header: { Text("Tilt directions") } footer: {
                Text("A diaper or a bottle logged this way doesn't ask anything on the watch: its kind or amount waits on Now under Needs details. Double pinch needs Apple Watch Series 9, Ultra 2 or later; on other watches, tap Log.")
            }
        }
        .navigationTitle("Apple Watch")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear(perform: load)
        .onChange(of: startMode) { push() }
    }

    private func load() {
        layout = Dictionary(uniqueKeysWithValues: TiltCompass.Direction.allCases.map { ($0, WatchCompassSettings.assignment($0, choices: choices)) })
    }

    private func binding(_ d: TiltCompass.Direction) -> Binding<String> {
        Binding(get: { layout[d] ?? "" }, set: { id in
            // one action per direction: taking it here clears it where it was
            for other in TiltCompass.Direction.allCases where other != d && layout[other] == id && !id.isEmpty {
                layout[other] = ""
                UserDefaults.standard.set("", forKey: WatchCompassSettings.key(other))
            }
            layout[d] = id
            UserDefaults.standard.set(id, forKey: WatchCompassSettings.key(d))
            push()
        })
    }

    /// The watch learns about it with the next application context.
    private func push() { Task { await model.refresh() } }
}

/// The four directions as the watch shows them, so the pickers below read as a map.
private struct CompassPreview: View {
    let layout: [TiltCompass.Direction: String]

    var body: some View {
        ZStack {
            Circle().strokeBorder(.quaternary, lineWidth: 6).frame(width: 180, height: 180)
            Circle().strokeBorder(.tertiary, style: StrokeStyle(lineWidth: 1.5, dash: [3, 3])).frame(width: 30, height: 30)
            chip(.north).offset(y: -90)
            chip(.south).offset(y: 90)
            chip(.east).offset(x: 96)
            chip(.west).offset(x: -96)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 230)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private func chip(_ d: TiltCompass.Direction) -> some View {
        let id = layout[d] ?? ""
        if id.isEmpty {
            Text("Nothing").font(.subheadline).foregroundStyle(.secondary)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(Color(.secondarySystemGroupedBackground), in: Capsule())
        } else {
            let color = WatchCompassSettings.color(id)
            Label(WatchCompassSettings.label(id), systemImage: WatchCompassSettings.icon(id))
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .foregroundStyle(color)
                .background(color.opacity(0.18), in: Capsule())
                .background(Color(.secondarySystemGroupedBackground), in: Capsule())
        }
    }
}

/// Entries logged blind from the watch's tilt mode that still miss an answer: a diaper's kind, how
/// much of a bottle went down. Answering edits the entry without the flag.
struct NeedsDetailsCard: View {
    @EnvironmentObject var model: AppModel
    let entries: [LogEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Needs details", systemImage: "applewatch").font(.subheadline.weight(.semibold))
            ForEach(entries) { e in
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(title(e)).font(.subheadline)
                        Spacer()
                        Text(e.occurredAt.formatted(date: .omitted, time: .shortened)).font(.caption).foregroundStyle(.secondary)
                    }
                    HStack(spacing: 6) {
                        ForEach(answers(e), id: \.label) { a in
                            Button { answer(e, a.fields) } label: { Text(a.label).lineLimit(1).frame(maxWidth: .infinity) }
                                .buttonStyle(.bordered)
                                .buttonBorderShape(.capsule)
                                .tint(e.type == "diaper" ? Theme.diaper : Theme.feed)
                        }
                    }
                    .controlSize(.small)
                }
                .accessibilityIdentifier("needsDetails-\(e.type)")
            }
        }
        .padding()
        .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 18))
    }

    private func title(_ e: LogEvent) -> String {
        let what = e.type == "diaper" ? "Diaper · what kind?" : "Bottle · how much went down?"
        return model.household.active.count > 1 ? "\(model.household.babyName(e.babyId)) · \(what)" : what
    }

    private func answers(_ e: LogEvent) -> [(label: String, fields: [String: FieldValue])] {
        if e.type == "diaper" {
            return ["wet", "dirty", "both", "dry"].map { ($0.capitalized, ["kind": .string($0)]) }
        }
        return [(0.25, "¼"), (0.5, "½"), (0.75, "¾"), (1.0, "All")].map { ($0.1, ["consumed_fraction": .number($0.0)]) }
            + [("Not sure", [:])]
    }

    private func answer(_ e: LogEvent, _ fields: [String: FieldValue]) {
        var f = e.fields.merging(fields) { $1 }
        f[LogEvent.needsDetails] = nil
        model.edit(e, fields: f, at: e.occurredAt)
    }
}
