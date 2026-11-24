import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@main
struct FitLoopLiveActivities: WidgetBundle {
    var body: some Widget {
        WorkoutLiveActivity()
        FitLoopTodayWidget()
    }
}

/// The open workout on the Lock Screen and in the Dynamic Island.
struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { ctx in
            LockScreenWorkout(attributes: ctx.attributes, state: ctx.state)
                .padding()
                .activityBackgroundTint(Color.black.opacity(0.75))
                .activitySystemActionForegroundColor(.orange)
        } dynamicIsland: { ctx in
            let s = ctx.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("\(s.setsDone)/\(s.setsTotal)", systemImage: "figure.strengthtraining.traditional")
                        .font(.caption.monospacedDigit()).foregroundStyle(.orange)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let hr = s.heartRate { Label("\(hr)", systemImage: "heart.fill").font(.caption.monospacedDigit()).foregroundStyle(.red) }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(s.finished ? ctx.attributes.title : s.exercise).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(s.finished ? "Workout saved" : s.setLine).font(.footnote).lineLimit(1)
                            RestOrElapsed(state: s, started: ctx.attributes.started).font(.title3.monospacedDigit())
                        }
                        Spacer()
                        if !s.finished { SetDoneButton() }
                    }
                }
            } compactLeading: {
                Image(systemName: "figure.strengthtraining.traditional").foregroundStyle(.orange)
            } compactTrailing: {
                if let until = s.restUntil, until > .now {
                    Text(timerInterval: Date.now...until, countsDown: true).monospacedDigit().frame(maxWidth: 44).foregroundStyle(.orange)
                } else {
                    Text("\(s.setsDone)/\(s.setsTotal)").monospacedDigit()
                }
            } minimal: {
                Image(systemName: "figure.strengthtraining.traditional").foregroundStyle(.orange)
            }
            .keylineTint(.orange)
        }
    }
}

struct LockScreenWorkout: View {
    let attributes: WorkoutActivityAttributes
    let state: WorkoutActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(attributes.title).font(.caption).foregroundStyle(.secondary)
                Spacer()
                if let hr = state.heartRate { Label("\(hr)", systemImage: "heart.fill").font(.caption.monospacedDigit()).foregroundStyle(.red) }
            }
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.finished ? "Workout done" : state.exercise).font(.headline).lineLimit(1)
                    Text(state.finished ? "\(state.setsDone) of \(state.setsTotal) sets" : state.setLine).font(.subheadline).lineLimit(1)
                }
                Spacer()
                RestOrElapsed(state: state, started: attributes.started).font(.title2.monospacedDigit())
            }
            HStack {
                ProgressView(value: Double(state.setsDone), total: Double(max(state.setsTotal, 1))).tint(.orange)
                if !state.finished { SetDoneButton() }
            }
        }
        .foregroundStyle(.white)
    }
}

/// The rest timer while resting (orange, counting down), otherwise the workout's elapsed time.
struct RestOrElapsed: View {
    let state: WorkoutActivityAttributes.ContentState
    let started: Date

    var body: some View {
        if let until = state.restUntil, until > .now, !state.finished {
            Text(timerInterval: Date.now...until, countsDown: true).foregroundStyle(.orange)
        } else if !state.finished {
            Text(started, style: .timer)
        }
    }
}

struct SetDoneButton: View {
    var body: some View {
        Button(intent: SetDoneIntent()) {
            Label("Set done", systemImage: "checkmark").font(.caption.bold())
        }
        .tint(.orange)
        .buttonStyle(.borderedProminent)
    }
}
