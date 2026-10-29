#if os(iOS) && canImport(ActivityKit)
import ActivityKit
import Foundation
import HeadwayKit

/// Manages ActivityKit Live Activities for tracked Caltrain trips:
/// starts, updates, ends, and registers push tokens (both push-to-start and per-activity update tokens).
@MainActor
public final class LiveActivityManager {
    public static let shared = LiveActivityManager()

    private var currentActivity: Activity<TrackActivityAttributes>?
    private var pushToStartTask: Task<Void, Never>?
    private var activityUpdatesTask: Task<Void, Never>?
    private var boardUpdatesTask: Task<Void, Never>?
    /// The pinned board's push token, so unpinning can drop it from the Worker.
    private var boardPushToken: String?

    private init() {}

    public func startMonitoring(backend: Backend) {
        observePushToStart(backend: backend)
        observeExistingActivities(backend: backend)
        for activity in Activity<BoardActivityAttributes>.activities {
            monitorBoardPushToken(activity, backend: backend)
        }
    }

    /// Observes push-to-start token updates (iOS 17.2+) and uploads the token to the Worker.
    private func observePushToStart(backend: Backend) {
        guard pushToStartTask == nil else { return }
        pushToStartTask = Task {
            if #available(iOS 17.2, *) {
                for await tokenData in Activity<TrackActivityAttributes>.pushToStartTokenUpdates {
                    let token = tokenData.map { String(format: "%02x", $0) }.joined()
                    try? await backend.registerActivityToken(token: token, kind: "start", sandbox: AppModel.isSandbox)
                }
            }
        }
    }

    /// Observes push tokens for active activities and sends them to the Worker.
    private func observeExistingActivities(backend: Backend) {
        guard activityUpdatesTask == nil else { return }
        activityUpdatesTask = Task {
            for await activity in Activity<TrackActivityAttributes>.activityUpdates {
                self.currentActivity = activity
                self.monitorActivityPushToken(activity, backend: backend)
            }
        }
    }

    private func monitorActivityPushToken(_ activity: Activity<TrackActivityAttributes>, backend: Backend) {
        Task {
            for await tokenData in activity.pushTokenUpdates {
                let token = tokenData.map { String(format: "%02x", $0) }.joined()
                try? await backend.registerActivityToken(
                    token: token,
                    kind: "update",
                    tripId: activity.attributes.tripId,
                    sandbox: AppModel.isSandbox
                )
            }
        }
    }

    /// Starts or updates a Live Activity for a tracked train.
    public func syncTracked(_ tracked: TrackedWithProgress?, backend: Backend) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        guard let tracked, !tracked.progress.arrived else {
            await endCurrentActivity()
            return
        }

        let p = tracked.progress
        let contentState = TrackActivityAttributes.ContentState(
            predArr: p.predArr,
            delayMin: p.delayMin,
            next: p.next?.name,
            nextPred: p.next?.pred,
            stopsLeft: p.stopsLeft,
            cancelled: p.cancelled,
            arrived: p.arrived
        )

        // If an activity is already active for this trip, update it.
        if let current = Activity<TrackActivityAttributes>.activities.first(where: { $0.attributes.tripId == tracked.tripId }) {
            self.currentActivity = current
            await current.update(ActivityContent(state: contentState, staleDate: Date(timeIntervalSinceNow: 180)))
            return
        }

        // Otherwise end any other existing activities and start a new one.
        await endCurrentActivity()

        let attributes = TrackActivityAttributes(
            tripId: tracked.tripId,
            train: p.train,
            kind: p.kind,
            to: p.to.name
        )

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: contentState, staleDate: Date(timeIntervalSinceNow: 180)),
                pushType: .token
            )
            self.currentActivity = activity
            monitorActivityPushToken(activity, backend: backend)
        } catch {
            // Live Activity request can be denied by system or user preference
        }
    }

    // MARK: "next trains" board

    /// The board pinned to the Lock Screen, if any.
    public var pinnedBoard: BoardActivityAttributes? {
        Activity<BoardActivityAttributes>.activities.first { $0.activityState == .active }?.attributes
    }

    public var activitiesEnabled: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    /// Pins `board`'s next trains to the Lock Screen and Dynamic Island (replacing any other pinned board).
    public func pinBoard(_ board: Board, backend: Backend) async throws {
        await unpinBoard(backend: backend)
        let attributes = BoardActivityAttributes(fromId: board.from.id, toId: board.to.id, fromShort: board.from.short, toShort: board.to.short)
        let activity = try Activity.request(
            attributes: attributes,
            content: ActivityContent(state: .init(board: board), staleDate: Date(timeIntervalSinceNow: 180)),
            pushType: .token
        )
        monitorBoardPushToken(activity, backend: backend)
    }

    public func unpinBoard(backend: Backend) async {
        if let token = boardPushToken {
            try? await backend.unregisterActivityToken(token: token)
            boardPushToken = nil
        }
        for activity in Activity<BoardActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }

    /// Keeps the pinned board current while the app is open (the cron pushes it the rest of the time).
    public func syncBoard(_ board: Board?) async {
        guard let board else { return }
        for activity in Activity<BoardActivityAttributes>.activities
        where activity.attributes.fromId == board.from.id && activity.attributes.toId == board.to.id {
            await activity.update(ActivityContent(state: .init(board: board), staleDate: Date(timeIntervalSinceNow: 180)))
        }
    }

    private func monitorBoardPushToken(_ activity: Activity<BoardActivityAttributes>, backend: Backend) {
        boardUpdatesTask?.cancel()
        boardUpdatesTask = Task {
            for await tokenData in activity.pushTokenUpdates {
                let token = tokenData.map { String(format: "%02x", $0) }.joined()
                self.boardPushToken = token
                try? await backend.registerActivityToken(token: token, kind: "update", tripId: activity.attributes.tokenKey, sandbox: AppModel.isSandbox)
            }
        }
    }

    public func endCurrentActivity() async {
        for activity in Activity<TrackActivityAttributes>.activities {
            await activity.end(dismissalPolicy: .immediate)
        }
        self.currentActivity = nil
    }
}
#endif
