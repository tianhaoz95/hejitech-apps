package com.hejitech.tinytouch.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

class MainActivity : ComponentActivity() {
    private val viewModel: PhoneViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TinyTouchApp(viewModel)
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.checkConnection()
    }
}

@Composable
fun TinyTouchApp(viewModel: PhoneViewModel) {
    val navController = rememberNavController()
    val state by viewModel.uiState.collectAsState()

    NavHost(navController = navController, startDestination = "dashboard") {
        composable("dashboard") {
            DashboardScreen(
                state = state,
                onSelectMode = viewModel::selectMode,
                onSetTimer = viewModel::setTimer,
                onToggleSound = viewModel::setSound,
                onToggleVoice = viewModel::setVoice,
                onToggleHaptics = viewModel::setHaptics,
                onToggleLowStim = viewModel::setLowStimulation,
                onSetHoldDuration = viewModel::setLockHoldDuration,
                onTriggerLullaby = viewModel::triggerLullabyNow,
                onSyncNow = viewModel::manualSync,
                onOpenGuide = { navController.navigate("guide") },
                onOpenPreview = { navController.navigate("preview") }
            )
        }
        composable("guide") {
            SafetyGuideScreen(onBack = { navController.popBackStack() })
        }
        composable("preview") {
            GamePreviewScreen(
                lowStimulation = state.lowStimulation,
                voiceEnabled = state.voiceEnabled,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
