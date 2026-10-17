package com.hejitech.contempo.mileage

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.hejitech.core.model.Timestamp
import com.hejitech.contempo.MainActivity
import com.hejitech.contempo.R
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.CaptureSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.roundToInt

private const val CHANNEL_ID = "mileage_trip"
private const val NOTIFICATION_ID = 1002
private const val ACTION_STOP_TRIP = "com.hejitech.contempo.mileage.ACTION_STOP_TRIP"
private const val ACTION_CANCEL_TRIP = "com.hejitech.contempo.mileage.ACTION_CANCEL_TRIP"
private const val ACTION_PAUSE_TRIP = "com.hejitech.contempo.mileage.ACTION_PAUSE_TRIP"
private const val ACTION_RESUME_TRIP = "com.hejitech.contempo.mileage.ACTION_RESUME_TRIP"

/** Roughly every 10s, plus a minimum-displacement filter — cuts GPS jitter noise without needing a dedicated smoothing pass. */
private const val UPDATE_INTERVAL_MS = 10_000L
private const val MIN_DISPLACEMENT_METERS = 15f
private const val METERS_PER_MILE = 1609.344
private const val LOCATION_TIMEOUT_MS = 1_500L

/**
 * Foreground service that continuously accumulates driving distance for a
 * GPS-tracked mileage trip. A single start/end straight-line distance would
 * cut every corner a real route takes and understate the true number — bad
 * for a tax record — so this sums Location.distanceTo() between consecutive
 * fixes instead (see the mileage plan's "Capture method 3").
 *
 * Owns the trip Entry's full lifecycle end to end: starts it in onCreate
 * (via MileageTripCoordinator, which auto-closes/abandons any previous open
 * trip the same way TimerEntryCoordinator does for the work timer — this
 * also covers a START_STICKY restart after process death), checkpoints the
 * running total to Firestore on every fix so progress survives a process
 * death mid-drive and is visible live on the Dashboard, and ends it in
 * onDestroy with the final accumulated total.
 *
 * Declared with the "location" foreground service type (Android 14+ requires
 * declaring one). Only started by a direct user tap while the app is
 * foregrounded — not on boot or from the background — which is what the
 * foreground-service exemption for continued location updates while the
 * screen is off/app is backgrounded during the drive relies on; genuinely
 * version/OEM-sensitive and worth confirming live per device.
 */
class MileageTrackingService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val mileageTripCoordinator = ServiceLocator.mileageTripCoordinator
    private val notificationManager by lazy { getSystemService(NotificationManager::class.java) }
    private val fusedLocationClient: FusedLocationProviderClient by lazy {
        LocationServices.getFusedLocationProviderClient(this)
    }

    private var lastLocation: Location? = null
    private var accumulatedMeters = 0.0
    private var isPaused = false

    /** Set by ACTION_CANCEL_TRIP — tells onDestroy to discard the open trip instead of finalizing it. */
    private var isCancelled = false

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            if (isPaused) {
                // Keep the reference point current so resuming doesn't
                // retroactively count distance covered while paused as if
                // it happened right after resume.
                lastLocation = location
                return
            }
            lastLocation?.let { previous -> accumulatedMeters += previous.distanceTo(location) }
            lastLocation = location
            val miles = metersToMiles(accumulatedMeters)
            notificationManager.notify(NOTIFICATION_ID, buildTrackingNotification(miles))
            scope.launch { mileageTripCoordinator.updateTripDistance(miles) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIFICATION_ID, buildTrackingNotification(0.0))
        scope.launch {
            val startLocation = captureOneShotLocation()
            mileageTripCoordinator.handleStartTrip(
                property = null,
                task = null,
                category = null,
                source = CaptureSource.MANUAL,
                startedAt = Timestamp.now(),
                captureMethod = "gps",
                startLat = startLocation?.first,
                startLng = startLocation?.second,
            )
        }
        startLocationUpdates()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Same "Stop trip" action as the notification's button — stopSelf()
        // runs the normal onDestroy teardown below (removes location
        // updates, writes the final accumulated distance via
        // mileageTripCoordinator.handleEndTrip), same as a manual
        // MileageTrackingService.stop() call from the Capture screen.
        when (intent?.action) {
            ACTION_STOP_TRIP -> stopSelf()
            // Same stopSelf()->onDestroy() teardown as ACTION_STOP_TRIP, but
            // isCancelled tells onDestroy to delete the open trip instead of
            // writing a finalized entry for it — see handleCancelTrip.
            ACTION_CANCEL_TRIP -> {
                isCancelled = true
                stopSelf()
            }
            ACTION_PAUSE_TRIP -> {
                isPaused = true
                notificationManager.notify(NOTIFICATION_ID, buildTrackingNotification(metersToMiles(accumulatedMeters)))
                scope.launch { mileageTripCoordinator.handlePauseTrip(Timestamp.now()) }
            }
            ACTION_RESUME_TRIP -> {
                isPaused = false
                notificationManager.notify(NOTIFICATION_ID, buildTrackingNotification(metersToMiles(accumulatedMeters)))
                scope.launch { mileageTripCoordinator.handleResumeTrip(Timestamp.now()) }
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        val finalMiles = metersToMiles(accumulatedMeters)
        val endLocation = lastLocation
        // Not scoped to `scope` — that gets cancelled on the next line, and
        // this final write needs to survive past onDestroy returning.
        CoroutineScope(SupervisorJob() + Dispatchers.Default).launch {
            if (isCancelled) {
                mileageTripCoordinator.handleCancelTrip()
            } else {
                mileageTripCoordinator.handleEndTrip(
                    endedAt = Timestamp.now(),
                    captureMethod = "gps",
                    directMiles = finalMiles,
                    endLat = endLocation?.latitude,
                    endLng = endLocation?.longitude,
                )
            }
        }
        scope.cancel()
    }

    /**
     * A quick cached-location read (not a fresh GPS fix) for the trip's
     * start coordinate, same approach/timeout as CaptureViewModel's
     * captureLocation() — a fresh fix can take seconds to arrive and this
     * shouldn't delay starting the trip.
     */
    private suspend fun captureOneShotLocation(): Pair<Double, Double>? {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return null
        }
        return withTimeoutOrNull(LOCATION_TIMEOUT_MS) {
            fusedLocationClient.lastLocation.await()?.let { it.latitude to it.longitude }
        }
    }

    private fun startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
            .setMinUpdateDistanceMeters(MIN_DISPLACEMENT_METERS)
            .build()
        fusedLocationClient.requestLocationUpdates(request, locationCallback, mainLooper)
    }

    private fun metersToMiles(meters: Double): Double = (meters / METERS_PER_MILE * 100.0).roundToInt() / 100.0

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // DEFAULT, not LOW — see OngoingWorkNotificationService's
            // ensureChannel kdoc: on OEM shades that treat IMPORTANCE_LOW
            // channels as "silent" (e.g. ColorOS), this ongoing notification
            // was getting buried below every other app's notifications,
            // effectively invisible during a drive.
            val channel = NotificationChannel(CHANNEL_ID, "Mileage trip", NotificationManager.IMPORTANCE_DEFAULT)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun buildTrackingNotification(miles: Double): Notification {
        ensureChannel()
        val contentIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getForegroundService(
            this, 0, Intent(this, MileageTrackingService::class.java).setAction(ACTION_STOP_TRIP), PendingIntent.FLAG_IMMUTABLE,
        )
        val pauseResumeIntent = PendingIntent.getForegroundService(
            this, 0,
            Intent(this, MileageTrackingService::class.java)
                .setAction(if (isPaused) ACTION_RESUME_TRIP else ACTION_PAUSE_TRIP),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentTitle(getString(R.string.mileage_tracking_notification_title))
            .setContentText(
                if (isPaused) getString(R.string.mileage_tracking_notification_paused_text)
                else getString(R.string.mileage_tracking_notification_text, "%.2f".format(miles)),
            )
            .setContentIntent(contentIntent)
            .addAction(0, getString(R.string.mileage_tracking_notification_action), stopIntent)
            .addAction(
                0,
                getString(
                    if (isPaused) R.string.mileage_tracking_notification_action_resume
                    else R.string.mileage_tracking_notification_action_pause,
                ),
                pauseResumeIntent,
            )
            .build()
    }

    companion object {
        fun start(context: Context) {
            ContextCompat.startForegroundService(context, Intent(context, MileageTrackingService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, MileageTrackingService::class.java))
        }

        /** Discards the trip in progress — see [ACTION_CANCEL_TRIP]'s onStartCommand handling. */
        fun cancel(context: Context) {
            context.startService(Intent(context, MileageTrackingService::class.java).setAction(ACTION_CANCEL_TRIP))
        }

        /** Sent to the already-running service — see [ACTION_PAUSE_TRIP]'s onStartCommand handling. */
        fun pause(context: Context) {
            context.startService(Intent(context, MileageTrackingService::class.java).setAction(ACTION_PAUSE_TRIP))
        }

        fun resume(context: Context) {
            context.startService(Intent(context, MileageTrackingService::class.java).setAction(ACTION_RESUME_TRIP))
        }
    }
}
