package com.hejitech.tinytouch.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.SmartDisplay
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.tinytouch.core.GameMode
import com.hejitech.tinytouch.core.HOLD_CHOICES
import com.hejitech.tinytouch.core.TIMER_CHOICES

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    state: PhoneUiState,
    onSelectMode: (GameMode) -> Unit,
    onSetTimer: (Int) -> Unit,
    onToggleSound: (Boolean) -> Unit,
    onToggleVoice: (Boolean) -> Unit,
    onToggleHaptics: (Boolean) -> Unit,
    onToggleLowStim: (Boolean) -> Unit,
    onSetHoldDuration: (Double) -> Unit,
    onTriggerLullaby: () -> Unit,
    onSyncNow: () -> Unit,
    onOpenGuide: () -> Unit,
    onOpenPreview: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("TinyTouch Remote", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Black,
                    titleContentColor = Color.White,
                    actionIconContentColor = Color.White
                ),
                actions = {
                    IconButton(onClick = onSyncNow, enabled = !state.isSyncing) {
                        if (state.isSyncing) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Color.White)
                        } else {
                            Icon(Icons.Default.Refresh, contentDescription = "Sync Now")
                        }
                    }
                }
            )
        },
        containerColor = Color(0xFF121212)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Wear OS Live Status Card
            WatchStatusCard(state = state, onSyncNow = onSyncNow)

            // 2. Remote Game Switcher
            GameSwitcherSection(selectedMode = state.selectedMode, onSelectMode = onSelectMode)

            // 3. Remote Session Limit & Lullaby
            TimerSection(
                selectedMinutes = state.timerMinutes,
                onSetTimer = onSetTimer,
                onTriggerLullaby = onTriggerLullaby
            )

            // 4. Watch Preferences
            WatchPreferencesSection(
                sound = state.soundEnabled,
                voice = state.voiceEnabled,
                haptics = state.hapticsEnabled,
                lowStim = state.lowStimulation,
                holdDuration = state.lockHoldDuration,
                onToggleSound = onToggleSound,
                onToggleVoice = onToggleVoice,
                onToggleHaptics = onToggleHaptics,
                onToggleLowStim = onToggleLowStim,
                onSetHoldDuration = onSetHoldDuration
            )

            // 5. Quick Links: Guide & Sandbox Preview
            QuickLinksSection(onOpenGuide = onOpenGuide, onOpenPreview = onOpenPreview)

            // 6. Kids Privacy notice
            PrivacyNoticeSection()
        }
    }
}

@Composable
private fun WatchStatusCard(state: PhoneUiState, onSyncNow: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color(0xFF1E1E1E))
            .padding(16.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF9933FF)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("⌚", fontSize = 22.sp)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Wear OS Remote", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 16.sp)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(if (state.isWatchConnected) Color(0xFF4CAF50) else Color(0xFF2196F3))
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (state.isWatchConnected) "Watch Active & Connected" else "Watch Ready (Auto-Syncs)",
                                color = if (state.isWatchConnected) Color(0xFF4CAF50) else Color.Gray,
                                fontSize = 12.sp
                            )
                        }
                    }
                }

                Button(
                    onClick = onSyncNow,
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF332040))
                ) {
                    Text("Sync", color = Color(0xFFFF80B3), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Divider(color = Color.White.copy(alpha = 0.1f))

            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                MetricItem(title = "CURRENT GAME", value = state.watchCurrentMode.capitalize())
                MetricItem(title = "SENSORY TOUCHES", value = "${state.watchTouchCount}", color = Color(0xFFBF80FF))
                MetricItem(title = "TIMER REMAINING", value = state.formattedWatchTime, color = Color(0xFF66B3FF))
            }
        }
    }
}

@Composable
private fun MetricItem(title: String, value: String, color: Color = Color.White) {
    Column {
        Text(title, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
        Spacer(modifier = Modifier.height(2.dp))
        Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = color)
    }
}

@Composable
private fun GameSwitcherSection(selectedMode: GameMode, onSelectMode: (GameMode) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Switch Game on Watch", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 16.sp)
        Text("Tap an activity to remotely switch what your child sees on your Wear OS watch.", color = Color.Gray, fontSize = 12.sp)

        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            GameMode.entries.forEach { mode ->
                val isSelected = mode == selectedMode
                val themeColor = Color(mode.themeColor)

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (isSelected) themeColor.copy(alpha = 0.15f) else Color(0xFF1E1E1E))
                        .border(
                            width = 2.dp,
                            color = if (isSelected) themeColor else Color.Transparent,
                            shape = RoundedCornerShape(16.dp)
                        )
                        .clickable { onSelectMode(mode) }
                        .padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(if (isSelected) themeColor else themeColor.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = when (mode) {
                                GameMode.BUBBLES -> "🫧"
                                GameMode.ANIMALS -> "🐾"
                                GameMode.SOUND_GARDEN -> "🎵"
                                GameMode.SPARKLES -> "✨"
                                GameMode.LULLABY -> "🌙"
                            },
                            fontSize = 22.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = mode.title,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (isSelected) themeColor else Color.White
                    )
                }
            }
        }
    }
}

@Composable
private fun TimerSection(
    selectedMinutes: Int,
    onSetTimer: (Int) -> Unit,
    onTriggerLullaby: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Session Timer & Transition", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 16.sp)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            TIMER_CHOICES.forEach { mins ->
                val isSelected = mins == selectedMinutes
                Button(
                    onClick = { onSetTimer(mins) },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isSelected) Color(0xFF2196F3) else Color(0xFF1E1E1E)
                    )
                ) {
                    Text(if (mins == 0) "Unlimited" else "${mins}m", color = Color.White, fontSize = 12.sp)
                }
            }
        }

        Button(
            onClick = onTriggerLullaby,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2A2045))
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                Text("🌙", fontSize = 18.sp)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Start Calming Lullaby Now", color = Color(0xFFBF80FF), fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun WatchPreferencesSection(
    sound: Boolean,
    voice: Boolean,
    haptics: Boolean,
    lowStim: Boolean,
    holdDuration: Double,
    onToggleSound: (Boolean) -> Unit,
    onToggleVoice: (Boolean) -> Unit,
    onToggleHaptics: (Boolean) -> Unit,
    onToggleLowStim: (Boolean) -> Unit,
    onSetHoldDuration: (Double) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Watch Settings & Accessibility", fontWeight = FontWeight.Bold, color = Color.White, fontSize = 16.sp)

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF1E1E1E))
        ) {
            PrefToggleRow("Sound Effects", "Play gentle pops, chimes, and notes", sound, onToggleSound)
            Divider(color = Color.White.copy(alpha = 0.08f), modifier = Modifier.padding(horizontal = 16.dp))
            PrefToggleRow("Animal Speech Words", "Spoken animal names ('Duck! Quack quack!')", voice, onToggleVoice)
            Divider(color = Color.White.copy(alpha = 0.08f), modifier = Modifier.padding(horizontal = 16.dp))
            PrefToggleRow("Tactile Haptics", "Haptic feedback on touches and rotary dial", haptics, onToggleHaptics)
            Divider(color = Color.White.copy(alpha = 0.08f), modifier = Modifier.padding(horizontal = 16.dp))
            PrefToggleRow("Low-Stimulation Mode", "Softer colors and slower animations", lowStim, onToggleLowStim)
            Divider(color = Color.White.copy(alpha = 0.08f), modifier = Modifier.padding(horizontal = 16.dp))

            // Hold Duration segmented
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Parent Shield Hold Time", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                    Text("Duration required to unlock settings", color = Color.Gray, fontSize = 11.sp)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    HOLD_CHOICES.forEach { dur ->
                        val isSelected = dur == holdDuration
                        Button(
                            onClick = { onSetHoldDuration(dur) },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isSelected) Color(0xFFFF5252) else Color(0xFF2C2C2C)
                            )
                        ) {
                            Text("${dur.toInt()}s", color = Color.White, fontSize = 11.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PrefToggleRow(title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onCheckedChange(!checked) }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(subtitle, color = Color.Gray, fontSize = 11.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = Color(0xFF4CAF50)
            )
        )
    }
}

@Composable
private fun QuickLinksSection(onOpenGuide: () -> Unit, onOpenPreview: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        QuickLinkRow(
            icon = "🛡️",
            title = "Toddler Lock & Safety Guide",
            subtitle = "Lock touch inputs & safe holding tips",
            onClick = onOpenGuide
        )
        QuickLinkRow(
            icon = "✨",
            title = "Interactive Sensory Preview",
            subtitle = "Test sound effects and games on phone",
            onClick = onOpenPreview
        )
    }
}

@Composable
private fun QuickLinkRow(icon: String, title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF1E1E1E))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(icon, fontSize = 24.sp)
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(subtitle, color = Color.Gray, fontSize = 11.sp)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = Color.Gray)
    }
}

@Composable
private fun PrivacyNoticeSection() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF102816))
            .padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("🔒", fontSize = 20.sp)
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text("100% Kid-Safe & Private", color = Color(0xFF4CAF50), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(
                    "No tracking, zero ads, zero data collection. All settings sync directly over local Bluetooth via Wearable Data Layer.",
                    color = Color.Gray,
                    fontSize = 10.sp
                )
            }
        }
    }
}
