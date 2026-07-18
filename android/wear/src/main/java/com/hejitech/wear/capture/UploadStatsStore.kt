package com.hejitech.wear.capture

import android.content.Context
import java.time.LocalDate

private const val PREFS_NAME = "upload_stats"
private const val KEY_DATE = "date"
private const val KEY_COUNT = "count"

/**
 * Tiny persisted "how many recordings uploaded today" counter, shown on the
 * Capture screen alongside the live pending-upload count — see
 * WearCaptureViewModel. Resets automatically the first time it's touched on
 * a new day; deliberately not tied to Firestore (the audioCaptures queue doc
 * is deleted once the phone processes it, so it can't answer "how many
 * uploaded today" after the fact — this is local, upload-time bookkeeping).
 */
class UploadStatsStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun recordUpload() {
        val today = LocalDate.now().toString()
        val count = if (prefs.getString(KEY_DATE, null) == today) prefs.getInt(KEY_COUNT, 0) + 1 else 1
        prefs.edit().putString(KEY_DATE, today).putInt(KEY_COUNT, count).apply()
    }

    fun getUploadedTodayCount(): Int {
        val today = LocalDate.now().toString()
        return if (prefs.getString(KEY_DATE, null) == today) prefs.getInt(KEY_COUNT, 0) else 0
    }
}
