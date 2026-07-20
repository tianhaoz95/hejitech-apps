import ContempoCore
import SwiftUI
import WidgetKit

/// The hours-progress complication — watchOS's WidgetKit equivalent of
/// Android Wear's `SHORT_TEXT` complication (`ProgressTileService`'s sibling
/// on that platform). Reads `HoursProgressStore` (written by the watch app
/// via an App Group — see that type's doc comment) rather than querying
/// Firestore itself: a widget extension's timeline provider runs on its own
/// refresh schedule, not continuously, so it reads whatever the app last
/// computed rather than re-fetching over the network on every timeline reload.
struct HoursComplicationEntry: TimelineEntry {
    let date: Date
    let confirmedHours: Double
}

struct HoursComplicationProvider: TimelineProvider {
    private let store = HoursProgressStore(appGroupId: "group.com.hejitech.contempo")

    func placeholder(in context: Context) -> HoursComplicationEntry {
        HoursComplicationEntry(date: Date(), confirmedHours: 0)
    }

    func getSnapshot(in context: Context, completion: @escaping (HoursComplicationEntry) -> Void) {
        completion(HoursComplicationEntry(date: Date(), confirmedHours: store.read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HoursComplicationEntry>) -> Void) {
        let entry = HoursComplicationEntry(date: Date(), confirmedHours: store.read())
        // No further reloads scheduled here — the watch app itself calls
        // `WidgetCenter.shared.reloadTimelines` whenever it refreshes
        // `confirmedHours`, which is the actual trigger for new data.
        completion(Timeline(entries: [entry], policy: .never))
    }
}

struct HoursComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HoursComplication", provider: HoursComplicationProvider()) { entry in
            HoursComplicationView(entry: entry)
        }
        .configurationDisplayName("Hours progress")
        .description("Confirmed hours toward the \(MaterialParticipationTest.name) test.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

private struct HoursComplicationView: View {
    let entry: HoursComplicationEntry
    @Environment(\.widgetFamily) private var family

    private var hoursText: String {
        entry.confirmedHours.formatted(.number.precision(.fractionLength(1)))
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: min(1, entry.confirmedHours / Double(MaterialParticipationTest.thresholdHours))) {
                Text("hrs")
            } currentValueLabel: {
                Text(hoursText)
            }
            .gaugeStyle(.accessoryCircular)
        case .accessoryInline:
            Text("\(hoursText) / \(MaterialParticipationTest.thresholdHours) hrs")
        default:
            VStack(alignment: .leading) {
                Text("\(hoursText) / \(MaterialParticipationTest.thresholdHours) hrs")
                    .font(.headline)
                Text(MaterialParticipationTest.name + " test")
                    .font(.caption2)
            }
        }
    }
}
