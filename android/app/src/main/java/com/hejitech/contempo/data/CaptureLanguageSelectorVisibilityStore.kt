package com.hejitech.contempo.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Plain SharedPreferences, same reasoning as QuickCaptureSettingsStore — a
 * single boolean doesn't need DataStore. Defaults to hidden: most hosts
 * never need to change capture language away from English, so the selector
 * row on the Capture tab only earns its screen space once someone opts in
 * via Settings.
 */
class CaptureLanguageSelectorVisibilityStore(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("capture_language_selector_settings", Context.MODE_PRIVATE)

    private val _visible = MutableStateFlow(prefs.getBoolean(KEY, false))
    val visible: StateFlow<Boolean> = _visible.asStateFlow()

    fun setVisible(value: Boolean) {
        prefs.edit().putBoolean(KEY, value).apply()
        _visible.value = value
    }

    private companion object {
        const val KEY = "capture_language_selector_visible"
    }
}
