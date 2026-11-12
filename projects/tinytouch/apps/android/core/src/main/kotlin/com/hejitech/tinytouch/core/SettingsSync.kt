package com.hejitech.tinytouch.core

/**
 * Last-change-wins settings sync between the phone and the watch, the rule of the Apple apps
 * (`ToddlerPlay/Sources/Models/SettingsSync.swift`).
 *
 * Both sides stamp their settings with the time a parent last changed them ([KEY_CHANGED_AT],
 * seconds since 1970) and send that stamp, not the send time, with every payload. A payload is
 * applied only when its stamp is newer than the last change the receiver knows of, so a Data Layer
 * item read again at launch can't undo a change made on the watch since, or re-fire a one-shot
 * action like "Bedtime lullaby now".
 */
object SettingsSync {
    const val KEY_CHANGED_AT = "settingsChangedAt"

    /** Whether settings stamped [changedAt] replace settings last changed at [lastChange]. Unstamped payloads apply. */
    fun isNewer(changedAt: Double?, lastChange: Double): Boolean = changedAt == null || changedAt > lastChange

    fun now(): Double = System.currentTimeMillis() / 1000.0
}

/** Keys of the payloads, the same names the iPhone and Apple Watch apps use. */
object SyncKeys {
    const val CURRENT_MODE = "currentMode"
    const val TIMER_MINUTES = "timerMinutes"
    const val SOUND = "soundEnabled"
    const val VOICE = "voiceEnabled"
    const val HAPTICS = "hapticsEnabled"
    const val LOW_STIMULATION = "lowStimulation"
    const val HOLD_DURATION = "lockHoldDuration"
    const val ACTION = "action"
    const val TIMESTAMP = "timestamp"
    const val TOUCHES = "touchesCount"
    const val TIMER_ACTIVE = "isTimerActive"
    const val REMAINING = "remainingSeconds"

    const val ACTION_TRIGGER_LULLABY = "triggerLullaby"
}

/** Settings a parent sets on the phone, sent to the watch. Every field is optional on receipt. */
data class SettingsPayload(
    val currentMode: String? = null,
    val timerMinutes: Int? = null,
    val soundEnabled: Boolean? = null,
    val voiceEnabled: Boolean? = null,
    val hapticsEnabled: Boolean? = null,
    val lowStimulation: Boolean? = null,
    val lockHoldDuration: Double? = null,
    val settingsChangedAt: Double? = null,
    val action: String? = null,
    val timestamp: Double? = null,
) {
    fun toMap(): Map<String, Any> = buildMap {
        currentMode?.let { put(SyncKeys.CURRENT_MODE, it) }
        timerMinutes?.let { put(SyncKeys.TIMER_MINUTES, it) }
        soundEnabled?.let { put(SyncKeys.SOUND, it) }
        voiceEnabled?.let { put(SyncKeys.VOICE, it) }
        hapticsEnabled?.let { put(SyncKeys.HAPTICS, it) }
        lowStimulation?.let { put(SyncKeys.LOW_STIMULATION, it) }
        lockHoldDuration?.let { put(SyncKeys.HOLD_DURATION, it) }
        settingsChangedAt?.let { put(SettingsSync.KEY_CHANGED_AT, it) }
        action?.let { put(SyncKeys.ACTION, it) }
        timestamp?.let { put(SyncKeys.TIMESTAMP, it) }
    }

    val triggersLullaby: Boolean get() = action == SyncKeys.ACTION_TRIGGER_LULLABY

    companion object {
        fun fromMap(m: Map<String, Any?>) = SettingsPayload(
            currentMode = m[SyncKeys.CURRENT_MODE] as? String,
            timerMinutes = (m[SyncKeys.TIMER_MINUTES] as? Number)?.toInt(),
            soundEnabled = m[SyncKeys.SOUND] as? Boolean,
            voiceEnabled = m[SyncKeys.VOICE] as? Boolean,
            hapticsEnabled = m[SyncKeys.HAPTICS] as? Boolean,
            lowStimulation = m[SyncKeys.LOW_STIMULATION] as? Boolean,
            lockHoldDuration = (m[SyncKeys.HOLD_DURATION] as? Number)?.toDouble(),
            settingsChangedAt = (m[SettingsSync.KEY_CHANGED_AT] as? Number)?.toDouble(),
            action = m[SyncKeys.ACTION] as? String,
            timestamp = (m[SyncKeys.TIMESTAMP] as? Number)?.toDouble(),
        )
    }
}

/** What the watch reports back: live telemetry plus its settings and their change stamp. */
data class StatusPayload(
    val currentMode: String? = null,
    val touchesCount: Int? = null,
    val isTimerActive: Boolean? = null,
    val remainingSeconds: Int? = null,
    val soundEnabled: Boolean? = null,
    val voiceEnabled: Boolean? = null,
    val hapticsEnabled: Boolean? = null,
    val lowStimulation: Boolean? = null,
    val lockHoldDuration: Double? = null,
    val settingsChangedAt: Double? = null,
    val timestamp: Double? = null,
) {
    fun toMap(): Map<String, Any> = buildMap {
        currentMode?.let { put(SyncKeys.CURRENT_MODE, it) }
        touchesCount?.let { put(SyncKeys.TOUCHES, it) }
        isTimerActive?.let { put(SyncKeys.TIMER_ACTIVE, it) }
        remainingSeconds?.let { put(SyncKeys.REMAINING, it) }
        soundEnabled?.let { put(SyncKeys.SOUND, it) }
        voiceEnabled?.let { put(SyncKeys.VOICE, it) }
        hapticsEnabled?.let { put(SyncKeys.HAPTICS, it) }
        lowStimulation?.let { put(SyncKeys.LOW_STIMULATION, it) }
        lockHoldDuration?.let { put(SyncKeys.HOLD_DURATION, it) }
        settingsChangedAt?.let { put(SettingsSync.KEY_CHANGED_AT, it) }
        timestamp?.let { put(SyncKeys.TIMESTAMP, it) }
    }

    companion object {
        fun fromMap(m: Map<String, Any?>) = StatusPayload(
            currentMode = m[SyncKeys.CURRENT_MODE] as? String,
            touchesCount = (m[SyncKeys.TOUCHES] as? Number)?.toInt(),
            isTimerActive = m[SyncKeys.TIMER_ACTIVE] as? Boolean,
            remainingSeconds = (m[SyncKeys.REMAINING] as? Number)?.toInt(),
            soundEnabled = m[SyncKeys.SOUND] as? Boolean,
            voiceEnabled = m[SyncKeys.VOICE] as? Boolean,
            hapticsEnabled = m[SyncKeys.HAPTICS] as? Boolean,
            lowStimulation = m[SyncKeys.LOW_STIMULATION] as? Boolean,
            lockHoldDuration = (m[SyncKeys.HOLD_DURATION] as? Number)?.toDouble(),
            settingsChangedAt = (m[SettingsSync.KEY_CHANGED_AT] as? Number)?.toDouble(),
            timestamp = (m[SyncKeys.TIMESTAMP] as? Number)?.toDouble(),
        )
    }
}
