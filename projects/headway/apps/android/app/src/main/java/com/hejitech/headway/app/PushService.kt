package com.hejitech.headway.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.tasks.await

/**
 * Alerts from the Worker (delays, cancellations, leave now, arrival, family) through Firebase Cloud
 * Messaging. With the app closed the system shows them itself, on the channel the Worker names; this
 * service shows them while the app is open, and hears when the phone's token changes.
 */
class PushService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        onToken?.invoke(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val shown = message.notification ?: return
        if (!canNotify(this)) return
        ensureChannels(this)
        val priority = message.data["priority"] != "false"
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, if (priority) CHANNEL_ALERTS else CHANNEL_QUIET)
            .setSmallIcon(R.drawable.ic_stat_train)
            .setColor(ContextCompat.getColor(this, R.color.caltrain_red))
            .setContentTitle(shown.title)
            .setContentText(shown.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(shown.body))
            .setGroup(message.data["thread"])
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        // The same alert again (its key) replaces the one showing, as the system does with the app closed.
        getSystemService(NotificationManager::class.java).notify(message.data["key"]?.take(64) ?: shown.title, 0, notification)
    }

    companion object {
        /** The Worker's `FCM_CHANNEL` (push.ts): keep the ids the same. */
        const val CHANNEL_ALERTS = "headway_alerts"
        const val CHANNEL_QUIET = "headway_quiet"

        /** Set while someone is signed in: a rotated token is registered again. */
        @Volatile
        var onToken: ((String) -> Unit)? = null

        /** The channels must exist before the system can show a notification with the app closed. */
        fun ensureChannels(context: Context) {
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(CHANNEL_ALERTS, "Train alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Delays, cancellations, when to leave and your stop coming up"
            })
            nm.createNotificationChannel(NotificationChannel(CHANNEL_QUIET, "Quiet notices", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Notices for your stations that don't affect your commute, without a sound"
            })
        }

        fun canNotify(context: Context): Boolean =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

        /** This phone's FCM token, or null when Google Play services can't give one. */
        suspend fun token(): String? = runCatching { FirebaseMessaging.getInstance().token.await() }.getOrNull()
    }
}
