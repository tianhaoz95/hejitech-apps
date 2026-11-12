package com.hejitech.tinytouch.kit.games

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.background
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.text.TextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.tinytouch.kit.Haptics
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun ParentShieldButton(
    holdDurationSeconds: Double = 3.0,
    onUnlocked: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var isPressing by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }
    var showHint by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    var timerJob by remember { mutableStateOf<Job?>(null) }

    Box(
        modifier = modifier
            .size(44.dp)
            .pointerInput(holdDurationSeconds) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    down.consume()
                    isPressing = true
                    progress = 0f
                    timerJob?.cancel()
                    timerJob = scope.launch {
                        val tick = 50L
                        val totalMs = (holdDurationSeconds * 1000).toLong()
                        var elapsed = 0L
                        var lastHaptic = 0L

                        while (elapsed < totalMs) {
                            delay(tick)
                            elapsed += tick
                            progress = (elapsed.toFloat() / totalMs).coerceIn(0f, 1f)

                            if (elapsed - lastHaptic >= 500L) {
                                Haptics.progressTick()
                                lastHaptic = elapsed
                            }
                        }
                        // Completed!
                        isPressing = false
                        progress = 0f
                        onUnlocked()
                    }

                    // Wait for release
                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) {
                            change.consume()
                            timerJob?.cancel()
                            if (isPressing && progress > 0.1f) {
                                showHint = true
                                scope.launch {
                                    delay(1500)
                                    showHint = false
                                }
                            }
                            isPressing = false
                            progress = 0f
                            break
                        }
                    }
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(34.dp)) {
            val r = size.minDimension / 2
            val center = Offset(size.width / 2, size.height / 2)

            // Base subtle track
            drawCircle(
                color = Color.White.copy(alpha = 0.15f),
                radius = r - 2f,
                style = Stroke(width = 3.dp.toPx())
            )

            // Charging progress ring
            if (progress > 0f) {
                drawArc(
                    brush = Brush.sweepGradient(
                        listOf(Color(0xFFFFD940), Color(0xFFFF9900), Color(0xFFFF4080), Color(0xFFFFD940))
                    ),
                    startAngle = -90f,
                    sweepAngle = progress * 360f,
                    useCenter = false,
                    style = Stroke(width = 3.5.dp.toPx())
                )
            }
        }

        BasicText(
            text = if (isPressing) "🔒" else "🔓",
            style = TextStyle(fontSize = 14.sp)
        )

        AnimatedVisibility(
            visible = showHint,
            enter = fadeIn() + scaleIn(),
            exit = fadeOut() + scaleOut(),
            modifier = Modifier.offset(y = 30.dp)
        ) {
            Box(
                modifier = Modifier
                    .background(Color.Black.copy(alpha = 0.85f), shape = RoundedCornerShape(8.dp))
                    .padding(horizontal = 4.dp, vertical = 2.dp)
            ) {
                BasicText(
                    text = "Hold ${holdDurationSeconds.toInt()}s",
                    style = TextStyle(
                        color = Color.Yellow,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    ),
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                )
            }
        }
    }
}
