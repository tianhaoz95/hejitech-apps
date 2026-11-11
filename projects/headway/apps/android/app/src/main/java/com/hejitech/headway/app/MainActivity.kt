package com.hejitech.headway.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.hejitech.headway.core.model.OnTrainMode

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsTransit
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.hejitech.headway.app.ui.screens.BoardScreen
import com.hejitech.headway.app.ui.screens.CommuteScreen
import com.hejitech.headway.app.ui.screens.FamilyScreen
import com.hejitech.headway.app.ui.screens.GlassesScreen
import com.hejitech.headway.app.ui.screens.SettingsScreen
import com.hejitech.headway.app.ui.theme.HeadwayTheme

enum class MainTab(val title: String) {
    TRAINS("Trains"),
    COMMUTE("Commute"),
    FAMILY("Family"),
    GLASSES("Glasses"),
    SETTINGS("Settings")
}

class MainActivity : ComponentActivity() {

    private val viewModel: HeadwayViewModel by viewModels()

    private val askBackground = registerForActivityResult(ActivityResultContracts.RequestPermission()) { viewModel.applyRideWatching() }
    private val askLocation = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        viewModel.applyRideWatching()
        // Android asks for "all the time" only after "while using the app".
        if (wantsBackground && granted[Manifest.permission.ACCESS_FINE_LOCATION] == true && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            askBackground.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }
    private var wantsBackground = false

    /** Asks for the location access an on-train choice needs, then the choice takes effect. */
    private fun requestRideAccess(mode: OnTrainMode) {
        if (!mode.usesLocation) return
        wantsBackground = mode == OnTrainMode.BACKGROUND
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fine) {
            val perms = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && wantsBackground) perms += Manifest.permission.POST_NOTIFICATIONS
            askLocation.launch(perms.toTypedArray())
        } else if (wantsBackground && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            askBackground.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }

    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    /** Android 13+ shows nothing until the person allows notifications: asked when they sign in or test an alert. */
    private fun requestNotifications() {
        if (!PushService.canNotify(this)) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    override fun onStart() {
        super.onStart()
        viewModel.onAppVisible(true)
    }

    override fun onStop() {
        viewModel.onAppVisible(false)
        super.onStop()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        PushService.ensureChannels(this)
        // Debug: `adb shell am start -n com.hejitech.headway/.app.MainActivity --ez autoSignIn true` signs the
        // seed rider in on the local stack (the iPhone app's -autoSignIn).
        if (BuildConfig.DEBUG && savedInstanceState == null && intent.getBooleanExtra("autoSignIn", false)) {
            viewModel.setBackendMode(true)
            viewModel.signInDebug()
        }

        setContent {
            HeadwayTheme {
                var currentTab by remember { mutableStateOf(MainTab.TRAINS) }
                val family by viewModel.family.collectAsState()

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    bottomBar = {
                        NavigationBar {
                            NavigationBarItem(
                                selected = currentTab == MainTab.TRAINS,
                                onClick = { currentTab = MainTab.TRAINS },
                                icon = { Icon(Icons.Default.DirectionsTransit, contentDescription = "Trains") },
                                label = { Text("Trains") }
                            )
                            NavigationBarItem(
                                selected = currentTab == MainTab.COMMUTE,
                                onClick = { currentTab = MainTab.COMMUTE },
                                icon = { Icon(Icons.Default.Schedule, contentDescription = "Commute") },
                                label = { Text("Commute") }
                            )
                            NavigationBarItem(
                                selected = currentTab == MainTab.FAMILY,
                                onClick = { currentTab = MainTab.FAMILY },
                                icon = {
                                    val invites = family?.invites?.size ?: 0
                                    BadgedBox(badge = { if (invites > 0) Badge { Text("$invites") } }) {
                                        Icon(Icons.Default.People, contentDescription = "Family")
                                    }
                                },
                                label = { Text("Family") }
                            )
                            NavigationBarItem(
                                selected = currentTab == MainTab.GLASSES,
                                onClick = { currentTab = MainTab.GLASSES },
                                icon = { Icon(Icons.Default.Visibility, contentDescription = "Glasses") },
                                label = { Text("Glasses") }
                            )
                            NavigationBarItem(
                                selected = currentTab == MainTab.SETTINGS,
                                onClick = { currentTab = MainTab.SETTINGS },
                                icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                                label = { Text("Settings") }
                            )
                        }
                    }
                ) { innerPadding ->
                    Surface(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding),
                        color = MaterialTheme.colorScheme.background
                    ) {
                        when (currentTab) {
                            MainTab.TRAINS -> BoardScreen(viewModel = viewModel)
                            MainTab.COMMUTE -> CommuteScreen(viewModel = viewModel)
                            MainTab.FAMILY -> FamilyScreen(viewModel = viewModel)
                            MainTab.GLASSES -> GlassesScreen(viewModel = viewModel)
                            MainTab.SETTINGS -> SettingsScreen(viewModel = viewModel, onRideModeChosen = ::requestRideAccess, onAskNotifications = ::requestNotifications)
                        }
                    }
                }
            }
        }
    }
}
