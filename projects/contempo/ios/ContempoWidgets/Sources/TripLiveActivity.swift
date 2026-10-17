import ActivityKit
import SwiftUI
import WidgetKit

/// Lock Screen banner + Dynamic Island presentation for an open GPS mileage
/// trip. Pause/Resume is interactive here (via `PauseTripIntent`/
/// `ResumeTripIntent`) in the Lock Screen banner and the Dynamic Island's
/// expanded presentation — same scope as `TimerLiveActivity`.
struct TripLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TripActivityAttributes.self) { context in
            HStack(spacing: 12) {
                Image(systemName: context.state.isPaused ? "pause.circle.fill" : "car.fill")
                    .foregroundStyle(.white)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(context.state.miles, specifier: "%.2f") mi")
                        .font(.headline)
                        .foregroundStyle(.white)
                    if context.state.isPaused {
                        Text("Paused")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.8))
                    }
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
                    Image(systemName: context.state.isPaused ? "pause.circle.fill" : "car.fill")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.miles, specifier: "%.2f") mi")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        if context.state.isPaused {
                            Text("Paused")
                        }
                        Spacer()
                        pauseResumeButton(isPaused: context.state.isPaused)
                    }
                }
            } compactLeading: {
                Image(systemName: context.state.isPaused ? "pause.circle.fill" : "car.fill")
            } compactTrailing: {
                Text("\(context.state.miles, specifier: "%.1f")")
            } minimal: {
                Image(systemName: context.state.isPaused ? "pause.circle.fill" : "car.fill")
            }
        }
    }

    /// A ternary can't be used for `Button(intent:)` directly — `PauseTripIntent`
    /// and `ResumeTripIntent` are different concrete types, and the two
    /// branches of `?:` must match. `@ViewBuilder`'s `if`/`else` has no such
    /// restriction.
    @ViewBuilder
    private func pauseResumeButton(isPaused: Bool) -> some View {
        if isPaused {
            Button(intent: ResumeTripIntent()) { Image(systemName: "play.fill") }
                .buttonStyle(.plain)
        } else {
            Button(intent: PauseTripIntent()) { Image(systemName: "pause.fill") }
                .buttonStyle(.plain)
        }
    }
}
