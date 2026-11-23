import ActivityKit
import G2DigestKit
import SwiftUI
import WidgetKit

struct EditionEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetEditionSnapshot?
}

struct EditionProvider: TimelineProvider {
    func placeholder(in context: Context) -> EditionEntry {
        EditionEntry(date: Date(), snapshot: WidgetEditionSnapshot(
            date: "2026-11-22",
            title: "Morning Brief",
            cardCount: 9,
            alertCount: 1,
            leadTitle: "Your daily briefing is ready",
            leadBody: "Open G2 Digest to skim cards or listen to glance and deep-dive audio."
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (EditionEntry) -> Void) {
        completion(EditionEntry(date: Date(), snapshot: loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EditionEntry>) -> Void) {
        let entry = EditionEntry(date: Date(), snapshot: loadSnapshot())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func loadSnapshot() -> WidgetEditionSnapshot? {
        guard let data = UserDefaults.standard.data(forKey: WidgetEditionSnapshot.storageKey) else { return nil }
        return try? JSONDecoder().decode(WidgetEditionSnapshot.self, from: data)
    }
}

struct G2DigestWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: EditionEntry

    var body: some View {
        Group {
            if let snap = entry.snapshot {
                switch family {
                case .accessoryRectangular:
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Image(systemName: "eyeglasses")
                            Text(snap.date).font(.caption2.bold())
                            if snap.alertCount > 0 {
                                Text("• \(snap.alertCount)!")
                                    .font(.caption2.bold())
                            }
                        }
                        Text(snap.leadTitle ?? snap.title)
                            .font(.caption)
                            .lineLimit(2)
                    }
                case .accessoryCircular:
                    VStack(spacing: 1) {
                        Image(systemName: "eyeglasses").font(.caption)
                        Text("\(snap.cardCount)").font(.headline.bold())
                    }
                default:
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Label("G2 Digest", systemImage: "eyeglasses")
                                .font(.caption2.bold())
                                .foregroundStyle(.secondary)
                            Spacer()
                            if snap.alertCount > 0 {
                                Text("\(snap.alertCount) alert\(snap.alertCount == 1 ? "" : "s")")
                                    .font(.caption2.bold())
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.red.opacity(0.18))
                                    .foregroundStyle(.red)
                                    .clipShape(Capsule())
                            }
                        }
                        Text(snap.title)
                            .font(.headline)
                            .lineLimit(1)
                        if let lead = snap.leadTitle {
                            Text(lead)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(family == .systemSmall ? 2 : 3)
                        }
                        Spacer(minLength: 0)
                        HStack {
                            Text(snap.date)
                            Spacer()
                            Text("\(snap.cardCount) cards")
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                    .padding(4)
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    Label("G2 Digest", systemImage: "eyeglasses")
                        .font(.caption.bold())
                    Text("Open G2 Digest to load your latest edition.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .widgetURL(URL(string: "g2digest://edition/latest"))
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct G2DigestEditionWidget: Widget {
    let kind: String = "G2DigestEditionWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: EditionProvider()) { entry in
            G2DigestWidgetView(entry: entry)
        }
        .configurationDisplayName("Latest Edition")
        .description("Glance at today's G2 Digest headline, alert count, and jump straight into your briefing.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}

struct G2DigestAudioLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: G2DigestAudioAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label(context.state.modeLabel.uppercased(), systemImage: "headphones")
                        .font(.caption2.bold())
                        .foregroundStyle(.green)
                    Spacer()
                    Text(context.state.cardPosition)
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                Text(context.state.cardTitle)
                    .font(.headline)
                    .lineLimit(1)
                ProgressView(value: context.state.progress)
                    .tint(.green)
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.85))
            .activitySystemActionForegroundColor(.green)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.state.modeLabel, systemImage: "headphones")
                        .font(.caption2.bold())
                        .foregroundStyle(.green)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.cardPosition)
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.cardTitle)
                            .font(.subheadline.bold())
                            .lineLimit(1)
                        ProgressView(value: context.state.progress)
                            .tint(.green)
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.isPlaying ? "waveform" : "pause.fill")
                    .foregroundStyle(.green)
            } compactTrailing: {
                Text(context.state.cardPosition)
                    .font(.caption2.monospacedDigit())
            } minimal: {
                Image(systemName: "headphones")
                    .foregroundStyle(.green)
            }
        }
    }
}

@main
struct G2DigestWidgetsBundle: WidgetBundle {
    var body: some Widget {
        G2DigestEditionWidget()
        G2DigestAudioLiveActivity()
    }
}
