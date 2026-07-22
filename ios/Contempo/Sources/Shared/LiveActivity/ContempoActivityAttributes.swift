#if canImport(ActivityKit)
import ActivityKit
import Foundation

/// Backs the "work in progress" Live Activity — the iOS equivalent of
/// Android's persistent `ongoing_work` notification
/// (`OngoingWorkNotificationService`). Compiled into both the `Contempo` app
/// target (which starts/updates/ends the activity) and the `ContempoWidgets`
/// extension (which renders it) — see `project.yml`'s shared sources entry.
struct TimerActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var subjectName: String
    }

    /// The moment the timer started — rendered via `Text(startedAt, style: .timer)`,
    /// which ticks live with no repeated Activity updates needed, same as
    /// Android's `setUsesChronometer(true)`.
    var startedAt: Date
}

/// Backs the "mileage trip in progress" Live Activity — the iOS equivalent
/// of Android's persistent `mileage_trip` notification
/// (`MileageTrackingService`). Unlike the timer, distance only changes on
/// each new GPS fix, so it needs an actual `ContentState` update per fix
/// rather than a self-ticking system view.
struct TripActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var miles: Double
    }
}
#endif
