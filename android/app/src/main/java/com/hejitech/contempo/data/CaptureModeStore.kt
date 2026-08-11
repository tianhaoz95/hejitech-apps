package com.hejitech.contempo.data

import android.content.Context
import com.hejitech.contempo.ui.capture.CaptureMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The persisted *default* capture mode, set from Settings — distinct from
 * CaptureViewModel's own in-session captureMode/setCaptureMode, which reads
 * this store's value once at construction and never writes back to it (see
 * CaptureViewModel's captureMode kdoc). Same SharedPreferences approach as
 * AiSettingsStore.
 */
class CaptureModeStore(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences("capture_mode_settings", Context.MODE_PRIVATE)

    private val _defaultMode = MutableStateFlow(readStoredMode())
    val defaultMode: StateFlow<CaptureMode> = _defaultMode.asStateFlow()

    fun setDefaultMode(value: CaptureMode) {
        prefs.edit().putString(KEY, value.name).apply()
        _defaultMode.value = value
    }

    private fun readStoredMode(): CaptureMode {
        val stored = prefs.getString(KEY, null) ?: return CaptureMode.AUDIO_FIRST
        return runCatching { CaptureMode.valueOf(stored) }
            .getOrDefault(CaptureMode.AUDIO_FIRST)
    }

    private companion object {
        const val KEY = "default_capture_mode"
    }
}
