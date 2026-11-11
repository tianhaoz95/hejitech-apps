package com.hejitech.headway.app

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
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.hejitech.headway.core.net.HeadwayApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * "Also with the app closed" on Android: Android only lets an app follow location in the background
 * from a foreground service, so a low-importance notification stays up while it watches for a ride.
 */
class OnTrainService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var location: RideLocation
    private var announced: String? = null
    private var looping = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL_WATCH, "Watching for a ride", NotificationManager.IMPORTANCE_LOW))
        nm.createNotificationChannel(NotificationChannel(CHANNEL_RIDE, "On a train", NotificationManager.IMPORTANCE_DEFAULT))
        location = RideLocation(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
        ServiceCompat.startForeground(this, WATCH_ID, notification(CHANNEL_WATCH, "Watching for your train", "Headway tells you when you board. Change this in Settings."), type)
        location.start()
        if (!looping) {
            looping = true
            scope.launch {
                while (isActive) {
                    delay(CHECK_MS)
                    check()
                }
            }
        }
        // The session is stored, so Android may restart this after the app process is gone.
        return START_STICKY
    }

    private suspend fun check() {
        val client = api ?: AppBackend.client(this).also { api = it }
        if (client.session == null) return
        val fixes = location.samples()
        if (fixes.size < 2 || fixes.takeLast(3).none { (it.speed ?: 0.0) >= 5.0 }) return
        val report = runCatching { client.reportOnTrain(fixes, background = true) }.getOrNull() ?: return
        val card = report.onTrain ?: return
        val ride = "${card.serviceDate}:${card.tripId}"
        if (report.autoTracked && announced != ride) {
            announced = ride
            getSystemService(NotificationManager::class.java).notify(
                RIDE_ID,
                notification(CHANNEL_RIDE, "On train ${card.train}", "Tracking it to ${card.to.name}. Not on it? Stop tracking in Headway.")
            )
        }
    }

    private fun notification(channel: String, title: String, text: String): Notification {
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, channel)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setOngoing(channel == CHANNEL_WATCH)
            .build()
    }

    override fun onDestroy() {
        location.stop()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_WATCH = "headway_watch"
        private const val CHANNEL_RIDE = "headway_ride"
        private const val WATCH_ID = 7001
        private const val RIDE_ID = 7002
        private const val CHECK_MS = 30_000L
        private var api: HeadwayApiClient? = null

        fun start(context: Context, client: HeadwayApiClient) {
            api = client
            ContextCompat.startForegroundService(context, Intent(context, OnTrainService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, OnTrainService::class.java))
        }
    }
}
