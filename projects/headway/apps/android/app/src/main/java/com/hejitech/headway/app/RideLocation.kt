package com.hejitech.headway.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat
import com.hejitech.headway.core.model.OnTrainSample

/**
 * The last few location fixes (up to 15 minutes, in memory), for telling if you're on a train. They go
 * with one request to the Worker and are never stored.
 */
class RideLocation(private val context: Context) : LocationListener {
    private val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val fixes = ArrayDeque<OnTrainSample>()
    private var running = false

    fun hasAccess(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    fun hasBackgroundAccess(): Boolean = hasAccess() && (
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        )

    @SuppressLint("MissingPermission")
    fun start() {
        if (running || !hasAccess()) return
        val providers = manager.getProviders(true).filter { it == LocationManager.GPS_PROVIDER || it == LocationManager.NETWORK_PROVIDER }
        if (providers.isEmpty()) return
        running = true
        for (p in providers) manager.requestLocationUpdates(p, 10_000L, 30f, this, Looper.getMainLooper())
    }

    fun stop() {
        if (!running) return
        running = false
        manager.removeUpdates(this)
    }

    @Synchronized
    fun samples(): List<OnTrainSample> = fixes.toList()

    /** Roughly where the phone is, for the trip estimate to the station: a recent fix, or the system's last one. */
    @SuppressLint("MissingPermission")
    fun lastKnown(): Pair<Double, Double>? {
        if (!hasAccess()) return null
        synchronized(this) { fixes.lastOrNull() }?.takeIf { System.currentTimeMillis() - it.at < 5 * 60_000 }?.let { return it.lat to it.lon }
        val best = manager.getProviders(true).mapNotNull { runCatching { manager.getLastKnownLocation(it) }.getOrNull() }
            .filter { System.currentTimeMillis() - it.time < 30 * 60_000 }
            .maxByOrNull { it.time }
        return best?.let { it.latitude to it.longitude }
    }

    @Synchronized
    override fun onLocationChanged(location: Location) {
        if (location.hasAccuracy() && location.accuracy > 200f) return
        fixes.addLast(
            OnTrainSample(
                lat = location.latitude,
                lon = location.longitude,
                at = location.time.toDouble(),
                speed = if (location.hasSpeed()) location.speed.toDouble() else null
            )
        )
        val cutoff = System.currentTimeMillis() - 15 * 60_000.0
        while (fixes.isNotEmpty() && (fixes.first().at < cutoff || fixes.size > 20)) fixes.removeFirst()
    }

    // Older Android versions call these and crash without them.
    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
}
