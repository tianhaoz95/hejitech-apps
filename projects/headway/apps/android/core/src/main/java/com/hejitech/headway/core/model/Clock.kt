package com.hejitech.headway.core.model

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.floor

object Clock {
    val PACIFIC: TimeZone = TimeZone.getTimeZone("America/Los_Angeles")

    private val timeFormat = SimpleDateFormat("h:mm", Locale.US).apply {
        timeZone = PACIFIC
    }

    private val timeWithAmPmFormat = SimpleDateFormat("h:mm a", Locale.US).apply {
        timeZone = PACIFIC
    }

    fun time(epochMs: Double): String {
        return synchronized(timeFormat) {
            timeFormat.format(Date(epochMs.toLong()))
        }
    }

    fun timeWithAmPm(epochMs: Double): String {
        return synchronized(timeWithAmPmFormat) {
            timeWithAmPmFormat.format(Date(epochMs.toLong()))
        }
    }

    /**
     * Relative time string: "12m", "now", "1h05"
     */
    fun until(epochMs: Double, nowMs: Long = System.currentTimeMillis()): String {
        val diffMin = floor((epochMs - nowMs) / 60000.0).toInt()
        return when {
            diffMin <= 0 -> "now"
            diffMin < 100 -> "${diffMin}m"
            else -> {
                val h = diffMin / 60
                val m = diffMin % 60
                String.format(Locale.US, "%dh%02d", h, m)
            }
        }
    }

    /**
     * Converts "HH:MM" (e.g. "08:15") to total minutes from midnight.
     */
    fun minutes(hhmm: String): Int? {
        val parts = hhmm.split(":").mapNotNull { it.toIntOrNull() }
        if (parts.size != 2) return null
        val h = parts[0]
        val m = parts[1]
        if (h !in 0..23 || m !in 0..59) return null
        return h * 60 + m
    }

    /**
     * Converts total minutes from midnight to "HH:MM".
     */
    fun hhmm(minutes: Int): String {
        val h = (minutes / 60) % 24
        val m = minutes % 60
        return String.format(Locale.US, "%02d:%02d", h, m)
    }
}
