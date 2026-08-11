package com.hejitech.contempo.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Plain SharedPreferences, same reasoning as QuickCaptureSettingsStore — a
 * single boolean doesn't need DataStore. Persists across restarts since
 * shake-to-report is a standing preference, not a one-off. See
 * MainActivity's ShakeDetector registration and FeedbackAnnotationScreen.
 */
class ShakeToReportSettingsStore(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("shake_to_report_settings", Context.MODE_PRIVATE)

    private val _enabled = MutableStateFlow(prefs.getBoolean(KEY, false))
    val enabled: StateFlow<Boolean> = _enabled.asStateFlow()

    fun setEnabled(value: Boolean) {
        prefs.edit().putBoolean(KEY, value).apply()
        _enabled.value = value
    }

    private companion object {
        const val KEY = "shake_to_report_enabled"
    }
}
