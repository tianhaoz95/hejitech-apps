import SwiftUI
import WidgetKit

/// Watch face complication: today's plan completion from the phone (via the watch app's shared
/// Keychain item). Tapping it opens the FitLoop watch app.
@main
struct FitLoopWatchWidgets: WidgetBundle {
    var body: some Widget { DayProgressComplication() }
}

struct DayProgressEntry: TimelineEntry {
    let date: Date
    /// nil: nothing from the phone for this day yet.
    let day: DayProgress?
}

struct DayProgressProvider: TimelineProvider {
    func placeholder(in context: Context) -> DayProgressEntry {
        DayProgressEntry(date: Date(), day: DayProgress(date: DayProgress.localDate(), completion: 0.6, workoutsDone: 1, workoutsTotal: 1, mealsDone: 2, mealsTotal: 4, next: "Dinner"))
    }

    func getSnapshot(in context: Context, completion: @escaping (DayProgressEntry) -> Void) {
        if context.isPreview { return completion(placeholder(in: context)) }
        completion(entry(at: Date()))
    }

    /// Today's progress now, and an empty day from midnight (the watch app reloads on every update).
    func getTimeline(in context: Context, completion: @escaping (Timeline<DayProgressEntry>) -> Void) {
        let now = Date()
        let midnight = Calendar.current.startOfDay(for: now).addingTimeInterval(86_400)
        let entries = [entry(at: now), DayProgressEntry(date: midnight, day: nil)]
        completion(Timeline(entries: entries, policy: .after(midnight.addingTimeInterval(60))))
    }

    private func entry(at date: Date) -> DayProgressEntry {
        let p = DayProgressStore.load()
        return DayProgressEntry(date: date, day: p?.date == DayProgress.localDate(date) ? p : nil)
    }
}

struct DayProgressComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "com.hejitech.fitloop.watchkitapp.widgets.dayprogress", provider: DayProgressProvider()) { entry in
            DayProgressView(entry: entry).containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Today's progress")
        .description("How much of today's plan you've done.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}

struct DayProgressView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DayProgressEntry

    private var completion: Double { entry.day?.completion ?? 0 }
    private var percent: String { entry.day == nil ? "--" : "\(Int((completion * 100).rounded()))%" }

    var body: some View {
        switch family {
        case .accessoryRectangular: rectangular
        case .accessoryInline: Text("\(Image(systemName: "figure.run")) FitLoop \(percent)")
        case .accessoryCorner:
            Image(systemName: "figure.run")
                .font(.title3)
                .widgetLabel { Gauge(value: completion) { Text("Today") }.tint(.orange) }
        default: circular
        }
    }

    private var circular: some View {
        Gauge(value: completion) {
            Image(systemName: "figure.run")
        } currentValueLabel: {
            Text(entry.day == nil ? "--" : "\(Int((completion * 100).rounded()))").monospacedDigit()
        }
        .gaugeStyle(.accessoryCircular)
        .tint(.orange)
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Label("Today", systemImage: "figure.run").font(.headline)
                Spacer()
                Text(percent).font(.headline.monospacedDigit()).foregroundStyle(.orange)
            }
            Gauge(value: completion) { EmptyView() }
                .gaugeStyle(.accessoryLinearCapacity)
                .tint(.orange)
            if let d = entry.day {
                Text(summary(d)).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            } else {
                Text("Open FitLoop on your iPhone").font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
        }
    }

    private func summary(_ d: DayProgress) -> String {
        var parts: [String] = []
        if d.workoutsTotal > 0 { parts.append("Workouts \(d.workoutsDone)/\(d.workoutsTotal)") }
        if d.mealsTotal > 0 { parts.append("Meals \(d.mealsDone)/\(d.mealsTotal)") }
        return parts.isEmpty ? "Rest day" : parts.joined(separator: " · ")
    }
}
