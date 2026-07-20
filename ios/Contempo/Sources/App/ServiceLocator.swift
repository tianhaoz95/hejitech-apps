import ContempoCore
import ContempoFirestore
import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions
import FirebaseStorage
import Foundation

/// Manual service locator instead of a DI framework — deliberate for MVP:
/// fewer moving parts, faster to read for a one-person team, easy to swap
/// for real DI later once the app has enough screens/tests to justify it.
/// Mirrors Android's `ServiceLocator` object 1:1 in spirit. Don't grow this
/// into a general-purpose framework; if it starts hurting, that's the signal
/// to adopt one, not to build more plumbing here.
@MainActor
enum ServiceLocator {
    static let entryRepository: EntryRepository = FirestoreEntryRepository(
        firestore: Firestore.firestore(),
        auth: Auth.auth(),
        storage: Storage.storage()
    )
    static let audioCaptureQueue = AudioCaptureQueue(firestore: Firestore.firestore(), auth: Auth.auth())
    static let timerEntryCoordinator = TimerEntryCoordinator(entryRepository: entryRepository)
    static let mileageTripCoordinator = MileageTripCoordinator(entryRepository: entryRepository)
    static let mileageTracker = MileageTracker()
    static let authManager = AuthManager()
    static let aiSettingsStore = AiSettingsStore()
    static let remoteConfigStore = RemoteConfigStore()
    static let modelDownloader = ModelDownloader()
    // LiteRtLlm (Gemma 4 E2B via LiteRT-LM) is the active OnDeviceLlm.
    // Swapping runtimes means changing only this line.
    static let onDeviceLlm: OnDeviceLlm = LiteRtLlm(downloader: modelDownloader, aiSettingsStore: aiSettingsStore)
    static let audioRecorder = AudioRecorder()
    static let whisperTranscriber = WhisperTranscriber()
    static let captureLanguageStore = CaptureLanguageStore()
    static let agentClient = AgentClient(
        onDeviceLlm: onDeviceLlm,
        functions: Functions.functions(),
        // Remotely disabling cloud AI overrides the user's own stored
        // preference, not just adds a separate check — a user who picked
        // .cloudOnly or .preferOnDevice before the switch flipped shouldn't
        // need to change their setting for the override to take effect.
        inferencePreference: {
            let stored = aiSettingsStore.preference
            if !remoteConfigStore.cloudAiEnabled && stored != .onDeviceOnly {
                return .onDeviceOnly
            }
            return stored
        }
    )
}
