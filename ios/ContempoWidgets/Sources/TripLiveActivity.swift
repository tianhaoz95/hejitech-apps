import ActivityKit
import SwiftUI
import WidgetKit

/// Lock Screen banner + Dynamic Island presentation for an open GPS mileage
/// trip. Same "no interactive stop button" scope cut as `TimerLiveActivity`.
struct TripLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TripActivityAttributes.self) { context in
            HStack(spacing: 12) {
                Image(systemName: "car.fill")
                    .foregroundStyle(.white)
                Text("\(context.state.miles, specifier: "%.2f") mi")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
            }
            .padding()
            .activityBackgroundTint(.black)
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "car.fill")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.miles, specifier: "%.2f") mi")
                }
            } compactLeading: {
                Image(systemName: "car.fill")
            } compactTrailing: {
                Text("\(context.state.miles, specifier: "%.1f")")
            } minimal: {
                Image(systemName: "car.fill")
            }
        }
    }
}
