import SwiftUI
import WidgetKit

struct TodayEntry: TimelineEntry {
    let date: Date
    let snapshot: TodaySnapshot?
}

struct TodayWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: .now, snapshot: Self.sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        let s = TodaySnapshotStore.load()
        completion(TodayEntry(date: .now, snapshot: s?.isToday == true ? s : (context.isPreview ? Self.sample : nil)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date()
        let s = TodaySnapshotStore.load()
        let current = s?.isToday == true ? s : nil
        let nextMidnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now) ?? now.addingTimeInterval(3600))
        let entries = [TodayEntry(date: now, snapshot: current), TodayEntry(date: nextMidnight, snapshot: nil)]
        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private static let sample = TodaySnapshot(
        date: TodaySnapshot.localDate(),
        dayTitle: "Upper body",
        completion: 0.6,
        workoutsDone: 1,
        workoutsTotal: 1,
        mealsDone: 2,
        mealsTotal: 4,
        nextTitle: "Dinner",
        nextWorkoutRef: nil
    )
}

struct FitLoopTodayWidget: Widget {
    static let kind = "FitLoopTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: Self.kind, provider: TodayWidgetProvider()) { entry in
            TodayWidgetView(snapshot: entry.snapshot)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Today's Plan")
        .description("See today's workouts, meals and what's next in FitLoop.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

struct TodayWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let snapshot: TodaySnapshot?

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular: circular
            case .accessoryRectangular: rectangular
            case .systemMedium: medium
            default: small
            }
        }
        .widgetURL(snapshot?.deepLink ?? URL(string: "fitloop://today")!)
    }

    private var pct: Int { Int(((snapshot?.completion ?? 0) * 100).rounded()) }

    private var small: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "figure.strengthtraining.traditional").foregroundStyle(.orange)
                Spacer()
                if snapshot != nil {
                    Text("\(pct)%").font(.caption.bold().monospacedDigit()).foregroundStyle(.orange)
                }
            }
            if let s = snapshot {
                Text(s.dayTitle.isEmpty ? "Today" : s.dayTitle).font(.headline).lineLimit(1)
                ProgressView(value: s.completion).tint(.orange)
                Text("W \(s.workoutsDone)/\(s.workoutsTotal) · M \(s.mealsDone)/\(s.mealsTotal)")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
                Text(s.nextTitle.map { "Next: \($0)" } ?? "All done")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            } else {
                Spacer(minLength: 0)
                Text("FitLoop").font(.headline)
                Text("Open FitLoop to refresh today's plan.").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var medium: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: "figure.strengthtraining.traditional").foregroundStyle(.orange)
                    Text(snapshot?.dayTitle.isEmpty == false ? snapshot!.dayTitle : "FitLoop Today")
                        .font(.headline)
                        .lineLimit(1)
                }
                if let s = snapshot {
                    ProgressView(value: s.completion).tint(.orange)
                    HStack(spacing: 12) {
                        Label("\(s.workoutsDone)/\(s.workoutsTotal) workouts", systemImage: "dumbbell")
                        Label("\(s.mealsDone)/\(s.mealsTotal) meals", systemImage: "fork.knife")
                    }
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                    Text(s.nextTitle.map { "Up next: \($0)" } ?? "Everything done for today")
                        .font(.subheadline.weight(.medium))
                        .lineLimit(1)
                } else {
                    Spacer(minLength: 0)
                    Text("Open FitLoop to load today's workouts and meals.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            if let s = snapshot {
                ZStack {
                    Circle().stroke(.secondary.opacity(0.25), lineWidth: 8)
                    Circle().trim(from: 0, to: s.completion)
                        .stroke(.orange, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Text("\(pct)%").font(.headline.monospacedDigit())
                }
                .frame(width: 66, height: 66)
            }
        }
    }

    private var circular: some View {
        Gauge(value: snapshot?.completion ?? 0) {
            Image(systemName: "figure.strengthtraining.traditional")
        } currentValueLabel: {
            Text(snapshot != nil ? "\(pct)" : "–").monospacedDigit()
        }
        .gaugeStyle(.accessoryCircular)
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(snapshot?.dayTitle.isEmpty == false ? snapshot!.dayTitle : "FitLoop").font(.headline).lineLimit(1)
            if let s = snapshot {
                Text("W \(s.workoutsDone)/\(s.workoutsTotal) · M \(s.mealsDone)/\(s.mealsTotal)").font(.caption.monospacedDigit())
                Text(s.nextTitle ?? "All done").font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            } else {
                Text("Open FitLoop").font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}
