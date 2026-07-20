import ActivityKit
import SwiftUI
import WidgetKit

/// Lock Screen banner + Dynamic Island presentation for an open work timer.
/// No interactive "mark done" button here (unlike Android's notification
/// action) — that needs an `AppIntent` shared with the app process via an App
/// Group, which is a deliberate scope cut for this pass. Tapping the Live
/// Activity still brings the app to the foreground, where the ongoing-work
/// banner on Capture finishes the timer in one more tap.
struct TimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TimerActivityAttributes.self) { context in
            HStack(spacing: 12) {
                Image(systemName: "clock.fill")
                    .foregroundStyle(.white)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.subjectName)
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text(context.attributes.startedAt, style: .timer)
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.white.opacity(0.8))
                }
                Spacer()
            }
            .padding()
            .activityBackgroundTint(.black)
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "clock.fill")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.startedAt, style: .timer)
                        .monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.subjectName)
                }
            } compactLeading: {
                Image(systemName: "clock.fill")
            } compactTrailing: {
                Text(context.attributes.startedAt, style: .timer)
                    .monospacedDigit()
                    .frame(width: 44)
            } minimal: {
                Image(systemName: "clock.fill")
            }
        }
    }
}
