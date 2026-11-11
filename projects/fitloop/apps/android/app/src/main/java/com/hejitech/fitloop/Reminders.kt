package com.hejitech.fitloop

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.hejitech.fitloop.core.Backend
import com.hejitech.fitloop.core.Reminder
import kotlinx.serialization.encodeToString
import java.time.ZoneId

/**
 * Hands the planned reminders (core's ReminderPlanner) to AlarmManager. Alarms are inexact (no
 * special permission; Android may deliver them a few minutes late) and don't survive a restart, so
 * the planned list is kept and BootReceiver sets them again.
 */
object ReminderScheduler {
    private const val CHANNEL = "reminders"
    private const val PREFS = "fitloop.reminders"

    fun canNotify(context: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Replaces everything scheduled with `reminders` (an empty list clears them). */
    fun schedule(context: Context, reminders: List<Reminder>) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val alarms = context.getSystemService(AlarmManager::class.java)
        for (old in stored(context)) pending(context, old, create = false)?.let { alarms.cancel(it); it.cancel() }
        prefs.edit().putString("planned", Backend.json.encodeToString(reminders)).apply()
        val now = System.currentTimeMillis()
        for (r in reminders) {
            val at = r.time.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            if (at <= now) continue
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(context, r, create = true)!!)
        }
    }

    fun stored(context: Context): List<Reminder> = runCatching {
        Backend.json.decodeFromString<List<Reminder>>(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("planned", "[]")!!)
    }.getOrDefault(emptyList())

    private fun pending(context: Context, r: Reminder, create: Boolean): PendingIntent? {
        val intent = Intent(context, ReminderReceiver::class.java).setAction(r.id)
            .putExtra("id", r.id).putExtra("title", r.title).putExtra("body", r.body)
        val flags = PendingIntent.FLAG_IMMUTABLE or if (create) PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_NO_CREATE
        return PendingIntent.getBroadcast(context, r.id.hashCode(), intent, flags)
    }

    fun show(context: Context, id: String, title: String, body: String) {
        if (!canNotify(context)) return
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "Reminders", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setGroup(id.substringBefore(":"))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(id.hashCode(), n) }
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ReminderScheduler.show(context, intent.getStringExtra("id") ?: return, intent.getStringExtra("title") ?: "FitLoop", intent.getStringExtra("body") ?: "")
    }
}

/** After a restart: sets the planned alarms again (the app re-plans the next time it opens). */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) ReminderScheduler.schedule(context, ReminderScheduler.stored(context))
    }
}
