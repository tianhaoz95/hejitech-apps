package com.hejitech.tinytouch.kit.games

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.text.TextStyle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.tinytouch.kit.Haptics
import com.hejitech.tinytouch.kit.SoundEngine
import kotlinx.coroutines.launch

private data class Star(
    val x: Float,
    val y: Float,
    val size: Float,
    var opacity: Float,
)

@Composable
fun SleepyMoonGame(env: PlayEnv, modifier: Modifier = Modifier) {
    val stars = remember { mutableStateListOf<Star>() }
    val moonScale = remember { Animatable(1f) }
    val scope = rememberCoroutineScope()

    DisposableEffect(Unit) {
        SoundEngine.startLullaby()
        onDispose {
            SoundEngine.stopLullaby()
        }
    }

    Ticker(ms = 100) {
        stars.forEach {
            it.opacity = rnd(0.2f, 0.95f)
        }
    }

    fun sootheMoon() {
        env.onTouch()
        Haptics.gentlePulse()
        SoundEngine.boing()
        if (env.voiceEnabled) {
            SoundEngine.speak("Goodnight, sweet dreams.")
        }
        scope.launch {
            moonScale.animateTo(1.18f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
            moonScale.animateTo(1.0f, spring(dampingRatio = Spring.DampingRatioMediumBouncy))
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF0D0D2E), Color(0xFF050514))
                )
            )
            .captureTouches(
                onDown = { sootheMoon() }
            ),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            if (stars.isEmpty()) {
                repeat(16) {
                    stars.add(Star(rnd(10f, size.width - 10f), rnd(10f, size.height - 10f), rnd(4f, 9f), rnd(0.3f, 0.9f)))
                }
            }
            stars.forEach { star ->
                drawPath(
                    starPath(Offset(star.x, star.y), star.size / 2, points = 4, smoothness = 0.35f),
                    Color.White.copy(alpha = star.opacity)
                )
            }
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(top = env.topInset)
        ) {
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .scale(moonScale.value)
                    .clip(CircleShape)
                    .clickable { sootheMoon() },
                contentAlignment = Alignment.Center
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    drawPath(
                        crescentPath(Offset(10f, 10f), size = size.width - 20f, progress = 0.58f),
                        Brush.linearGradient(
                            listOf(Color(0xFFFFF280), Color(0xFFFFD94D))
                        )
                    )
                }
                BasicText("😴", style = TextStyle(fontSize = 42.sp))
            }

            Spacer(modifier = Modifier.height(14.dp))

            BasicText(
                text = "Time to rest ✨",
                style = TextStyle(
                    color = Color(0xFFE6E6FF),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            )

            Spacer(modifier = Modifier.height(4.dp))

            BasicText(
                text = "Goodnight little star",
                style = TextStyle(
                    color = Color.Gray,
                    fontSize = 11.sp
                )
            )
        }
    }
}
