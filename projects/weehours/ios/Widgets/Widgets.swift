import ActivityKit
import AppIntents
import LogCore
import SwiftUI
import WidgetKit

@main
struct WeeHoursWidgets: WidgetBundle {
    var body: some Widget {
        StatusWidget()
        SessionLiveActivity()
    }
}

struct StatusEntry: TimelineEntry {
    let date: Date
    let snapshot: StatusSnapshot?
    let babyName: String
}

struct StatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> StatusEntry { StatusEntry(date: Date(), snapshot: nil, babyName: "Baby") }

    func getSnapshot(in context: Context, completion: @escaping (StatusEntry) -> Void) {
        completion(StatusEntry(date: Date(), snapshot: SharedStore.snapshot, babyName: SharedStore.household?.babyName ?? "Baby"))
    }

    /// The line is relative ("2h40m ago"), so redraw every 5 minutes for the next 2 hours.
    func getTimeline(in context: Context, completion: @escaping (Timeline<StatusEntry>) -> Void) {
        let s = SharedStore.snapshot
        let name = SharedStore.household?.babyName ?? "Baby"
        let entries = (0..<24).map { StatusEntry(date: Date().addingTimeInterval(Double($0) * 300), snapshot: s, babyName: name) }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct StatusWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "status", provider: StatusProvider()) { entry in
            StatusWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color(red: 0.11, green: 0.10, blue: 0.22) }
        }
        .configurationDisplayName("What's next")
        .description("Time since the last feed, next side and last diaper, with one-tap logging.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

struct StatusWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: StatusEntry

    var line: String { entry.snapshot?.line(now: entry.date) ?? "Open the app to set up" }

    var body: some View {
        switch family {
        case .accessoryInline:
            Text(line)
        case .accessoryCircular:
            if let fed = entry.snapshot?.lastFeedAt {
                VStack(spacing: 0) {
                    Image(systemName: "drop.fill")
                    Text(StatusSnapshot.duration(entry.date.timeIntervalSince(fed))).font(.caption2.bold())
                }
            } else {
                Image(systemName: "moon.stars.fill")
            }
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text(entry.babyName).font(.headline)
                Text(line).font(.caption).lineLimit(3)
            }
        case .systemMedium:
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.babyName).font(.caption).foregroundStyle(.white.opacity(0.7))
                    Text(line).font(.headline).foregroundStyle(.white).lineLimit(4)
                    Spacer()
                }
                VStack(spacing: 8) {
                    Button(intent: ToggleFeedIntent()) {
                        Label(entry.snapshot?.openFeedKind == nil ? "Feed" : "Finish", systemImage: "drop.fill").frame(maxWidth: .infinity)
                    }
                    Button(intent: LogDiaperIntent(kind: .wet)) { Label("Wet", systemImage: "humidity.fill").frame(maxWidth: .infinity) }
                    Button(intent: LogDiaperIntent(kind: .dirty)) { Label("Dirty", systemImage: "humidity").frame(maxWidth: .infinity) }
                }
                .font(.caption.bold())
                .tint(Color(red: 0.95, green: 0.62, blue: 0.40))
                .frame(width: 104)
            }
        default:
            VStack(alignment: .leading, spacing: 6) {
                Text(entry.babyName).font(.caption).foregroundStyle(.white.opacity(0.7))
                Text(line).font(.subheadline.bold()).foregroundStyle(.white).lineLimit(4)
                Spacer()
                Button(intent: ToggleFeedIntent()) {
                    Label(entry.snapshot?.openFeedKind == nil ? "Feed" : "Finish", systemImage: "drop.fill").frame(maxWidth: .infinity)
                }
                .font(.caption.bold())
                .tint(Color(red: 0.95, green: 0.62, blue: 0.40))
            }
        }
    }
}

/// Lock screen and Dynamic Island while a feed or sleep is in progress, with one-tap finish.
struct SessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: SessionActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: icon(context.state.kind))
                    Text(title(context.state)).font(.headline)
                    Spacer()
                    Text(context.state.since, style: .timer).font(.title3.monospacedDigit().bold())
                }
                HStack {
                    if context.state.kind == "sleep" {
                        Button(intent: ToggleSleepIntent()) { Text("Woke up").frame(maxWidth: .infinity) }
                    } else {
                        if context.state.kind == "breast" {
                            Button(intent: SwitchSideIntent()) { Text("Switch side").frame(maxWidth: .infinity) }
                        }
                        Button(intent: ToggleFeedIntent()) { Text("Finish").frame(maxWidth: .infinity) }
                    }
                }
                .tint(Color(red: 0.95, green: 0.62, blue: 0.40))
            }
            .padding()
            .activityBackgroundTint(Color(red: 0.11, green: 0.10, blue: 0.22))
            .activitySystemActionForegroundColor(.white)
            .foregroundStyle(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: icon(context.state.kind)) }
                DynamicIslandExpandedRegion(.trailing) { Text(context.state.since, style: .timer).monospacedDigit() }
                DynamicIslandExpandedRegion(.bottom) {
                    if context.state.kind == "sleep" {
                        Button(intent: ToggleSleepIntent()) { Text("Woke up") }
                    } else {
                        Button(intent: ToggleFeedIntent()) { Text("Finish") }
                    }
                }
            } compactLeading: {
                Image(systemName: icon(context.state.kind))
            } compactTrailing: {
                Text(context.state.since, style: .timer).monospacedDigit().frame(width: 44)
            } minimal: {
                Image(systemName: icon(context.state.kind))
            }
        }
    }

    func icon(_ kind: String) -> String {
        kind == "sleep" ? "moon.zzz.fill" : kind == "breast" ? "heart.fill" : "waterbottle.fill"
    }

    func title(_ s: SessionActivityAttributes.ContentState) -> String {
        switch s.kind {
        case "sleep": return "Sleeping"
        case "breast": return "Nursing" + (s.side.map { " · \($0) next" } ?? "")
        default: return "Bottle"
        }
    }
}
