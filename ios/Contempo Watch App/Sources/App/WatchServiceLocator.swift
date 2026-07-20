import ContempoCore
import FirebaseAuth
import FirebaseCore
import FirebaseStorage
import Foundation

/// Manual service locator, same deliberate reasoning as the phone app's
/// `ServiceLocator` — mirrors it in spirit, but with a much smaller surface:
/// no `ContempoFirestore` (SDK-based Firestore isn't available on watchOS at
/// all), so entry reads/writes go through the two REST-based types in
/// `ContempoCore` (`WatchAudioCaptureQueueWriter`, `WatchEntryStatsReader`)
/// instead.
@MainActor
enum WatchServiceLocator {
    /// Shares progress data with the `Contempo Watch Widgets` complication
    /// extension — see `HoursProgressStore`'s doc comment. Must match the
    /// App Group entitlement configured on both targets in `project.yml`.
    static let appGroupId = "group.com.hejitech.contempo"

    static let audioRecorder = WatchAudioRecorder()
    static let pendingCaptureStore = PendingCaptureStore()
    static let uploadStatsStore = UploadStatsStore()
    static let hoursProgressStore = HoursProgressStore(appGroupId: appGroupId)

    static let audioCaptureQueueWriter = WatchAudioCaptureQueueWriter(
        projectId: FirebaseApp.app()?.options.projectID ?? "",
        emulatorHost: FirebaseBootstrap.emulatorHost
    )
    static let entryStatsReader = WatchEntryStatsReader(
        projectId: FirebaseApp.app()?.options.projectID ?? "",
        emulatorHost: FirebaseBootstrap.emulatorHost
    )
}
