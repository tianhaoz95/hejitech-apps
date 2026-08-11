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
    static let textCaptureQueue = TextCaptureQueue(firestore: Firestore.firestore(), auth: Auth.auth())
    static let timerEntryCoordinator = TimerEntryCoordinator(entryRepository: entryRepository)
    static let mileageTripCoordinator = MileageTripCoordinator(entryRepository: entryRepository)
    static let mileageTracker = MileageTracker()
    static let authManager = AuthManager()
    static let aiSettingsStore = AiSettingsStore()
    static let remoteConfigStore = RemoteConfigStore()
    static let subscriptionStore = SubscriptionStore()
    static let modelDownloader = ModelDownloader()
    // LiteRtLlm (Gemma 4 E2B via LiteRT-LM) is the active OnDeviceLlm.
    // Swapping runtimes means changing only this line.
    static let onDeviceLlm: OnDeviceLlm = LiteRtLlm(downloader: modelDownloader, aiSettingsStore: aiSettingsStore)
    static let audioRecorder = AudioRecorder()
    static let whisperTranscriber = WhisperTranscriber()
    static let captureLanguageStore = CaptureLanguageStore()
    static let captureModeStore = CaptureModeStore()
    static let quickCaptureSettingsStore = QuickCaptureSettingsStore()
    static let quickCaptureStatsStore = QuickCaptureStatsStore()
    static let pendingCaptureStore = PendingCaptureStore()
    static let shakeToReportSettingsStore = ShakeToReportSettingsStore()
    static let currentScreenTracker = CurrentScreenTracker()
    static let agentClient = AgentClient(
        onDeviceLlm: onDeviceLlm,
        functions: Functions.functions(),
        entryRepository: entryRepository,
        // Remotely disabling cloud AI, or not currently holding a Pro
        // entitlement (reports/pricing-proposal-v0.html §3.2), overrides the
        // user's own stored preference rather than just gating it in
        // Settings — a user who picked .cloudOnly or .preferOnDevice while
        // on Pro, then downgrades to Free, shouldn't need to touch Settings
        // for the downgrade to actually take effect.
        inferencePreference: {
            let stored = aiSettingsStore.preference
            let allowedByEntitlement = subscriptionStore.hasProEntitlement || stored == .onDeviceOnly
            let allowedByRemoteConfig = remoteConfigStore.cloudAiEnabled || stored == .onDeviceOnly
            return (allowedByEntitlement && allowedByRemoteConfig) ? stored : .onDeviceOnly
        }
    )
}
