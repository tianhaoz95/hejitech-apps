package com.hejitech.wear.timer

import android.content.Context
import android.content.SharedPreferences

data class CompletedWorkTimer(
    val startedAtMs: Long,
    val stoppedAtMs: Long,
    val durationMinutes: Int,
    val task: String,
    val property: String,
)

class WearWorkTimerStore(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("wear_work_timer_prefs", Context.MODE_PRIVATE)

    fun startTimer(task: String = "STR General Work", property: String = "") {
        prefs.edit()
            .putLong(KEY_STARTED_AT_MS, System.currentTimeMillis())
            .putString(KEY_TASK, task)
            .putString(KEY_PROPERTY, property)
            .apply()
    }

    fun isTimerRunning(): Boolean {
        return prefs.getLong(KEY_STARTED_AT_MS, 0L) > 0L
    }

    fun getStartedAtMs(): Long {
        return prefs.getLong(KEY_STARTED_AT_MS, 0L)
    }

    fun getTask(): String {
        return prefs.getString(KEY_TASK, "STR General Work") ?: "STR General Work"
    }

    fun getProperty(): String {
        return prefs.getString(KEY_PROPERTY, "") ?: ""
    }

    fun getElapsedSeconds(): Int {
        val start = getStartedAtMs()
        if (start == 0L) return 0
        return maxOf(0, ((System.currentTimeMillis() - start) / 1000L).toInt())
    }

    fun getElapsedMinutes(): Int {
        return maxOf(0, getElapsedSeconds() / 60)
    }

    fun stopAndCompleteTimer(): CompletedWorkTimer? {
        val start = getStartedAtMs()
        if (start == 0L) return null

        val stopMs = System.currentTimeMillis()
        val task = getTask()
        val property = getProperty()
        val elapsedSec = maxOf(0, ((stopMs - start) / 1000L).toInt())
        val minutes = maxOf(1, minOf(12 * 60, (elapsedSec + 30) / 60))

        clearTimer()

        return CompletedWorkTimer(
            startedAtMs = start,
            stoppedAtMs = stopMs,
            durationMinutes = minutes,
            task = task,
            property = property,
        )
    }

    fun clearTimer() {
        prefs.edit()
            .remove(KEY_STARTED_AT_MS)
            .remove(KEY_TASK)
            .remove(KEY_PROPERTY)
            .apply()
    }

    companion object {
        private const val KEY_STARTED_AT_MS = "started_at_ms"
        private const val KEY_TASK = "task"
        private const val KEY_PROPERTY = "property"
    }
}
