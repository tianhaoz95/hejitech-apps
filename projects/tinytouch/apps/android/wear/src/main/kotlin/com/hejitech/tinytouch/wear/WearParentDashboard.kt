package com.hejitech.tinytouch.wear

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.ScalingLazyColumn
import androidx.wear.compose.material.Switch
import androidx.wear.compose.material.SwitchDefaults
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.ToggleChip
import androidx.wear.compose.material.ToggleChipDefaults
import com.hejitech.tinytouch.core.GameMode
import com.hejitech.tinytouch.core.HOLD_CHOICES
import com.hejitech.tinytouch.core.TIMER_CHOICES

@Composable
fun WearParentDashboard(
    state: WearUiState,
    onSelectMode: (GameMode) -> Unit,
    onSetTimer: (Int) -> Unit,
    onToggleSound: (Boolean) -> Unit,
    onToggleVoice: (Boolean) -> Unit,
    onToggleHaptics: (Boolean) -> Unit,
    onToggleLowStim: (Boolean) -> Unit,
    onSetHoldDuration: (Double) -> Unit,
    onResumePlay: () -> Unit,
) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .padding(horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        item {
            Text(
                text = "Parent Menu",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = Color.White,
                modifier = Modifier.padding(top = 16.dp, bottom = 4.dp)
            )
        }

        // Section: Return to play
        item {
            Button(
                onClick = onResumePlay,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(38.dp),
                colors = ButtonDefaults.primaryButtonColors(backgroundColor = Color(0xFF2196F3))
            ) {
                Text("▶ Return to Play", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color.White)
            }
        }

        // Activities header
        item {
            Text("ACTIVITIES", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
        }

        items(GameMode.entries.size) { idx ->
            val mode = GameMode.entries[idx]
            val isSelected = mode == state.currentMode
            val themeColor = Color(mode.themeColor)

            Button(
                onClick = { onSelectMode(mode) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(44.dp),
                colors = ButtonDefaults.buttonColors(
                    backgroundColor = if (isSelected) themeColor.copy(alpha = 0.35f) else Color(0xFF1E1E1E)
                )
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(themeColor),
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
                            fontSize = 12.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(mode.title, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        Text(mode.developmentalFocus, color = Color.Gray, fontSize = 9.sp, maxLines = 1)
                    }
                    if (isSelected) {
                        Text("✓", color = Color.Green, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Timer header
        item {
            Spacer(modifier = Modifier.height(4.dp))
            Text("SESSION LIMIT", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                TIMER_CHOICES.forEach { mins ->
                    val isSelected = mins == state.timerMinutes
                    Button(
                        onClick = { onSetTimer(mins) },
                        modifier = Modifier
                            .weight(1f)
                            .height(32.dp),
                        colors = ButtonDefaults.buttonColors(
                            backgroundColor = if (isSelected) Color(0xFFFF9900) else Color(0xFF2C2C2C)
                        )
                    ) {
                        Text(if (mins == 0) "Off" else "${mins}m", fontSize = 10.sp, color = Color.White)
                    }
                }
            }
        }

        // Preferences
        item {
            Spacer(modifier = Modifier.height(4.dp))
            Text("SENSORY OPTIONS", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
        }

        item {
            ToggleChip(
                checked = state.soundEnabled,
                onCheckedChange = onToggleSound,
                label = { Text("Sound Effects", fontSize = 11.sp) },
                toggleControl = { Switch(checked = state.soundEnabled) },
                modifier = Modifier.fillMaxWidth(),
                colors = ToggleChipDefaults.toggleChipColors(checkedStartBackgroundColor = Color(0xFF1E1E1E))
            )
        }

        item {
            ToggleChip(
                checked = state.voiceEnabled,
                onCheckedChange = onToggleVoice,
                label = { Text("Spoken Words", fontSize = 11.sp) },
                toggleControl = { Switch(checked = state.voiceEnabled) },
                modifier = Modifier.fillMaxWidth(),
                colors = ToggleChipDefaults.toggleChipColors(checkedStartBackgroundColor = Color(0xFF1E1E1E))
            )
        }

        item {
            ToggleChip(
                checked = state.hapticsEnabled,
                onCheckedChange = onToggleHaptics,
                label = { Text("Haptics", fontSize = 11.sp) },
                toggleControl = { Switch(checked = state.hapticsEnabled) },
                modifier = Modifier.fillMaxWidth(),
                colors = ToggleChipDefaults.toggleChipColors(checkedStartBackgroundColor = Color(0xFF1E1E1E))
            )
        }

        item {
            ToggleChip(
                checked = state.lowStimulation,
                onCheckedChange = onToggleLowStim,
                label = { Text("Low Stimulation", fontSize = 11.sp) },
                toggleControl = { Switch(checked = state.lowStimulation) },
                modifier = Modifier.fillMaxWidth(),
                colors = ToggleChipDefaults.toggleChipColors(checkedStartBackgroundColor = Color(0xFF1E1E1E))
            )
        }

        // Shield hold duration
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Lock Hold", fontSize = 11.sp, color = Color.White)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    HOLD_CHOICES.forEach { dur ->
                        val isSelected = dur == state.lockHoldDuration
                        Button(
                            onClick = { onSetHoldDuration(dur) },
                            modifier = Modifier
                                .size(36.dp, 28.dp),
                            colors = ButtonDefaults.buttonColors(
                                backgroundColor = if (isSelected) Color(0xFFFF5252) else Color(0xFF2C2C2C)
                            )
                        ) {
                            Text("${dur.toInt()}s", fontSize = 10.sp, color = Color.White)
                        }
                    }
                }
            }
        }

        // Session Stats
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Session touches", fontSize = 11.sp, color = Color.Gray)
                Text("${state.sessionTouchesCount}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF4CAF50))
            }
        }
    }
}
