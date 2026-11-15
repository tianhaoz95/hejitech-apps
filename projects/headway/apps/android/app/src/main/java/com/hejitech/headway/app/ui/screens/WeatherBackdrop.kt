package com.hejitech.headway.app.ui.screens

import android.provider.Settings
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hejitech.headway.app.ui.theme.StatusGrey
import com.hejitech.headway.core.model.*
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

// The weather on the Trains tab, as on iPhone: a small "from → to" chip in the board's header, and an
// animated backdrop behind the whole board in the ride's weather (core's `rideTheme`).

private val RainBlue = Color(0xFF2F80ED)
private val SunYellow = Color(0xFFF5B400)
private val NightIndigo = Color(0xFF5C6BC0)

/** The condition's icon and a color that reads on light and dark backgrounds. */
fun WeatherHour.icon(): Pair<ImageVector, Color> = when (cond) {
    WeatherCondition.CLEAR, WeatherCondition.MOSTLY_CLEAR -> if (day) Icons.Default.WbSunny to SunYellow else Icons.Default.NightsStay to NightIndigo
    WeatherCondition.PARTLY_CLOUDY -> Icons.Default.FilterDrama to StatusGrey
    WeatherCondition.CLOUDY -> Icons.Default.Cloud to StatusGrey
    WeatherCondition.FOG, WeatherCondition.HAZE, WeatherCondition.SMOKE -> Icons.Default.BlurOn to StatusGrey
    WeatherCondition.DRIZZLE -> Icons.Default.Grain to RainBlue
    WeatherCondition.RAIN, WeatherCondition.SHOWERS -> Icons.Default.Umbrella to RainBlue
    WeatherCondition.THUNDER -> Icons.Default.Thunderstorm to RainBlue
    WeatherCondition.SNOW -> Icons.Default.AcUnit to RainBlue
    WeatherCondition.WIND -> Icons.Default.Air to StatusGrey
}

/** In the board's header: the departure station's weather now → the destination's when the next train arrives. */
@Composable
fun BoardWeatherChip(board: Board, weather: BoardWeather) {
    val label = buildString {
        append("Weather. ")
        weather.from?.let { append("${board.from.name} now: ${it.tempF} degrees, ${it.words}. ") }
        weather.to?.let {
            append(board.to.name)
            weather.toAt?.let { at -> append(" at ${Clock.time(at)}") }
            append(": ${it.tempF} degrees, ${it.words}")
            if (it.cond.isWet) append(", ${it.pop} percent chance of rain")
        }
    }
    Row(
        modifier = Modifier
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.75f), RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 3.dp)
            .semantics(mergeDescendants = true) { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        ChipEnd(weather.from)
        Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = StatusGrey, modifier = Modifier.size(11.dp))
        ChipEnd(weather.to)
    }
}

@Composable
private fun ChipEnd(h: WeatherHour?) {
    if (h == null) {
        Text("–", style = MaterialTheme.typography.labelMedium, color = StatusGrey)
        return
    }
    val (icon, tint) = h.icon()
    Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(15.dp))
    Text("${h.tempF}°", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, maxLines = 1)
}

// ---------------------------------------------------------------- animated backdrop

/**
 * The board's backdrop: a sky in the ride's weather, gently moving (still when the system's animations
 * are off). Pastel in light mode and deep in dark mode, so the board's text keeps its contrast.
 */
@Composable
fun WeatherBackdrop(theme: WeatherTheme, modifier: Modifier = Modifier) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val still = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    var t by remember { mutableDoubleStateOf(12.0) }
    if (!still) {
        LaunchedEffect(theme) {
            val start = withFrameNanos { it }
            while (true) {
                withFrameNanos { now -> t = 12.0 + (now - start) / 1e9 }
            }
        }
    }
    Canvas(modifier.fillMaxSize()) { WeatherPainter(theme, dark, t, this).paint() }
}

private class Seeded(seed: Long) {
    private var state = seed * -7046029254386353131L
    fun next(): Double {
        state = state * 6364136223846793005L + 1442695040888963407L
        return ((state ushr 33) and 0xFFFFFF).toDouble() / 0xFFFFFF.toDouble()
    }
}

private class WeatherPainter(val theme: WeatherTheme, val dark: Boolean, val t: Double, val d: DrawScope) {
    val w = d.size.width.toDouble()
    val h = d.size.height.toDouble()
    private val density = d.density.toDouble()

    fun paint() {
        sky()
        when (theme) {
            WeatherTheme.CLEAR_DAY -> sun(strong = true)
            WeatherTheme.CLEAR_NIGHT -> { stars(70); moon() }
            WeatherTheme.PARTLY_DAY -> { sun(strong = false); clouds(4, 0.75, high = true) }
            WeatherTheme.PARTLY_NIGHT -> { stars(40); moon(); clouds(3, 0.5, high = true) }
            WeatherTheme.CLOUDY -> clouds(7, 0.8, high = false)
            WeatherTheme.FOG -> mist()
            WeatherTheme.RAIN -> { clouds(5, 0.7, high = true); rain(110, 1.0) }
            WeatherTheme.STORM -> { clouds(6, 0.85, high = true); rain(160, 1.35); lightning() }
            WeatherTheme.SNOW -> { clouds(4, 0.6, high = true); snow(80) }
        }
    }

    private fun dp(v: Double) = (v * density).toFloat()

    private fun skyColors(): List<Color> = when (theme) {
        WeatherTheme.CLEAR_DAY -> if (dark) listOf(Color(0xFF0E3A66), Color(0xFF16304D), Color(0xFF0B0F17)) else listOf(Color(0xFF8EC9F5), Color(0xFFD7EEFC), Color(0xFFF4F8FB))
        WeatherTheme.PARTLY_DAY -> if (dark) listOf(Color(0xFF1A3654), Color(0xFF16263A), Color(0xFF0B0F17)) else listOf(Color(0xFFA6CDEB), Color(0xFFDCEBF6), Color(0xFFF2F5F8))
        WeatherTheme.CLEAR_NIGHT, WeatherTheme.PARTLY_NIGHT -> if (dark) listOf(Color(0xFF0B1030), Color(0xFF0A0F24), Color(0xFF05070F)) else listOf(Color(0xFFB9B6E3), Color(0xFFDCDBF0), Color(0xFFF2F2F7))
        WeatherTheme.CLOUDY -> if (dark) listOf(Color(0xFF2A3038), Color(0xFF1A1E24), Color(0xFF0C0D10)) else listOf(Color(0xFFA9B4C1), Color(0xFFD3DAE2), Color(0xFFF0F2F5))
        WeatherTheme.FOG -> if (dark) listOf(Color(0xFF30343A), Color(0xFF22252A), Color(0xFF0F1012)) else listOf(Color(0xFFD5D8DC), Color(0xFFE6E8EA), Color(0xFFF2F2F3))
        WeatherTheme.RAIN -> if (dark) listOf(Color(0xFF1E2B3B), Color(0xFF141C27), Color(0xFF090C11)) else listOf(Color(0xFF9FAFC2), Color(0xFFCDD6E0), Color(0xFFEEF1F5))
        WeatherTheme.STORM -> if (dark) listOf(Color(0xFF161B26), Color(0xFF10141C), Color(0xFF07080B)) else listOf(Color(0xFF7F8A9C), Color(0xFFB9C0CB), Color(0xFFE9EBEF))
        WeatherTheme.SNOW -> if (dark) listOf(Color(0xFF22324A), Color(0xFF18222F), Color(0xFF0B0F15)) else listOf(Color(0xFFC9D9EA), Color(0xFFE6EEF6), Color(0xFFF6F8FB))
    }

    private fun sky() {
        d.drawRect(Brush.verticalGradient(skyColors(), startY = 0f, endY = (h * 0.75).toFloat()))
    }

    private fun sun(strong: Boolean) {
        // Peeking in from the top-left corner: the toolbar's buttons sit top-right.
        val c = Offset((w * 0.04).toFloat(), (h * 0.015).toFloat())
        val glow = dp(if (strong) 230.0 else 170.0) * (1 + 0.04 * sin(t * 0.8)).toFloat()
        val warm = if (dark) Color(1f, 0.75f, 0.35f) else Color(1f, 0.85f, 0.4f)
        d.drawCircle(Brush.radialGradient(listOf(warm.copy(alpha = if (dark) 0.35f else 0.55f), warm.copy(alpha = 0f)), center = c, radius = glow), radius = glow, center = c)
        d.translate(c.x, c.y) {
            rotate(degrees = (t * 0.05 * 180 / PI).toFloat(), pivot = Offset.Zero) {
                for (i in 0 until 12) {
                    val a = i / 12.0 * 2 * PI
                    val inner = dp(40.0).toDouble()
                    val p = Path().apply {
                        moveTo((cos(a - 0.05) * inner).toFloat(), (sin(a - 0.05) * inner).toFloat())
                        lineTo((cos(a) * glow * 1.6).toFloat(), (sin(a) * glow * 1.6).toFloat())
                        lineTo((cos(a + 0.05) * inner).toFloat(), (sin(a + 0.05) * inner).toFloat())
                        close()
                    }
                    drawPath(p, warm.copy(alpha = if (dark) 0.06f else 0.12f))
                }
            }
        }
        d.drawCircle(warm.copy(alpha = if (dark) 0.8f else 0.95f), radius = dp(44.0), center = c)
    }

    private fun moon() {
        val c = Offset((w * 0.07).toFloat(), (h * 0.035).toFloat())
        val r = dp(22.0)
        val tone = if (dark) Color(0.92f, 0.92f, 0.92f) else Color(0.55f, 0.55f, 0.75f)
        d.drawCircle(Brush.radialGradient(listOf(tone.copy(alpha = 0.18f), tone.copy(alpha = 0f)), center = c, radius = r * 3), radius = r * 3, center = c)
        val disc = Path().apply { addOval(androidx.compose.ui.geometry.Rect(c, r)) }
        val bite = Path().apply { addOval(androidx.compose.ui.geometry.Rect(Offset(c.x + r * 0.55f, c.y - r * 0.25f), r)) }
        val crescent = Path().apply { op(disc, bite, androidx.compose.ui.graphics.PathOperation.Difference) }
        d.drawPath(crescent, tone.copy(alpha = 0.9f))
    }

    private fun stars(count: Int) {
        val rng = Seeded(7)
        val tone = if (dark) Color.White else Color(0.35f, 0.35f, 0.6f)
        repeat(count) {
            val x = rng.next() * w
            val y = rng.next() * h * 0.55
            val phase = rng.next() * 6.28
            val r = dp(0.6 + rng.next() * 1.4)
            val rate = 0.8 + rng.next() * 1.5
            val a = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * rate + phase))
            d.drawCircle(tone.copy(alpha = (a * if (dark) 0.9 else 0.6).toFloat()), radius = r, center = Offset(x.toFloat(), y.toFloat()))
        }
    }

    private fun clouds(count: Int, alpha: Double, high: Boolean) {
        val rng = Seeded(11)
        val tone = when (theme) {
            WeatherTheme.STORM -> if (dark) Color(0xFF383838) else Color(0xFF8C8C8C)
            WeatherTheme.RAIN -> if (dark) Color(0xFF474747) else Color(0xFFB3B3B3)
            else -> if (dark) Color(0xFF525252) else Color.White
        }
        for (i in 0 until count) {
            val cw = w * (0.45 + rng.next() * 0.45)
            val ch = cw * (0.28 + rng.next() * 0.12)
            val speed = dp(6 + rng.next() * 10)
            val span = w + cw * 2
            val x = ((rng.next() * span + t * speed) % span) - cw
            val band = if (high) 0.32 else 0.7
            val y = h * (rng.next() * band) - ch * 0.3 + (i % 2) * dp(20.0)
            val a = (alpha * (0.6 + rng.next() * 0.4)).toFloat()
            // Soft edges without a blur filter: three passes, each a little larger and fainter.
            for ((grow, fade) in listOf(1.12 to 0.25f, 1.05 to 0.45f, 1.0 to 1f)) {
                cloud(x - cw * (grow - 1) / 2, y - ch * (grow - 1) / 2, cw * grow, ch * grow, tone.copy(alpha = a * fade * 0.7f))
            }
        }
    }

    private fun cloud(x: Double, y: Double, cw: Double, ch: Double, color: Color) {
        d.drawOval(color, Offset(x.toFloat(), (y + ch * 0.35).toFloat()), Size(cw.toFloat(), (ch * 0.65).toFloat()))
        d.drawOval(color, Offset((x + cw * 0.15).toFloat(), (y + ch * 0.05).toFloat()), Size((cw * 0.4).toFloat(), (ch * 0.75).toFloat()))
        d.drawOval(color, Offset((x + cw * 0.42).toFloat(), y.toFloat()), Size((cw * 0.42).toFloat(), (ch * 0.8).toFloat()))
    }

    private fun mist() {
        val rng = Seeded(23)
        val tone = if (dark) Color(0xFF737373) else Color.White
        for (i in 0 until 9) {
            val bh = dp(60 + rng.next() * 90).toDouble()
            val y = i / 9.0 * h * 0.95 + rng.next() * dp(30.0)
            val bw = w * (1.1 + rng.next() * 0.8)
            val speed = dp(4 + rng.next() * 8) * (if (i % 2 == 0) 1 else -1)
            val span = w + bw
            var x = (t * speed + rng.next() * span) % span
            if (x < 0) x += span
            x -= bw
            val a = ((if (dark) 0.16 else 0.5) + 0.1 * sin(t * 0.3 + i)).toFloat()
            for ((grow, fade) in listOf(1.3 to 0.3f, 1.0 to 0.7f)) {
                val gh = bh * grow
                d.drawRoundRect(tone.copy(alpha = a * fade), Offset(x.toFloat(), (y - (gh - bh) / 2).toFloat()), Size(bw.toFloat(), gh.toFloat()), CornerRadius((gh / 2).toFloat()))
            }
        }
    }

    private fun rain(count: Int, speed: Double) {
        val rng = Seeded(31)
        val tone = if (dark) Color(0.6f, 0.72f, 0.9f) else Color(0.3f, 0.42f, 0.62f)
        val slant = 0.18
        repeat(count) {
            val len = dp(14 + rng.next() * 16).toDouble()
            val v = dp(520 + rng.next() * 260) * speed
            val x0 = rng.next() * (w + dp(80.0))
            val span = h + len
            val y = ((rng.next() * span + t * v) % span) - len
            val x = x0 - y * slant
            val a = ((if (dark) 0.55 else 0.4) * (0.5 + rng.next() * 0.5)).toFloat()
            d.drawLine(tone.copy(alpha = a), Offset(x.toFloat(), y.toFloat()), Offset((x - len * slant).toFloat(), (y + len).toFloat()), strokeWidth = dp(if (dark) 1.4 else 1.2), cap = StrokeCap.Round)
        }
    }

    private fun lightning() {
        // A flash every ~7 s: two quick pulses.
        val cycle = t % 7.3
        val flash = max(0.0, 1 - abs(cycle - 0.1) / 0.08) + 0.6 * max(0.0, 1 - abs(cycle - 0.32) / 0.07)
        if (flash > 0) d.drawRect(Color.White.copy(alpha = (flash * if (dark) 0.22 else 0.35).toFloat().coerceAtMost(1f)))
    }

    private fun snow(count: Int) {
        val rng = Seeded(41)
        val tone = if (dark) Color.White else Color(0.6f, 0.7f, 0.82f)
        repeat(count) {
            val r = dp(1.5 + rng.next() * 2.5)
            val v = dp(25 + rng.next() * 40)
            val span = h + dp(10.0)
            val y = ((rng.next() * span + t * v) % span) - dp(5.0)
            val sway = 0.5 + rng.next()
            val phase = rng.next() * 6
            val x = rng.next() * w + sin(t * sway + phase) * dp(14.0)
            d.drawCircle(tone.copy(alpha = 0.75f), radius = r, center = Offset(x.toFloat(), y.toFloat()))
        }
    }
}
