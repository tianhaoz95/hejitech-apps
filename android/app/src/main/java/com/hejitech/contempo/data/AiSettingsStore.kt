package com.hejitech.contempo.data

import android.content.Context
import com.hejitech.contempo.agent.InferencePreference
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Plain SharedPreferences, not DataStore — this is a single small enum
 * value, and this codebase already avoids extra framework weight for MVP
 * (see ServiceLocator's manual-DI comment). Exposes a StateFlow so
 * AgentClient and SettingsScreen both read live, not just at construction.
 */
class AiSettingsStore(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("ai_settings", Context.MODE_PRIVATE)

    private val _preference = MutableStateFlow(readStoredPreference())
    val preference: StateFlow<InferencePreference> = _preference.asStateFlow()

    fun setPreference(value: InferencePreference) {
        prefs.edit().putString(KEY, value.name).apply()
        _preference.value = value
    }

    private fun readStoredPreference(): InferencePreference {
        val stored = prefs.getString(KEY, null) ?: return InferencePreference.PREFER_ON_DEVICE
        return runCatching { InferencePreference.valueOf(stored) }
            .getOrDefault(InferencePreference.PREFER_ON_DEVICE)
    }

    private companion object {
        const val KEY = "inference_preference"
    }
}
