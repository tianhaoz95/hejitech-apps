package com.hejitech.fitloop.wear

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.health.services.client.HealthServices
import androidx.health.services.client.MeasureCallback
import androidx.health.services.client.data.Availability
import androidx.health.services.client.data.DataPointContainer
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.DeltaDataType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import com.hejitech.fitloop.core.WatchWorkout
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val Orange = Color(0xFFFF7A45)

/**
 * FitLoop on a Wear OS watch: while the phone has a workout open it shows the exercise, the set,
 * the rest timer and heart rate (sent to the phone, which relays it to the glasses and the agent),
 * and Set done marks the set from the wrist. The Android side of the iPhone app's watch app.
 */
class MainActivity : ComponentActivity() {
    private lateinit var phone: PhoneLink
    private var heartRate by mutableStateOf<Int?>(null)
    private var lastSent = 0L
    private var measuring = false

    private val measure by lazy { HealthServices.getClient(this).measureClient }
    private val callback = object : MeasureCallback {
        override fun onAvailabilityChanged(dataType: DeltaDataType<*, *>, availability: Availability) {}
        override fun onDataReceived(data: DataPointContainer) {
            val bpm = data.getData(DataType.HEART_RATE_BPM).lastOrNull()?.value?.toInt() ?: return
            if (bpm <= 0) return
            heartRate = bpm
            val now = System.currentTimeMillis()
            if (now - lastSent >= 4_000) {
                lastSent = now
                lifecycleScope.launch { phone.heartRate(bpm) }
            }
        }
    }

    private val heartPermission = if (Build.VERSION.SDK_INT >= 36) "android.permission.health.READ_HEART_RATE" else Manifest.permission.BODY_SENSORS
    private val askHeart = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> if (granted) syncMeasuring() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        phone = PhoneLink(this)
        setContent {
            val workout by WatchState.workout.collectAsStateWithLifecycle()
            LaunchedEffect(workout.open) { syncMeasuring() }
            WatchScreen(workout, heartRate) { lifecycleScope.launch { phone.setDone() }; buzz(40) }
        }
        lifecycleScope.launch {
            // Buzz when a rest ends, like the iPhone app's watch.
            var restWas = 0L
            WatchState.workout.collect { w ->
                if (w.restUntil > System.currentTimeMillis() && w.restUntil != restWas) {
                    restWas = w.restUntil
                    launch {
                        delay(w.restUntil - System.currentTimeMillis())
                        if (WatchState.workout.value.restUntil == restWas) buzz(250)
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        lifecycleScope.launch { phone.hello() }
        syncMeasuring()
    }

    override fun onPause() {
        super.onPause()
        stopMeasuring()
    }

    /** Heart rate only while a workout is open and the app is in front. */
    private fun syncMeasuring() {
        val open = WatchState.workout.value.open
        if (open) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (!open) return stopMeasuring()
        if (measuring) return
        if (ContextCompat.checkSelfPermission(this, heartPermission) != PackageManager.PERMISSION_GRANTED) return askHeart.launch(heartPermission)
        runCatching { measure.registerMeasureCallback(DataType.HEART_RATE_BPM, callback) }.onSuccess { measuring = true }
    }

    private fun stopMeasuring() {
        if (!measuring) return
        measuring = false
        heartRate = null
        runCatching { measure.unregisterMeasureCallbackAsync(DataType.HEART_RATE_BPM, callback) }
    }

    private fun buzz(ms: Long) {
        runCatching { getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)) }
    }
}

@Composable
fun WatchScreen(w: WatchWorkout, heartRate: Int?, onSetDone: () -> Unit) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { now = System.currentTimeMillis(); delay(500) } }
    MaterialTheme {
        Column(
            Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 22.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            if (!w.open) {
                Text("FitLoop", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(6.dp))
                Text("Open a workout in FitLoop on your phone; it shows up here with your heart rate.", fontSize = 13.sp, textAlign = TextAlign.Center, color = Color.LightGray)
                return@Column
            }
            Text(w.title, fontSize = 11.sp, color = Color.LightGray, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(w.exercise, fontSize = 16.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(w.setLine, fontSize = 12.sp, textAlign = TextAlign.Center, maxLines = 2)
            val left = ((w.restUntil - now) / 1000).toInt()
            if (left > 0) Text("Rest %d:%02d".format(left / 60, left % 60), fontSize = 22.sp, color = Orange, fontWeight = FontWeight.SemiBold)
            Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(heartRate?.let { "♥ $it" } ?: "♥ –", color = Color(0xFFFF5A5A), fontSize = 14.sp)
                Text("${w.setsDone}/${w.setsTotal}", fontSize = 12.sp, color = Color.LightGray)
            }
            Chip(
                onClick = onSetDone, colors = ChipDefaults.primaryChipColors(backgroundColor = Orange, contentColor = Color.Black),
                label = { Text("Set done", fontWeight = FontWeight.SemiBold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
