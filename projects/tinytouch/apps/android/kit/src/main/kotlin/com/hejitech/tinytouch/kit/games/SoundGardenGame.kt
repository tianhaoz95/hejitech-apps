package com.hejitech.tinytouch.kit.games

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import com.hejitech.tinytouch.kit.Haptics
import com.hejitech.tinytouch.kit.SoundEngine

private data class Bar(val id: Int, val name: String, val color: Color)

private val BARS = listOf(
    Bar(0, "Do", Color(0xFFFF5959)),
    Bar(1, "Re", Color(0xFFFFA640)),
    Bar(2, "Mi", Color(0xFFFFE640)),
    Bar(3, "Sol", Color(0xFF59D973)),
    Bar(4, "La", Color(0xFF4DB3FF)),
    Bar(5, "Do", Color(0xFFBF73F2)),
)

@Composable
fun SoundGardenGame(env: PlayEnv, modifier: Modifier = Modifier) {
    var activeBarIndex by remember { mutableStateOf<Int?>(null) }
    var lastCrownIndex by remember { mutableIntStateOf(-1) }

    fun triggerBar(idx: Int) {
        if (idx in BARS.indices) {
            env.onTouch()
            activeBarIndex = idx
            Haptics.tap()
            SoundEngine.chime(idx)
        }
    }

    CrownEffect(env.crown) { delta ->
        val next = (lastCrownIndex + (if (delta > 0) 1 else -1)).coerceIn(0, BARS.size - 1)
        if (next != lastCrownIndex) {
            lastCrownIndex = next
            triggerBar(next)
        }
    }

    Ticker(ms = 250) {
        if (activeBarIndex != null) {
            activeBarIndex = null
        }
    }

    Canvas(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .captureTouches(
                onDown = { pos ->
                    val barWidth = 300f / BARS.size
                    val idx = (pos.x / barWidth).toInt().coerceIn(0, BARS.size - 1)
                    triggerBar(idx)
                },
                onMove = { pos ->
                    val barWidth = 300f / BARS.size
                    val idx = (pos.x / barWidth).toInt().coerceIn(0, BARS.size - 1)
                    if (activeBarIndex != idx) {
                        triggerBar(idx)
                    }
                },
                onUp = {
                    activeBarIndex = null
                }
            )
    ) {
        val w = size.width
        val h = size.height
        val totalBars = BARS.size
        val barWidth = (w - (totalBars + 1) * 8f) / totalBars

        drawRect(Color.Black)

        BARS.forEachIndexed { idx, bar ->
            val isActive = activeBarIndex == idx
            val usableHeight = h - 60f
            val step = usableHeight * 0.05f
            val barH = usableHeight - idx * step

            val x = 8f + idx * (barWidth + 8f)
            val y = h - barH - 16f

            val brush = Brush.verticalGradient(
                colors = listOf(
                    bar.color.copy(alpha = if (isActive) 1.0f else 0.65f),
                    bar.color.copy(alpha = if (isActive) 0.85f else 0.35f)
                ),
                startY = y,
                endY = y + barH
            )

            drawRoundRect(
                brush = brush,
                topLeft = Offset(x, y),
                size = Size(barWidth, barH),
                cornerRadius = CornerRadius(16f, 16f)
            )

            drawRoundRect(
                color = Color.White.copy(alpha = if (isActive) 0.9f else 0.25f),
                topLeft = Offset(x, y),
                size = Size(barWidth, barH),
                cornerRadius = CornerRadius(16f, 16f),
                style = Stroke(width = if (isActive) 4f else 2f)
            )
        }
    }
}
