#if os(iOS) && canImport(ActivityKit) && canImport(WidgetKit)
import ActivityKit
import HeadwayKit
import SwiftUI
import WidgetKit

public struct TrackActivityWidget: Widget {
    public init() {}

    public var body: some WidgetConfiguration {
        ActivityConfiguration(for: TrackActivityAttributes.self) { context in
            LockScreenLiveActivityView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(Color.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "tram.fill")
                            .foregroundStyle(Color(red: 0.12, green: 0.54, blue: 0.30))
                        Text("\(context.attributes.train) \(context.attributes.kind)")
                            .font(.headline)
                            .foregroundStyle(.white)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    let arrDate = Date(timeIntervalSince1970: context.state.predArr / 1000)
                    Text(arrDate, style: .relative)
                        .font(.headline)
                        .foregroundStyle(Color(red: 0.24, green: 0.82, blue: 0.48))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            if let next = context.state.next {
                                if let nextPred = context.state.nextPred {
                                    let nextDate = Date(timeIntervalSince1970: nextPred / 1000)
                                    Text("Next: \(next) (\(nextDate, format: .dateTime.hour().minute()))")
                                        .font(.subheadline)
                                        .foregroundStyle(.white.opacity(0.85))
                                } else {
                                    Text("Next: \(next)")
                                        .font(.subheadline)
                                        .foregroundStyle(.white.opacity(0.85))
                                }
                            }
                            Spacer()
                            let arrDate = Date(timeIntervalSince1970: context.state.predArr / 1000)
                            Text("\(context.attributes.to) \(arrDate, format: .dateTime.hour().minute())")
                                .font(.subheadline)
                                .foregroundStyle(.white.opacity(0.85))
                            if let delay = context.state.delayMin, delay >= 2 {
                                Text("+\(delay)m")
                                    .font(.subheadline.bold())
                                    .foregroundStyle(.orange)
                            }
                        }

                        ProgressView(value: progressFraction(stopsLeft: context.state.stopsLeft))
                            .tint(Color(red: 0.12, green: 0.54, blue: 0.30))
                    }
                    .padding(.top, 4)
                }
            } compactLeading: {
                HStack(spacing: 3) {
                    Image(systemName: "tram.fill")
                        .foregroundStyle(Color(red: 0.24, green: 0.82, blue: 0.48))
                    Text(context.attributes.train)
                        .font(.caption2.bold())
                        .foregroundStyle(.white)
                }
            } compactTrailing: {
                let arrDate = Date(timeIntervalSince1970: context.state.predArr / 1000)
                Text(arrDate, style: .relative)
                    .font(.caption2.bold())
                    .foregroundStyle(Color(red: 0.24, green: 0.82, blue: 0.48))
                    .frame(maxWidth: 40)
            } minimal: {
                Image(systemName: "tram.fill")
                    .foregroundStyle(Color(red: 0.24, green: 0.82, blue: 0.48))
            }
        }
    }

    private func progressFraction(stopsLeft: Int) -> Double {
        if stopsLeft <= 0 { return 1.0 }
        return max(0.1, 1.0 - (Double(stopsLeft) / 8.0))
    }
}

struct LockScreenLiveActivityView: View {
    let attributes: TrackActivityAttributes
    let state: TrackActivityAttributes.ContentState

    private var arrDate: Date {
        Date(timeIntervalSince1970: state.predArr / 1000)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header row
            HStack(alignment: .center, spacing: 8) {
                Image(systemName: "tram.fill")
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .frame(width: 26, height: 26)
                    .background(Color(red: 0.12, green: 0.54, blue: 0.30), in: RoundedRectangle(cornerRadius: 6))
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(attributes.train) \(attributes.kind)")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Text("to \(attributes.to)")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
                if state.cancelled {
                    Text("Cancelled")
                        .font(.subheadline.bold())
                        .foregroundStyle(.red)
                } else if let delay = state.delayMin, delay >= 2 {
                    Text("+\(delay) min")
                        .font(.subheadline.bold())
                        .foregroundStyle(.orange)
                } else {
                    Text("On time")
                        .font(.subheadline.bold())
                        .foregroundStyle(.green)
                }
            }

            // Main Arrival & ETA
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(arrDate, format: .dateTime.hour().minute())
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    HStack(spacing: 4) {
                        Text("arrives · in")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.7))
                        Text(arrDate, style: .relative)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.9))
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    if state.arrived {
                        Text("Arrived")
                            .font(.headline)
                            .foregroundStyle(.green)
                    } else if state.stopsLeft <= 1 {
                        Text("Next stop is yours")
                            .font(.headline)
                            .foregroundStyle(.green)
                    } else {
                        Text("\(state.stopsLeft) stops")
                            .font(.title3.bold())
                            .foregroundStyle(.white)
                        Text("to go")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
            }

            // Stops / next stop info
            if let next = state.next, !state.arrived {
                Divider()
                    .background(Color.white.opacity(0.2))

                HStack {
                    if let nextPred = state.nextPred {
                        let nextDate = Date(timeIntervalSince1970: nextPred / 1000)
                        Text("Next: ")
                            .foregroundStyle(.white.opacity(0.7))
                        + Text(next)
                            .bold()
                            .foregroundStyle(.white)
                        + Text(" at \(nextDate, format: .dateTime.hour().minute())")
                            .foregroundStyle(.white.opacity(0.7))
                    } else {
                        Text("Next: ")
                            .foregroundStyle(.white.opacity(0.7))
                        + Text(next)
                            .bold()
                            .foregroundStyle(.white)
                    }
                    Spacer()
                    Text("Live Caltrain")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.6))
                }
                .font(.footnote)
            }
        }
        .padding(16)
    }
}
#endif
