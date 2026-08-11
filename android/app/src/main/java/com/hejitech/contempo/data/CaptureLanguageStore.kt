package com.hejitech.contempo.data

import android.content.Context
import com.hejitech.core.model.CaptureLanguage
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Persists the app-level capture-language preference (set from Settings)
 * across app restarts — same simple SharedPreferences pattern as
 * QuickCaptureSettingsStore, same reasoning (a single small enum value
 * doesn't need DataStore).
 *
 * This only remembers the current preference — the language that actually
 * gets used for a given recording is stamped onto that specific capture at
 * record time (see CaptureLanguage's kdoc), not re-read from here when
 * background processing eventually runs.
 */
class CaptureLanguageStore(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("capture_language_settings", Context.MODE_PRIVATE)

    private val _selected = MutableStateFlow(loadSelected())
    val selected: StateFlow<CaptureLanguage> = _selected.asStateFlow()

    fun setSelected(language: CaptureLanguage) {
        prefs.edit().putString(KEY, language.name).apply()
        _selected.value = language
    }

    private fun loadSelected(): CaptureLanguage =
        runCatching { CaptureLanguage.valueOf(prefs.getString(KEY, null) ?: DEFAULT.name) }
            .getOrDefault(DEFAULT)

    private companion object {
        // English is the safer silent default for hosts who never open
        // Settings, vs. AUTO's per-recording language-detection
        // overhead/uncertainty.
        val DEFAULT = CaptureLanguage.ENGLISH
        const val KEY = "selected_language"
    }
}
