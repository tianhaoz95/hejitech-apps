import ActivityKit
import AppIntents
import LogCore
import SwiftUI
import WidgetKit

@main
struct WeeHoursWidgets: WidgetBundle {
    var body: some Widget {
        StatusWidget()
        EveryoneWidget()
        SpeakWidget()
        SpeakControl()
        SessionLiveActivity()
    }
}

struct StatusEntry: TimelineEntry {
    let date: Date
    let snapshot: StatusSnapshot?
    let babyName: String
    /// The child the widget's buttons log for (nil: the first shown child).
    var child: ChildEntity? = nil
}

/// Which child a "What's next" widget follows (long-press → Edit Widget).
struct ChildWidgetIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Child"
    static let description = IntentDescription("The child this widget shows and logs for.")
    @Parameter(title: "Child") var child: ChildEntity?
}

struct StatusProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> StatusEntry { StatusEntry(date: Date(), snapshot: nil, babyName: "Baby") }

    func snapshot(for configuration: ChildWidgetIntent, in context: Context) async -> StatusEntry {
        entry(configuration, at: Date())
    }

    /// The line is relative ("2h40m ago"), so redraw every 5 minutes for the next 2 hours.
    func timeline(for configuration: ChildWidgetIntent, in context: Context) async -> Timeline<StatusEntry> {
        Timeline(entries: (0..<24).map { entry(configuration, at: Date().addingTimeInterval(Double($0) * 300)) }, policy: .atEnd)
    }

    private func entry(_ configuration: ChildWidgetIntent, at date: Date) -> StatusEntry {
        guard let h = SharedStore.household else { return StatusEntry(date: date, snapshot: nil, babyName: "Baby") }
        let baby = configuration.child.flatMap { c in h.babies.first { $0.id == c.id } } ?? SharedStore.shown(h).first ?? h.firstBaby
        return StatusEntry(date: date, snapshot: SharedStore.snapshots[baby.id] ?? (baby.id == h.babyId ? SharedStore.snapshot : nil),
                           babyName: baby.name, child: ChildEntity(baby))
    }
}

struct StatusWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "status", intent: ChildWidgetIntent.self, provider: StatusProvider()) { entry in
            StatusWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color(red: 0.11, green: 0.10, blue: 0.22) }
        }
        .configurationDisplayName("What's next")
        .description("Time since the last feed, next side and last diaper, with one-tap logging. Edit the widget to pick a child.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

// MARK: - Everyone (several children)

struct EveryoneEntry: TimelineEntry {
    let date: Date
    let children: [(name: String, line: String)]
}

struct EveryoneProvider: TimelineProvider {
    func placeholder(in context: Context) -> EveryoneEntry {
        EveryoneEntry(date: Date(), children: [("Mia", "Fed 1h20m ago · left next"), ("Leo", "Sleeping 35m")])
    }

    func getSnapshot(in context: Context, completion: @escaping (EveryoneEntry) -> Void) { completion(entry(at: Date())) }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EveryoneEntry>) -> Void) {
        completion(Timeline(entries: (0..<24).map { entry(at: Date().addingTimeInterval(Double($0) * 300)) }, policy: .atEnd))
    }

    private func entry(at date: Date) -> EveryoneEntry {
        guard let h = SharedStore.household else { return EveryoneEntry(date: date, children: []) }
        let all = SharedStore.snapshots
        return EveryoneEntry(date: date, children: SharedStore.shown(h).map { ($0.name, all[$0.id]?.line(now: date) ?? "Open the app") })
    }
}

/// Every shown child's line in one widget, for families with twins or siblings.
struct EveryoneWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "everyone", provider: EveryoneProvider()) { entry in
            VStack(alignment: .leading, spacing: 8) {
                if entry.children.isEmpty { Text("Open the app to set up").foregroundStyle(.white) }
                ForEach(entry.children.prefix(4), id: \.name) { c in
                    VStack(alignment: .leading, spacing: 1) {
                        Text(c.name).font(.caption.bold()).foregroundStyle(.white.opacity(0.7))
                        Text(c.line).font(.subheadline.weight(.semibold)).foregroundStyle(.white).lineLimit(2)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .containerBackground(for: .widget) { Color(red: 0.11, green: 0.10, blue: 0.22) }
        }
        .configurationDisplayName("Everyone")
        .description("Every child's status line, for twins and siblings.")
        .supportedFamilies([.systemMedium, .systemLarge])
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
                    Button(intent: ToggleFeedIntent(child: entry.child)) {
                        Label(entry.snapshot?.openFeedKind == nil ? "Feed" : "Finish", systemImage: "drop.fill").frame(maxWidth: .infinity)
                    }
                    Button(intent: LogDiaperIntent(kind: .wet, child: entry.child)) { Label("Wet", systemImage: "humidity.fill").frame(maxWidth: .infinity) }
                    Button(intent: LogDiaperIntent(kind: .dirty, child: entry.child)) { Label("Dirty", systemImage: "humidity").frame(maxWidth: .infinity) }
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
                Button(intent: ToggleFeedIntent(child: entry.child)) {
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
            let child = Self.child(context.attributes)
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: icon(context.state.kind))
                    Text((context.attributes.babyName.isEmpty ? "" : context.attributes.babyName + " · ") + title(context.state)).font(.headline)
                    Spacer()
                    Text(context.state.since, style: .timer).font(.title3.monospacedDigit().bold())
                }
                Self.actions(context.state, child: child)
                    .tint(Color(red: 0.95, green: 0.62, blue: 0.40))
            }
            .padding()
            .activityBackgroundTint(Color(red: 0.11, green: 0.10, blue: 0.22))
            .activitySystemActionForegroundColor(.white)
            .foregroundStyle(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // what is being timed, for whom, and for how long
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(title(context.state)).font(.headline).lineLimit(1)
                            if !context.attributes.babyName.isEmpty {
                                Text(context.attributes.babyName).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    } icon: {
                        Image(systemName: icon(context.state.kind)).foregroundStyle(tint(context.state.kind))
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.since, style: .timer).font(.title2.monospacedDigit().bold())
                        .multilineTextAlignment(.trailing).frame(maxWidth: 90)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Self.actions(context.state, child: Self.child(context.attributes))
                        .tint(tint(context.state.kind))
                }
            } compactLeading: {
                Image(systemName: icon(context.state.kind)).foregroundStyle(tint(context.state.kind))
            } compactTrailing: {
                Text(context.state.since, style: .timer).monospacedDigit().frame(width: 44)
                    .foregroundStyle(tint(context.state.kind))
            } minimal: {
                Image(systemName: icon(context.state.kind)).foregroundStyle(tint(context.state.kind))
            }
            .keylineTint(tint(context.state.kind))
        }
    }

    /// One-tap actions without unlocking: wake; switch to the other side or finish nursing; or
    /// finish a bottle with how much was drunk.
    @ViewBuilder static func actions(_ s: SessionActivityAttributes.ContentState, child: ChildEntity?) -> some View {
        HStack(spacing: 6) {
            switch s.kind {
            case "sleep":
                Button(intent: ToggleSleepIntent(child: child)) { Text("Woke up").frame(maxWidth: .infinity) }
            case "breast":
                Button(intent: SwitchSideIntent(child: child)) {
                    Label("Switch to \(s.side ?? "other")", systemImage: "arrow.left.arrow.right").frame(maxWidth: .infinity)
                }
                Button(intent: ToggleFeedIntent(child: child)) { Text("Finish").frame(maxWidth: .infinity) }
            default:
                ForEach([(AmountOption.half, "½"), (.threeQuarters, "¾"), (.full, "All")], id: \.0) { amount, label in
                    Button(intent: FinishBottleIntent(amount: amount, child: child)) { Text(label).frame(maxWidth: .infinity) }
                }
                Button(intent: ToggleFeedIntent(child: child)) { Text("Done").frame(maxWidth: .infinity) }
            }
        }
        .font(.subheadline.weight(.semibold))
    }

    /// The activity's child (nil on activities from older builds: the first child).
    static func child(_ a: SessionActivityAttributes) -> ChildEntity? {
        guard let id = a.babyId.flatMap(UUID.init(uuidString:)), let b = SharedStore.household?.baby(id) else { return nil }
        return ChildEntity(b)
    }

    /// The app's colours: feeds warm orange, sleep lavender (Theme in the app).
    func tint(_ kind: String) -> Color {
        kind == "sleep" ? Color(red: 0.62, green: 0.58, blue: 0.95) : Color(red: 0.98, green: 0.70, blue: 0.45)
    }

    func icon(_ kind: String) -> String {
        kind == "sleep" ? "moon.zzz.fill" : kind == "breast" ? "heart.fill" : "waterbottle.fill"
    }

    func title(_ s: SessionActivityAttributes.ContentState) -> String {
        switch s.kind {
        case "sleep": return "Sleeping"
        // `side` is the side to switch to, so the baby is on the other one
        case "breast": return "Nursing" + (s.side.map { " · on \($0 == "left" ? "right" : "left")" } ?? "")
        default: return "Bottle · how much?"
        }
    }
}
