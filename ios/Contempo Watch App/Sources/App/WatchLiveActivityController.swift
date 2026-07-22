#if canImport(ActivityKit)
import ActivityKit
import Foundation

/// Controls Live Activities on watchOS for ongoing work timers and GPS trips —
/// surfaces in Smart Stack and Lock Screen on watchOS 11+.
@MainActor
enum WatchLiveActivityController {
    private static var timerActivity: Activity<TimerActivityAttributes>?
    private static var tripActivity: Activity<TripActivityAttributes>?

    static func startTimer(subjectName: String, startedAt: Date) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        endTimer()
        let attributes = TimerActivityAttributes(startedAt: startedAt)
        let content = ActivityContent(state: TimerActivityAttributes.ContentState(subjectName: subjectName), staleDate: nil)
        timerActivity = try? Activity.request(attributes: attributes, content: content)
    }

    static func endTimer() {
        guard let activity = timerActivity else { return }
        timerActivity = nil
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }

    static func startTrip(startedAt: Date = Date()) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        endTrip()
        let content = ActivityContent(state: TripActivityAttributes.ContentState(miles: 0.0), staleDate: nil)
        tripActivity = try? Activity.request(attributes: TripActivityAttributes(), content: content)
    }

    static func endTrip() {
        guard let activity = tripActivity else { return }
        tripActivity = nil
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }
}
#else
import Foundation

@MainActor
enum WatchLiveActivityController {
    static func startTimer(subjectName: String, startedAt: Date) {}
    static func endTimer() {}
    static func startTrip(startedAt: Date = Date()) {}
    static func endTrip() {}
}
#endif
