import HeadwayKit
import SwiftUI

/// The Commute tab: morning and evening legs, the switch time, days and which alerts to send.
/// Saved through the Worker (the same checks as the web settings page).
struct CommuteView: View {
    @Environment(AppModel.self) private var model
    @State private var draft = Settings.defaults
    @State private var saved = false

    var body: some View {
        NavigationStack {
            Form {
                LegSection(title: "Morning", leg: $draft.morning, make: Leg.morning)
                LegSection(title: "Evening", leg: $draft.evening, make: Leg.evening)
                Section {
                    TimeField(title: "Switch to evening at", hhmm: $draft.switchAt)
                    DaysRow(days: $draft.days)
                } footer: {
                    Text("Before the switch time the glasses and the Trains tab open on your morning trains, after it on your evening ones. Commute alerts come only on these days.")
                }
                AlertsSection(alerts: $draft.alerts)
                Section {
                    HStack {
                        Text("Display name")
                        Spacer()
                        TextField("Optional (e.g. Alex)", text: Binding(
                            get: { draft.shareName ?? "" },
                            set: { draft.shareName = $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : String($0.prefix(20)) }
                        ))
                        .multilineTextAlignment(.trailing)
                    }
                } header: {
                    Text("Live ETA Sharing")
                } footer: {
                    Text("Shown on the live ETA web page when you share your ride with friends or family.")
                }
                if let e = model.error { Text(e).foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("Commute")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(saved ? "Saved" : "Save") {
                        Task {
                            saved = await model.save(draft)
                            if saved, draft.alerts.anyOn, model.notificationsAllowed == nil { await model.requestNotifications() }
                        }
                    }
                    .disabled(draft == model.settings && model.settingsSaved)
                }
            }
            .onAppear { draft = model.settings; saved = false }
            .onChange(of: draft) { saved = false }
        }
    }
}

extension AlertSettings {
    var anyOn: Bool { delay || cancellation || service || leaveNow || arrival }
}

struct LegSection: View {
    @Environment(AppModel.self) private var model
    let title: String
    @Binding var leg: Leg?
    let make: (String, String) -> Leg

    var body: some View {
        Section {
            Toggle(title, isOn: Binding(get: { leg != nil }, set: { on in
                if on {
                    // A sensible start: the other leg reversed, or Mountain View ⇄ SF.
                    leg = title == "Morning" ? make("mountain_view", "san_francisco") : make("san_francisco", "mountain_view")
                } else { leg = nil }
            }))
            .font(.headline)
            if let current = leg {
                let bind = Binding(get: { leg ?? current }, set: { leg = $0 })
                StationPickerRow(title: "From", selection: bind.from)
                StationPickerRow(title: "To", selection: bind.to)
                Picker("Train preference", selection: bind.expressPreference) {
                    ForEach(ExpressPreference.allCases, id: \.self) { pref in
                        Text(pref.title).tag(pref)
                    }
                }
                Toggle("Usual train", isOn: Binding(get: { current.usual != nil }, set: { leg?.usual = $0 ? (title == "Morning" ? "08:00" : "17:30") : nil }))
                if current.usual != nil {
                    TimeField(title: "At or after", hhmm: Binding(get: { leg?.usual ?? "08:00" }, set: { leg?.usual = $0 }))
                }
                Stepper("Walk to the station: \(current.walkMinutes) min", value: bind.walkMinutes, in: 0...90)
                TimeField(title: "Watch from", hhmm: bind.window.start)
                TimeField(title: "Until", hhmm: bind.window.end)
                if current.from == current.to { Text("Pick two different stations.").foregroundStyle(.red).font(.footnote) }
            }
        } footer: {
            if leg != nil {
                Text("Train preference lets you prefer or only take faster Caltrain express trains. The leave-now reminder targets the first matching train at or after your usual time. Alerts only come inside the watch window.")
            }
        }
    }
}

/// An "HH:MM" string edited with a time picker (Pacific wall-clock time, no date).
struct TimeField: View {
    let title: String
    @Binding var hhmm: String

    private static let calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = Clock.pacific
        return c
    }()

    var body: some View {
        DatePicker(title, selection: Binding(get: {
            let m = Clock.minutes(hhmm) ?? 0
            return Self.calendar.date(bySettingHour: m / 60, minute: m % 60, second: 0, of: Date()) ?? Date()
        }, set: { d in
            let c = Self.calendar.dateComponents([.hour, .minute], from: d)
            hhmm = Clock.hhmm((c.hour ?? 0) * 60 + (c.minute ?? 0))
        }), displayedComponents: .hourAndMinute)
        .environment(\.timeZone, Clock.pacific)
    }
}

struct DaysRow: View {
    @Binding var days: [Int]
    private let names = ["M", "T", "W", "T", "F", "S", "S"]
    private let full = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    var body: some View {
        HStack {
            ForEach(0..<7, id: \.self) { i in
                let on = days.contains(i)
                Button(names[i]) {
                    if on { days.removeAll { $0 == i } } else { days = (days + [i]).sorted() }
                }
                .buttonStyle(.bordered)
                .tint(on ? .accentColor : .secondary)
                .accessibilityLabel(full[i])
                .accessibilityValue(on ? "on" : "off")
            }
        }
    }
}

struct AlertsSection: View {
    @Binding var alerts: AlertSettings

    var body: some View {
        Section {
            Toggle("Delays", isOn: $alerts.delay)
            if alerts.delay { Stepper("At least \(alerts.delayThreshold) min late", value: $alerts.delayThreshold, in: 1...60) }
            Toggle("Cancellations", isOn: $alerts.cancellation)
            Toggle("Caltrain service alerts", isOn: $alerts.service)
            Toggle("Faster train alerts", isOn: $alerts.betterTrain)
            Toggle("Leave-now reminder", isOn: $alerts.leaveNow)
            Toggle("Before my stop", isOn: $alerts.arrival)
            if alerts.arrival { Stepper("\(alerts.arrivalMinutes) min before arriving", value: $alerts.arrivalMinutes, in: 1...60) }
        } header: {
            Text("Alerts")
        } footer: {
            Text("\"Faster train alerts\" tells you when a later express reaches your destination first. \"Before my stop\" follows the train you track (here or with a long press on the R1 ring), any day.")
        }
    }
}
