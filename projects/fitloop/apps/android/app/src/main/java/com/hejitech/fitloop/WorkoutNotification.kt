package com.hejitech.fitloop

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import com.hejitech.fitloop.core.WatchWorkout

/** Bridge from the ongoing workout notification's "Set done" action to the open WorkoutPlayer. */
object WorkoutActionBridge {
    @Volatile
    var onSetDone: (() -> Unit)? = null
}

/**
 * Ongoing workout notification (Android counterpart to iOS's Live Activity) and rest-timer
 * completion alerts (sound + vibration in foreground, notification when backgrounded).
 */
object WorkoutNotification {
    private const val WORKOUT_CHANNEL = "fitloop_workout"
    private const val REST_CHANNEL = "fitloop_rest_done"
    private const val WORKOUT_ID = 9101
    private const val REST_ID = 9102
    private const val REST_ALARM_REQ = 9103
    const val ACTION_SET_DONE = "com.hejitech.fitloop.ACTION_SET_DONE"

    fun show(context: Context, workout: WatchWorkout, heartRate: Int?) {
        if (!workout.open || !ReminderScheduler.canNotify(context)) return
        ensureChannels(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPending = PendingIntent.getActivity(
            context, WORKOUT_ID, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val setDoneIntent = Intent(context, WorkoutActionReceiver::class.java).apply {
            action = ACTION_SET_DONE
        }
        val setDonePending = PendingIntent.getBroadcast(
            context, WORKOUT_ID + 1, setDoneIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val now = System.currentTimeMillis()
        val resting = workout.restUntil > now
        val subtitle = buildString {
            append(workout.setLine)
            if (heartRate != null) append(" · ♥ $heartRate")
        }

        val builder = NotificationCompat.Builder(context, WORKOUT_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(workout.exercise.ifEmpty { workout.title })
            .setContentText(subtitle)
            .setSubText("${workout.title} · ${workout.setsDone}/${workout.setsTotal}")
            .setProgress(maxOf(workout.setsTotal, 1), workout.setsDone, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(contentPending)
            .addAction(0, "Set done", setDonePending)

        if (resting) {
            builder.setWhen(workout.restUntil)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
        } else {
            builder.setShowWhen(false)
        }

        context.getSystemService(NotificationManager::class.java)?.notify(WORKOUT_ID, builder.build())
    }

    fun cancel(context: Context) {
        context.getSystemService(NotificationManager::class.java)?.cancel(WORKOUT_ID)
    }

    fun scheduleRestDone(context: Context, untilMs: Long, exercise: String, setLine: String) {
        if (untilMs <= System.currentTimeMillis() + 1000) return
        ensureChannels(context)
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        val pi = restPendingIntent(context, exercise, setLine)
        am.set(AlarmManager.RTC_WAKEUP, untilMs, pi)
    }

    fun cancelRestDone(context: Context) {
        val am = context.getSystemService(AlarmManager::class.java)
        am?.cancel(restPendingIntent(context, "", ""))
        context.getSystemService(NotificationManager::class.java)?.cancel(REST_ID)
    }

    fun playTimerDoneAlert(context: Context) {
        runCatching {
            val vibrator = if (Build.VERSION.SDK_INT >= 31) {
                context.getSystemService(VibratorManager::class.java)?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Vibrator::class.java)
            }
            vibrator?.vibrate(VibrationEffect.createOneShot(180, VibrationEffect.DEFAULT_AMPLITUDE))
        }
        runCatching {
            val tone = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
            tone.startTone(ToneGenerator.TONE_PROP_ACK, 220)
            Handler(Looper.getMainLooper()).postDelayed({ runCatching { tone.release() } }, 400)
        }
    }

    internal fun showRestDoneNotification(context: Context, exercise: String, setLine: String) {
        if (!ReminderScheduler.canNotify(context)) return
        ensureChannels(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            context, REST_ID, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val body = listOf(exercise, setLine).filter { it.isNotEmpty() }.joinToString(" · ")
        val notification = NotificationCompat.Builder(context, REST_CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Rest done")
            .setContentText(body.ifEmpty { "Time for your next set" })
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pi)
            .build()
        context.getSystemService(NotificationManager::class.java)?.notify(REST_ID, notification)
    }

    private fun restPendingIntent(context: Context, exercise: String, setLine: String): PendingIntent {
        val intent = Intent(context, RestTimerReceiver::class.java).apply {
            putExtra("exercise", exercise)
            putExtra("setLine", setLine)
        }
        return PendingIntent.getBroadcast(
            context, REST_ALARM_REQ, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun ensureChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(WORKOUT_CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(WORKOUT_CHANNEL, "Active workout", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Ongoing workout status and Set done button"
                    setShowBadge(false)
                },
            )
        }
        if (nm.getNotificationChannel(REST_CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(REST_CHANNEL, "Rest timer", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Alerts when a workout rest timer ends"
                    enableVibration(true)
                },
            )
        }
    }
}

class WorkoutActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == WorkoutNotification.ACTION_SET_DONE) {
            Handler(Looper.getMainLooper()).post { WorkoutActionBridge.onSetDone?.invoke() }
        }
    }
}

class RestTimerReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        WorkoutNotification.showRestDoneNotification(
            context,
            intent.getStringExtra("exercise").orEmpty(),
            intent.getStringExtra("setLine").orEmpty(),
        )
    }
}
