import ActivityKit
import Foundation

/// Starts, updates and ends the workout's Live Activity (Lock Screen, Dynamic Island) for the
/// workout open in the player. Updates only when something shown changes.
@MainActor
final class WorkoutLiveActivityController {
    private var activity: Activity<WorkoutActivityAttributes>?
    private var last: WorkoutActivityAttributes.ContentState?

    func start(title: String, started: Date, state: WorkoutActivityAttributes.ContentState) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        // One workout at a time: end any left from an earlier launch.
        for a in Activity<WorkoutActivityAttributes>.activities where a.id != activity?.id {
            Task { await a.end(nil, dismissalPolicy: .immediate) }
        }
        if let activity, activity.attributes.title == title { return update(state) }
        activity = try? Activity.request(
            attributes: WorkoutActivityAttributes(title: title, started: started),
            content: .init(state: state, staleDate: nil), pushType: nil
        )
        last = state
    }

    func update(_ state: WorkoutActivityAttributes.ContentState) {
        guard let activity, state != last else { return }
        last = state
        Task { await activity.update(.init(state: state, staleDate: nil)) }
    }

    func update(heartRate: Int?) {
        guard var s = last else { return }
        s.heartRate = heartRate
        update(s)
    }

    /// Finished workouts stay a few minutes on the Lock Screen as "Workout done"; closed ones leave now.
    func end(finished: Bool) {
        guard let activity else { return }
        var s = last ?? .init(exercise: "", setLine: "", setsDone: 0, setsTotal: 0)
        s.finished = finished
        s.restUntil = nil
        self.activity = nil
        last = nil
        Task { await activity.end(.init(state: s, staleDate: nil), dismissalPolicy: finished ? .after(.now.addingTimeInterval(4 * 60)) : .immediate) }
    }
}
