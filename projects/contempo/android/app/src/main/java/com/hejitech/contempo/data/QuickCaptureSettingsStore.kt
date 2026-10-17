package com.hejitech.contempo.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Plain SharedPreferences, same reasoning as AiSettingsStore — a single
 * boolean doesn't need DataStore. Persists across restarts since Quick
 * Capture is a standing mode a host would toggle on for a stretch of work
 * (e.g. walking a property doing several quick notes), not a one-off.
 */
class QuickCaptureSettingsStore(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("quick_capture_settings", Context.MODE_PRIVATE)

    private val _enabled = MutableStateFlow(prefs.getBoolean(KEY, false))
    val enabled: StateFlow<Boolean> = _enabled.asStateFlow()

    fun setEnabled(value: Boolean) {
        prefs.edit().putBoolean(KEY, value).apply()
        _enabled.value = value
    }

    private companion object {
        const val KEY = "quick_capture_enabled"
    }
}
