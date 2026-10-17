package com.hejitech.contempo.timer

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.firebase.Timestamp
import com.hejitech.contempo.MainActivity
import com.hejitech.contempo.R
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.Entry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

private const val CHANNEL_ID = "ongoing_work"
private const val NOTIFICATION_ID = 1003
private const val ACTION_MARK_DONE = "com.hejitech.contempo.timer.ACTION_MARK_DONE"
private const val ACTION_PAUSE = "com.hejitech.contempo.timer.ACTION_PAUSE"
private const val ACTION_RESUME = "com.hejitech.contempo.timer.ACTION_RESUME"

/** Same best-effort budget as CaptureViewModel/WearCaptureViewModel's own captureLocation — never worth delaying "done" for. */
private const val LOCATION_TIMEOUT_MS = 1_500L

/**
 * Foreground service backing a persistent "work in progress" notification —
 * lets a host mark a running work timer done straight from the notification
 * shade, no need to open the app. Doesn't own starting/stopping the timer
 * itself (TimerEntryCoordinator.handleStart/handleStop, called from
 * CaptureViewModel and AudioCaptureProcessor, both already do that); this
 * only mirrors whatever the current open timer entry is via its own
 * Firestore listener, independent of any Activity/ViewModel being alive —
 * unlike CaptureViewModel.openTimerEntry, this must keep working with the UI
 * fully backgrounded. Reacting to Firestore (rather than assuming this
 * service is the only thing that can close the entry) means the notification
 * disappears correctly however the timer actually got closed — a notification
 * tap, the in-app "Tap to complete" banner, or a later voice "stop."
 *
 * START_NOT_STICKY (unlike MileageTrackingService's START_STICKY): if the
 * process is killed mid-timer, the notification simply goes away rather than
 * the OS restarting this service before ServiceLocator/sign-in are ready —
 * ContempoApp.onCreate() re-detects an already-open timer and restarts this
 * on the next process start instead, so nothing is lost, just delayed.
 */
class OngoingWorkNotificationService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val entryRepository = ServiceLocator.entryRepository
    private val timerEntryCoordinator = ServiceLocator.timerEntryCoordinator
    private val notificationManager by lazy { getSystemService(NotificationManager::class.java) }

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, buildNotification(null))
        entryRepository.observeEntries()
            .map { entries -> entries.find { it.inProgress && !it.isTrip } }
            .distinctUntilChanged()
            .catch { stopSelf() }
            .onEach { entry ->
                if (entry == null) {
                    stopSelf()
                } else {
                    notificationManager.notify(NOTIFICATION_ID, buildNotification(entry))
                }
            }
            .launchIn(scope)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_MARK_DONE -> scope.launch {
                val stopLocation = captureLocation()
                // No property/task to fill in from here (unlike a voice
                // "stop" utterance) — same as the in-app "Tap to complete"
                // banner's CaptureViewModel.completeOpenTimer(). The service
                // stops itself once the Firestore listener above observes
                // the entry go non-inProgress, not immediately here — keeps
                // "when does the notification actually disappear" governed
                // by one code path regardless of what triggered the close.
                timerEntryCoordinator.handleStop(null, null, Timestamp.now(), stopLocation?.first, stopLocation?.second)
            }
            ACTION_PAUSE -> scope.launch { timerEntryCoordinator.handlePause(Timestamp.now()) }
            ACTION_RESUME -> scope.launch { timerEntryCoordinator.handleResume(Timestamp.now()) }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    private suspend fun captureLocation(): Pair<Double, Double>? {
        val context = ServiceLocator.appContext
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return null
        }
        return runCatching {
            withTimeoutOrNull(LOCATION_TIMEOUT_MS) {
                LocationServices.getFusedLocationProviderClient(context).lastLocation.await()
                    ?.let { it.latitude to it.longitude }
            }
        }.getOrNull()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // DEFAULT, not LOW: on OEM shades that treat IMPORTANCE_LOW
            // channels as "silent" (e.g. ColorOS), a silent ongoing
            // notification gets buried in a collapsed section below every
            // other app's notifications — defeating the point of a
            // "glanceable without opening the app" notification. The
            // one-time sound/vibrate per timer start is an acceptable
            // trade-off; the chronometer itself still ticks with no
            // repeated posts either way.
            notificationManager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Work in progress", NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
    }

    /**
     * [entry] is null only for the brief window in onCreate() before the
     * first Firestore snapshot arrives — startForeground() must be called
     * within seconds of the service starting, before the real entry details
     * are known. The "Mark done" action works correctly even during that
     * window (it closes whatever's actually open, not whatever's displayed).
     */
    private fun buildNotification(entry: Entry?): Notification {
        ensureChannel()
        val untitled = getString(R.string.capture_ongoing_work_untitled)
        val subjectName = entry?.let { it.propertyName.ifBlank { it.task.ifBlank { untitled } } } ?: untitled
        val title = getString(R.string.capture_ongoing_work_title, subjectName)
        val contentIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val markDoneIntent = PendingIntent.getForegroundService(
            this, 0, Intent(this, OngoingWorkNotificationService::class.java).setAction(ACTION_MARK_DONE), PendingIntent.FLAG_IMMUTABLE,
        )
        val pauseResumeIntent = PendingIntent.getForegroundService(
            this, 0,
            Intent(this, OngoingWorkNotificationService::class.java)
                .setAction(if (entry?.isPaused == true) ACTION_RESUME else ACTION_PAUSE),
            PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentTitle(title)
            .setContentIntent(contentIntent)
            .addAction(0, getString(R.string.ongoing_work_notification_action), markDoneIntent)
        if (entry != null) {
            builder.addAction(
                0,
                getString(
                    if (entry.isPaused) R.string.ongoing_work_notification_action_resume
                    else R.string.ongoing_work_notification_action_pause,
                ),
                pauseResumeIntent,
            )
        }
        if (entry != null && entry.isPaused) {
            // Frozen while paused — no chronometer, since a ticking clock
            // would misleadingly suggest time is still accruing.
            val activeElapsedSeconds = (
                (entry.pausedAt?.seconds ?: Timestamp.now().seconds) -
                    entry.activityDate.seconds - entry.pausedDurationSeconds
                ).coerceAtLeast(0)
            builder.setContentText(getString(R.string.ongoing_work_notification_paused_text, formatElapsedSeconds(activeElapsedSeconds)))
        } else {
            builder.setContentText(getString(R.string.ongoing_work_notification_text))
        }
        if (entry != null && !entry.isPaused) {
            // Renders and ticks the live "MM:SS"/"H:MM:SS" elapsed time
            // itself — no repeated notification posts needed to keep it
            // live, unlike the amount-based mileage notification above,
            // which only updates on each new location fix. setWhen is offset
            // back by any already-accumulated paused time so the chronometer
            // reads correct active elapsed time, not wall-clock-since-start.
            builder.setUsesChronometer(true)
                .setWhen(entry.activityDate.toDate().time + entry.pausedDurationSeconds * 1000L)
        }
        return builder.build()
    }

    private fun formatElapsedSeconds(totalSeconds: Long): String {
        val hours = totalSeconds / 3600
        val minutes = (totalSeconds % 3600) / 60
        val seconds = totalSeconds % 60
        return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds) else "%d:%02d".format(minutes, seconds)
    }

    companion object {
        /**
         * Safe (and cheap) to call unconditionally right after a
         * TimerEntryCoordinator.handleStart() succeeds, regardless of
         * caller — CaptureViewModel's two call sites are always
         * foregrounded, but AudioCaptureProcessor's (the watch-relay path)
         * can run from a plain (non-expedited) periodic WorkManager job,
         * where Android 12+ may refuse a background foreground-service
         * start; callers should wrap this in runCatching so a decorative
         * notification failing never breaks the actual entry save.
         */
        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, OngoingWorkNotificationService::class.java))
        }
    }
}
