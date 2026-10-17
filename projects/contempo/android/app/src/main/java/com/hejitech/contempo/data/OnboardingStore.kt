package com.hejitech.contempo.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Plain SharedPreferences, same reasoning and shape as
 * ShakeToReportSettingsStore/QuickCaptureSettingsStore — a single boolean
 * for whether this device has ever completed (or skipped) the first-launch
 * onboarding walkthrough. Deliberately device-scoped, not account-scoped:
 * SharedPreferences, not Firestore, so a user signing into an existing
 * account on a new device still sees onboarding once here, matching the
 * product ask ("regardless of whether they already have an account or not").
 */
class OnboardingStore(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("onboarding_settings", Context.MODE_PRIVATE)

    private val _hasCompleted = MutableStateFlow(prefs.getBoolean(KEY, false))
    val hasCompleted: StateFlow<Boolean> = _hasCompleted.asStateFlow()

    fun setCompleted(value: Boolean) {
        prefs.edit().putBoolean(KEY, value).apply()
        _hasCompleted.value = value
    }

    private companion object {
        const val KEY = "has_completed_onboarding"
    }
}
