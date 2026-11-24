import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

private let lantern = Color(red: 1.0, green: 0.78, blue: 0.34)
private let night = Color(red: 0.06, green: 0.07, blue: 0.17)
private let moon = Color(red: 0.96, green: 0.95, blue: 0.92)
private let ink = Color(red: 0.76, green: 0.77, blue: 0.86)

@main
struct RoarlyLiveActivities: WidgetBundle {
    var body: some Widget {
        StoryLiveActivity()
    }
}

struct StoryLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: StoryActivityAttributes.self) { ctx in
            LockScreenStoryView(attributes: ctx.attributes, state: ctx.state)
                .padding()
                .activityBackgroundTint(night.opacity(0.92))
                .activitySystemActionForegroundColor(lantern)
        } dynamicIsland: { ctx in
            let s = ctx.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(s.modeTitle, systemImage: s.isBedtime ? "moon.stars.fill" : "sun.max.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(lantern)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(ctx.attributes.started, style: .timer)
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(ink)
                }
                DynamicIslandExpandedRegion(.center) {
                    if let emoji = s.lastEmoji, let name = s.lastName {
                        Text("\(emoji) \(name)")
                            .font(.headline)
                            .foregroundStyle(moon)
                            .lineLimit(1)
                    } else {
                        Text("Listening to your story")
                            .font(.headline)
                            .foregroundStyle(moon)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 10) {
                        if !s.ambients.isEmpty {
                            Text(s.ambients.joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(ink)
                                .lineLimit(1)
                        } else {
                            Text("Roarly")
                                .font(.caption)
                                .foregroundStyle(ink)
                        }
                        Spacer()
                        if !s.ambients.isEmpty {
                            Button(intent: SilenceAmbientsIntent()) {
                                Image(systemName: "speaker.slash.fill")
                                    .font(.caption.bold())
                            }
                            .tint(ink.opacity(0.35))
                            .buttonStyle(.borderedProminent)
                        }
                        Button(intent: StopStoryIntent()) {
                            Label("Stop", systemImage: "stop.fill")
                                .font(.caption.bold())
                        }
                        .tint(lantern)
                        .foregroundStyle(night)
                        .buttonStyle(.borderedProminent)
                    }
                }
            } compactLeading: {
                Image(systemName: "ear.fill")
                    .foregroundStyle(lantern)
            } compactTrailing: {
                if let emoji = s.lastEmoji {
                    Text(emoji)
                } else {
                    Image(systemName: s.isBedtime ? "moon.stars.fill" : "sun.max.fill")
                        .foregroundStyle(lantern)
                }
            } minimal: {
                Image(systemName: "ear.fill")
                    .foregroundStyle(lantern)
            }
            .keylineTint(lantern)
        }
    }
}

private struct LockScreenStoryView: View {
    let attributes: StoryActivityAttributes
    let state: StoryActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Roarly · \(state.modeTitle)", systemImage: state.isBedtime ? "moon.stars.fill" : "sun.max.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(lantern)
                Spacer()
                Text(attributes.started, style: .timer)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(ink)
            }
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    if let emoji = state.lastEmoji, let name = state.lastName {
                        Text("\(emoji) \(name)")
                            .font(.headline)
                            .foregroundStyle(moon)
                            .lineLimit(1)
                    } else {
                        Text("Listening to your story")
                            .font(.headline)
                            .foregroundStyle(moon)
                            .lineLimit(1)
                    }
                    if !state.ambients.isEmpty {
                        Text(state.ambients.joined(separator: " · "))
                            .font(.subheadline)
                            .foregroundStyle(ink)
                            .lineLimit(1)
                    }
                }
                Spacer()
                if !state.ambients.isEmpty {
                    Button(intent: SilenceAmbientsIntent()) {
                        Image(systemName: "speaker.slash.fill")
                            .font(.caption.bold())
                    }
                    .tint(ink.opacity(0.3))
                    .buttonStyle(.borderedProminent)
                }
                Button(intent: StopStoryIntent()) {
                    Label("Stop", systemImage: "stop.fill")
                        .font(.caption.bold())
                }
                .tint(lantern)
                .foregroundStyle(night)
                .buttonStyle(.borderedProminent)
            }
        }
    }
}
