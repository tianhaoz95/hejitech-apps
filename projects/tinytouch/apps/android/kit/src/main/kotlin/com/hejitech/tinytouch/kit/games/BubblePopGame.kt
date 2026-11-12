package com.hejitech.tinytouch.kit.games

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import com.hejitech.tinytouch.kit.Haptics
import com.hejitech.tinytouch.kit.SoundEngine
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin
import kotlin.random.Random

private val BUBBLE_COLORS = listOf(
    Color(0xFF4DD8F2), // Cyan
    Color(0xFFFF73A6), // Pink
    Color(0xFFFFD940), // Yellow
    Color(0xFF66E680), // Lime Green
    Color(0xFFBF80FF), // Lavender
    Color(0xFFFF9940), // Orange
)

private val SHAPES = listOf("star", "heart", "circle", "face")

private data class Bubble(
    val id: Long,
    var x: Float,
    var y: Float,
    val size: Float,
    val color: Color,
    val shape: String,
    val speed: Float,
    var wobble: Float = 0f,
)

private data class Burst(
    val id: Long,
    val x: Float,
    val y: Float,
    val color: Color,
    var scale: Float = 0.1f,
    var opacity: Float = 1.0f,
)

@Composable
fun BubblePopGame(env: PlayEnv, modifier: Modifier = Modifier) {
    val ids = remember { Ids() }
    val bubbles = remember { mutableStateListOf<Bubble>() }
    val bursts = remember { mutableStateListOf<Burst>() }
    var crownBubbleSize by remember { mutableFloatStateOf(0f) }

    val targetCount = if (env.lowStimulation) 4 else 7

    fun spawnBubble(w: Float, h: Float, randomY: Boolean = false) {
        val size = rnd(44f, 68f)
        val x = rnd(size / 2, w - size / 2)
        val y = if (randomY) rnd(40f, h - 40f) else h + size
        val color = BUBBLE_COLORS.random()
        val shape = SHAPES.random()
        val speed = if (env.lowStimulation) rnd(0.6f, 1.2f) else rnd(1.0f, 2.2f)
        bubbles.add(Bubble(ids.next(), x, y, size, color, shape, speed))
    }

    fun popGiantBubble(w: Float, h: Float) {
        crownBubbleSize = 0f
        Haptics.bounce()
        SoundEngine.sparkle()
        SoundEngine.pop()
        repeat(3) {
            bursts.add(Burst(ids.next(), w / 2, h / 2, BUBBLE_COLORS.random()))
        }
    }

    CrownEffect(env.crown) { delta ->
        crownBubbleSize = (crownBubbleSize + delta * 5f).coerceIn(0f, 160f)
        if (crownBubbleSize >= 155f) {
            // Giant pop! Handled on tick or tap with dimensions
        } else if (crownBubbleSize > 10f) {
            Haptics.crownTick()
        }
    }

    Ticker(ms = 50) {
        // Bubble movement
        val it = bubbles.iterator()
        while (it.hasNext()) {
            val b = it.next()
            b.y -= b.speed
            b.wobble = (sin(b.y * 0.05) * 6.0).toFloat()
            if (b.y < -b.size) {
                it.remove()
            }
        }
        // Burst updates
        val bIt = bursts.iterator()
        while (bIt.hasNext()) {
            val burst = bIt.next()
            burst.scale += 0.15f
            burst.opacity -= 0.12f
            if (burst.opacity <= 0f) {
                bIt.remove()
            }
        }
    }

    Canvas(
        modifier = modifier
            .fillMaxSize()
            .captureTouches(
                onDown = { pos ->
                    env.onTouch()
                    val idx = bubbles.indexOfFirst { b ->
                        hypot(b.x + b.wobble - pos.x, b.y - pos.y) <= (b.size * 0.6f)
                    }
                    if (idx != -1) {
                        val popped = bubbles.removeAt(idx)
                        Haptics.pop()
                        SoundEngine.pop()
                        bursts.add(Burst(ids.next(), popped.x + popped.wobble, popped.y, popped.color))
                        if (env.voiceEnabled && Random.nextBoolean()) {
                            SoundEngine.speak("Pop!")
                        }
                    } else {
                        Haptics.tap()
                        SoundEngine.boing()
                        val newBubble = Bubble(
                            ids.next(),
                            pos.x,
                            pos.y,
                            rnd(46f, 64f),
                            BUBBLE_COLORS.random(),
                            SHAPES.random(),
                            1.2f
                        )
                        bubbles.add(newBubble)
                    }
                }
            )
    ) {
        val w = size.width
        val h = size.height

        if (crownBubbleSize >= 155f) {
            popGiantBubble(w, h)
        }

        // Seed or maintain bubbles
        while (bubbles.size < targetCount) {
            spawnBubble(w, h, randomY = bubbles.isEmpty())
        }

        // Draw background OLED black
        drawRect(Color.Black)

        // Draw floating bubbles
        for (b in bubbles) {
            val center = Offset(b.x + b.wobble, b.y)
            drawBubble(center, b.size, b.color)

            // Shape inside
            val innerSize = b.size * 0.42f
            when (b.shape) {
                "star" -> {
                    drawPath(
                        starPath(center, innerSize / 2),
                        Color.White.copy(alpha = 0.85f)
                    )
                }
                "heart" -> {
                    drawPath(
                        heartPath(center - Offset(innerSize / 2, innerSize / 2), innerSize, innerSize),
                        Color.White.copy(alpha = 0.85f)
                    )
                }
                "face" -> {
                    drawCircle(Color.White.copy(alpha = 0.85f), radius = innerSize / 2, center = center)
                    val eyeRadius = innerSize * 0.08f
                    val eyeY = center.y - innerSize * 0.05f
                    drawCircle(Color.Black, radius = eyeRadius, center = Offset(center.x - innerSize * 0.15f, eyeY))
                    drawCircle(Color.Black, radius = eyeRadius, center = Offset(center.x + innerSize * 0.15f, eyeY))
                }
                else -> {
                    drawCircle(Color.White.copy(alpha = 0.85f), radius = innerSize * 0.4f, center = center)
                }
            }
        }

        // Giant crown bubble
        if (crownBubbleSize > 10f) {
            val center = Offset(w / 2, h / 2)
            drawBubble(center, crownBubbleSize, Color(0xFFFF9900))
            drawPath(
                starPath(center, crownBubbleSize * 0.2f),
                Color(0xFFFFD940)
            )
        }

        // Draw pop bursts
        for (burst in bursts) {
            val center = Offset(burst.x, burst.y)
            drawCircle(
                burst.color.copy(alpha = burst.opacity),
                radius = 25f * burst.scale,
                center = center,
                style = Stroke(width = 3f)
            )
            for (i in 0 until 6) {
                val angle = (i * PI / 3).toFloat()
                val dist = 28f * burst.scale
                val starCenter = center + Offset(cos(angle) * dist, sin(angle) * dist)
                drawPath(
                    starPath(starCenter, 4f),
                    burst.color.copy(alpha = burst.opacity)
                )
            }
        }
    }
}
