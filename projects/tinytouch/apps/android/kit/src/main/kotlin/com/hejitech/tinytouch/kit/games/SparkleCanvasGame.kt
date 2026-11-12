package com.hejitech.tinytouch.kit.games

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import com.hejitech.tinytouch.kit.Haptics
import com.hejitech.tinytouch.kit.SoundEngine
import kotlin.math.cos
import kotlin.math.sin

private data class Sparkle(
    val id: Long,
    var x: Float,
    var y: Float,
    val vx: Float,
    val vy: Float,
    val color: Color,
    var size: Float,
    var opacity: Float = 1.0f,
    var rotation: Float = 0f,
)

private val RAINBOW = listOf(
    Color.Red, Color(0xFFFF9900), Color.Yellow, Color.Green,
    Color.Cyan, Color.Blue, Color(0xFFBF00FF), Color(0xFFFF007F)
)

@Composable
fun SparkleCanvasGame(env: PlayEnv, modifier: Modifier = Modifier) {
    val ids = remember { Ids() }
    val particles = remember { mutableStateListOf<Sparkle>() }

    fun addSparkles(at: Offset) {
        env.onTouch()
        repeat(3) {
            val color = RAINBOW.random()
            val vx = rnd(-2.5f, 2.5f)
            val vy = rnd(-2.5f, 2.5f)
            particles.add(
                Sparkle(
                    id = ids.next(),
                    x = at.x + rnd(-8f, 8f),
                    y = at.y + rnd(-8f, 8f),
                    vx = vx,
                    vy = vy,
                    color = color,
                    size = rnd(12f, 24f),
                    rotation = rnd(0f, 360f)
                )
            )
        }
        Haptics.tap()
        SoundEngine.sparkle()
    }

    CrownEffect(env.crown) { delta ->
        Haptics.crownTick()
        // Spawn vortex particle
        val angle = rnd(0f, 360f)
        val r = rnd(20f, 70f)
        val rad = Math.toRadians(angle.toDouble()).toFloat()
        // Center around (200, 200) fallback
        val center = Offset(200f, 200f)
        particles.add(
            Sparkle(
                id = ids.next(),
                x = center.x + cos(rad) * r,
                y = center.y + sin(rad) * r,
                vx = -sin(rad) * 1.5f,
                vy = cos(rad) * 1.5f,
                color = RAINBOW.random(),
                size = rnd(12f, 24f),
                rotation = angle
            )
        )
    }

    Ticker(ms = 40) {
        val it = particles.iterator()
        while (it.hasNext()) {
            val p = it.next()
            p.x += p.vx
            p.y += p.vy
            p.opacity -= 0.04f
            p.rotation += 4f
            p.size -= 0.2f
            if (p.opacity <= 0f || p.size <= 0f) {
                it.remove()
            }
        }
        if (particles.size > 50) {
            repeat(particles.size - 50) {
                if (particles.isNotEmpty()) particles.removeAt(0)
            }
        }
    }

    Canvas(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .captureTouches(
                onDown = { addSparkles(it) },
                onMove = { addSparkles(it) }
            )
    ) {
        drawRect(Color.Black)

        for (p in particles) {
            val center = Offset(p.x, p.y)
            drawPath(
                starPath(center, p.size / 2, points = 4, smoothness = 0.3f),
                color = p.color.copy(alpha = p.opacity.coerceIn(0f, 1f))
            )
        }
    }
}
