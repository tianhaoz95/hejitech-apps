package com.hejitech.tinytouch.wear

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.tinytouch.core.GameMode
import com.hejitech.tinytouch.core.SessionTimer
import com.hejitech.tinytouch.core.SettingsPayload
import com.hejitech.tinytouch.core.SettingsSync
import com.hejitech.tinytouch.core.StatusPayload
import com.hejitech.tinytouch.core.launchModeFor
import com.hejitech.tinytouch.kit.DataLayer
import com.hejitech.tinytouch.kit.Haptics
import com.hejitech.tinytouch.kit.SoundEngine
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class WearUiState(
    val currentMode: GameMode = GameMode.BUBBLES,
    val isParentMenuOpen: Boolean = false,
    val soundEnabled: Boolean = true,
    val voiceEnabled: Boolean = true,
    val hapticsEnabled: Boolean = true,
    val lowStimulation: Boolean = false,
    val lockHoldDuration: Double = 3.0,
    val timerMinutes: Int = 0,
    val remainingSeconds: Int = 0,
    val isTimerActive: Boolean = false,
    val sessionTouchesCount: Int = 0,
)

class WearViewModel(app: Application) : AndroidViewModel(app) {
    private val _uiState = MutableStateFlow(WearUiState())
    val uiState = _uiState.asStateFlow()

    private val _crownEvents = MutableSharedFlow<Float>(extraBufferCapacity = 16)
    val crownEvents = _crownEvents.asSharedFlow()

    private val timer = SessionTimer()
    private var settingsChangedAt: Double = 0.0

    init {
        SoundEngine.init(app)
        Haptics.init(app)

        // Listen for phone settings updates
        DataLayer.listen(app, DataLayer.SETTINGS_PATH) { map ->
            val payload = SettingsPayload.fromMap(map)
            val stamp = payload.settingsChangedAt
            if (SettingsSync.isNewer(stamp, settingsChangedAt)) {
                if (stamp != null) settingsChangedAt = stamp

                payload.action?.let { act ->
                    if (payload.triggersLullaby) {
                        setMode(GameMode.LULLABY, fromPhone = true)
                    }
                }

                payload.currentMode?.let { modeStr ->
                    GameMode.parse(modeStr)?.let { setMode(it, fromPhone = true) }
                }

                payload.soundEnabled?.let {
                    _uiState.value = _uiState.value.copy(soundEnabled = it)
                    SoundEngine.soundEnabled = it
                }
                payload.voiceEnabled?.let {
                    _uiState.value = _uiState.value.copy(voiceEnabled = it)
                    SoundEngine.voiceEnabled = it
                }
                payload.hapticsEnabled?.let {
                    _uiState.value = _uiState.value.copy(hapticsEnabled = it)
                    Haptics.enabled = it
                }
                payload.lowStimulation?.let {
                    _uiState.value = _uiState.value.copy(lowStimulation = it)
                }
                payload.lockHoldDuration?.let {
                    _uiState.value = _uiState.value.copy(lockHoldDuration = it)
                }
                payload.timerMinutes?.let {
                    setPlayTimer(it, fromPhone = true)
                }
            }
        }

        // Timer ticker coroutine
        viewModelScope.launch {
            while (true) {
                delay(1000)
                if (timer.tick()) {
                    // Timer expired! Smoothly transition into calming Lullaby
                    _uiState.value = _uiState.value.copy(
                        currentMode = GameMode.LULLABY,
                        isTimerActive = false,
                        remainingSeconds = 0
                    )
                    Haptics.gentlePulse()
                    sendStatusUpdate()
                } else if (timer.isActive) {
                    _uiState.value = _uiState.value.copy(
                        remainingSeconds = timer.remainingSeconds,
                        isTimerActive = true
                    )
                }
            }
        }

        sendStatusUpdate()
    }

    fun onRotaryInput(delta: Float) {
        _crownEvents.tryEmit(delta)
    }

    fun registerTouch() {
        val count = _uiState.value.sessionTouchesCount + 1
        _uiState.value = _uiState.value.copy(sessionTouchesCount = count)
        if (count % 3 == 0) {
            sendStatusUpdate()
        }
    }

    fun setMode(mode: GameMode, fromPhone: Boolean = false) {
        if (_uiState.value.currentMode != mode) {
            _uiState.value = _uiState.value.copy(currentMode = mode, isParentMenuOpen = false)
            Haptics.gentlePulse()
            if (!fromPhone) {
                settingsChangedAt = SettingsSync.now()
            }
            sendStatusUpdate()
        }
    }

    fun setPlayTimer(minutes: Int, fromPhone: Boolean = false) {
        timer.set(minutes)
        _uiState.value = _uiState.value.copy(
            timerMinutes = minutes,
            remainingSeconds = timer.remainingSeconds,
            isTimerActive = timer.isActive
        )
        if (!fromPhone) {
            settingsChangedAt = SettingsSync.now()
        }
        sendStatusUpdate()
    }

    fun toggleSound(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(soundEnabled = enabled)
        SoundEngine.soundEnabled = enabled
        settingsChangedAt = SettingsSync.now()
        sendStatusUpdate()
    }

    fun toggleVoice(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(voiceEnabled = enabled)
        SoundEngine.voiceEnabled = enabled
        settingsChangedAt = SettingsSync.now()
        sendStatusUpdate()
    }

    fun toggleHaptics(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(hapticsEnabled = enabled)
        Haptics.enabled = enabled
        settingsChangedAt = SettingsSync.now()
        sendStatusUpdate()
    }

    fun toggleLowStimulation(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(lowStimulation = enabled)
        settingsChangedAt = SettingsSync.now()
        sendStatusUpdate()
    }

    fun setLockHoldDuration(duration: Double) {
        _uiState.value = _uiState.value.copy(lockHoldDuration = duration)
        settingsChangedAt = SettingsSync.now()
        sendStatusUpdate()
    }

    fun openParentMenu() {
        Haptics.success()
        SoundEngine.unlockChime()
        _uiState.value = _uiState.value.copy(isParentMenuOpen = true)
    }

    fun closeParentMenu() {
        Haptics.tap()
        _uiState.value = _uiState.value.copy(isParentMenuOpen = false)
    }

    fun handleIntentUri(scheme: String?, host: String?, modeParam: String?) {
        if (scheme == "tinytouch") {
            launchModeFor(host, modeParam)?.let {
                setMode(it)
            }
        }
    }

    private fun sendStatusUpdate() {
        val s = _uiState.value
        val payload = StatusPayload(
            currentMode = s.currentMode.raw,
            touchesCount = s.sessionTouchesCount,
            isTimerActive = s.isTimerActive,
            remainingSeconds = s.remainingSeconds,
            soundEnabled = s.soundEnabled,
            voiceEnabled = s.voiceEnabled,
            hapticsEnabled = s.hapticsEnabled,
            lowStimulation = s.lowStimulation,
            lockHoldDuration = s.lockHoldDuration,
            settingsChangedAt = settingsChangedAt,
            timestamp = SettingsSync.now()
        )
        viewModelScope.launch {
            DataLayer.put(getApplication(), DataLayer.STATUS_PATH, payload.toMap())
        }
    }
}
