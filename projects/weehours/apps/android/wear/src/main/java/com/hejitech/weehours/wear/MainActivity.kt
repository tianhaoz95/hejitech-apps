package com.hejitech.weehours.wear

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import kotlinx.coroutines.delay
import java.util.Locale
import kotlin.math.max

class MainActivity : ComponentActivity() {
    private var initialMode by mutableStateOf("buttons") // "buttons" | "tilt" | "listen"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        val link = PhoneLink.getInstance(applicationContext)

        setContent {
            MaterialTheme {
                WearMainScreen(
                    link = link,
                    initialMode = initialMode,
                    onConsumeInitialMode = { initialMode = "buttons" }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val host = intent?.data?.host ?: return
        when (host) {
            "tilt" -> initialMode = "tilt"
            "listen", "voice" -> initialMode = "listen"
            else -> initialMode = "buttons"
        }
    }
}

@Composable
fun WearMainScreen(
    link: PhoneLink,
    initialMode: String,
    onConsumeInitialMode: () -> Unit
) {
    val context = LocalContext.current
    val household by link.household.collectAsState()
    val selectedBabyId by link.selectedBabyId.collectAsState()
    val statusLines by link.statusLines.collectAsState()
    val openSessions by link.openSessions.collectAsState()
    val pinnedCategories by link.pinnedCategories.collectAsState()
    val lastSummary by link.lastSummary.collectAsState()
    val pendingCount by link.pendingCount.collectAsState()

    var showTiltMode by remember { mutableStateOf(initialMode == "tilt") }
    var nowMs by remember { mutableLongStateOf(System.currentTimeMillis()) }

    val voiceLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { res ->
        if (res.resultCode == Activity.RESULT_OK) {
            val matches = res.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val text = matches?.firstOrNull()?.trim().orEmpty()
            if (text.isNotEmpty()) {
                watchHaptic(context, longArrayOf(0, 30, 40, 45))
                link.sendAction(kind = "voice", transcript = text)
            }
        }
    }

    fun launchSpeechRecognizer() {
        try {
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak log entry")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
            }
            voiceLauncher.launch(intent)
        } catch (_: Exception) {
        }
    }

    LaunchedEffect(initialMode) {
        if (initialMode == "tilt") {
            showTiltMode = true
            onConsumeInitialMode()
        } else if (initialMode == "listen") {
            launchSpeechRecognizer()
            onConsumeInitialMode()
        }
    }

    LaunchedEffect(Unit) {
        link.flushQueue()
        while (true) {
            delay(1_000L)
            nowMs = System.currentTimeMillis()
        }
    }

    if (showTiltMode) {
        TiltModeScreen(
            link = link,
            onClose = { showTiltMode = false }
        )
        return
    }

    val baby = remember(household, selectedBabyId) { link.currentBaby }
    val statusLine = remember(statusLines, baby) { link.currentStatusLine() }
    val openInfo = remember(openSessions, baby) { link.currentOpenInfo() }

    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF12100E)),
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 22.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // 1. Child Pill & Status Line
        item(key = "header") {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        watchHaptic(context, longArrayOf(0, 20))
                        link.cycleSelectedBaby()
                    }
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                val multiHint = if (link.activeBabies.size > 1) " ▾" else ""
                Text(
                    text = "${baby.name}$multiHint",
                    color = Color(0xFFE59838),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = statusLine,
                    color = Color(0xFFF5ECE6),
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
                if (!lastSummary.isNullOrBlank()) {
                    Text(
                        text = "✓ $lastSummary",
                        color = Color(0xFF6CC08A),
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        // 2. Top Row: Speak & Tilt Mode
        item(key = "speak_and_tilt") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                WearPillButton(
                    label = "🎤 Speak",
                    bgColor = Color(0xFFE59838),
                    textColor = Color(0xFF1A1614),
                    modifier = Modifier.weight(1f),
                    onClick = {
                        watchHaptic(context, longArrayOf(0, 25))
                        launchSpeechRecognizer()
                    }
                )
                WearPillButton(
                    label = "🧭 Tilt",
                    bgColor = Color(0xFF2B2623),
                    textColor = Color(0xFFF5ECE6),
                    modifier = Modifier.weight(1f),
                    onClick = {
                        watchHaptic(context, longArrayOf(0, 25))
                        showTiltMode = true
                    }
                )
            }
        }

        // 3. Pregnancy Mode (if expecting)
        if (baby.isExpected) {
            item(key = "expecting_kick") {
                WearPillButton(
                    label = "🤰 Felt Movement",
                    bgColor = Color(0xFF9C598D),
                    textColor = Color.White,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        watchHaptic(context, longArrayOf(0, 30))
                        link.sendAction(kind = "tap", action = "movement.kick")
                    }
                )
            }
        } else {
            // 4. Feed Controls (Open vs Closed)
            item(key = "feed_controls") {
                if (openInfo?.feedSinceMs != null) {
                    val mins = max(0L, (nowMs - openInfo.feedSinceMs) / 60_000L)
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (openInfo.feedKind == "breast") {
                            val sideLabel = openInfo.nursingSide?.uppercase(Locale.US) ?: "L"
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                WearPillButton(
                                    label = "⇄ Switch ($sideLabel)",
                                    bgColor = Color(0xFF3A2D24),
                                    textColor = Color(0xFFE58538),
                                    modifier = Modifier.weight(1f),
                                    onClick = {
                                        watchHaptic(context, longArrayOf(0, 25))
                                        link.sendAction(kind = "tap", action = "feed.breast.switch")
                                    }
                                )
                                WearPillButton(
                                    label = "Done ${mins}m",
                                    bgColor = Color(0xFFE58538),
                                    textColor = Color.White,
                                    modifier = Modifier.weight(1f),
                                    onClick = {
                                        watchHaptic(context, longArrayOf(0, 35))
                                        link.sendAction(kind = "tap", action = "feed.toggle")
                                    }
                                )
                            }
                        } else {
                            // Open Bottle: Fraction buttons
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                listOf(1.0 to "All", 0.75 to "¾", 0.5 to "½", 0.25 to "¼").forEach { (frac, label) ->
                                    WearPillButton(
                                        label = label,
                                        bgColor = Color(0xFFE58538),
                                        textColor = Color.White,
                                        modifier = Modifier.weight(1f),
                                        onClick = {
                                            watchHaptic(context, longArrayOf(0, 35))
                                            link.sendAction(kind = "bottle", fraction = frac)
                                        }
                                    )
                                }
                            }
                        }
                    }
                } else {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        WearPillButton(
                            label = "🍼 Bottle",
                            bgColor = Color(0xFFE58538),
                            textColor = Color.White,
                            modifier = Modifier.weight(1.3f),
                            onClick = {
                                watchHaptic(context, longArrayOf(0, 30))
                                link.sendAction(kind = "tap", action = "feed.toggle")
                            }
                        )
                        WearPillButton(
                            label = "L",
                            bgColor = Color(0xFF3A2D24),
                            textColor = Color(0xFFE58538),
                            modifier = Modifier.weight(0.85f),
                            onClick = {
                                watchHaptic(context, longArrayOf(0, 30))
                                link.sendAction(kind = "tap", action = "feed.breast.left")
                            }
                        )
                        WearPillButton(
                            label = "R",
                            bgColor = Color(0xFF3A2D24),
                            textColor = Color(0xFFE58538),
                            modifier = Modifier.weight(0.85f),
                            onClick = {
                                watchHaptic(context, longArrayOf(0, 30))
                                link.sendAction(kind = "tap", action = "feed.breast.right")
                            }
                        )
                    }
                }
            }

            // 5. Diaper Row: Wet / Dirty / Both
            item(key = "diaper_controls") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    WearPillButton(
                        label = "💧 Wet",
                        bgColor = Color(0xFF4E9A6F),
                        textColor = Color.White,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            watchHaptic(context, longArrayOf(0, 30))
                            link.sendAction(kind = "tap", action = "diaper.wet")
                        }
                    )
                    WearPillButton(
                        label = "💩 Dirty",
                        bgColor = Color(0xFF4E9A6F),
                        textColor = Color.White,
                        modifier = Modifier.weight(1f),
                        onClick = {
                            watchHaptic(context, longArrayOf(0, 30))
                            link.sendAction(kind = "tap", action = "diaper.dirty")
                        }
                    )
                    WearPillButton(
                        label = "Both",
                        bgColor = Color(0xFF356B4D),
                        textColor = Color.White,
                        modifier = Modifier.weight(0.85f),
                        onClick = {
                            watchHaptic(context, longArrayOf(0, 30))
                            link.sendAction(kind = "tap", action = "diaper.both")
                        }
                    )
                }
            }

            // 6. Sleep Toggle
            item(key = "sleep_control") {
                val sleepSince = openInfo?.sleepSinceMs
                val sleepLabel = if (sleepSince != null) {
                    val mins = max(0L, (nowMs - sleepSince) / 60_000L)
                    "☀️ Woke Up (${mins}m)"
                } else {
                    "🌙 Fell Asleep"
                }
                WearPillButton(
                    label = sleepLabel,
                    bgColor = Color(0xFF4A78B8),
                    textColor = Color.White,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        watchHaptic(context, longArrayOf(0, 30))
                        link.sendAction(kind = "tap", action = "sleep.toggle")
                    }
                )
            }
        }

        // 7. Pinned Care & Timed Activities
        items(pinnedCategories, key = { it }) { cat ->
            val runningSince = openInfo?.timedActivities?.get(cat)
            val label = if (runningSince != null) {
                val mins = max(0L, (nowMs - runningSince) / 60_000L)
                "⏹ Stop ${cat.replace('_', ' ')} (${mins}m)"
            } else {
                cat.replace('_', ' ').replaceFirstChar { it.uppercase() }
            }
            WearPillButton(
                label = label,
                bgColor = if (runningSince != null) Color(0xFFD96B52) else Color(0xFF2B2623),
                textColor = Color.White,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    watchHaptic(context, longArrayOf(0, 25))
                    if (runningSince != null) {
                        link.sendAction(kind = "stop_timed", action = cat, category = cat)
                    } else {
                        link.sendAction(kind = "care", action = cat, category = cat)
                    }
                }
            )
        }

        // 8. Undo & Offline Queue Status
        item(key = "undo_footer") {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                WearPillButton(
                    label = "↩ Undo Last",
                    bgColor = Color(0xFF24201D),
                    textColor = Color(0xFFB5ADA3),
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        watchHaptic(context, longArrayOf(0, 20))
                        link.sendAction(kind = "undo")
                    }
                )
                if (pendingCount > 0) {
                    Text(
                        text = "$pendingCount queued for phone",
                        color = Color(0xFF9E948B),
                        fontSize = 10.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun WearPillButton(
    label: String,
    bgColor: Color,
    textColor: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .height(38.dp)
            .clip(RoundedCornerShape(19.dp))
            .background(bgColor)
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1
        )
    }
}
