package com.hejitech.tinytouch.kit

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** Gentle tactile feedback for every touch (the watch's `HapticsManager`). */
object Haptics {
    var enabled: Boolean = true
    private var vibrator: Vibrator? = null
    private var lastCrownTick = 0L

    fun init(context: Context) {
        if (vibrator != null) return
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
    }

    private fun effect(predefined: Int, fallbackMs: Long, amplitude: Int = VibrationEffect.DEFAULT_AMPLITUDE) {
        if (!enabled) return
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                v.vibrate(VibrationEffect.createPredefined(predefined))
            } else {
                v.vibrate(VibrationEffect.createOneShot(fallbackMs, amplitude))
            }
        }
    }

    /** Light click for taps. */
    fun tap() = effect(VibrationEffect.EFFECT_CLICK, 15)

    /** Cheerful pop for bubbles. */
    fun pop() = effect(VibrationEffect.EFFECT_HEAVY_CLICK, 25)

    /** Springy bounce for animals. */
    fun bounce() = effect(VibrationEffect.EFFECT_DOUBLE_CLICK, 40)

    /** Subtle tick when the crown / bezel turns, at most every 60 ms. */
    fun crownTick() {
        val now = SystemClock.uptimeMillis()
        if (now - lastCrownTick < 60) return
        lastCrownTick = now
        effect(VibrationEffect.EFFECT_TICK, 8)
    }

    /** Rewarding pulse when a parent unlocks the shield. */
    fun success() = effect(VibrationEffect.EFFECT_DOUBLE_CLICK, 60)

    /** Rhythm tick while the Parent Shield is held. */
    fun progressTick() = effect(VibrationEffect.EFFECT_TICK, 10)

    /** Soft, slow pulse for the lullaby. */
    fun gentlePulse() {
        if (!enabled) return
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        runCatching { v.vibrate(VibrationEffect.createOneShot(90, 60)) }
    }
}
