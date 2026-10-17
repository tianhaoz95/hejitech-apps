import ActivityKit
import SwiftUI
import WidgetKit

/// Lock Screen banner + Dynamic Island presentation for an open work timer.
/// Pause/Resume is interactive here (via `PauseWorkIntent`/`ResumeWorkIntent`,
/// `LiveActivityIntent`s that run in the app's own process — see
/// `Contempo/Sources/Shared/LiveActivityIntents/PauseResumeIntents.swift`),
/// available in the Lock Screen banner and the Dynamic Island's expanded
/// presentation; the compact/minimal Dynamic Island shapes have no room for
/// an interactive control and stay tap-to-open-app, same as before.
struct TimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TimerActivityAttributes.self) { context in
            HStack(spacing: 12) {
                Image(systemName: context.state.isPaused ? "pause.circle.fill" : "clock.fill")
                    .foregroundStyle(.white)
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.subjectName)
                        .font(.headline)
                        .foregroundStyle(.white)
                    timerText(context: context)
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.white.opacity(0.8))
                }
                Spacer()
                pauseResumeButton(isPaused: context.state.isPaused)
                    .foregroundStyle(.white)
                    .padding(10)
                    .background(.white.opacity(0.2), in: Circle())
            }
            .padding()
            .activityBackgroundTint(.black)
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.state.isPaused ? "pause.circle.fill" : "clock.fill")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    timerText(context: context).monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.subjectName)
                        Spacer()
                        pauseResumeButton(isPaused: context.state.isPaused)
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.isPaused ? "pause.circle.fill" : "clock.fill")
            } compactTrailing: {
                timerText(context: context)
                    .monospacedDigit()
                    .frame(width: 44)
            } minimal: {
                Image(systemName: context.state.isPaused ? "pause.circle.fill" : "clock.fill")
            }
        }
    }

    /// Ticks live via the system's own `Text(date, style: .timer)` when
    /// running (no repeated Activity updates needed) — the anchor date is
    /// shifted forward by the accumulated paused duration so it reads correct
    /// *active* elapsed time, not wall-clock-since-start. Frozen as static
    /// text while paused, computed from the moment the pause began.
    @ViewBuilder
    private func timerText(context: ActivityViewContext<TimerActivityAttributes>) -> some View {
        if context.state.isPaused, let pausedAt = context.state.pausedAt {
            let frozenElapsed = max(0, pausedAt.timeIntervalSince(context.attributes.startedAt) - context.state.pausedDurationSeconds)
            Text(formatElapsed(frozenElapsed))
        } else {
            let effectiveStart = context.attributes.startedAt.addingTimeInterval(context.state.pausedDurationSeconds)
            Text(effectiveStart, style: .timer)
        }
    }

    /// A ternary can't be used for `Button(intent:)` directly — `PauseWorkIntent`
    /// and `ResumeWorkIntent` are different concrete types, and the two
    /// branches of `?:` must match. `@ViewBuilder`'s `if`/`else` has no such
    /// restriction.
    @ViewBuilder
    private func pauseResumeButton(isPaused: Bool) -> some View {
        if isPaused {
            Button(intent: ResumeWorkIntent()) { Image(systemName: "play.fill") }
                .buttonStyle(.plain)
        } else {
            Button(intent: PauseWorkIntent()) { Image(systemName: "pause.fill") }
                .buttonStyle(.plain)
        }
    }

    private func formatElapsed(_ seconds: TimeInterval) -> String {
        let total = Int(seconds)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        let secs = total % 60
        return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, secs) : String(format: "%d:%02d", minutes, secs)
    }
}
