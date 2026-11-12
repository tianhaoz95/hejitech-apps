package com.hejitech.tinytouch.core

import java.util.Locale

/**
 * The play-session limit: when it runs out the watch moves to the calm lullaby, never a black
 * screen (the watch's `AppState.onTimerTick`).
 */
class SessionTimer {
    var selectedMinutes: Int = 0
        private set
    var remainingSeconds: Int = 0
        private set
    var isActive: Boolean = false
        private set

    /** 0 = unlimited. */
    fun set(minutes: Int) {
        selectedMinutes = minutes
        if (minutes > 0) {
            remainingSeconds = minutes * 60
            isActive = true
        } else {
            remainingSeconds = 0
            isActive = false
        }
    }

    /** One second passed. True exactly once, when the limit runs out. */
    fun tick(): Boolean {
        if (!isActive || remainingSeconds <= 0) return false
        remainingSeconds -= 1
        if (remainingSeconds == 0) {
            isActive = false
            return true
        }
        return false
    }
}

/** "Off" or "m:ss", as both Apple apps show it. */
fun formatRemaining(active: Boolean, seconds: Int): String =
    if (!active) "Off" else String.format(Locale.US, "%d:%02d", seconds / 60, seconds % 60)

/** The timer choices both apps offer (0 = unlimited / off). */
val TIMER_CHOICES = listOf(0, 3, 5, 10)

/** Parent Shield hold times (seconds). */
val HOLD_CHOICES = listOf(3.0, 5.0)

/**
 * `tinytouch://play`, `tinytouch://lullaby`, `tinytouch://play?mode=bubbles`: the launch links of
 * the watch app (`ToddlerPlayApp.handleIncomingURL`). Null means "just play" (keep the mode).
 */
fun launchModeFor(host: String?, modeParam: String?): GameMode? {
    if (modeParam != null) return GameMode.parse(modeParam)
    val h = host?.lowercase().orEmpty()
    return if (h.isNotEmpty() && h != "play") GameMode.parse(h) else null
}

/** Sound names, the WAVs `tools/generate_sounds.py` writes (res/raw in the kit module). */
object Sounds {
    val PENTATONIC = listOf("chime_c4", "chime_d4", "chime_e4", "chime_g4", "chime_a4", "chime_c5")
    val ALL = listOf(
        "bubble_pop", "boing", "sparkle", "quack", "woof", "meow", "moo", "ribbit", "unlock",
    ) + PENTATONIC

    /** Pentatonic only, so a toddler can't play a discordant note; out-of-range taps clamp. */
    fun chime(index: Int): String = PENTATONIC[index.coerceIn(0, PENTATONIC.size - 1)]

    fun animal(name: String): String = when (name.lowercase()) {
        "dog", "puppy", "woof" -> "woof"
        "cat", "kitty", "meow" -> "meow"
        "duck", "duckling", "quack" -> "quack"
        "cow", "moo" -> "moo"
        "frog", "ribbit" -> "ribbit"
        else -> "boing"
    }
}
