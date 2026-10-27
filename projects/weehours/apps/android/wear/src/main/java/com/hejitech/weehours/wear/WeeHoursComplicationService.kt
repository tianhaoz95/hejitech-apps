package com.hejitech.weehours.wear

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.LongTextComplicationData
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService

class SpeakComplicationService : SuspendingComplicationDataSourceService() {
    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        buildData(type = type, title = "Wee Hours", body = "Speak", deepLink = "weehours://listen", reqCode = 8101)

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val link = PhoneLink.getInstance(applicationContext)
        return buildData(
            type = request.complicationType,
            title = link.currentBaby.name,
            body = link.currentStatusLine(),
            deepLink = "weehours://listen",
            reqCode = 8101
        )
    }

    private fun buildData(
        type: ComplicationType,
        title: String,
        body: String,
        deepLink: String,
        reqCode: Int
    ): ComplicationData? {
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(deepLink)
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val pi = PendingIntent.getActivity(
            applicationContext,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return when (type) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(
                text = PlainComplicationText.Builder("Speak").build(),
                contentDescription = PlainComplicationText.Builder("Speak log entry in Wee Hours").build()
            )
                .setTitle(PlainComplicationText.Builder(title).build())
                .setTapAction(pi)
                .build()

            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(
                text = PlainComplicationText.Builder(body).build(),
                contentDescription = PlainComplicationText.Builder("$title: $body").build()
            )
                .setTitle(PlainComplicationText.Builder(title).build())
                .setTapAction(pi)
                .build()

            else -> null
        }
    }
}

class TiltComplicationService : SuspendingComplicationDataSourceService() {
    override fun getPreviewData(type: ComplicationType): ComplicationData? =
        buildData(type = type, title = "Tilt", body = "Tilt Log", reqCode = 8102)

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        val link = PhoneLink.getInstance(applicationContext)
        return buildData(
            type = request.complicationType,
            title = link.currentBaby.name,
            body = "Tilt Log",
            reqCode = 8102
        )
    }

    private fun buildData(
        type: ComplicationType,
        title: String,
        body: String,
        reqCode: Int
    ): ComplicationData? {
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("weehours://tilt")
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val pi = PendingIntent.getActivity(
            applicationContext,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return when (type) {
            ComplicationType.SHORT_TEXT -> ShortTextComplicationData.Builder(
                text = PlainComplicationText.Builder("Tilt").build(),
                contentDescription = PlainComplicationText.Builder("Open Wee Hours Tilt Compass").build()
            )
                .setTitle(PlainComplicationText.Builder(title).build())
                .setTapAction(pi)
                .build()

            ComplicationType.LONG_TEXT -> LongTextComplicationData.Builder(
                text = PlainComplicationText.Builder(body).build(),
                contentDescription = PlainComplicationText.Builder("Open Wee Hours Tilt Compass").build()
            )
                .setTitle(PlainComplicationText.Builder(title).build())
                .setTapAction(pi)
                .build()

            else -> null
        }
    }
}
