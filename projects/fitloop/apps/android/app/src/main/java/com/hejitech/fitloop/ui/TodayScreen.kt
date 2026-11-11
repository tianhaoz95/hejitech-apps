package com.hejitech.fitloop.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.imePadding
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.hejitech.fitloop.AppModel
import com.hejitech.fitloop.core.CheckinData
import com.hejitech.fitloop.core.Day
import com.hejitech.fitloop.core.FeedbackTag
import com.hejitech.fitloop.core.MealState
import com.hejitech.fitloop.core.NewCheckin
import com.hejitech.fitloop.core.WorkoutState
import kotlinx.coroutines.launch
import java.time.format.DateTimeFormatter

/** What a note for the agent is about: a plan item (its ref), or the day. */
data class NoteTarget(val ref: String?, val title: String, val tags: List<FeedbackTag>)

/**
 * The Today tab: the day's workouts (open one in the player) and meals (check off, portion, swap,
 * skip), progress against the targets, and a note for the agent on anything.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(model: AppModel, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    var noteFor by remember { mutableStateOf<NoteTarget?>(null) }
    val isToday = model.date == Day.today()
    val title = if (isToday) "Today" else Day.date(model.date)?.format(DateTimeFormatter.ofPattern("EEEE, MMM d")) ?: model.date

    LaunchedEffect(model.today) {
        if (model.openFirstWorkout && model.today != null) {
            model.openFirstWorkout = false
            model.openWorkout = model.today?.state?.workouts?.firstOrNull()?.ref
        }
    }

    Column(modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text(title) },
            navigationIcon = { if (!isToday) TextButton(onClick = { scope.launch { model.show(Day.today()) } }) { Text("Today") } },
            actions = {
                IconButton(onClick = { scope.launch { model.show(Day.adding(-1, model.date)) } }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, "Previous day") }
                IconButton(onClick = { scope.launch { model.show(Day.adding(1, model.date)) } }) { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, "Next day") }
            },
        )
        PullToRefreshBox(isRefreshing = model.loading && model.today != null, onRefresh = { scope.launch { model.refresh() } }, modifier = Modifier.fillMaxSize()) {
            val t = model.today
            val day = t?.state?.day
            LazyColumn(Modifier.fillMaxSize()) {
                if (t != null && day != null && t.plan != null) {
                    item {
                        Section(day.title) {
                            DaySummary(t.state.completion, t.state.nutrition.eaten.calories, t.state.nutrition.targets.calories, t.state.nutrition.eaten.proteinG, t.state.nutrition.targets.proteinG)
                            day.notes?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                            t.plan?.changeNote?.takeIf { it.isNotEmpty() }?.let {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Outlined.AutoAwesome, null, Modifier.padding(end = 6.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Secondary(it)
                                }
                            }
                        }
                    }
                    if (t.state.workouts.isNotEmpty()) item {
                        Section("Workouts") {
                            t.state.workouts.forEachIndexed { i, w ->
                                if (i > 0) HorizontalDivider()
                                WorkoutRow(w, onOpen = { model.openWorkout = w.ref }, onSkip = {
                                    scope.launch { model.checkin(NewCheckin(model.date, w.ref, "workout", "skipped")) }
                                }, onNote = {
                                    noteFor = NoteTarget(w.ref, w.workout.title, listOf(FeedbackTag.TOO_HARD, FeedbackTag.TOO_EASY, FeedbackTag.NO_TIME, FeedbackTag.LOVED_IT, FeedbackTag.OTHER))
                                })
                            }
                        }
                    }
                    if (t.state.meals.isNotEmpty()) item {
                        Section("Meals") {
                            t.state.meals.forEachIndexed { i, m ->
                                if (i > 0) HorizontalDivider()
                                MealRow(model, m) { noteFor = NoteTarget(m.ref, m.meal.name, listOf(FeedbackTag.HUNGRY, FeedbackTag.TOO_MUCH_FOOD, FeedbackTag.LOVED_IT, FeedbackTag.OTHER)) }
                            }
                        }
                    }
                    item {
                        Section {
                            Row(Modifier.fillMaxWidth().clickable { noteFor = NoteTarget(null, "Today", FeedbackTag.entries) }, verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.AutoMirrored.Outlined.Chat, null, tint = MaterialTheme.colorScheme.primary)
                                Spacer(Modifier.width(10.dp))
                                Text("Note for my agent about today", color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                } else if (model.loading && t == null) {
                    item { Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
                } else {
                    item {
                        Empty(
                            if (t?.plan == null) "No plan yet" else "Nothing planned",
                            if (t?.plan == null) "Ask your AI agent to build your FitLoop plan: connect it in Settings → Agents, then say \"make me a FitLoop plan\"."
                            else "Your plan has nothing on this day.",
                        )
                    }
                }
                item { ErrorText(model.error) }
            }
        }
    }
    noteFor?.let { NoteSheet(model, it) { noteFor = null } }
}

@Composable
fun Empty(title: String, text: String) {
    Column(Modifier.fillMaxWidth().padding(40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}

@Composable
private fun DaySummary(completion: Double, kcal: Double?, kcalTarget: Double?, protein: Double?, proteinTarget: Double?) {
    Text("${(completion * 100).toInt()}% done", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
    LinearProgressIndicator(progress = { completion.toFloat() }, modifier = Modifier.fillMaxWidth())
    if (kcalTarget != null) {
        Secondary("${(kcal ?: 0.0).toInt()} of ${kcalTarget.toInt()} kcal" + (proteinTarget?.let { " · ${(protein ?: 0.0).toInt()} of ${it.toInt()} g protein" } ?: ""))
    }
}

@Composable
private fun WorkoutRow(state: WorkoutState, onOpen: () -> Unit, onSkip: () -> Unit, onNote: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth().clickable(onClick = onOpen).testTag("workout-${state.ref}"), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Headline(state.workout.title)
            Secondary(listOfNotNull(state.workout.time, "${state.workout.durationMin} min", state.workout.exercises.size.let { "$it exercise${if (it == 1) "" else "s"}" }).joinToString(" · "))
        }
        when (state.status) {
            "done" -> Icon(Icons.Filled.CheckCircle, "Done", tint = Good)
            "skipped" -> Secondary("Skipped")
            else -> Text("${state.setsDone}/${state.setsTotal}", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Box {
            IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, "More") }
            DropdownMenu(menu, { menu = false }) {
                DropdownMenuItem({ Text("Skip") }, { menu = false; onSkip() })
                DropdownMenuItem({ Text("Note for my agent…") }, { menu = false; onNote() })
            }
        }
    }
}

@Composable
private fun MealRow(model: AppModel, state: MealState, onNote: () -> Unit) {
    val scope = rememberCoroutineScope()
    var menu by remember { mutableStateOf(false) }
    var swapping by remember { mutableStateOf(false) }
    val m = state.meal
    fun act(status: String, portion: String?) = scope.launch {
        model.checkin(NewCheckin(model.date, state.ref, "meal", status, portion?.let { CheckinData(portion = it) }))
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Headline(listOfNotNull(m.time, m.name).joinToString(" · "), Modifier.weight(1f))
            when (state.status) {
                "done" -> Text(when (state.portion) { "less" -> "Less"; "more" -> "More"; else -> "Done" }, color = Good, style = MaterialTheme.typography.labelMedium)
                "swapped" -> Text("Swapped", color = Warn, style = MaterialTheme.typography.labelMedium)
                "skipped" -> Secondary("Skipped")
            }
        }
        Text(m.items.joinToString(", ") { "${it.name} ${it.amount}" }, style = MaterialTheme.typography.bodyMedium)
        m.macros?.let { Secondary(it.summary) }
        m.prep?.takeIf { it.isNotEmpty() }?.let { prep ->
            var open by remember { mutableStateOf(false) }
            Text(if (open) "Prep ▴" else "Prep ▾", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge, modifier = Modifier.clickable { open = !open })
            if (open) prep.forEachIndexed { i, p -> Secondary("${i + 1}. $p") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { act("done", "as_planned") }, modifier = Modifier.testTag("ate-${state.ref}")) { Text("Ate it") }
            Box {
                OutlinedButton(onClick = { menu = true }) { Text("Other") }
                DropdownMenu(menu, { menu = false }) {
                    DropdownMenuItem({ Text("Ate less") }, { menu = false; act("done", "less") })
                    DropdownMenuItem({ Text("Ate more") }, { menu = false; act("done", "more") })
                    DropdownMenuItem({ Text("Something else…") }, { menu = false; swapping = true })
                    DropdownMenuItem({ Text("Skipped it") }, { menu = false; act("skipped", null) })
                    HorizontalDivider()
                    DropdownMenuItem({ Text("Note for my agent…") }, { menu = false; onNote() })
                }
            }
        }
    }
    if (swapping) {
        var text by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { swapping = false },
            title = { Text("What did you eat instead?") },
            text = { OutlinedTextField(text, { text = it }, placeholder = { Text("e.g. a burrito") }, singleLine = true) },
            confirmButton = {
                TextButton(onClick = {
                    swapping = false
                    scope.launch { model.checkin(NewCheckin(model.date, state.ref, "meal", "swapped", CheckinData(swappedFor = text))) }
                }, enabled = text.isNotBlank()) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { swapping = false }) { Text("Cancel") } },
        )
    }
}

/** A note for the agent: quick tags and words, tied to a plan item (or the day). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteSheet(model: AppModel, target: NoteTarget, onDismiss: () -> Unit) {
    val scope = rememberCoroutineScope()
    var tags by remember { mutableStateOf(setOf<FeedbackTag>()) }
    var text by remember { mutableStateOf("") }
    // Full height and scrolling: with every tag listed, Send would sit below a half-open sheet.
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 24.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(target.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            for (t in target.tags) {
                Row(Modifier.fillMaxWidth().clickable { tags = if (t in tags) tags - t else tags + t }, verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(t in tags, { tags = if (it) tags + t else tags - t })
                    Text(t.label)
                }
            }
            if (FeedbackTag.PAIN in tags) {
                Text(
                    "Stop if something hurts, you feel dizzy or have chest symptoms, and see a doctor or physio — your agent isn't a medical professional.",
                    color = Warn, style = MaterialTheme.typography.bodySmall,
                )
            }
            OutlinedTextField(text, { text = it }, label = { Text("What should your agent know?") }, minLines = 3, modifier = Modifier.fillMaxWidth())
            Secondary("Your agent reads this next time it looks at your plan, and replies in Feedback.")
            Button(
                onClick = { scope.launch { if (model.sendFeedback(target.ref, text, tags)) onDismiss() } },
                enabled = tags.isNotEmpty() || text.isNotBlank(), modifier = Modifier.fillMaxWidth(),
            ) { Text("Send") }
            ErrorText(model.error)
        }
    }
}
