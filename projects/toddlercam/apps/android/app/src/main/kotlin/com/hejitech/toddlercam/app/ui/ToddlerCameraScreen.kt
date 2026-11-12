package com.hejitech.toddlercam.app.ui

import android.view.ViewGroup
import androidx.camera.view.PreviewView
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.hejitech.toddlercam.app.audio.SoundManager
import com.hejitech.toddlercam.app.camera.DualCameraManager
import com.hejitech.toddlercam.core.FaceEmojiType
import com.hejitech.toddlercam.core.SoundType
import kotlinx.coroutines.delay

enum class ActiveDialog {
    NONE,
    PARENT_GATE_HUB,
    PARENT_GATE_GALLERY,
    PARENT_HUB,
    GALLERY
}

@Composable
fun ToddlerCameraScreen(
    cameraManager: DualCameraManager,
    soundManager: SoundManager,
    modifier: Modifier = Modifier
) {
    val state by cameraManager.state.collectAsState()
    val latestPhoto by cameraManager.latestPhoto.collectAsState()
    val isFlash by cameraManager.isFlashActive.collectAsState()
    val lifecycleOwner = LocalLifecycleOwner.current

    var activeDialog by remember { mutableStateOf(ActiveDialog.NONE) }
    var previewViewRef by remember { mutableStateOf<PreviewView?>(null) }

    // Touch pop bubbles when touching anywhere on screen
    val touchPops = remember { mutableStateListOf<PoppingBubble>() }
    val popSymbols = remember { listOf("🫧", "⭐", "❤️", "🎵", "🎈", "✨", "🌈") }
    val touchSounds = remember { listOf(SoundType.POP, SoundType.QUACK, SoundType.BOING, SoundType.GIGGLE) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    if (!state.isToddlerLocked) {
                        soundManager.play(touchSounds.random())
                        val symbol = popSymbols.random()
                        touchPops.add(PoppingBubble(symbol = symbol, offset = offset))
                    }
                }
            }
    ) {
        // 1. Camera Feed / Preview
        if (!cameraManager.isDemoMode) {
            AndroidView(
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                    }.also { pv ->
                        previewViewRef = pv
                        cameraManager.bindCamera(lifecycleOwner, pv)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        } else {
            // Demo mode cheerful animated preview
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF2E3440), Color(0xFF3B4252), Color(0xFF434C5E))
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(text = "👶", fontSize = 80.sp)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "ToddlerCam Live Feed",
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Demo Mode • Tap anywhere for cheerful pops!",
                        color = Color(0xFFFFCC80),
                        fontSize = 12.sp
                    )
                }
            }
        }

        // 2. Picture-in-Picture Floating Selfie Window (Top Right)
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(top = 44.dp, end = 16.dp)
                .size(width = 100.dp, height = 135.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Color(0x99263238))
                .border(3.dp, Color(0xFFFFD54F), RoundedCornerShape(20.dp))
                .clickable {
                    cameraManager.swapCameras(lifecycleOwner, previewViewRef)
                    soundManager.play(SoundType.BOING)
                },
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = if (state.primaryPosition == "back") "👶 Selfie" else "📸 Back",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(text = "Tap to swap", fontSize = 9.sp, color = Color.LightGray)
            }
        }

        // 3. Active Face Emoji Tracking Overlay
        val activeEmoji = FaceEmojiType.fromRaw(state.activeFaceEmoji)
        if (activeEmoji != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 130.dp)
            ) {
                Text(
                    text = activeEmoji.emoji,
                    fontSize = 72.sp
                )
            }
        }

        // 4. Cheerful Touch Sparkles / Pops
        for (pop in touchPops) {
            key(pop.id) {
                LaunchedEffect(pop.id) {
                    delay(700)
                    touchPops.remove(pop)
                }
                Box(
                    modifier = Modifier.offset(
                        x = (pop.offset.x / 2.5f).dp,
                        y = (pop.offset.y / 2.5f).dp
                    )
                ) {
                    Text(text = pop.symbol, fontSize = 38.sp)
                }
            }
        }

        // 5. Header Bar (Status & Parent Safe Mode)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 44.dp, start = 16.dp, end = 125.dp),
            horizontalArrangement = Arrangement.Start,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0x99000000))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "📸", fontSize = 14.sp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "ToddlerCam",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }
        }

        // 6. Bottom Controls
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(bottom = 24.dp)
        ) {
            ToddlerControlBar(
                onShutter = {
                    soundManager.play(SoundType.SHUTTER)
                    cameraManager.capturePhoto { photo ->
                        // Photo saved to media store & thumbnail broadcast to watch
                    }
                },
                onOpenGallery = {
                    activeDialog = ActiveDialog.PARENT_GATE_GALLERY
                },
                onOpenParentZone = {
                    activeDialog = ActiveDialog.PARENT_GATE_HUB
                }
            )
        }

        // 7. Fullscreen Toddler Lock Overlay (when lock enabled)
        if (state.isToddlerLocked) {
            ToddlerLockOverlay(
                onPopTouch = { soundManager.play(SoundType.POP) },
                onTripleTapUnlock = { cameraManager.toggleToddlerLock() }
            )
        }

        // 8. Flash effect
        if (isFlash) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.White)
            )
        }

        // 9. Dialogs
        when (activeDialog) {
            ActiveDialog.PARENT_GATE_HUB -> {
                ParentGateDialog(
                    onSuccess = { activeDialog = ActiveDialog.PARENT_HUB },
                    onDismiss = { activeDialog = ActiveDialog.NONE }
                )
            }
            ActiveDialog.PARENT_GATE_GALLERY -> {
                ParentGateDialog(
                    onSuccess = { activeDialog = ActiveDialog.GALLERY },
                    onDismiss = { activeDialog = ActiveDialog.NONE }
                )
            }
            ActiveDialog.PARENT_HUB -> {
                ParentHubDialog(
                    state = state,
                    onToggleLock = { cameraManager.toggleToddlerLock() },
                    onSwapCameras = { cameraManager.swapCameras(lifecycleOwner, previewViewRef) },
                    onSelectMask = { cameraManager.setFaceEmoji(it) },
                    onPlaySound = { soundManager.play(it) },
                    onDismiss = { activeDialog = ActiveDialog.NONE }
                )
            }
            ActiveDialog.GALLERY -> {
                GalleryDialog(
                    latestPhoto = latestPhoto,
                    onDismiss = { activeDialog = ActiveDialog.NONE }
                )
            }
            ActiveDialog.NONE -> {}
        }
    }
}
