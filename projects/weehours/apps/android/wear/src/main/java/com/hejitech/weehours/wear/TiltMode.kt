package com.hejitech.weehours.wear

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import com.hejitech.weehours.core.TiltCompass
import com.hejitech.weehours.core.TiltLock
import kotlinx.coroutines.delay
import java.util.Date
import kotlin.math.atan2
import kotlin.math.sqrt

@Composable
fun TiltModeScreen(
    link: PhoneLink,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val slots by link.compassSlots.collectAsState()
    val tiltLock = remember {
        TiltLock(available = slots.keys)
    }

    var tiltX by remember { mutableDoubleStateOf(0.0) }
    var tiltY by remember { mutableDoubleStateOf(0.0) }
    var progress by remember { mutableDoubleStateOf(0.0) }
    var aimingDir by remember { mutableStateOf<TiltCompass.Direction?>(null) }
    var lockedDir by remember { mutableStateOf<TiltCompass.Direction?>(null) }
    var confirmCountdown by remember { mutableIntStateOf(4) }
    var committedLabel by remember { mutableStateOf<String?>(null) }

    // 10-sample auto-centering baseline calibration + 30 Hz sensor loop
    DisposableEffect(Unit) {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        val gravitySensor = sensorManager?.getDefaultSensor(Sensor.TYPE_GRAVITY)
            ?: sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        val gyroSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

        var sampleCount = 0
        var baseX = 0.0
        var baseY = 0.0
        var latestRotation = 0.0

        val listener = object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                when (event.sensor.type) {
                    Sensor.TYPE_GYROSCOPE -> {
                        val rx = event.values[0].toDouble()
                        val ry = event.values[1].toDouble()
                        val rz = event.values[2].toDouble()
                        latestRotation = sqrt(rx * rx + ry * ry + rz * rz)
                    }
                    Sensor.TYPE_GRAVITY, Sensor.TYPE_ACCELEROMETER -> {
                        val gx = event.values[0].toDouble()
                        val gy = event.values[1].toDouble()
                        val gz = event.values[2].toDouble().let { if (it == 0.0) 9.81 else it }

                        val rawDegX = Math.toDegrees(atan2(gx, absOrMin(gz)))
                        val rawDegY = Math.toDegrees(atan2(-gy, absOrMin(gz)))

                        if (sampleCount < 10) {
                            baseX += rawDegX / 10.0
                            baseY += rawDegY / 10.0
                            sampleCount += 1
                            return
                        }

                        val dx = (rawDegX - baseX).coerceIn(-35.0, 35.0)
                        val dy = (rawDegY - baseY).coerceIn(-35.0, 35.0)
                        tiltX = dx
                        tiltY = dy

                        if (lockedDir == null && committedLabel == null) {
                            val now = Date()
                            val prevDir = (tiltLock.phase as? TiltLock.Phase.Aiming)?.direction
                            val locked = tiltLock.update(x = dx, y = dy, rotation = latestRotation, at = now)
                            val curAim = (tiltLock.phase as? TiltLock.Phase.Aiming)?.direction
                            if (curAim != null && curAim != prevDir) {
                                watchHaptic(context, longArrayOf(0, 18))
                            }
                            aimingDir = curAim
                            progress = tiltLock.progress(now)
                            if (locked != null) {
                                lockedDir = locked
                                confirmCountdown = 4
                                watchHaptic(context, longArrayOf(0, 35, 45, 50))
                            }
                        }
                    }
                }
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        if (gravitySensor != null) {
            sensorManager?.registerListener(listener, gravitySensor, SensorManager.SENSOR_DELAY_GAME)
        }
        if (gyroSensor != null) {
            sensorManager?.registerListener(listener, gyroSensor, SensorManager.SENSOR_DELAY_GAME)
        }

        onDispose {
            sensorManager?.unregisterListener(listener)
        }
    }

    // 4-second confirmation countdown when locked
    LaunchedEffect(lockedDir) {
        val dir = lockedDir ?: return@LaunchedEffect
        val slot = slots[dir] ?: return@LaunchedEffect
        for (sec in 4 downTo 1) {
            confirmCountdown = sec
            delay(1_000L)
        }
        commitTiltSlot(link, slot)
        committedLabel = slot.label
        lockedDir = null
    }

    // 4-second Undo window after commit
    LaunchedEffect(committedLabel) {
        if (committedLabel == null) return@LaunchedEffect
        delay(4_000L)
        committedLabel = null
        tiltLock.reset()
        onClose()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0E0C0A)),
        contentAlignment = Alignment.Center
    ) {
        when {
            committedLabel != null -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Logged",
                        color = Color(0xFFE59838),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = committedLabel ?: "",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    )
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(18.dp))
                            .background(Color(0xFF332E2A))
                            .clickable {
                                link.sendAction(kind = "undo")
                                committedLabel = null
                                tiltLock.reset()
                            }
                            .padding(horizontal = 18.dp, vertical = 8.dp)
                    ) {
                        Text("Undo", color = Color(0xFFE59838), fontWeight = FontWeight.Bold)
                    }
                }
            }

            lockedDir != null -> {
                val slot = slots[lockedDir]
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = slot?.label ?: "Action",
                        color = Color.White,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Logging in ${confirmCountdown}s…",
                        color = Color(0xFFE59838),
                        fontSize = 13.sp
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFF332E2A))
                                .clickable {
                                    lockedDir = null
                                    tiltLock.reset()
                                }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Text("Cancel", color = Color.White, fontSize = 13.sp)
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color(0xFFE59838))
                                .clickable {
                                    if (slot != null) {
                                        commitTiltSlot(link, slot)
                                        committedLabel = slot.label
                                        lockedDir = null
                                    }
                                }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Text("Now", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }

            else -> {
                // Live 4-Way Compass Canvas + Directional Labels
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Canvas(modifier = Modifier.fillMaxSize().padding(18.dp)) {
                        val center = Offset(size.width / 2f, size.height / 2f)
                        val maxRadius = size.minDimension / 2f
                        val thresholdRadius = maxRadius * (18f / 32f)

                        // Outer compass ring
                        drawCircle(
                            color = Color(0xFF2B2623),
                            radius = maxRadius,
                            center = center,
                            style = Stroke(width = 3f)
                        )
                        // 18° threshold ring
                        drawCircle(
                            color = Color(0xFF4A423B),
                            radius = thresholdRadius,
                            center = center,
                            style = Stroke(width = 2f)
                        )

                        // Dwell progress arc when aiming
                        if (aimingDir != null && progress > 0.0) {
                            val startAngle = when (aimingDir) {
                                TiltCompass.Direction.NORTH -> -135f
                                TiltCompass.Direction.EAST -> -45f
                                TiltCompass.Direction.SOUTH -> 45f
                                TiltCompass.Direction.WEST -> 135f
                                null -> 0f
                            }
                            drawArc(
                                color = Color(0xFFE59838),
                                startAngle = startAngle,
                                sweepAngle = (90f * progress.toFloat()),
                                useCenter = false,
                                topLeft = Offset(center.x - maxRadius, center.y - maxRadius),
                                size = Size(maxRadius * 2f, maxRadius * 2f),
                                style = Stroke(width = 8f, cap = StrokeCap.Round)
                            )
                        }

                        // Gravity ball dot
                        val ballX = center.x + (tiltX.toFloat() / 32f) * maxRadius
                        val ballY = center.y - (tiltY.toFloat() / 32f) * maxRadius
                        drawCircle(
                            color = if (aimingDir != null) Color(0xFFE59838) else Color(0xFFF5ECE6),
                            radius = 12f,
                            center = Offset(ballX, ballY)
                        )
                    }

                    // North Label
                    Text(
                        text = slots[TiltCompass.Direction.NORTH]?.label ?: "Feed",
                        color = if (aimingDir == TiltCompass.Direction.NORTH) Color(0xFFE59838) else Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.TopCenter).padding(top = 6.dp)
                    )
                    // South Label
                    Text(
                        text = slots[TiltCompass.Direction.SOUTH]?.label ?: "Sleep",
                        color = if (aimingDir == TiltCompass.Direction.SOUTH) Color(0xFFE59838) else Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 6.dp)
                    )
                    // West Label
                    Text(
                        text = slots[TiltCompass.Direction.WEST]?.label ?: "Care",
                        color = if (aimingDir == TiltCompass.Direction.WEST) Color(0xFFE59838) else Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.CenterStart).padding(start = 6.dp)
                    )
                    // East Label
                    Text(
                        text = slots[TiltCompass.Direction.EAST]?.label ?: "Diaper",
                        color = if (aimingDir == TiltCompass.Direction.EAST) Color(0xFFE59838) else Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.CenterEnd).padding(end = 6.dp)
                    )

                    // Center Back Tap
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .clickable { onClose() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "×",
                            color = Color(0xFF9E948B),
                            fontSize = 18.sp
                        )
                    }
                }
            }
        }
    }
}

private fun commitTiltSlot(link: PhoneLink, slot: TiltCompass.Slot) {
    when (slot.action) {
        "feed" -> link.sendAction(kind = "tap", action = "feed.toggle")
        "diaper" -> link.sendAction(kind = "tap", action = "diaper.wet", needsDetails = true)
        "sleep" -> link.sendAction(kind = "tap", action = "sleep.toggle")
        else -> link.sendAction(kind = "care", action = slot.action, category = slot.action)
    }
}

private fun absOrMin(v: Double): Double = kotlin.math.abs(v).coerceAtLeast(0.5)

internal fun watchHaptic(context: Context, pattern: LongArray) {
    try {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        vibrator?.vibrate(VibrationEffect.createWaveform(pattern, -1))
    } catch (_: Exception) {
    }
}
