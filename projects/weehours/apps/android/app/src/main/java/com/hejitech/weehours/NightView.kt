package com.hejitech.weehours

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun NightHudOverlay(model: AppModel) {
    val now by model.nowTick.collectAsState()
    val revision by model.revision.collectAsState()
    val lastEvent by model.lastLoggedEvent.collectAsState()
    val toast by model.toastMessage.collectAsState()

    val baby = remember(revision, now) { model.primaryBaby }
    val status = remember(revision, now) { model.status(baby.id, now) }
    val line = remember(revision, now) { model.statusLine(baby.id, now) }
    val timeFormatter = remember { SimpleDateFormat("HH:mm", Locale.US) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(WeeColors.NightBg)
            .padding(24.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Top bar: Child switcher + Close Night HUD
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    model.activeBabies.forEach { b ->
                        val selected = b.id == baby.id
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(if (selected) WeeColors.NightRed.copy(alpha = 0.22f) else WeeColors.NightSurface)
                                .border(
                                    width = 1.dp,
                                    color = if (selected) WeeColors.NightRed else WeeColors.NightRedDim,
                                    shape = RoundedCornerShape(20.dp)
                                )
                                .clickable { model.selectOnlyBaby(b.id) }
                                .padding(horizontal = 14.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = b.name,
                                color = WeeColors.NightRed,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 15.sp
                            )
                        }
                    }
                }

                IconButton(onClick = { model.setNightHud(false) }) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Exit Night Mode",
                        tint = WeeColors.NightRed
                    )
                }
            }

            // Center Clock & Live Status
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = timeFormatter.format(now),
                    color = WeeColors.NightRed,
                    fontSize = 68.sp,
                    fontWeight = FontWeight.Light,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "${baby.name} · $line",
                    color = WeeColors.NightRed,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center
                )
                if (!toast.isNullOrBlank()) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier
                            .padding(top = 6.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(WeeColors.NightSurface)
                            .border(1.dp, WeeColors.NightRedDim, RoundedCornerShape(12.dp))
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = toast ?: "",
                            color = WeeColors.NightRed,
                            fontSize = 14.sp
                        )
                        if (lastEvent != null) {
                            Box(
                                modifier = Modifier
                                    .clickable {
                                        lastEvent?.let { model.undoEvent(it.id) }
                                    }
                                    .padding(4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Undo,
                                    contentDescription = "Undo",
                                    tint = WeeColors.NightRed,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Giant Eyes-Half-Shut Action Grid (0 blue light)
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    val feedOpen = status.openFeedSince != null
                    NightActionButton(
                        title = if (feedOpen) "Finish Feed" else "Start Feed",
                        subtitle = if (feedOpen) "Tap to finish" else "${model.household.bottleMl(baby.id).toInt()} ml / Nurse",
                        active = feedOpen,
                        modifier = Modifier.weight(1f),
                        onClick = { model.toggleFeed(baby.id) }
                    )
                    val sleepOpen = status.sleepingSince != null
                    NightActionButton(
                        title = if (sleepOpen) "Woke Up" else "Fell Asleep",
                        subtitle = if (sleepOpen) "End sleep timer" else "Start sleep timer",
                        active = sleepOpen,
                        modifier = Modifier.weight(1f),
                        onClick = { model.toggleSleep(baby.id) }
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    NightActionButton(
                        title = "Wet Diaper",
                        subtitle = "1-tap log",
                        active = false,
                        modifier = Modifier.weight(1f),
                        onClick = { model.logDiaper(kind = "wet", babyId = baby.id) }
                    )
                    NightActionButton(
                        title = "Dirty Diaper",
                        subtitle = "Fill details later",
                        active = false,
                        modifier = Modifier.weight(1f),
                        onClick = { model.logDiaper(kind = "dirty", needsDetails = true, babyId = baby.id) }
                    )
                }

                // Giant Speak Orb
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(72.dp)
                        .clip(RoundedCornerShape(22.dp))
                        .background(WeeColors.NightRed.copy(alpha = 0.18f))
                        .border(2.dp, WeeColors.NightRed, RoundedCornerShape(22.dp))
                        .clickable { model.startVoiceCapture() },
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Mic,
                            contentDescription = null,
                            tint = WeeColors.NightRed,
                            modifier = Modifier.size(28.dp)
                        )
                        Text(
                            text = "Speak Log Entry",
                            color = WeeColors.NightRed,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NightActionButton(
    title: String,
    subtitle: String,
    active: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .height(104.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(if (active) WeeColors.NightRed.copy(alpha = 0.25f) else WeeColors.NightSurface)
            .border(
                width = if (active) 2.dp else 1.dp,
                color = if (active) WeeColors.NightRed else WeeColors.NightRedDim,
                shape = RoundedCornerShape(20.dp)
            )
            .clickable(onClick = onClick)
            .padding(16.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = title,
                color = WeeColors.NightRed,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = subtitle,
                color = WeeColors.NightRedDim,
                fontSize = 13.sp
            )
        }
    }
}
