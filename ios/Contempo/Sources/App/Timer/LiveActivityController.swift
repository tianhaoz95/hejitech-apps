import ActivityKit
import Foundation

/// Starts/updates/ends the two ongoing-work Live Activities — the closest
/// iOS equivalent of Android's persistent `IMPORTANCE_DEFAULT` notifications
/// for the same two states (`OngoingWorkNotificationService`,
/// `MileageTrackingService`). See `TimerLiveActivity`/`TripLiveActivity`'s
/// doc comments for why there's no interactive stop button.
@MainActor
enum LiveActivityController {
    private static var timerActivity: Activity<TimerActivityAttributes>?
    private static var tripActivity: Activity<TripActivityAttributes>?

    static func startTimer(subjectName: String, startedAt: Date) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attributes = TimerActivityAttributes(startedAt: startedAt)
        let content = ActivityContent(state: TimerActivityAttributes.ContentState(subjectName: subjectName), staleDate: nil)
        timerActivity = try? Activity.request(attributes: attributes, content: content)
    }

    static func endTimer() {
        guard let activity = timerActivity else { return }
        timerActivity = nil
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }

    static func startTrip(miles: Double) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let content = ActivityContent(state: TripActivityAttributes.ContentState(miles: miles), staleDate: nil)
        tripActivity = try? Activity.request(attributes: TripActivityAttributes(), content: content)
    }

    static func updateTrip(miles: Double) async {
        guard let tripActivity else { return }
        await tripActivity.update(ActivityContent(state: TripActivityAttributes.ContentState(miles: miles), staleDate: nil))
    }

    static func endTrip() async {
        guard let activity = tripActivity else { return }
        tripActivity = nil
        await activity.end(nil, dismissalPolicy: .immediate)
    }
}
