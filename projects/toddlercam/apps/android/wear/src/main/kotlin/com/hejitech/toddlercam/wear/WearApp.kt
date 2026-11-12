package com.hejitech.toddlercam.wear

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.*
import com.hejitech.toddlercam.core.FaceEmojiType
import com.hejitech.toddlercam.core.SoundType
import com.hejitech.toddlercam.core.ToddlerState

enum class WearScreen {
    MAIN,
    MASKS,
    SOUNDS,
    LAST_PHOTO
}

@Composable
fun WearApp(viewModel: WearViewModel) {
    val state by viewModel.state.collectAsState()
    val isConnected by viewModel.isConnected.collectAsState()
    val thumbnail by viewModel.lastPhotoThumbnail.collectAsState()
    val feedback by viewModel.lastActionFeedback.collectAsState()

    var currentScreen by remember { mutableStateOf(WearScreen.MAIN) }

    when (currentScreen) {
        WearScreen.MAIN -> MainRemoteScreen(
            state = state,
            isConnected = isConnected,
            feedback = feedback,
            onShutter = { viewModel.shutter() },
            onPlaySound = { viewModel.playSound(it) },
            onSwapCameras = { viewModel.swapCameras() },
            onToggleLock = { viewModel.toggleLock() },
            onOpenMasks = { currentScreen = WearScreen.MASKS },
            onOpenSounds = { currentScreen = WearScreen.SOUNDS },
            onOpenLastPhoto = { currentScreen = WearScreen.LAST_PHOTO }
        )
        WearScreen.MASKS -> FaceMasksScreen(
            activeMaskRaw = state.activeFaceEmoji,
            onSelectMask = {
                viewModel.setFaceEmoji(it)
                currentScreen = WearScreen.MAIN
            },
            onBack = { currentScreen = WearScreen.MAIN }
        )
        WearScreen.SOUNDS -> SoundboardScreen(
            onPlaySound = { viewModel.playSound(it) },
            onBack = { currentScreen = WearScreen.MAIN }
        )
        WearScreen.LAST_PHOTO -> LastPhotoScreen(
            thumbnail = thumbnail,
            onBack = { currentScreen = WearScreen.MAIN }
        )
    }
}

@Composable
fun MainRemoteScreen(
    state: ToddlerState,
    isConnected: Boolean,
    feedback: String?,
    onShutter: () -> Unit,
    onPlaySound: (SoundType) -> Unit,
    onSwapCameras: () -> Unit,
    onToggleLock: () -> Unit,
    onOpenMasks: () -> Unit,
    onOpenSounds: () -> Unit,
    onOpenLastPhoto: () -> Unit
) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 18.dp)
    ) {
        // 1. Connection & Mode Status Bar
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(if (isConnected) Color(0xFF4CAF50) else Color(0xFFFFB300))
                    )
                    Spacer(modifier = Modifier.width(5.dp))
                    Text(
                        text = if (isConnected) "ToddlerCam" else "Connecting...",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.LightGray
                    )
                }

                if (state.isToddlerLocked) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "🔒 Screen Locked",
                        fontSize = 10.sp,
                        color = Color(0xFFFFCC80),
                        fontWeight = FontWeight.Bold
                    )
                }

                if (!feedback.isNullOrEmpty()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = feedback,
                        fontSize = 10.sp,
                        color = Color(0xFF81D4FA),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // 2. Giant Shutter Button
        item {
            Spacer(modifier = Modifier.height(4.dp))
            Button(
                onClick = onShutter,
                modifier = Modifier
                    .fillMaxWidth(0.92f)
                    .height(52.dp),
                colors = ButtonDefaults.buttonColors(
                    backgroundColor = Color(0xFFFF9800),
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(26.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(text = "📸", fontSize = 20.sp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "SHUTTER",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }
        }

        // 3. Attention Grabbers (Animal Sounds to make child smile)
        item {
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Attention Grabbers",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.Gray
            )
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(0.95f),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                CompactChip(
                    onClick = { onPlaySound(SoundType.WOOF) },
                    label = { Text("🐶 Bark", fontSize = 11.sp) },
                    modifier = Modifier.weight(1f),
                    colors = ChipDefaults.secondaryChipColors()
                )
                CompactChip(
                    onClick = { onPlaySound(SoundType.QUACK) },
                    label = { Text("🦆 Quack", fontSize = 11.sp) },
                    modifier = Modifier.weight(1f),
                    colors = ChipDefaults.secondaryChipColors()
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(0.95f),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                CompactChip(
                    onClick = { onPlaySound(SoundType.MEOW) },
                    label = { Text("🐱 Meow", fontSize = 11.sp) },
                    modifier = Modifier.weight(1f),
                    colors = ChipDefaults.secondaryChipColors()
                )
                CompactChip(
                    onClick = { onPlaySound(SoundType.GIGGLE) },
                    label = { Text("👶 Giggle", fontSize = 11.sp) },
                    modifier = Modifier.weight(1f),
                    colors = ChipDefaults.secondaryChipColors()
                )
            }
        }

        // 4. Quick Controls: Flip Camera & Lock Screen
        item {
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(0.95f),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Chip(
                    onClick = onSwapCameras,
                    label = {
                        Text(
                            text = if (state.primaryPosition == "front") "🔄 Front" else "🔄 Back",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    modifier = Modifier.weight(1f),
                    colors = ChipDefaults.chipColors(backgroundColor = Color(0xFF263238))
                )
                Chip(
                    onClick = onToggleLock,
                    label = {
                        Text(
                            text = if (state.isToddlerLocked) "🔓 Unlock" else "🔒 Lock",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    modifier = Modifier.weight(1f),
                    colors = ChipDefaults.chipColors(
                        backgroundColor = if (state.isToddlerLocked) Color(0xFFB71C1C) else Color(0xFF1B5E20)
                    )
                )
            }
        }

        // 5. Face Masks Button
        item {
            val maskEmoji = FaceEmojiType.fromRaw(state.activeFaceEmoji)?.emoji ?: "🎭"
            Chip(
                onClick = onOpenMasks,
                label = { Text("Face Masks", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                secondaryLabel = {
                    Text(
                        text = if (state.activeFaceEmoji == "none") "None" else "Active: $maskEmoji",
                        fontSize = 10.sp,
                        color = Color.LightGray
                    )
                },
                icon = { Text(maskEmoji, fontSize = 16.sp) },
                modifier = Modifier.fillMaxWidth(0.95f),
                colors = ChipDefaults.secondaryChipColors()
            )
        }

        // 6. Last Photo Review Button
        item {
            Chip(
                onClick = onOpenLastPhoto,
                label = { Text("Review Last Photo", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                icon = { Text("🖼️", fontSize = 16.sp) },
                modifier = Modifier.fillMaxWidth(0.95f),
                colors = ChipDefaults.secondaryChipColors()
            )
        }

        // 7. Full Soundboard
        item {
            Chip(
                onClick = onOpenSounds,
                label = { Text("Silly Soundboard", fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                icon = { Text("🪈", fontSize = 16.sp) },
                modifier = Modifier.fillMaxWidth(0.95f),
                colors = ChipDefaults.secondaryChipColors()
            )
        }
    }
}

@Composable
fun FaceMasksScreen(
    activeMaskRaw: String,
    onSelectMask: (FaceEmojiType?) -> Unit,
    onBack: () -> Unit
) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 20.dp)
    ) {
        item {
            Text(
                text = "🎭 Face Masks",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        item {
            Chip(
                onClick = { onSelectMask(null) },
                label = { Text("None (Clear Mask)", fontSize = 12.sp) },
                colors = ChipDefaults.chipColors(
                    backgroundColor = if (activeMaskRaw == "none") Color(0xFFD32F2F) else Color(0xFF424242)
                ),
                modifier = Modifier.fillMaxWidth(0.95f)
            )
        }

        items(FaceEmojiType.entries.size) { index ->
            val emojiType = FaceEmojiType.entries[index]
            val isSelected = activeMaskRaw == emojiType.rawValue
            Chip(
                onClick = { onSelectMask(emojiType) },
                label = { Text("${emojiType.emoji} ${emojiType.displayName}", fontSize = 12.sp) },
                colors = ChipDefaults.chipColors(
                    backgroundColor = if (isSelected) Color(0xFFFF9800) else Color(0xFF263238)
                ),
                modifier = Modifier.fillMaxWidth(0.95f)
            )
        }

        item {
            Spacer(modifier = Modifier.height(4.dp))
            CompactChip(
                onClick = onBack,
                label = { Text("Back", fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth(0.6f)
            )
        }
    }
}

@Composable
fun SoundboardScreen(
    onPlaySound: (SoundType) -> Unit,
    onBack: () -> Unit
) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 20.dp)
    ) {
        item {
            Text(
                text = "🦆 Soundboard",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        items(SoundType.entries.size) { index ->
            val sound = SoundType.entries[index]
            Chip(
                onClick = { onPlaySound(sound) },
                label = { Text("${sound.emoji} ${sound.displayName}", fontSize = 12.sp) },
                modifier = Modifier.fillMaxWidth(0.95f),
                colors = ChipDefaults.secondaryChipColors()
            )
        }

        item {
            Spacer(modifier = Modifier.height(4.dp))
            CompactChip(
                onClick = onBack,
                label = { Text("Back", fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth(0.6f)
            )
        }
    }
}

@Composable
fun LastPhotoScreen(
    thumbnail: Bitmap?,
    onBack: () -> Unit
) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 18.dp)
    ) {
        item {
            Text(
                text = "🖼️ Last Photo",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        item {
            Spacer(modifier = Modifier.height(4.dp))
            if (thumbnail != null) {
                Image(
                    bitmap = thumbnail.asImageBitmap(),
                    contentDescription = "Last captured photo thumbnail",
                    modifier = Modifier
                        .size(110.dp)
                        .clip(RoundedCornerShape(14.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF263238)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No photo taken yet",
                        fontSize = 10.sp,
                        color = Color.Gray,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(6.dp)
                    )
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(6.dp))
            CompactChip(
                onClick = onBack,
                label = { Text("Back", fontSize = 11.sp) },
                modifier = Modifier.fillMaxWidth(0.6f)
            )
        }
    }
}
