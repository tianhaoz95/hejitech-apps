package com.hejitech.toddlercam.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.hejitech.toddlercam.app.audio.SoundManager
import com.hejitech.toddlercam.app.camera.DualCameraManager
import com.hejitech.toddlercam.app.ui.ToddlerCameraScreen
import com.hejitech.toddlercam.app.wear.PhoneWearableManager
import com.hejitech.toddlercam.core.FaceEmojiType
import com.hejitech.toddlercam.core.SoundType
import com.hejitech.toddlercam.core.WatchActionMessage
import com.hejitech.toddlercam.core.WatchConstants
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var soundManager: SoundManager
    private lateinit var cameraManager: DualCameraManager
    private lateinit var wearableManager: PhoneWearableManager

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        // Permissions updated
    }

    private val actionListener: (WatchActionMessage) -> Unit = { action ->
        runOnUiThread {
            handleWatchAction(action)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        soundManager = SoundManager(this)
        cameraManager = DualCameraManager(this)
        wearableManager = PhoneWearableManager.get(this)

        checkPermissions()

        PhoneWearableManager.addActionListener(actionListener)

        // Observe state changes and broadcast to Wear OS watches
        lifecycleScope.launch {
            cameraManager.state.collectLatest { state ->
                wearableManager.broadcastState(state)
            }
        }

        setContent {
            ToddlerCameraScreen(
                cameraManager = cameraManager,
                soundManager = soundManager
            )
        }
    }

    private fun handleWatchAction(action: WatchActionMessage) {
        when (action.action) {
            WatchConstants.ACTION_SHUTTER -> {
                soundManager.play(SoundType.SHUTTER)
                cameraManager.capturePhoto { photo ->
                    wearableManager.sendThumbnailToWatch(photo.thumbnailBytes)
                }
            }
            WatchConstants.ACTION_PLAY_SOUND -> {
                val sound = action.sound?.let { SoundType.fromRaw(it) } ?: SoundType.QUACK
                soundManager.play(sound)
            }
            WatchConstants.ACTION_SWAP_CAMERAS -> {
                cameraManager.swapCameras()
            }
            WatchConstants.ACTION_TOGGLE_LOCK -> {
                cameraManager.toggleToddlerLock()
            }
            WatchConstants.ACTION_SET_EMOJI -> {
                val emoji = action.emoji?.let { FaceEmojiType.fromRaw(it) }
                cameraManager.setFaceEmoji(emoji)
            }
            WatchConstants.ACTION_TOGGLE_CAPTURE_MODE -> {
                cameraManager.toggleCaptureMode()
            }
            WatchConstants.ACTION_REQUEST_STATUS -> {
                wearableManager.broadcastState(cameraManager.state.value)
            }
        }
    }

    private fun checkPermissions() {
        // Camera only: the app takes photos, never records audio (a kids app must not ask for more).
        val permissions = arrayOf(Manifest.permission.CAMERA)
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        PhoneWearableManager.removeActionListener(actionListener)
        cameraManager.release()
        soundManager.release()
    }
}
