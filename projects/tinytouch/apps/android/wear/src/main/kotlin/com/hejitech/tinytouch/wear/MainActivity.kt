package com.hejitech.tinytouch.wear

import android.content.Intent
import android.os.Bundle
import android.view.MotionEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.view.InputDeviceCompat
import androidx.core.view.MotionEventCompat
import com.hejitech.tinytouch.kit.games.PlayEnv
import com.hejitech.tinytouch.kit.games.ToddlerPlayStage

class MainActivity : ComponentActivity() {
    private val viewModel: WearViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Keep screen awake while toddler is playing (the watch's ExtendedRuntimeSession counterpart)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        handleIntent(intent)

        setContent {
            WearApp(viewModel)
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val data = intent?.data ?: return
        viewModel.handleIntentUri(
            scheme = data.scheme,
            host = data.host,
            modeParam = data.getQueryParameter("mode")
        )
    }

    override fun onGenericMotionEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_SCROLL &&
            event.isFromSource(InputDeviceCompat.SOURCE_ROTARY_ENCODER)
        ) {
            val delta = -event.getAxisValue(MotionEventCompat.AXIS_SCROLL)
            viewModel.onRotaryInput(delta)
            return true
        }
        return super.onGenericMotionEvent(event)
    }
}

@Composable
fun WearApp(viewModel: WearViewModel) {
    val state by viewModel.uiState.collectAsState()

    val env = remember(state.lowStimulation, state.voiceEnabled) {
        PlayEnv(
            lowStimulation = state.lowStimulation,
            voiceEnabled = state.voiceEnabled,
            onTouch = viewModel::registerTouch,
            crown = viewModel.crownEvents,
            round = true,
            topInset = 28.dp
        )
    }

    Box(modifier = Modifier.fillMaxSize()) {
        if (state.isParentMenuOpen) {
            WearParentDashboard(
                state = state,
                onSelectMode = viewModel::setMode,
                onSetTimer = viewModel::setPlayTimer,
                onToggleSound = viewModel::toggleSound,
                onToggleVoice = viewModel::toggleVoice,
                onToggleHaptics = viewModel::toggleHaptics,
                onToggleLowStim = viewModel::toggleLowStimulation,
                onSetHoldDuration = viewModel::setLockHoldDuration,
                onResumePlay = viewModel::closeParentMenu
            )
        } else {
            ToddlerPlayStage(
                mode = state.currentMode,
                env = env,
                isTimerActive = state.isTimerActive,
                remainingSeconds = state.remainingSeconds,
                lockHoldDuration = state.lockHoldDuration,
                onParentUnlocked = viewModel::openParentMenu,
                showShield = true
            )
        }
    }
}
