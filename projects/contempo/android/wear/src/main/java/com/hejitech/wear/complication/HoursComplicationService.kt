package com.hejitech.wear.complication

import com.hejitech.core.supabase.ContempoBackend
import com.hejitech.wear.data.fetchConfirmedHours
import android.app.PendingIntent
import android.content.Intent
import com.hejitech.wear.MainActivity
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

private const val QUERY_TIMEOUT_MS = 8_000L

/**
 * A watch-face complication showing confirmed hours logged so far — the
 * "glance at your wrist, see your progress" surface, no app launch needed.
 * Tapping it opens MainActivity (same as the tile). Runs in the app's main
 * process, so WearApp.onCreate has already called Firebase.initialize by
 * the time the OS asks for data — same assumption the tile service makes.
 */
class HoursComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) return null
        return shortText("42h", "42 hours logged")
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        if (ContempoBackend.uid == null) return shortText("—", "Sign in to see hours logged")

        val hours = withTimeoutOrNull(QUERY_TIMEOUT_MS) { runCatching { fetchConfirmedHours() }.getOrNull() } ?: return null

        return shortText("${hours.toInt()}h", "${hours.toInt()} hours logged toward material participation")
    }

    private fun shortText(text: String, description: String): ShortTextComplicationData =
        ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(text).build(),
            contentDescription = PlainComplicationText.Builder(description).build(),
        )
            .setTapAction(
                PendingIntent.getActivity(
                    this,
                    0,
                    Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE,
                )
            )
            .build()
}
