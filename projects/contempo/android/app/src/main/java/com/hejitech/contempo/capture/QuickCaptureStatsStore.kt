package com.hejitech.contempo.capture

import android.content.Context
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Tiny persisted "how many Quick Capture recordings finished processing
 * today" counter — shown on the Capture tab's status indicator alongside the
 * live pending/processing counts (see CaptureViewModel.quickCaptureStatus).
 * Deliberately local, same reasoning as wear/capture/UploadStatsStore.kt:
 * once AudioCaptureProcessor finishes an item, its audioCaptures queue doc is
 * deleted, so Firestore alone can't answer "how many finished today" after
 * the fact — this is local, completion-time bookkeeping, mirroring that same
 * pattern one step further down the pipeline (uploaded vs. fully processed).
 */
class QuickCaptureStatsStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _completedToday = MutableStateFlow(loadTodayCount())
    val completedToday: StateFlow<Int> = _completedToday.asStateFlow()

    fun recordCompleted() {
        val today = LocalDate.now().toString()
        val count = if (prefs.getString(KEY_DATE, null) == today) prefs.getInt(KEY_COUNT, 0) + 1 else 1
        prefs.edit().putString(KEY_DATE, today).putInt(KEY_COUNT, count).apply()
        _completedToday.value = count
    }

    private fun loadTodayCount(): Int {
        val today = LocalDate.now().toString()
        return if (prefs.getString(KEY_DATE, null) == today) prefs.getInt(KEY_COUNT, 0) else 0
    }

    private companion object {
        const val PREFS_NAME = "quick_capture_stats"
        const val KEY_DATE = "date"
        const val KEY_COUNT = "count"
    }
}
