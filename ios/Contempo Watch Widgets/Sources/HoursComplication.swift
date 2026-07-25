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
    let isTimerRunning: Bool
    let elapsedSeconds: Int
    let taskName: String
}

struct HoursComplicationProvider: TimelineProvider {
    private let store = HoursProgressStore(appGroupId: "group.com.hejitech.contempoapp")
    private let timerStore = WatchWorkTimerStore(appGroupId: "group.com.hejitech.contempoapp")

    func placeholder(in context: Context) -> HoursComplicationEntry {
        HoursComplicationEntry(
            date: Date(),
            confirmedHours: 0,
            isTimerRunning: false,
            elapsedSeconds: 0,
            taskName: ""
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (HoursComplicationEntry) -> Void) {
        completion(createEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HoursComplicationEntry>) -> Void) {
        completion(Timeline(entries: [createEntry()], policy: .never))
    }

    private func createEntry() -> HoursComplicationEntry {
        HoursComplicationEntry(
            date: Date(),
            confirmedHours: store.read(),
            isTimerRunning: timerStore.isTimerRunning(),
            elapsedSeconds: timerStore.elapsedSeconds(),
            taskName: timerStore.currentTask()
        )
    }
}

struct HoursComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HoursComplication", provider: HoursComplicationProvider()) { entry in
            HoursComplicationView(entry: entry)
        }
        .configurationDisplayName("Hours & Work Timer")
        .description("Confirmed hours & active work session for \(MaterialParticipationTest.name).")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

private struct HoursComplicationView: View {
    let entry: HoursComplicationEntry
    @Environment(\.widgetFamily) private var family

    private var hoursText: String {
        entry.confirmedHours.formatted(.number.precision(.fractionLength(1)))
    }

    private var elapsedMinutesText: String {
        let mins = entry.elapsedSeconds / 60
        return "\(mins)m"
    }

    var body: some View {
        if entry.isTimerRunning {
            switch family {
            case .accessoryCircular:
                VStack(spacing: 0) {
                    Image(systemName: "stopwatch.fill")
                        .font(.system(size: 14))
                    Text(elapsedMinutesText)
                        .font(.system(size: 11, weight: .bold))
                }
            case .accessoryInline:
                Text("⏱️ WORKING: \(elapsedMinutesText)")
            default:
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 6, height: 6)
                        Text("WORK IN PROGRESS")
                            .font(.system(size: 10, weight: .bold))
                    }
                    Text(entry.taskName)
                        .font(.caption2)
                        .lineLimit(1)
                    Text("Elapsed: \(elapsedMinutesText)")
                        .font(.caption)
                        .bold()
                }
            }
        } else {
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
}
