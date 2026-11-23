package com.hejitech.tether.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Android Foreground Service keeping active SSH connections alive when the screen turns off or
 * the user switches apps, with a persistent IMPORTANCE_DEFAULT notification and a "Disconnect All"
 * action button (PRD §10.7, §15.2).
 */
class SshForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "tether_ssh_sessions"
        const val NOTIFICATION_ID = 1001
        const val ACTION_UPDATE_COUNT = "com.hejitech.tether.UPDATE_SSH_COUNT"
        const val ACTION_DISCONNECT_ALL = "com.hejitech.tether.DISCONNECT_ALL_SSH"
        const val EXTRA_ACTIVE_COUNT = "active_count"

        var onDisconnectAllRequested: (() -> Unit)? = null

        fun updateActiveSessionCount(context: Context, count: Int) {
            val intent = Intent(context, SshForegroundService::class.java).apply {
                action = ACTION_UPDATE_COUNT
                putExtra(EXTRA_ACTIVE_COUNT, count)
            }
            if (count > 0) {
                runCatching { context.startForegroundService(intent) }
            } else {
                runCatching { context.stopService(intent) }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Active SSH Sessions",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Keeps active SSH terminal sessions alive in the background"
        }
        mgr.createNotificationChannel(channel)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_DISCONNECT_ALL -> {
                onDisconnectAllRequested?.invoke()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                val count = intent?.getIntExtra(EXTRA_ACTIVE_COUNT, 0) ?: 0
                if (count <= 0) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                    return START_NOT_STICKY
                }
                val notification = buildNotification(count)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
                return START_NOT_STICKY
            }
        }
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        onDisconnectAllRequested?.invoke()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf(startId)
    }

    private fun buildNotification(activeCount: Int): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val disconnectIntent = Intent(this, SshForegroundService::class.java).apply {
            action = ACTION_DISCONNECT_ALL
        }
        val disconnectPending = PendingIntent.getService(
            this,
            1,
            disconnectIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val disconnectAction = Notification.Action.Builder(
            null,
            "Disconnect All",
            disconnectPending
        ).build()

        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Tether SSH Active")
            .setContentText("$activeCount active SSH session(s) connected")
            .setContentIntent(openPending)
            .setOngoing(true)
            .addAction(disconnectAction)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
