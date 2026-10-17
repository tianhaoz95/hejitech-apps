#if canImport(ActivityKit)
import ActivityKit
import AppIntents
import ContempoFirestore
import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage
import Foundation

/// Interactive Live Activity buttons for pause/resume. Unlike a normal widget
/// `AppIntent`, a `LiveActivityIntent`'s `perform()` always runs inside the
/// containing app's process (launching it in the background first if
/// needed) rather than the widget extension's — so this can safely construct
/// the same Firestore-backed coordinators the rest of the app uses and push
/// the result straight onto the activity via `Activity<...>.activities`, no
/// App Group hop required. Declared in this shared directory (see
/// project.yml's `Contempo/Sources/Shared` entries on both the `Contempo` and
/// `ContempoWidgets` targets) so both targets compile the identical
/// implementation, which `Button(intent:)` in the widget's Live Activity view
/// requires.
private func makeRepository() -> FirestoreEntryRepository {
    FirestoreEntryRepository(firestore: Firestore.firestore(), auth: Auth.auth(), storage: Storage.storage())
}

private func applyTimerState(from entry: Entry) async {
    guard let activity = Activity<TimerActivityAttributes>.activities.first else { return }
    var state = activity.content.state
    state.isPaused = entry.isPaused ?? false
    state.pausedAt = entry.pausedAt?.dateValue()
    state.pausedDurationSeconds = Double(entry.pausedDurationSeconds ?? 0)
    await activity.update(ActivityContent(state: state, staleDate: nil))
}

private func applyTripState(from entry: Entry) async {
    guard let activity = Activity<TripActivityAttributes>.activities.first else { return }
    var state = activity.content.state
    state.isPaused = entry.isPaused ?? false
    await activity.update(ActivityContent(state: state, staleDate: nil))
}

struct PauseWorkIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Pause"

    func perform() async throws -> some IntentResult {
        let repository = makeRepository()
        let coordinator = TimerEntryCoordinator(entryRepository: repository)
        _ = try? await coordinator.handlePause(pausedAt: Timestamp(date: Date()))
        if let entry = try? await repository.findOpenEntry(isTrip: false) {
            await applyTimerState(from: entry)
        }
        return .result()
    }
}

struct ResumeWorkIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Resume"

    func perform() async throws -> some IntentResult {
        let repository = makeRepository()
        let coordinator = TimerEntryCoordinator(entryRepository: repository)
        _ = try? await coordinator.handleResume(resumedAt: Timestamp(date: Date()))
        if let entry = try? await repository.findOpenEntry(isTrip: false) {
            await applyTimerState(from: entry)
        }
        return .result()
    }
}

struct PauseTripIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Pause"

    func perform() async throws -> some IntentResult {
        let repository = makeRepository()
        let coordinator = MileageTripCoordinator(entryRepository: repository)
        _ = try? await coordinator.handlePauseTrip(pausedAt: Timestamp(date: Date()))
        if let entry = try? await repository.findOpenEntry(isTrip: true) {
            await applyTripState(from: entry)
        }
        return .result()
    }
}

struct ResumeTripIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Resume"

    func perform() async throws -> some IntentResult {
        let repository = makeRepository()
        let coordinator = MileageTripCoordinator(entryRepository: repository)
        _ = try? await coordinator.handleResumeTrip(resumedAt: Timestamp(date: Date()))
        if let entry = try? await repository.findOpenEntry(isTrip: true) {
            await applyTripState(from: entry)
        }
        return .result()
    }
}
#endif
