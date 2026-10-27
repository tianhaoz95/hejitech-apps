package com.hejitech.headway.wear.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.*
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import com.hejitech.headway.core.model.Clock
import com.hejitech.headway.wear.MainActivity
import com.hejitech.headway.wear.sync.WearStore

class NextTrainComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        return when (type) {
            ComplicationType.SHORT_TEXT -> shortText("8:14", "SF", "Next Caltrain 8:14 AM")
            else -> null
        }
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        WearStore.init(applicationContext)
        val state = WearStore.syncState.value
        val train = state?.board?.trains?.firstOrNull()
        val toShort = state?.board?.to?.short ?: "SF"

        if (train == null) {
            return shortText("—", toShort, "No upcoming Caltrain")
        }

        val depTime = Clock.time(train.predDep)
        val until = Clock.until(train.predDep)
        val delayMin = train.delayMin
        val delayPart = if (delayMin != null && delayMin > 0) " +${delayMin}m" else ""

        return when (request.complicationType) {
            ComplicationType.SHORT_TEXT -> {
                shortText("$until$delayPart", toShort, "Train #${train.train} to $toShort in $until ($depTime)")
            }
            else -> null
        }
    }

    private fun shortText(text: String, title: String, description: String): ShortTextComplicationData {
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(text).build(),
            contentDescription = PlainComplicationText.Builder(description).build()
        )
            .setTitle(PlainComplicationText.Builder(title).build())
            .setTapAction(
                PendingIntent.getActivity(
                    this,
                    0,
                    Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE
                )
            )
            .build()
    }
}
