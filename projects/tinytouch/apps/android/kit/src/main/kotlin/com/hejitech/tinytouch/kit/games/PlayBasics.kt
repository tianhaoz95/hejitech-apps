package com.hejitech.tinytouch.kit.games

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.random.Random

/**
 * What a game needs from the app around it. On the watch [crown] carries rotary input (the
 * crown or bezel) in detents, positive clockwise; the phone preview has none.
 */
@Immutable
data class PlayEnv(
    val lowStimulation: Boolean = false,
    val voiceEnabled: Boolean = true,
    val onTouch: () -> Unit = {},
    val crown: Flow<Float>? = null,
    /** Round watch screens: layout games keep their content inside the circle. */
    val round: Boolean = false,
    /** Space kept free at the top for the Parent Shield and timer. */
    val topInset: Dp = 0.dp,
)

internal fun rnd(from: Float, until: Float) = from + Random.nextFloat() * (until - from)

internal class Ids {
    private var next = 0L
    fun next() = next++
}

/**
 * Takes every touch on the area (down, drags, release) and consumes it, so nothing under a game
 * (or the system's edge swipes inside the app) ever sees a toddler's finger.
 */
internal fun Modifier.captureTouches(
    onDown: (Offset) -> Unit = {},
    onMove: (Offset) -> Unit = {},
    onUp: (Offset) -> Unit = {},
): Modifier = pointerInput(Unit) {
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        down.consume()
        onDown(down.position)
        var last = down.position
        while (true) {
            val event = awaitPointerEvent()
            val change = event.changes.firstOrNull { it.id == down.id } ?: event.changes.firstOrNull() ?: break
            event.changes.forEach { it.consume() }
            if (!change.pressed) {
                onUp(change.position)
                break
            }
            if (change.position != last) {
                last = change.position
                onMove(change.position)
            }
        }
    }
}

/** Runs [onTick] every [ms] while composed (the watch views' `Timer.publish`). */
@Composable
internal fun Ticker(ms: Long, onTick: () -> Unit) {
    val tick by rememberUpdatedState(onTick)
    LaunchedEffect(ms) {
        while (true) {
            delay(ms)
            tick()
        }
    }
}

/** Calls [onDelta] for every rotary turn. */
@Composable
internal fun CrownEffect(crown: Flow<Float>?, onDelta: (Float) -> Unit) {
    val cb by rememberUpdatedState(onDelta)
    LaunchedEffect(crown) { crown?.collect { cb(it) } }
}

// region Shapes (ShapeViews.swift)

internal fun starPath(center: Offset, outer: Float, points: Int = 5, smoothness: Float = 0.45f): Path {
    val inner = outer * smoothness
    val total = points * 2
    val step = (2 * PI / total).toFloat()
    return Path().apply {
        for (i in 0 until total) {
            val r = if (i % 2 == 0) outer else inner
            val a = i * step - (PI / 2).toFloat()
            val x = center.x + cos(a) * r
            val y = center.y + sin(a) * r
            if (i == 0) moveTo(x, y) else lineTo(x, y)
        }
        close()
    }
}

internal fun heartPath(topLeft: Offset, w: Float, h: Float): Path = Path().apply {
    fun p(fx: Float, fy: Float) = Offset(topLeft.x + w * fx, topLeft.y + h * fy)
    val start = p(0.5f, 0.85f)
    moveTo(start.x, start.y)
    val c1 = p(0.2f, 0.7f); val c2 = p(0.05f, 0.55f); val e1 = p(0.05f, 0.35f)
    cubicTo(c1.x, c1.y, c2.x, c2.y, e1.x, e1.y)
    val r = w * 0.25f
    val left = p(0.3f, 0.3f)
    arcTo(Rect(left.x - r, left.y - r, left.x + r, left.y + r), 180f, 180f, false)
    val right = p(0.7f, 0.3f)
    arcTo(Rect(right.x - r, right.y - r, right.x + r, right.y + r), 180f, 180f, false)
    val c3 = p(0.95f, 0.55f); val c4 = p(0.8f, 0.7f)
    cubicTo(c3.x, c3.y, c4.x, c4.y, start.x, start.y)
    close()
}

internal fun crescentPath(topLeft: Offset, size: Float, progress: Float = 0.58f): Path = Path().apply {
    val r = size / 2
    val cx = topLeft.x + r
    val cy = topLeft.y + r
    arcTo(Rect(cx - r, cy - r, cx + r, cy + r), -90f, 180f, true)
    cubicTo(
        cx + r * (1 - progress), cy + r * 0.5f,
        cx + r * (1 - progress), cy - r * 0.5f,
        cx, cy - r,
    )
    close()
}

/** A shiny soap bubble (BubbleView). */
internal fun DrawScope.drawBubble(center: Offset, size: Float, color: Color) {
    val r = size / 2
    drawCircle(color.copy(alpha = 0.25f), radius = r * 1.08f, center = center + Offset(0f, size * 0.04f))
    drawCircle(
        Brush.radialGradient(
            0.2f to color.copy(alpha = 0.4f),
            0.6f to color.copy(alpha = 0.8f),
            1f to Color.White.copy(alpha = 0.9f),
            center = center, radius = r,
        ),
        radius = r, center = center,
    )
    val rim = max(1.5f, size * 0.05f)
    drawCircle(
        Brush.linearGradient(
            listOf(Color.White.copy(alpha = 0.9f), color.copy(alpha = 0.6f), Color.White.copy(alpha = 0.3f)),
            start = center - Offset(r, r), end = center + Offset(r, r),
        ),
        radius = r - rim / 2, center = center, style = Stroke(rim),
    )
    val glint = center + Offset(-size * 0.22f, -size * 0.22f)
    rotate(-35f, pivot = glint) {
        drawOval(
            Color.White.copy(alpha = 0.85f),
            topLeft = glint - Offset(size * 0.14f, size * 0.09f),
            size = Size(size * 0.28f, size * 0.18f),
        )
    }
    drawCircle(Color.White.copy(alpha = 0.6f), radius = size * 0.05f, center = center + Offset(size * 0.25f, size * 0.22f))
}

// endregion
