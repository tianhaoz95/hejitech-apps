package com.hejitech.tinytouch.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.tinytouch.core.GameMode
import com.hejitech.tinytouch.core.HOLD_CHOICES
import com.hejitech.tinytouch.core.SettingsPayload
import com.hejitech.tinytouch.core.SettingsSync
import com.hejitech.tinytouch.core.StatusPayload
import com.hejitech.tinytouch.core.SyncKeys
import com.hejitech.tinytouch.core.TIMER_CHOICES
import com.hejitech.tinytouch.core.formatRemaining
import com.hejitech.tinytouch.kit.DataLayer
import com.hejitech.tinytouch.kit.Haptics
import com.hejitech.tinytouch.kit.SoundEngine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PhoneUiState(
    val isWatchConnected: Boolean = false,
    val isSyncing: Boolean = false,
    val syncStatusText: String = "Ready",
    val selectedMode: GameMode = GameMode.BUBBLES,
    val timerMinutes: Int = 0,
    val soundEnabled: Boolean = true,
    val voiceEnabled: Boolean = true,
    val hapticsEnabled: Boolean = true,
    val lowStimulation: Boolean = false,
    val lockHoldDuration: Double = 3.0,
    // Live Watch Telemetry
    val watchCurrentMode: String = "bubbles",
    val watchTouchCount: Int = 0,
    val watchRemainingSeconds: Int = 0,
    val watchIsTimerActive: Boolean = false,
) {
    val formattedWatchTime: String get() = formatRemaining(watchIsTimerActive, watchRemainingSeconds)
}

class PhoneViewModel(app: Application) : AndroidViewModel(app) {
    private val _uiState = MutableStateFlow(PhoneUiState())
    val uiState = _uiState.asStateFlow()

    private var settingsChangedAt: Double = 0.0

    init {
        SoundEngine.init(app)
        Haptics.init(app)

        // Listen for watch status updates
        DataLayer.listen(app, DataLayer.STATUS_PATH) { map ->
            val status = StatusPayload.fromMap(map)
            _uiState.value = _uiState.value.copy(
                isWatchConnected = true,
                watchCurrentMode = status.currentMode ?: _uiState.value.watchCurrentMode,
                watchTouchCount = status.touchesCount ?: _uiState.value.watchTouchCount,
                watchRemainingSeconds = status.remainingSeconds ?: _uiState.value.watchRemainingSeconds,
                watchIsTimerActive = status.isTimerActive ?: _uiState.value.watchIsTimerActive,
            )
            // Adopt watch settings if newer
            status.settingsChangedAt?.let { stamp ->
                if (stamp > settingsChangedAt) {
                    settingsChangedAt = stamp
                    status.currentMode?.let { modeStr ->
                        GameMode.parse(modeStr)?.let { _uiState.value = _uiState.value.copy(selectedMode = it) }
                    }
                    status.soundEnabled?.let { _uiState.value = _uiState.value.copy(soundEnabled = it) }
                    status.voiceEnabled?.let { _uiState.value = _uiState.value.copy(voiceEnabled = it) }
                    status.hapticsEnabled?.let { _uiState.value = _uiState.value.copy(hapticsEnabled = it) }
                    status.lowStimulation?.let { _uiState.value = _uiState.value.copy(lowStimulation = it) }
                    status.lockHoldDuration?.let { _uiState.value = _uiState.value.copy(lockHoldDuration = it) }
                }
            }
        }

        checkConnection()
    }

    fun checkConnection() {
        viewModelScope.launch {
            val count = DataLayer.reachableNodeCount(getApplication(), DataLayer.WATCH_CAPABILITY)
            _uiState.value = _uiState.value.copy(isWatchConnected = count > 0)
        }
    }

    private fun broadcastSettings(action: String? = null) {
        settingsChangedAt = SettingsSync.now()
        val s = _uiState.value
        val payload = SettingsPayload(
            currentMode = s.selectedMode.raw,
            timerMinutes = s.timerMinutes,
            soundEnabled = s.soundEnabled,
            voiceEnabled = s.voiceEnabled,
            hapticsEnabled = s.hapticsEnabled,
            lowStimulation = s.lowStimulation,
            lockHoldDuration = s.lockHoldDuration,
            settingsChangedAt = settingsChangedAt,
            action = action,
            timestamp = settingsChangedAt
        )
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSyncing = true)
            val success = DataLayer.put(getApplication(), DataLayer.SETTINGS_PATH, payload.toMap())
            _uiState.value = _uiState.value.copy(
                isSyncing = false,
                syncStatusText = if (success) "Live Synced" else "Saved (Queued)"
            )
        }
    }

    fun selectMode(mode: GameMode) {
        _uiState.value = _uiState.value.copy(selectedMode = mode)
        Haptics.tap()
        broadcastSettings()
    }

    fun setTimer(minutes: Int) {
        _uiState.value = _uiState.value.copy(timerMinutes = minutes)
        Haptics.tap()
        broadcastSettings()
    }

    fun setSound(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(soundEnabled = enabled)
        SoundEngine.soundEnabled = enabled
        broadcastSettings()
    }

    fun setVoice(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(voiceEnabled = enabled)
        SoundEngine.voiceEnabled = enabled
        broadcastSettings()
    }

    fun setHaptics(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(hapticsEnabled = enabled)
        Haptics.enabled = enabled
        broadcastSettings()
    }

    fun setLowStimulation(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(lowStimulation = enabled)
        broadcastSettings()
    }

    fun setLockHoldDuration(duration: Double) {
        _uiState.value = _uiState.value.copy(lockHoldDuration = duration)
        broadcastSettings()
    }

    fun triggerLullabyNow() {
        _uiState.value = _uiState.value.copy(selectedMode = GameMode.LULLABY)
        Haptics.success()
        broadcastSettings(action = SyncKeys.ACTION_TRIGGER_LULLABY)
    }

    fun manualSync() {
        Haptics.tap()
        broadcastSettings()
        checkConnection()
    }
}
