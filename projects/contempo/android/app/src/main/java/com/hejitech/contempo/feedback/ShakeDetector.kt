package com.hejitech.contempo.feedback

import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.sqrt

/**
 * Detects a physical shake via TYPE_ACCELEROMETER — combined acceleration
 * magnitude minus gravity (~9.8 m/s²) crossing [SHAKE_THRESHOLD], debounced
 * by [DEBOUNCE_MS] so one physical shake fires [onShake] once, not
 * repeatedly across the sensor's sample rate. Register/unregister from an
 * Activity's onResume/onPause — see MainActivity.
 */
class ShakeDetector(private val onShake: () -> Unit) : SensorEventListener {
    private var lastShakeTimeMs = 0L

    override fun onSensorChanged(event: SensorEvent) {
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]
        val delta = sqrt((x * x + y * y + z * z).toDouble()) - SensorManager.GRAVITY_EARTH
        if (delta > SHAKE_THRESHOLD) {
            val now = System.currentTimeMillis()
            if (now - lastShakeTimeMs > DEBOUNCE_MS) {
                lastShakeTimeMs = now
                onShake()
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    fun register(sensorManager: SensorManager) {
        val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) ?: return
        sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI)
    }

    fun unregister(sensorManager: SensorManager) {
        sensorManager.unregisterListener(this)
    }

    private companion object {
        const val SHAKE_THRESHOLD = 15.0
        const val DEBOUNCE_MS = 1000L
    }
}
