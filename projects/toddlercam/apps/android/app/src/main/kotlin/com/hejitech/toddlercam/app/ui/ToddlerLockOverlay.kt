package com.hejitech.toddlercam.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.util.UUID

data class PoppingBubble(
    val id: String = UUID.randomUUID().toString(),
    val symbol: String,
    val offset: Offset
)

@Composable
fun ToddlerLockOverlay(
    onPopTouch: () -> Unit,
    onTripleTapUnlock: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bubbles = remember { mutableStateListOf<PoppingBubble>() }
    val symbols = remember { listOf("🫧", "⭐", "❤️", "🎵", "🎈", "✨") }
    var unlockTapCount by remember { mutableStateOf(0) }
    var lastTapTime by remember { mutableStateOf(0L) }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0x22000000))
            .pointerInput(Unit) {
                detectTapGestures { offset ->
                    onPopTouch()
                    val randomSymbol = symbols.random()
                    val bubble = PoppingBubble(symbol = randomSymbol, offset = offset)
                    bubbles.add(bubble)

                    // Check top-right triple tap for parent unlock
                    val now = System.currentTimeMillis()
                    if (offset.x > size.width - 240 && offset.y < 240) {
                        if (now - lastTapTime < 600) {
                            unlockTapCount++
                            if (unlockTapCount >= 3) {
                                unlockTapCount = 0
                                onTripleTapUnlock()
                            }
                        } else {
                            unlockTapCount = 1
                        }
                        lastTapTime = now
                    }
                }
            }
    ) {
        // Cheerful Popping Bubbles Canvas
        for (bubble in bubbles) {
            key(bubble.id) {
                LaunchedEffect(bubble.id) {
                    delay(800)
                    bubbles.remove(bubble)
                }
                Box(
                    modifier = Modifier
                        .offset(x = (bubble.offset.x / 2.5f).dp, y = (bubble.offset.y / 2.5f).dp)
                ) {
                    Text(
                        text = bubble.symbol,
                        fontSize = 42.sp
                    )
                }
            }
        }

        // Lock Banner at top
        Box(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 48.dp)
                .background(Color(0xCC000000), shape = RoundedCornerShape(20.dp))
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "🔒 Toddler Safe Lock",
                    color = Color(0xFFFFB74D),
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Text(
                    text = "Tap anywhere for bubbles • Parents: 3 taps top-right or Watch to unlock",
                    color = Color.LightGray,
                    fontSize = 11.sp
                )
            }
        }
    }
}
