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

    /// Called from the in-app pause button (the Live Activity's own
    /// interactive buttons — see `PauseWorkIntent`/`ResumeWorkIntent` — update
    /// the activity directly via `Activity<TimerActivityAttributes>.activities`
    /// instead, since a `LiveActivityIntent` runs in-process but doesn't have
    /// access to this enum's private `timerActivity` reference from the
    /// widget-extension-compiled copy of this file).
    static func pauseTimer(pausedAt: Date, pausedDurationSeconds: Double) {
        guard let activity = timerActivity else { return }
        var state = activity.content.state
        state.isPaused = true
        state.pausedAt = pausedAt
        state.pausedDurationSeconds = pausedDurationSeconds
        Task { await activity.update(ActivityContent(state: state, staleDate: nil)) }
    }

    static func resumeTimer(pausedDurationSeconds: Double) {
        guard let activity = timerActivity else { return }
        var state = activity.content.state
        state.isPaused = false
        state.pausedAt = nil
        state.pausedDurationSeconds = pausedDurationSeconds
        Task { await activity.update(ActivityContent(state: state, staleDate: nil)) }
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

    static func pauseTrip() {
        guard let activity = tripActivity else { return }
        var state = activity.content.state
        state.isPaused = true
        Task { await activity.update(ActivityContent(state: state, staleDate: nil)) }
    }

    static func resumeTrip() {
        guard let activity = tripActivity else { return }
        var state = activity.content.state
        state.isPaused = false
        Task { await activity.update(ActivityContent(state: state, staleDate: nil)) }
    }
}
