#if os(iOS) && canImport(ActivityKit) && canImport(WidgetKit)
import ActivityKit
import HeadwayKit
import SwiftUI
import WidgetKit

private let green = Color(red: 0.24, green: 0.82, blue: 0.48)
private let deepGreen = Color(red: 0.12, green: 0.54, blue: 0.30)

/// "Next trains": a board pinned from the Trains tab, on the Lock Screen and in the Dynamic Island.
/// Countdowns tick on their own; the app (while open) and the cron (every minute) push new trains.
public struct BoardActivityWidget: Widget {
    public init() {}

    public var body: some WidgetConfiguration {
        ActivityConfiguration(for: BoardActivityAttributes.self) { context in
            BoardActivityLockScreenView(attributes: context.attributes, state: context.state)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(Color.white)
                .widgetURL(URL(string: "headway://board"))
        } dynamicIsland: { context in
            let first = context.state.trains.first
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "tram.fill").foregroundStyle(green)
                        Text("\(context.attributes.fromShort) → \(context.attributes.toShort)")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .lineLimit(1)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let first, !first.cancelled {
                        Countdown(date: first.depDate)
                            .font(.headline)
                            .foregroundStyle(green)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 4) {
                        ForEach(context.state.trains, id: \.self) { TrainLine(train: $0) }
                        if context.state.trains.isEmpty {
                            Text("No more trains today").font(.subheadline).foregroundStyle(.white.opacity(0.7))
                        }
                    }
                    .padding(.top, 4)
                }
            } compactLeading: {
                HStack(spacing: 3) {
                    Image(systemName: "tram.fill").foregroundStyle(green)
                    Text(first?.train ?? "—").font(.caption2.bold()).foregroundStyle(.white)
                }
            } compactTrailing: {
                if let first, !first.cancelled {
                    Countdown(date: first.depDate)
                        .font(.caption2.bold())
                        .foregroundStyle(green)
                        .frame(maxWidth: 44)
                } else {
                    Text("—").font(.caption2.bold())
                }
            } minimal: {
                Image(systemName: "tram.fill").foregroundStyle(green)
            }
            .widgetURL(URL(string: "headway://board"))
        }
    }
}

/// Minutes and seconds to `date`, stopping at 0:00 (Live Activities can't re-render on their own).
private struct Countdown: View {
    let date: Date
    var body: some View {
        Text(timerInterval: Date.now...max(Date.now, date), countsDown: true)
            .monospacedDigit()
            .multilineTextAlignment(.trailing)
    }
}

private struct TrainLine: View {
    let train: BoardActivityAttributes.Train

    var body: some View {
        HStack(spacing: 8) {
            Text(train.train)
                .font(.subheadline.monospacedDigit().bold())
                .foregroundStyle(.white)
                .frame(width: 38, alignment: .leading)
            Text(train.kind)
                .font(.caption2.bold())
                .foregroundStyle(train.kind == "LOC" ? .white.opacity(0.7) : green)
                .lineLimit(1)
            Text(train.depDate, format: .dateTime.hour().minute())
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(.white.opacity(0.85))
            if train.cancelled {
                Text("Cancelled").font(.caption.bold()).foregroundStyle(.red)
            } else if let d = train.delayMin, d >= 2 {
                Text("+\(d)m").font(.caption.bold()).foregroundStyle(.orange)
            }
            Spacer(minLength: 4)
            if !train.cancelled {
                Countdown(date: train.depDate)
                    .font(.subheadline.bold())
                    .foregroundStyle(green)
                    .frame(width: 56, alignment: .trailing)
            }
        }
    }
}

struct BoardActivityLockScreenView: View {
    let attributes: BoardActivityAttributes
    let state: BoardActivityAttributes.ContentState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "tram.fill")
                    .font(.subheadline)
                    .foregroundStyle(.white)
                    .frame(width: 26, height: 26)
                    .background(deepGreen, in: RoundedRectangle(cornerRadius: 6))
                Text("\(attributes.fromShort) → \(attributes.toShort)")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text(state.live ? "LIVE" : "TIMETABLE")
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background((state.live ? Color.green : Color.white).opacity(0.18), in: Capsule())
                    .foregroundStyle(state.live ? .green : .white.opacity(0.7))
            }
            if state.trains.isEmpty {
                Text("No more trains today").font(.subheadline).foregroundStyle(.white.opacity(0.7))
            } else {
                ForEach(state.trains, id: \.self) { TrainLine(train: $0) }
            }
        }
        .padding(16)
    }
}
#endif
