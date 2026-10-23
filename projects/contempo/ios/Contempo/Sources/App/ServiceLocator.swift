import ContempoCore
import ContempoData
import Foundation

/// Manual service locator instead of a DI framework — deliberate for MVP:
/// fewer moving parts, faster to read for a one-person team, easy to swap
/// for real DI later once the app has enough screens/tests to justify it.
/// Mirrors Android's `ServiceLocator` object 1:1 in spirit. Don't grow this
/// into a general-purpose framework; if it starts hurting, that's the signal
/// to adopt one, not to build more plumbing here.
@MainActor
enum ServiceLocator {
    static let entryRepository: EntryRepository = SupabaseEntryRepository()
    static let audioCaptureQueue = AudioCaptureQueue()
    static let textCaptureQueue = TextCaptureQueue()
    static let timerEntryCoordinator = TimerEntryCoordinator(entryRepository: entryRepository)
    static let mileageTripCoordinator = MileageTripCoordinator(entryRepository: entryRepository)
    static let mileageTracker = MileageTracker()
    static let authManager = AuthManager()
    static let subscriptionStore = SubscriptionStore()
    static let modelDownloader = ModelDownloader()
    // LiteRtLlm (Gemma 4 E2B via LiteRT-LM) is the active OnDeviceLlm.
    // Swapping runtimes means changing only this line.
    static let onDeviceLlm: OnDeviceLlm = LiteRtLlm(downloader: modelDownloader)
    static let audioRecorder = AudioRecorder()
    static let whisperTranscriber = WhisperTranscriber()
    static let captureLanguageStore = CaptureLanguageStore()
    static let captureModeStore = CaptureModeStore()
    static let quickCaptureSettingsStore = QuickCaptureSettingsStore()
    static let quickCaptureStatsStore = QuickCaptureStatsStore()
    static let pendingCaptureStore = PendingCaptureStore()
    static let shakeToReportSettingsStore = ShakeToReportSettingsStore()
    static let taxTestStore = TaxTestStore()
    static let onboardingStore = OnboardingStore()
    static let agentClient = AgentClient(onDeviceLlm: onDeviceLlm, entryRepository: entryRepository)
    static let appGroupId = "group.com.hejitech.contempoapp"
    static let hoursProgressStore = HoursProgressStore(appGroupId: appGroupId)

}
