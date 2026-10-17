package com.hejitech.contempo.data

import android.content.Context
import com.hejitech.contempo.agent.AgentClient
import com.hejitech.contempo.agent.AudioRecorder
import com.hejitech.contempo.agent.InferencePreference
import com.hejitech.contempo.agent.LiteRtLlm
import com.hejitech.contempo.agent.OnDeviceLlm
import com.hejitech.contempo.agent.WhisperTranscriber
import com.hejitech.contempo.auth.AuthManager
import com.hejitech.contempo.auth.WatchAuthTokenRelay
import com.hejitech.contempo.capture.PendingCaptureStore
import com.hejitech.contempo.capture.QuickCaptureStatsStore
import com.hejitech.core.data.AudioCaptureQueue
import com.hejitech.core.data.EntryRepository
import com.hejitech.core.data.SupabaseEntryRepository
import com.hejitech.core.data.MileageTripCoordinator
import com.hejitech.core.data.SubscriptionRepository
import com.hejitech.core.data.TextCaptureQueue
import com.hejitech.core.data.TimerEntryCoordinator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Manual service locator instead of Hilt/Dagger — deliberate for MVP:
 * fewer moving parts, faster to read for a one-person team, easy to swap
 * for real DI later once the app has enough screens/tests to justify it.
 * Don't grow this into a general-purpose framework; if it starts hurting,
 * that's the signal to adopt Hilt, not to build more plumbing here.
 */
object ServiceLocator {
    // Application Context, so non-Composable call sites (CaptureViewModel's
    // voice-triggered trip start/stop) can start/stop MileageTrackingService
    // without needing to be an AndroidViewModel — mirrors how audioRecorder/
    // whisperTranscriber below are already handed this same applicationContext
    // at init time.
    lateinit var appContext: Context
        private set
    lateinit var entryRepository: EntryRepository
        private set
    lateinit var agentClient: AgentClient
        private set
    lateinit var authManager: AuthManager
        private set
    lateinit var aiSettingsStore: AiSettingsStore
        private set
    lateinit var remoteConfigStore: RemoteConfigStore
        private set
    lateinit var onDeviceLlm: OnDeviceLlm
        private set
    lateinit var audioRecorder: AudioRecorder
        private set
    lateinit var whisperTranscriber: WhisperTranscriber
        private set
    lateinit var timerEntryCoordinator: TimerEntryCoordinator
        private set
    lateinit var mileageTripCoordinator: MileageTripCoordinator
        private set
    lateinit var audioCaptureQueue: AudioCaptureQueue
        private set
    lateinit var textCaptureQueue: TextCaptureQueue
        private set
    lateinit var quickCaptureSettingsStore: QuickCaptureSettingsStore
        private set
    lateinit var shakeToReportSettingsStore: ShakeToReportSettingsStore
        private set
    lateinit var onboardingStore: OnboardingStore
        private set
    lateinit var pendingCaptureStore: PendingCaptureStore
        private set
    lateinit var quickCaptureStatsStore: QuickCaptureStatsStore
        private set
    lateinit var captureLanguageStore: CaptureLanguageStore
        private set
    lateinit var captureModeStore: CaptureModeStore
        private set
    lateinit var subscriptionRepository: SubscriptionRepository
        private set

    // Process-lifetime scope for cross-screen background work (currently
    // just OnDeviceLlm's status/download tracking) — same lifetime as the
    // other singletons here, never cancelled short of process death.
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /**
     * Backs the InferencePreference downgrade below and SettingsViewModel's
     * UI gate — see reports/pricing-proposal-v0.html §3.2. Fails closed
     * (starts false) until the first Firestore snapshot arrives, and again on
     * any listener error, rather than risk unlocking cloud AI for a Free
     * account.
     */
    private val _hasProEntitlement = MutableStateFlow(false)
    val hasProEntitlement: StateFlow<Boolean> = _hasProEntitlement.asStateFlow()

    fun initialize(context: Context) {
        appContext = context.applicationContext
        entryRepository = SupabaseEntryRepository(context.applicationContext)
        timerEntryCoordinator = TimerEntryCoordinator(entryRepository)
        mileageTripCoordinator = MileageTripCoordinator(entryRepository)
        audioCaptureQueue = AudioCaptureQueue()
        textCaptureQueue = TextCaptureQueue()
        quickCaptureSettingsStore = QuickCaptureSettingsStore(context)
        shakeToReportSettingsStore = ShakeToReportSettingsStore(context)
        onboardingStore = OnboardingStore(context)
        pendingCaptureStore = PendingCaptureStore(context)
        quickCaptureStatsStore = QuickCaptureStatsStore(context)
        captureLanguageStore = CaptureLanguageStore(context)
        captureModeStore = CaptureModeStore(context)
        aiSettingsStore = AiSettingsStore(context)
        remoteConfigStore = RemoteConfigStore()
        subscriptionRepository = SubscriptionRepository()
        appScope.launch {
            subscriptionRepository.observeHasProEntitlement().collect { _hasProEntitlement.value = it }
        }
        // LiteRtLlm (Gemma 4 E2B via LiteRT-LM) is the active OnDeviceLlm —
        // see OnDeviceLlm's kdoc for why this replaced Gemini Nano/AICore
        // (GeminiNanoLlm, kept but unused). Swapping back, or to a future
        // runtime, means changing only this line.
        onDeviceLlm = LiteRtLlm(context, aiSettingsStore, appScope)
        agentClient = AgentClient(
            onDeviceLlm = onDeviceLlm,
            entryRepository = entryRepository,
            // Remotely disabling cloud AI (RemoteConfigStore's kill switch), or
            // not currently holding a Pro entitlement (reports/pricing-proposal-v0.html
            // §3.2), overrides the user's own stored preference rather than
            // just gating it in Settings — a user who picked CLOUD_ONLY or
            // PREFER_ON_DEVICE while on Pro, then downgrades to Free, shouldn't
            // need to touch Settings for the downgrade to actually take effect.
            inferencePreference = {
                val stored = aiSettingsStore.preference.value
                val allowedByEntitlement = hasProEntitlement.value || stored == InferencePreference.ON_DEVICE_ONLY
                val allowedByRemoteConfig = remoteConfigStore.cloudAiEnabled.value || stored == InferencePreference.ON_DEVICE_ONLY
                if (allowedByEntitlement && allowedByRemoteConfig) stored else InferencePreference.ON_DEVICE_ONLY
            },
        )
        authManager = AuthManager(context.applicationContext)
        WatchAuthTokenRelay(context.applicationContext, appScope).start()
        audioRecorder = AudioRecorder(context.applicationContext)
        whisperTranscriber = WhisperTranscriber(context.applicationContext)
    }
}
