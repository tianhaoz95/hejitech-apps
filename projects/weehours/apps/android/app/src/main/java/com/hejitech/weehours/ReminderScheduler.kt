package com.hejitech.weehours

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.hejitech.weehours.core.DerivedLog
import com.hejitech.weehours.core.Household
import com.hejitech.weehours.core.LogService
import com.hejitech.weehours.core.ReminderPlanner
import com.hejitech.weehours.core.Session
import java.util.Date

class ReminderScheduler(private val context: Context) {

    companion object {
        const val CHANNEL_REMINDERS = "weehours_reminders"
        const val CHANNEL_ONGOING = "weehours_ongoing_session"
        const val ONGOING_NOTIFICATION_ID = 4200
        private const val BASE_ALARM_REQ_CODE = 5100
        private const val MAX_SCHEDULED_ALARMS = 24

        const val EXTRA_TITLE = "extra_title"
        const val EXTRA_BODY = "extra_body"
        const val EXTRA_NOTIF_ID = "extra_notif_id"

        fun ensureChannels(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
                val reminders = NotificationChannel(
                    CHANNEL_REMINDERS,
                    "Care & Feed Reminders",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Feed, diaper, and open session reminders"
                }
                val ongoing = NotificationChannel(
                    CHANNEL_ONGOING,
                    "Active Feed & Sleep Timers",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Live timer for open feeding, nursing, sleep, or tummy time sessions"
                    setShowBadge(false)
                }
                nm.createNotificationChannel(reminders)
                nm.createNotificationChannel(ongoing)
            }
        }
    }

    init {
        ensureChannels(context)
    }

    fun syncNotifications(service: LogService, now: Date = Date()) {
        val household = service.household
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

        if (alarmManager != null) {
            for (i in 0 until MAX_SCHEDULED_ALARMS) {
                val pi = PendingIntent.getBroadcast(
                    context,
                    BASE_ALARM_REQ_CODE + i,
                    Intent(context, ReminderBroadcastReceiver::class.java),
                    PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
                )
                if (pi != null) {
                    alarmManager.cancel(pi)
                    pi.cancel()
                }
            }
        }

        val planned = ReminderPlanner.plan(
            logs = service.derivedByChild(),
            household = household,
            me = service.me,
            now = now
        )
        var alarmIdx = 0
        for (item in planned) {
            if (item.fireAt.after(now) && alarmIdx < MAX_SCHEDULED_ALARMS) {
                val babyName = item.baby?.let { household.babyName(it) } ?: household.babyName
                scheduleAlarm(
                    alarmManager = alarmManager,
                    index = alarmIdx++,
                    triggerAt = item.fireAt,
                    title = "$babyName · Wee Hours",
                    body = item.message
                )
            }
        }

        updateOngoingNotification(service, household)
    }

    private fun updateOngoingNotification(service: LogService, household: Household) {
        val nm = NotificationManagerCompat.from(context)
        val openDescriptions = mutableListOf<Pair<Date, String>>()

        for (baby in household.active) {
            val d: DerivedLog = service.derived(baby = baby.id)
            d.openFeedSession()?.let { feed ->
                val start = feed.start ?: Date()
                val kindLabel = if (feed.kind == Session.Kind.BREAST) {
                    val side = feed.sides.lastOrNull()?.replaceFirstChar { it.uppercase() } ?: ""
                    "Nursing ${if (side.isNotEmpty()) "($side)" else ""}".trim()
                } else {
                    "Bottle feed"
                }
                openDescriptions.add(start to "${baby.name}: $kindLabel")
            }
            d.openSession(Session.Kind.SLEEP)?.let { sleep ->
                val start = sleep.start ?: Date()
                openDescriptions.add(start to "${baby.name}: Sleeping")
            }
            for ((cat, ev) in service.openTimedActivities(baby = baby.id)) {
                openDescriptions.add(ev.occurredAt to "${baby.name}: ${cat.replace('_', ' ').replaceFirstChar { it.uppercase() }}")
            }
        }

        if (openDescriptions.isEmpty()) {
            nm.cancel(ONGOING_NOTIFICATION_ID)
            return
        }

        val primary = openDescriptions.minByOrNull { it.first.time } ?: return
        val openIntent = Intent(context, MainActivity::class.java).apply {
            data = Uri.parse("weehours://now")
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPi = PendingIntent.getActivity(
            context,
            ONGOING_NOTIFICATION_ID,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val summaryText = openDescriptions.joinToString(" · ") { it.second }
        try {
            val notif = NotificationCompat.Builder(context, CHANNEL_ONGOING)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(primary.second)
                .setContentText(if (openDescriptions.size > 1) summaryText else "Session in progress — tap to open Wee Hours")
                .setWhen(primary.first.time)
                .setUsesChronometer(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(contentPi)
                .build()
            nm.notify(ONGOING_NOTIFICATION_ID, notif)
        } catch (_: SecurityException) {
        }
    }

    private fun scheduleAlarm(
        alarmManager: AlarmManager?,
        index: Int,
        triggerAt: Date,
        title: String,
        body: String
    ) {
        if (alarmManager == null) return
        val intent = Intent(context, ReminderBroadcastReceiver::class.java).apply {
            putExtra(EXTRA_TITLE, title)
            putExtra(EXTRA_BODY, body)
            putExtra(EXTRA_NOTIF_ID, BASE_ALARM_REQ_CODE + index)
        }
        val pi = PendingIntent.getBroadcast(
            context,
            BASE_ALARM_REQ_CODE + index,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        try {
            alarmManager.setWindow(
                AlarmManager.RTC_WAKEUP,
                triggerAt.time,
                5 * 60 * 1000L,
                pi
            )
        } catch (_: SecurityException) {
        }
    }
}

class ReminderBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ReminderScheduler.ensureChannels(context)
        val title = intent.getStringExtra(ReminderScheduler.EXTRA_TITLE) ?: "Wee Hours Reminder"
        val body = intent.getStringExtra(ReminderScheduler.EXTRA_BODY) ?: "Tap to open Wee Hours"
        val notifId = intent.getIntExtra(ReminderScheduler.EXTRA_NOTIF_ID, 5100)

        val openIntent = Intent(context, MainActivity::class.java).apply {
            data = Uri.parse("weehours://now")
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            context,
            notifId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        try {
            val notification = NotificationCompat.Builder(context, ReminderScheduler.CHANNEL_REMINDERS)
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build()
            NotificationManagerCompat.from(context).notify(notifId, notification)
        } catch (_: SecurityException) {
        }
    }
}
