package com.hejitech.weehours

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bedtime
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

class MainActivity : ComponentActivity() {
    private val model: AppModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        intent?.data?.let { model.handleDeepLink(it) }

        setContent {
            WeeHoursTheme {
                val permissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestMultiplePermissions()
                ) { }

                LaunchedEffect(Unit) {
                    val perms = mutableListOf(Manifest.permission.RECORD_AUDIO)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        perms.add(Manifest.permission.POST_NOTIFICATIONS)
                    }
                    permissionLauncher.launch(perms.toTypedArray())
                }

                WeeHoursRoot(model = model)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent.data?.let { model.handleDeepLink(it) }
    }
}

@Composable
fun WeeHoursRoot(model: AppModel) {
    val phase by model.phase.collectAsState()
    val currentTab by model.currentTab.collectAsState()
    val listeningOpen by model.listeningSheetOpen.collectAsState()
    val reviewOpen by model.reviewSheetOpen.collectAsState()
    val showWhatsNew by model.showWhatsNew.collectAsState()
    val nightOverride by model.nightHudOverride.collectAsState()
    val thumbZone by model.thumbZone.collectAsState()
    val toast by model.toastMessage.collectAsState()
    val lastEvent by model.lastLoggedEvent.collectAsState()

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(4500L)
            model.clearToast()
        }
    }

    if (phase == AppPhase.ONBOARDING) {
        OnboardingScreen(model = model)
        return
    }

    if (nightOverride == true) {
        NightHudOverlay(model = model)
        if (listeningOpen) {
            ListeningSheet(model = model)
        }
        return
    }

    Scaffold(
        bottomBar = {
            Column {
                // Toast with 1-tap Undo
                if (!toast.isNullOrBlank()) {
                    Surface(
                        color = WeeColors.Charcoal,
                        contentColor = Color.White,
                        shape = RoundedCornerShape(14.dp),
                        shadowElevation = 6.dp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = toast ?: "",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f)
                            )
                            if (lastEvent != null) {
                                TextButton(
                                    onClick = {
                                        lastEvent?.let { model.undoEvent(it.id) }
                                        model.clearToast()
                                    }
                                ) {
                                    Icon(Icons.Default.Undo, contentDescription = null, tint = WeeColors.Amber, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Undo", color = WeeColors.Amber, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // One-Handed Thumb Dock (when enabled on Now tab)
                if (thumbZone && currentTab == MainTab.NOW) {
                    ThumbDockBar(model = model)
                }

                NavigationBar {
                    NavigationBarItem(
                        selected = currentTab == MainTab.NOW,
                        onClick = { model.selectTab(MainTab.NOW) },
                        icon = { Icon(Icons.Default.Home, contentDescription = "Now") },
                        label = { Text("Now") }
                    )
                    NavigationBarItem(
                        selected = currentTab == MainTab.TIMELINE,
                        onClick = { model.selectTab(MainTab.TIMELINE) },
                        icon = { Icon(Icons.Default.History, contentDescription = "Timeline") },
                        label = { Text("Timeline") }
                    )
                    NavigationBarItem(
                        selected = currentTab == MainTab.SETTINGS,
                        onClick = { model.selectTab(MainTab.SETTINGS) },
                        icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                        label = { Text("Settings") }
                    )
                }
            }
        },
        floatingActionButton = {
            if (!thumbZone || currentTab != MainTab.NOW) {
                FloatingActionButton(
                    onClick = { model.startVoiceCapture() },
                    containerColor = WeeColors.Amber,
                    contentColor = Color.White,
                    shape = CircleShape
                ) {
                    Icon(Icons.Default.Mic, contentDescription = "Speak Log Entry")
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (currentTab) {
                MainTab.NOW -> HomeView(model = model)
                MainTab.TIMELINE -> TimelineView(model = model)
                MainTab.SETTINGS -> SettingsView(model = model)
            }
        }
    }

    if (listeningOpen) {
        ListeningSheet(model = model)
    }
    if (reviewOpen) {
        ReviewSheet(model = model)
    }
    if (showWhatsNew) {
        WhatsNewSheet(onDismiss = { model.dismissWhatsNew() })
    }
}

@Composable
private fun ThumbDockBar(model: AppModel) {
    val baby = model.primaryBaby
    Surface(
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 4.dp,
        shadowElevation = 4.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ThumbDockButton(
                label = "Feed",
                color = WeeColors.FeedOrange,
                icon = { Icon(Icons.Default.LocalDrink, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp)) },
                modifier = Modifier.weight(1f),
                onClick = { model.toggleFeed(baby.id) }
            )
            ThumbDockButton(
                label = "Wet",
                color = WeeColors.DiaperGreen,
                icon = { Icon(Icons.Default.WaterDrop, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp)) },
                modifier = Modifier.weight(1f),
                onClick = { model.logDiaper(kind = "wet", babyId = baby.id) }
            )
            ThumbDockButton(
                label = "Sleep",
                color = WeeColors.SleepBlue,
                icon = { Icon(Icons.Default.Bedtime, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp)) },
                modifier = Modifier.weight(1f),
                onClick = { model.toggleSleep(baby.id) }
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(WeeColors.Amber)
                    .clickable { model.startVoiceCapture() }
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(Icons.Default.Mic, contentDescription = "Speak", tint = Color.White, modifier = Modifier.size(18.dp))
                    Text("Speak", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun ThumbDockButton(
    label: String,
    color: Color,
    icon: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(color)
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            icon()
            Text(label, color = Color.White, fontWeight = FontWeight.SemiBold)
        }
    }
}
