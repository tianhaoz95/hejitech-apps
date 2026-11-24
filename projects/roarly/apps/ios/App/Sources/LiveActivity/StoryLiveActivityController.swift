import ActivityKit
import Foundation

/// Starts, updates, and ends the Lock Screen / Dynamic Island Live Activity while Roarly is
/// listening. Updates only when the visible state changes.
@MainActor
final class StoryLiveActivityController {
    private var activity: Activity<StoryActivityAttributes>?
    private var last: StoryActivityAttributes.ContentState?

    func start(started: Date = Date(), state: StoryActivityAttributes.ContentState) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        for a in Activity<StoryActivityAttributes>.activities where a.id != activity?.id {
            Task { await a.end(nil, dismissalPolicy: .immediate) }
        }
        if activity != nil {
            update(state)
            return
        }
        activity = try? Activity.request(
            attributes: StoryActivityAttributes(started: started),
            content: .init(state: state, staleDate: nil),
            pushType: nil
        )
        last = state
    }

    func update(_ state: StoryActivityAttributes.ContentState) {
        guard let activity, state != last else { return }
        last = state
        Task { await activity.update(.init(state: state, staleDate: nil)) }
    }

    func end() {
        guard let activity else { return }
        self.activity = nil
        last = nil
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }
}
