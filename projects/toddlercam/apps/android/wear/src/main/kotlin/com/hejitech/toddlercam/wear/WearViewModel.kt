package com.hejitech.toddlercam.wear

import android.app.Application
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.Wearable
import com.hejitech.toddlercam.core.CameraCaptureMode
import com.hejitech.toddlercam.core.FaceEmojiType
import com.hejitech.toddlercam.core.SoundType
import com.hejitech.toddlercam.core.ToddlerState
import com.hejitech.toddlercam.core.WatchActionMessage
import com.hejitech.toddlercam.core.WatchConstants
import com.hejitech.toddlercam.wear.sync.WearStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class WearViewModel(application: Application) : AndroidViewModel(application) {

    private val messageClient = Wearable.getMessageClient(application)
    private val nodeClient = Wearable.getNodeClient(application)

    val state: StateFlow<ToddlerState> = WearStore.state
    val lastPhotoThumbnail: StateFlow<android.graphics.Bitmap?> = WearStore.lastPhotoThumbnail

    private val _isConnected = MutableStateFlow(false)
    val isConnected: StateFlow<Boolean> = _isConnected.asStateFlow()

    private val _lastActionFeedback = MutableStateFlow<String?>(null)
    val lastActionFeedback: StateFlow<String?> = _lastActionFeedback.asStateFlow()

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val mgr = application.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            mgr?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            application.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    init {
        checkConnectivity()
        requestStatus()
    }

    fun checkConnectivity() {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val nodes = nodeClient.connectedNodes.await()
                _isConnected.value = nodes.isNotEmpty()
            } catch (_: Exception) {
                _isConnected.value = false
            }
        }
    }

    private fun triggerWristHaptic() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(50)
            }
        } catch (_: Exception) {}
    }

    private fun sendAction(message: WatchActionMessage, feedbackText: String? = null) {
        triggerWristHaptic()
        if (feedbackText != null) {
            _lastActionFeedback.value = feedbackText
        }
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val nodes = nodeClient.connectedNodes.await()
                _isConnected.value = nodes.isNotEmpty()
                val data = message.toJson().toByteArray(Charsets.UTF_8)
                for (node in nodes) {
                    messageClient.sendMessage(node.id, WatchConstants.PATH_ACTION, data).await()
                }
            } catch (e: Exception) {
                _isConnected.value = false
            }
        }
    }

    fun shutter() {
        sendAction(
            WatchActionMessage(action = WatchConstants.ACTION_SHUTTER),
            feedbackText = "📸 Snap!"
        )
    }

    fun playSound(sound: SoundType) {
        sendAction(
            WatchActionMessage(action = WatchConstants.ACTION_PLAY_SOUND, sound = sound.rawValue),
            feedbackText = "${sound.emoji} ${sound.displayName}"
        )
    }

    fun swapCameras() {
        sendAction(
            WatchActionMessage(action = WatchConstants.ACTION_SWAP_CAMERAS),
            feedbackText = "🔄 Swapped"
        )
    }

    fun toggleLock() {
        val willLock = !state.value.isToddlerLocked
        sendAction(
            WatchActionMessage(action = WatchConstants.ACTION_TOGGLE_LOCK),
            feedbackText = if (willLock) "🔒 Screen Locked" else "🔓 Unlocked"
        )
    }

    fun setFaceEmoji(emojiType: FaceEmojiType?) {
        sendAction(
            WatchActionMessage(
                action = WatchConstants.ACTION_SET_EMOJI,
                emoji = emojiType?.rawValue ?: "none"
            ),
            feedbackText = if (emojiType != null) "${emojiType.emoji} Mask On" else "Mask Cleared"
        )
    }

    fun toggleCaptureMode() {
        sendAction(
            WatchActionMessage(action = WatchConstants.ACTION_TOGGLE_CAPTURE_MODE),
            feedbackText = "Mode Switched"
        )
    }

    fun requestStatus() {
        sendAction(WatchActionMessage(action = WatchConstants.ACTION_REQUEST_STATUS))
    }
}
