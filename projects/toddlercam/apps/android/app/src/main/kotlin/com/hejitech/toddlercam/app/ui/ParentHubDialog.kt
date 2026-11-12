package com.hejitech.toddlercam.app.ui

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.hejitech.toddlercam.core.FaceEmojiType
import com.hejitech.toddlercam.core.SoundType
import com.hejitech.toddlercam.core.ToddlerState

@Composable
fun ParentHubDialog(
    state: ToddlerState,
    onToggleLock: () -> Unit,
    onSwapCameras: () -> Unit,
    onSelectMask: (FaceEmojiType?) -> Unit,
    onPlaySound: (SoundType) -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = Color(0xFF1E1E1E),
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.88f)
                .padding(8.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "⚙️ Parent Hub",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    TextButton(onClick = onDismiss) {
                        Text("Done", fontWeight = FontWeight.Bold, color = Color(0xFFFFB74D))
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    // 1. Android App Pinning (Toddler Screen Safe Guide)
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF2C3437)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = "🔒 Android App Pinning (Toddler Mode)",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = Color(0xFF81D4FA)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "To prevent toddlers from leaving the camera, turn on App Pinning in Android Settings. Open recent apps, tap the app icon, and choose 'Pin'.",
                                    fontSize = 12.sp,
                                    color = Color.LightGray
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedButton(
                                    onClick = {
                                        runCatching {
                                            context.startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS))
                                        }
                                    },
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF81D4FA))
                                ) {
                                    Text("Open Security Settings", fontSize = 12.sp)
                                }
                            }
                        }
                    }

                    // 2. Camera & Lock Controls
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF2A2A2A)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = "Camera & Toddler Lock",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Button(
                                        onClick = onSwapCameras,
                                        modifier = Modifier.weight(1f),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF424242))
                                    ) {
                                        Text("🔄 Swap Camera", fontSize = 12.sp)
                                    }
                                    Button(
                                        onClick = onToggleLock,
                                        modifier = Modifier.weight(1f),
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = if (state.isToddlerLocked) Color(0xFFC62828) else Color(0xFF2E7D32)
                                        )
                                    ) {
                                        Text(if (state.isToddlerLocked) "🔓 Unlock" else "🔒 Lock Screen", fontSize = 12.sp)
                                    }
                                }
                            }
                        }
                    }

                    // 3. Face Masks (Emoji Filters)
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF2A2A2A)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = "🎭 Face Masks (Emoji Overlays)",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                // "None" plus all nine masks in two rows of five equal chips (two
                                // fixed rows used to push four masks off the card).
                                val choices: List<FaceEmojiType?> = listOf(null) + FaceEmojiType.entries
                                choices.chunked(5).forEachIndexed { rowIndex, row ->
                                    if (rowIndex > 0) Spacer(modifier = Modifier.height(6.dp))
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        for (emoji in row) {
                                            val selected = if (emoji == null) state.activeFaceEmoji == "none"
                                            else state.activeFaceEmoji == emoji.rawValue
                                            OutlinedButton(
                                                onClick = { onSelectMask(emoji) },
                                                modifier = Modifier.weight(1f),
                                                contentPadding = PaddingValues(horizontal = 0.dp, vertical = 8.dp),
                                                colors = ButtonDefaults.outlinedButtonColors(
                                                    contentColor = when {
                                                        emoji == null && selected -> Color(0xFFFF5252)
                                                        emoji == null -> Color.Gray
                                                        selected -> Color(0xFFFFB74D)
                                                        else -> Color.White
                                                    }
                                                )
                                            ) {
                                                if (emoji == null) Text("None", fontSize = 10.sp, maxLines = 1)
                                                else Text(emoji.emoji, fontSize = 16.sp)
                                            }
                                        }
                                }
                                }
                            }
                        }
                    }

                    // 4. Silly Soundboard
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF2A2A2A)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = "🦆 Attention Grabber Sounds",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = Color.White
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    for (sound in listOf(SoundType.WOOF, SoundType.QUACK, SoundType.MEOW, SoundType.GIGGLE)) {
                                        Button(
                                            onClick = { onPlaySound(sound) },
                                            modifier = Modifier.weight(1f),
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF424242))
                                        ) {
                                            Text("${sound.emoji}", fontSize = 14.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 5. Wear OS Wrist Remote Link
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF2A2A2A)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = "⌚ Wear OS Parent Remote",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = Color(0xFFFFB74D)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Install ToddlerCam on your Wear OS watch to trigger the shutter, blast attention sounds, and review photos right from your wrist!",
                                    fontSize = 12.sp,
                                    color = Color.LightGray
                                )
                            }
                        }
                    }

                    // 6. Privacy & Child Safety
                    item {
                        Text(
                            text = "🛡️ 100% Child-Safe & COPPA Compliant\nZero tracking, zero analytics, zero ads, no accounts required. All photos and sounds stay strictly on your device.",
                            fontSize = 11.sp,
                            color = Color.Gray,
                            lineHeight = 16.sp
                        )
                    }
                }
            }
        }
    }
}
