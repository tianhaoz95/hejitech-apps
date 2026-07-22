import ContempoCore
import SwiftUI
import WidgetKit

struct HoursLockScreenEntry: TimelineEntry {
    let date: Date
    let confirmedHours: Double
}

struct HoursLockScreenProvider: TimelineProvider {
    private let store = HoursProgressStore(appGroupId: "group.com.hejitech.contempo")

    func placeholder(in context: Context) -> HoursLockScreenEntry {
        HoursLockScreenEntry(date: Date(), confirmedHours: 35.0)
    }

    func getSnapshot(in context: Context, completion: @escaping (HoursLockScreenEntry) -> Void) {
        completion(createEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HoursLockScreenEntry>) -> Void) {
        completion(Timeline(entries: [createEntry()], policy: .after(Date().addingTimeInterval(900))))
    }

    private func createEntry() -> HoursLockScreenEntry {
        HoursLockScreenEntry(date: Date(), confirmedHours: store.read())
    }
}

struct HoursLockScreenWidget: Widget {
    let kind: String = "HoursLockScreenWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HoursLockScreenProvider()) { entry in
            HoursLockScreenWidgetView(entry: entry)
        }
        .configurationDisplayName("Material Participation Hours")
        .description("Tracks progress towards 100 material participation hours on your lock screen and home screen.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
            .systemSmall,
            .systemMedium
        ])
    }
}

struct HoursLockScreenWidgetView: View {
    let entry: HoursLockScreenEntry
    @Environment(\.widgetFamily) private var family

    private var targetHours: Double {
        Double(MaterialParticipationTest.thresholdHours)
    }

    private var progress: Double {
        min(1.0, max(0.0, entry.confirmedHours / targetHours))
    }

    private var hoursText: String {
        entry.confirmedHours.formatted(.number.precision(.fractionLength(1)))
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: progress) {
                Image(systemName: "clock.fill")
            } currentValueLabel: {
                Text(hoursText)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
            }
            .gaugeStyle(.accessoryCircular)

        case .accessoryInline:
            HStack(spacing: 4) {
                Image(systemName: "clock.fill")
                Text("\(hoursText) / \(MaterialParticipationTest.thresholdHours) hrs")
            }

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 4) {
                    Image(systemName: "clock.fill")
                        .font(.caption2)
                    Text("CONTEMPO HOURS")
                        .font(.system(size: 10, weight: .bold))
                }
                Text("\(hoursText) / \(MaterialParticipationTest.thresholdHours) hrs")
                    .font(.system(size: 16, weight: .bold, design: .rounded))

                ProgressView(value: progress)
                    .progressViewStyle(.linear)
            }

        case .systemSmall:
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "clock.badge.checkmark.fill")
                        .font(.title2)
                        .foregroundStyle(Color(red: 0.16, green: 0.38, blue: 0.31))
                    Spacer()
                    Text("\(Int(progress * 100))%")
                        .font(.caption)
                        .bold()
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(red: 0.16, green: 0.38, blue: 0.31).opacity(0.15))
                        .clipShape(Capsule())
                }

                Spacer()

                Text(hoursText)
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundStyle(.primary)

                Text("of \(MaterialParticipationTest.thresholdHours) hrs confirmed")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding()

        case .systemMedium:
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .stroke(Color.secondary.opacity(0.2), lineWidth: 8)
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(Color(red: 0.16, green: 0.38, blue: 0.31), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text(hoursText)
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                        Text("hrs")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 80, height: 80)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Material Participation")
                        .font(.headline)
                    Text("\(hoursText) / \(MaterialParticipationTest.thresholdHours) hours confirmed")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    ProgressView(value: progress)
                        .tint(Color(red: 0.16, green: 0.38, blue: 0.31))
                        .padding(.top, 4)
                }
            }
            .padding()

        @unknown default:
            Text("\(hoursText) hrs")
        }
    }
}
