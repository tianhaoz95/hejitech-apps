package com.hejitech.contempo.data

import com.google.firebase.Firebase
import com.google.firebase.remoteconfig.remoteConfig
import com.google.firebase.remoteconfig.remoteConfigSettings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await

private const val KEY_CLOUD_AI_ENABLED = "cloud_ai_enabled"
private const val DEFAULT_CLOUD_AI_ENABLED = true
private const val MIN_FETCH_INTERVAL_SECONDS = 3_600L

/**
 * A remote kill switch for cloud AI usage — cloud calls (Genkit's
 * parseEntry/askAgent Cloud Functions) cost real money per request, unlike
 * on-device inference, so this exists to cut that cost off instantly (a
 * console change, not a Play Store release) if it ever needs to happen.
 * Gated centrally in ServiceLocator's AgentClient.inferencePreference lambda
 * — every AgentClient call site (parseEntry, draftEntryFromPhoto,
 * askQuestion, ...) benefits without each needing its own check, and
 * SettingsViewModel/Screen read [cloudAiEnabled] too so the "Cloud only"
 * option doesn't sit there silently lying about what it does.
 *
 * [cloudAiEnabled]'s Kotlin-side default (true) holds until [refresh]
 * actually completes — deliberately not read from the Firebase SDK's own
 * getBoolean() before that, since an un-awaited setDefaultsAsync() leaves a
 * window where getBoolean() would return the SDK's built-in false-for-unset
 * fallback instead of ours, which would fail this closed instead of open on
 * a cold start with no cached fetch yet.
 */
class RemoteConfigStore {
    private val remoteConfig = Firebase.remoteConfig

    private val _cloudAiEnabled = MutableStateFlow(DEFAULT_CLOUD_AI_ENABLED)
    val cloudAiEnabled: StateFlow<Boolean> = _cloudAiEnabled.asStateFlow()

    init {
        remoteConfig.setConfigSettingsAsync(
            remoteConfigSettings { minimumFetchIntervalInSeconds = MIN_FETCH_INTERVAL_SECONDS }
        )
    }

    /** Best-effort, called once from ContempoApp.onCreate() — see its call site for why failures are silently swallowed. */
    suspend fun refresh() {
        runCatching {
            remoteConfig.setDefaultsAsync(mapOf(KEY_CLOUD_AI_ENABLED to DEFAULT_CLOUD_AI_ENABLED)).await()
            remoteConfig.fetchAndActivate().await()
            _cloudAiEnabled.value = remoteConfig.getBoolean(KEY_CLOUD_AI_ENABLED)
        }
    }
}
