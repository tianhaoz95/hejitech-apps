package com.hejitech.headway.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsTransit
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import com.hejitech.headway.app.ui.screens.BoardScreen
import com.hejitech.headway.app.ui.screens.CommuteScreen
import com.hejitech.headway.app.ui.screens.FamilyScreen
import com.hejitech.headway.app.ui.screens.SettingsScreen
import com.hejitech.headway.app.ui.screens.SignInScreen
import com.hejitech.headway.app.ui.screens.WhatsNew
import com.hejitech.headway.app.ui.screens.WhatsNewDialog
import com.hejitech.headway.app.ui.theme.HeadwayTheme
import com.hejitech.headway.core.model.OnTrainMode

enum class MainTab(val title: String) {
    TRAINS("Trains"),
    COMMUTE("Commute"),
    FAMILY("Family"),
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

    /** Location for the trip estimate (Settings › Location): the switch turns on only once access is given. */
    private val askLocationForEstimate = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { viewModel.setUseLocation(true) }

    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { viewModel.onNotificationPermission(it) }

    /** Asks for the location access an on-train choice needs, then the choice takes effect. */
    private fun requestRideAccess(mode: OnTrainMode) {
        if (!mode.usesLocation) return
        wantsBackground = mode == OnTrainMode.BACKGROUND
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fine) {
            askLocation.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        } else if (wantsBackground && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            askBackground.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }

    private fun requestUseLocation(on: Boolean) {
        if (on && !viewModel.hasLocationAccess()) {
            askLocationForEstimate.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        } else {
            viewModel.setUseLocation(on)
        }
    }

    /** Android 13+ shows nothing until the person allows notifications. */
    private fun requestNotifications() {
        if (PushService.canNotify(this)) viewModel.onNotificationPermission(true)
        else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    /** Alerts are the point of the app, so ask once, the first time it opens signed in. Later: Settings › Alerts. */
    private fun askForNotificationsOnce() {
        if (PushService.canNotify(this)) return
        val prefs = getSharedPreferences("headway", Context.MODE_PRIVATE)
        if (prefs.getBoolean("asked_notifications", false)) return
        prefs.edit().putBoolean("asked_notifications", true).apply()
        requestNotifications()
    }

    override fun onStart() {
        super.onStart()
        viewModel.onAppVisible(true)
    }

    override fun onStop() {
        viewModel.onAppVisible(false)
        super.onStop()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handle(intent)
    }

    /** The browser coming back from Google sign-in. */
    private fun handle(intent: Intent) {
        val data = intent.data ?: return
        if (data.scheme == "headway" && data.host == "login-callback") {
            viewModel.finishOAuth(data)
            intent.data = null
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        PushService.ensureChannels(this)
        if (savedInstanceState == null) handle(intent)

        // Debug: `adb shell am start -n com.hejitech.headway/.app.MainActivity --ez autoSignIn true` signs the
        // seed rider in on the local stack (the iPhone app's -autoSignIn); `--es screen commute` opens a tab.
        if (BuildConfig.DEBUG && savedInstanceState == null && intent.getBooleanExtra("autoSignIn", false)) {
            viewModel.setBackendMode(true)
            viewModel.signInLocalSeed()
        }
        val firstTab = (if (BuildConfig.DEBUG) intent.getStringExtra("screen") else null)
            ?.let { name ->
                if (name.equals("glasses", ignoreCase = true)) MainTab.SETTINGS
                else MainTab.entries.firstOrNull { it.name.equals(name, ignoreCase = true) }
            } ?: MainTab.TRAINS

        setContent {
            HeadwayTheme {
                val phase by viewModel.phase.collectAsState()
                var showWhatsNew by rememberSaveable { mutableStateOf(false) }

                LaunchedEffect(phase) {
                    if (phase == Phase.READY) {
                        askForNotificationsOnce()
                        if (WhatsNew.shouldShowAutomatically(this@MainActivity)) showWhatsNew = true
                    }
                }

                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    when (phase) {
                        Phase.LAUNCHING -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                        Phase.SIGNED_OUT -> SignInScreen(viewModel)
                        Phase.READY -> MainTabs(firstTab)
                    }
                }

                if (showWhatsNew) {
                    WhatsNewDialog(onDismiss = {
                        WhatsNew.markSeen(this@MainActivity)
                        showWhatsNew = false
                    })
                }
            }
        }
    }

    @Composable
    private fun MainTabs(firstTab: MainTab) {
        var currentTab by rememberSaveable { mutableStateOf(firstTab) }
        val family by viewModel.family.collectAsState()

        Scaffold(
            modifier = Modifier.fillMaxSize(),
            bottomBar = {
                NavigationBar {
                    MainTab.entries.forEach { tab ->
                        NavigationBarItem(
                            selected = currentTab == tab,
                            onClick = { currentTab = tab },
                            icon = {
                                val icon = when (tab) {
                                    MainTab.TRAINS -> Icons.Default.DirectionsTransit
                                    MainTab.COMMUTE -> Icons.Default.Schedule
                                    MainTab.FAMILY -> Icons.Default.People
                                    MainTab.SETTINGS -> Icons.Default.Settings
                                }
                                val invites = if (tab == MainTab.FAMILY) family?.invites?.size ?: 0 else 0
                                BadgedBox(badge = { if (invites > 0) Badge { Text("$invites") } }) {
                                    Icon(icon, contentDescription = tab.title)
                                }
                            },
                            label = { Text(tab.title) }
                        )
                    }
                }
            }
        ) { innerPadding ->
            // The tabs have their own top bars: they must not add the status bar's height again.
            Surface(modifier = Modifier.fillMaxSize().padding(innerPadding).consumeWindowInsets(innerPadding), color = MaterialTheme.colorScheme.background) {
                when (currentTab) {
                    MainTab.TRAINS -> BoardScreen(viewModel = viewModel)
                    MainTab.COMMUTE -> CommuteScreen(viewModel = viewModel, onAskNotifications = ::requestNotifications)
                    MainTab.FAMILY -> FamilyScreen(viewModel = viewModel)
                    MainTab.SETTINGS -> SettingsScreen(
                        viewModel = viewModel,
                        onRideModeChosen = ::requestRideAccess,
                        onAskNotifications = ::requestNotifications,
                        onUseLocation = ::requestUseLocation
                    )
                }
            }
        }
    }
}
