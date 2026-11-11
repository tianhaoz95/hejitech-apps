package com.hejitech.fitloop.ui

import android.annotation.SuppressLint
import android.graphics.Color as AndroidColor
import android.webkit.WebView
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.RadioButtonChecked
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.hejitech.fitloop.AppModel
import com.hejitech.fitloop.core.CheckinData
import com.hejitech.fitloop.core.ExerciseAnimation
import com.hejitech.fitloop.core.FeedbackTag
import com.hejitech.fitloop.core.NewCheckin
import com.hejitech.fitloop.core.WorkoutState
import com.hejitech.fitloop.core.formatSeconds
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The workout player: one exercise at a time with its set target, how-to and cues; "Set done"
 * checks the set in and starts the rest timer; timed sets run a work timer. The same flow as the
 * iPhone app's WorkoutPlayer (no watch on Android yet, so no heart rate).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WorkoutPlayer(model: AppModel, initial: WorkoutState, modifier: Modifier = Modifier, onClose: () -> Unit) {
    val scope = rememberCoroutineScope()
    // The latest state of this workout (check-ins refresh model.today).
    val state = model.today?.state?.workouts?.firstOrNull { it.ref == initial.ref } ?: initial
    val start = remember { initial.next }
    var ex by remember { mutableStateOf(start?.first ?: 0) }
    var set by remember { mutableStateOf(start?.second ?: 1) }
    var restUntil by remember { mutableStateOf<Long?>(null) }
    var workStarted by remember { mutableStateOf<Long?>(null) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var menu by remember { mutableStateOf(false) }
    var confirmEnd by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf<NoteTarget?>(null) }
    val current = state.exercises[ex.coerceIn(0, state.exercises.size - 1)]
    val e = current.exercise

    LaunchedEffect(Unit) { while (true) { now = System.currentTimeMillis(); delay(250) } }
    BackHandler(onBack = onClose)

    fun move(d: Int) {
        ex = (ex + d + state.exercises.size) % state.exercises.size
        val c = state.exercises[ex]
        set = minOf(c.setsDone + 1, c.exercise.sets)
        restUntil = null
        workStarted = null
    }

    suspend fun finish(status: String) {
        model.checkin(NewCheckin(model.date, state.ref, "workout", status))
        onClose()
    }

    fun setDone() {
        val c = current
        val data = CheckinData(reps = c.exercise.repsCount, load = c.exercise.load, durationSec = workStarted?.let { ((System.currentTimeMillis() - it) / 1000).toInt() })
        val setNumber = set
        workStarted = null
        val last = setNumber >= c.exercise.sets
        scope.launch {
            model.checkin(NewCheckin(model.date, "${c.ref}/$setNumber", "set", "done", data))
            if (last) {
                model.checkin(NewCheckin(model.date, c.ref, "exercise", "done"))
                val fresh = model.today?.state?.workouts?.firstOrNull { it.ref == initial.ref }
                if (fresh?.next == null) { finish("done"); return@launch }
            }
            if (model.settings.glasses.autoRestTimer && c.exercise.restSec > 0) restUntil = System.currentTimeMillis() + c.exercise.restSec * 1000L
            if (last) model.today?.state?.workouts?.firstOrNull { it.ref == initial.ref }?.next?.let { (i, s) -> ex = i; set = s } else set = setNumber + 1
        }
    }

    fun skipExercise() = scope.launch {
        model.checkin(NewCheckin(model.date, current.ref, "exercise", "skipped"))
        model.today?.state?.workouts?.firstOrNull { it.ref == initial.ref }?.next?.let { (i, s) -> ex = i; set = s }
    }

    val mainLabel = when {
        current.settled -> "Next exercise"
        e.durationSec != null -> if (workStarted == null) "Start ${formatSeconds(e.durationSec!!)}" else "Done"
        else -> "Set done"
    }
    fun mainAction() {
        when {
            current.settled -> move(1)
            e.durationSec != null && workStarted == null -> { workStarted = System.currentTimeMillis(); restUntil = null }
            else -> setDone()
        }
    }

    Column(modifier.fillMaxSize()) {
        TopAppBar(
            windowInsets = androidx.compose.foundation.layout.WindowInsets(0),
            title = { Text(state.workout.title) },
            navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.Filled.Close, "Close") } },
            actions = {
                IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, "More") }
                DropdownMenu(menu, { menu = false }) {
                    DropdownMenuItem({ Text("Skip this exercise") }, { menu = false; skipExercise() })
                    DropdownMenuItem({ Text("Note for my agent") }, {
                        menu = false
                        note = NoteTarget(current.ref, e.name, listOf(FeedbackTag.TOO_HARD, FeedbackTag.TOO_EASY, FeedbackTag.PAIN, FeedbackTag.LOVED_IT, FeedbackTag.OTHER))
                    })
                    DropdownMenuItem({ Text("End workout") }, { menu = false; confirmEnd = true })
                }
            },
        )
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("${state.setsDone} of ${state.setsTotal} sets", style = MaterialTheme.typography.bodyMedium)
            LinearProgressIndicator(progress = { state.setsDone.toFloat() / maxOf(state.setsTotal, 1) }, modifier = Modifier.fillMaxWidth())

            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(e.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Secondary("${ex + 1}/${state.exercises.size}")
                    }
                    if (current.settled) {
                        Text(if (current.status == "done") "Done" else current.status.replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    } else {
                        Text("Set $set of ${e.sets}", style = MaterialTheme.typography.titleMedium)
                        Text(e.target, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    }
                    val started = workStarted
                    val until = restUntil
                    if (started != null && e.durationSec != null) {
                        val left = e.durationSec!! * 1000L - (now - started)
                        Text(if (left > 0) "Work ${clock(left)}" else "Time!", fontSize = 40.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    } else if (until != null) {
                        val left = until - now
                        Text(if (left > 0) "Rest ${clock(left)}" else "Go", fontSize = 40.sp, fontWeight = FontWeight.Bold,
                            color = if (left > 0) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilledTonalIconButton(onClick = { move(-1) }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Previous exercise") }
                        Button(onClick = ::mainAction, modifier = Modifier.weight(1f).heightIn(min = 52.dp).testTag("main-action")) { Text(mainLabel, style = MaterialTheme.typography.titleMedium) }
                        FilledTonalIconButton(onClick = { move(1) }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Next exercise") }
                    }
                }
            }

            e.animation?.takeIf { !it.gifUrl.isNullOrEmpty() || !it.steps.isNullOrEmpty() }?.let { ExerciseAnimationCard(it) }
            e.cues?.takeIf { it.isNotEmpty() }?.let { cues ->
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (c in cues) Row(verticalAlignment = Alignment.Top) {
                        Icon(Icons.Filled.Check, null, Modifier.padding(end = 8.dp), tint = MaterialTheme.colorScheme.primary)
                        Text(c, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            e.instructions?.let { how ->
                var open by remember(e.id) { mutableStateOf(false) }
                Text(if (open) "How to ▴" else "How to ▾", color = MaterialTheme.colorScheme.primary, modifier = Modifier.clickable { open = !open })
                if (open) Text(how, style = MaterialTheme.typography.bodyMedium)
            }
            e.alternative?.let { Secondary("Instead: $it") }

            Headline("This workout")
            state.exercises.forEachIndexed { i, s ->
                Row(
                    Modifier.fillMaxWidth().clickable {
                        ex = i; set = minOf(s.setsDone + 1, s.exercise.sets); restUntil = null; workStarted = null
                    }.padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        when { s.status == "done" -> Icons.Filled.CheckCircle; i == ex -> Icons.Filled.RadioButtonChecked; else -> Icons.Filled.RadioButtonUnchecked },
                        null, tint = if (s.status == "done") Good else MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(s.exercise.name, Modifier.weight(1f))
                    Secondary(if (s.status == "skipped") "skipped" else "${s.setsDone}/${s.exercise.sets}")
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    if (confirmEnd) {
        AlertDialog(
            onDismissRequest = { confirmEnd = false },
            title = { Text("End the workout?") },
            confirmButton = { TextButton(onClick = { confirmEnd = false; scope.launch { finish(if (state.setsDone >= state.setsTotal) "done" else "partial") } }) { Text("End and save") } },
            dismissButton = { TextButton(onClick = { confirmEnd = false }) { Text("Cancel") } },
        )
    }
    note?.let { NoteSheet(model, it) { note = null } }
}

private fun clock(ms: Long): String {
    val t = maxOf(0L, (ms + 999) / 1000)
    return "${t / 60}:${"%02d".format(t % 60)}"
}

/** The agent's demonstration GIF (in a WebView, which animates it) and its steps. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun ExerciseAnimationCard(animation: ExerciseAnimation) {
    var step by remember(animation) { mutableStateOf(0) }
    val steps = animation.steps.orEmpty()
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Animated instructions", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                if (steps.isNotEmpty()) Secondary("Step ${step + 1}/${steps.size}")
            }
            animation.gifUrl?.takeIf { it.isNotEmpty() }?.let { url ->
                val html = """<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}body{background:transparent;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;overflow:hidden}img{max-width:100%;max-height:100%;object-fit:contain;border-radius:12px}</style></head><body><img src="$url" alt="Exercise animation"></body></html>"""
                AndroidView(
                    factory = { ctx -> WebView(ctx).apply { setBackgroundColor(AndroidColor.TRANSPARENT); isVerticalScrollBarEnabled = false } },
                    update = { it.loadDataWithBaseURL(null, html, "text/html", "utf-8", null) },
                    modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(14.dp)),
                )
            }
            animation.description?.takeIf { it.isNotEmpty() }?.let { Secondary(it) }
            steps.forEachIndexed { i, s ->
                Row(Modifier.fillMaxWidth().clickable { step = i }.padding(vertical = 2.dp)) {
                    Text("${i + 1}.", Modifier.width(24.dp), color = if (i == step) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.SemiBold)
                    Text(s, color = if (i == step) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
