package com.hejitech.tether.app

import android.app.Activity
import android.content.Context
import android.content.pm.ActivityInfo
import android.hardware.display.DisplayManager
import android.view.Display

/**
 * Isolated Display Host (PRD §4, §12.1, §12.4).
 * This is the ONLY file in the Android app that touches DisplayManager and screen orientation
 * locking. In v1 it operates in mirror mode on the primary Activity window and locks orientation
 * to landscape when an external USB-C monitor is attached, keeping a clean boundary for future
 * Presentation / secondary Activity external-display mode.
 */
class DisplayHostController(
    private val activity: Activity,
    private val onExternalDisplayChanged: (connected: Boolean, description: String) -> Unit
) : DisplayManager.DisplayListener {

    private val displayManager =
        activity.getSystemService(Context.DISPLAY_SERVICE) as DisplayManager

    fun start() {
        displayManager.registerDisplayListener(this, null)
        refreshDisplays()
    }

    fun stop() {
        displayManager.unregisterDisplayListener(this)
    }

    override fun onDisplayAdded(displayId: Int) = refreshDisplays()
    override fun onDisplayRemoved(displayId: Int) = refreshDisplays()
    override fun onDisplayChanged(displayId: Int) = refreshDisplays()

    fun refreshDisplays() {
        val displays = displayManager.displays
        val external = displays.firstOrNull { it.displayId != Display.DEFAULT_DISPLAY }
        if (external != null) {
            val mode = external.mode
            val desc = "External Display (${mode.physicalWidth}×${mode.physicalHeight} Mirror)"
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            onExternalDisplayChanged(true, desc)
        } else {
            val metrics = activity.resources.displayMetrics
            val desc = "Mirror Ready (${metrics.widthPixels}×${metrics.heightPixels}px)"
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            onExternalDisplayChanged(false, desc)
        }
    }
}
