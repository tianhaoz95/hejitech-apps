package com.hejitech.fitloop.ui

import android.app.TimePickerDialog
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.fitloop.AppModel
import com.hejitech.fitloop.BuildConfig
import com.hejitech.fitloop.MainActivity
import com.hejitech.fitloop.core.Day
import com.hejitech.fitloop.core.PairedDevice
import com.hejitech.fitloop.core.PairingCode
import com.hejitech.fitloop.core.Plan
import com.hejitech.fitloop.core.Settings
import kotlinx.coroutines.launch

/**
 * The Settings tab: what the agent should know, every data option (on/off), what the agent may see,
 * reminders, glasses (pairing + display), agents, account, deleting data. Health data comes from the
 * iPhone app (Apple Health and the watch); this app keeps manual entries and photos.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(model: AppModel, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var draft by remember(model.settings) { mutableStateOf(model.settings) }
    var page by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }
    val saved = draft == model.settings
    val site = model.backend.config.site

    when (page) {
        "about" -> { AboutEditor(draft.about, { draft = draft.copy(about = it) }) { page = null }; return }
        "glasses" -> { GlassesPairing(model) { page = null }; return }
    }

    Column(modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("Settings") },
            actions = {
                TextButton(enabled = !saved, modifier = Modifier.testTag("save"), onClick = {
                    scope.launch {
                        val r = draft.reminders
                        if (model.save(draft) && (r.workout.on || r.meals.on || r.evening.on || r.weekly.on)) (context as? MainActivity)?.askForNotifications()
                    }
                }) { Text(if (saved) "Saved" else "Save") }
            },
        )
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Section(footer = "Your agent fills this in by interviewing you over MCP; you don't need to type it first. Every agent you connect reads it at the start of a session.") {
                    NavRow("About you (for your agent)") { page = "about" }
                }
            }
            item {
                val v = draft.vitals
                Section("Data FitLoop keeps", footer = "Heart rate and the daily health summary come from FitLoop on an iPhone with a watch. Never used for advertising, marketing or data mining.") {
                    SwitchRow("Live heart rate in workouts", v.liveHr) { draft = draft.copy(vitals = v.copy(liveHr = it)) }
                    SwitchRow("Daily health summary", v.healthDaily) { draft = draft.copy(vitals = v.copy(healthDaily = it)) }
                    SwitchRow("Manual entries", v.manual) { draft = draft.copy(vitals = v.copy(manual = it)) }
                    SwitchRow("Progress photos", v.photos) { draft = draft.copy(vitals = v.copy(photos = it)) }
                }
            }
            item {
                val a = draft.agentAccess
                Section("What your agent may see", footer = "Shared over MCP only with the third-party AI agents you connect.") {
                    SwitchRow("Check-ins", a.checkins) { draft = draft.copy(agentAccess = a.copy(checkins = it)) }
                    SwitchRow("Feedback notes", a.feedback) { draft = draft.copy(agentAccess = a.copy(feedback = it)) }
                    SwitchRow("Vitals", a.vitals) { draft = draft.copy(agentAccess = a.copy(vitals = it)) }
                    SwitchRow("Progress photo images", a.photos) { draft = draft.copy(agentAccess = a.copy(photos = it)) }
                }
            }
            item {
                val r = draft.reminders
                fun set(n: Settings.Reminders) { draft = draft.copy(reminders = n) }
                Section("Reminders") {
                    SwitchRow("Before a workout", r.workout.on) { set(r.copy(workout = r.workout.copy(on = it))) }
                    if (r.workout.on) Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("${r.workout.minutesBefore} min before", Modifier.weight(1f))
                        TextButton(onClick = { set(r.copy(workout = r.workout.copy(minutesBefore = maxOf(0, r.workout.minutesBefore - 5)))) }) { Text("−") }
                        TextButton(onClick = { set(r.copy(workout = r.workout.copy(minutesBefore = minOf(120, r.workout.minutesBefore + 5)))) }) { Text("+") }
                    }
                    SwitchRow("At each meal", r.meals.on) { set(r.copy(meals = r.meals.copy(on = it))) }
                    SwitchRow("Evening check-in nudge", r.evening.on) { set(r.copy(evening = r.evening.copy(on = it))) }
                    if (r.evening.on) TimeRow("At", r.evening.time) { set(r.copy(evening = r.evening.copy(time = it))) }
                    SwitchRow("Weekly review for your agent", r.weekly.on) { set(r.copy(weekly = r.weekly.copy(on = it))) }
                    if (r.weekly.on) {
                        var menu by remember { mutableStateOf(false) }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("On", Modifier.weight(1f))
                            Box {
                                TextButton(onClick = { menu = true }) { Text(r.weekly.weekday.replaceFirstChar { it.uppercase() }) }
                                DropdownMenu(menu, { menu = false }) {
                                    for (d in Plan.WEEKDAYS) DropdownMenuItem({ Text(d.replaceFirstChar { it.uppercase() }) }, { menu = false; set(r.copy(weekly = r.weekly.copy(weekday = d))) })
                                }
                            }
                        }
                        TimeRow("At", r.weekly.time) { set(r.copy(weekly = r.weekly.copy(time = it))) }
                    }
                }
            }
            item {
                val g = draft.glasses
                Section("Even G2") {
                    SwitchRow("Show heart rate", g.showHr) { draft = draft.copy(glasses = g.copy(showHr = it)) }
                    SwitchRow("Start the rest timer after each set", g.autoRestTimer) { draft = draft.copy(glasses = g.copy(autoRestTimer = it)) }
                    NavRow("Pair glasses") { page = "glasses" }
                }
            }
            item {
                Section {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Units", Modifier.weight(1f))
                        TextButton(onClick = { draft = draft.copy(units = if (draft.units == "metric") "imperial" else "metric") }) {
                            Text(if (draft.units == "metric") "Metric" else "Imperial")
                        }
                    }
                }
            }
            item {
                Section("Agents") {
                    NavRow("Connect an agent (MCP)") { openUrl(context, "$site/settings/") }
                    Secondary("Add $site/mcp as a connector in Claude or another MCP client and sign in with this account.")
                }
            }
            item {
                Section("Account") {
                    LabeledRow("Signed in as", model.email ?: "—")
                    TextButton(onClick = model::signOut) { Text("Sign out") }
                }
            }
            item {
                Section("About") {
                    NavRow("Help") { openUrl(context, "$site/support/") }
                    NavRow("Terms") { openUrl(context, "$site/terms/") }
                    NavRow("Privacy") { openUrl(context, "$site/privacy/") }
                    LabeledRow("Version", BuildConfig.VERSION_NAME)
                }
            }
            item {
                Section(footer = "FitLoop shows your agent's plan and your records; it isn't medical advice.") {
                    TextButton(onClick = { confirmDelete = true }) { Text("Delete my FitLoop data", color = MaterialTheme.colorScheme.error) }
                }
            }
            item { ErrorText(model.error) }
        }
    }
    if (confirmDelete) AlertDialog(
        onDismissRequest = { confirmDelete = false },
        title = { Text("Delete everything FitLoop keeps about you?") },
        text = { Text("Your plans, check-ins, notes, vitals and photos are deleted. This can't be undone.") },
        confirmButton = { TextButton(onClick = { confirmDelete = false; scope.launch { model.deleteData() } }) { Text("Delete", color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
    )
}

@Composable
private fun NavRow(label: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f))
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** An "HH:MM" string edited with the system time picker. */
@Composable
private fun TimeRow(title: String, hhmm: String, onChange: (String) -> Unit) {
    val context = LocalContext.current
    val (h, m) = Day.time(hhmm) ?: (21 to 0)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(title, Modifier.weight(1f))
        TextButton(onClick = {
            TimePickerDialog(context, { _, hour, minute -> onChange("%02d:%02d".format(hour, minute)) }, h, m, android.text.format.DateFormat.is24HourFormat(context)).show()
        }) { Text("%02d:%02d".format(h, m)) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AboutEditor(about: Settings.About, onChange: (Settings.About) -> Unit, onBack: () -> Unit) {
    BackHandler(onBack = onBack)
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("About you") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } })
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { OutlinedTextField(about.goals, { onChange(about.copy(goals = it)) }, Modifier.fillMaxWidth(), label = { Text("Goals") }, placeholder = { Text("e.g. lose 4 kg by December") }) }
            item { OutlinedTextField(about.restrictions, { onChange(about.copy(restrictions = it)) }, Modifier.fillMaxWidth(), label = { Text("Injuries and limits") }, placeholder = { Text("e.g. left knee: no jumping") }) }
            item { OutlinedTextField(about.equipment, { onChange(about.copy(equipment = it)) }, Modifier.fillMaxWidth(), label = { Text("Equipment") }, placeholder = { Text("e.g. dumbbells to 30 kg, bike") }) }
            item { OutlinedTextField(about.schedule, { onChange(about.copy(schedule = it)) }, Modifier.fillMaxWidth(), label = { Text("When you can train") }, placeholder = { Text("e.g. 45 min at lunch on weekdays") }) }
            item { OutlinedTextField(about.diet, { onChange(about.copy(diet = it)) }, Modifier.fillMaxWidth(), label = { Text("Diet") }, placeholder = { Text("e.g. vegetarian on weekdays") }) }
            item { OutlinedTextField(about.notes, { onChange(about.copy(notes = it)) }, Modifier.fillMaxWidth(), label = { Text("Anything else") }) }
            item { Secondary("Save on the Settings page to keep your changes.", Modifier.padding(bottom = 24.dp)) }
        }
    }
}

/** A pairing code for the Even Hub plugin, and the paired glasses. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GlassesPairing(model: AppModel, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf<PairingCode?>(null) }
    var devices by remember { mutableStateOf<List<PairedDevice>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    suspend fun load() { devices = runCatching { model.backend.devices() }.getOrDefault(devices) }
    LaunchedEffect(Unit) { load() }
    BackHandler(onBack = onBack)
    Column(Modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Glasses") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } })
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Section(footer = "On the glasses: swipe through today, tap to open, tap a set done, hold for the menu (how-to, skip, notes), double-tap to go back or exit.") {
                    code?.let {
                        Text(it.code.toList().joinToString(" "), fontSize = 40.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, color = MaterialTheme.colorScheme.primary)
                        Secondary("Open FitLoop in the Even app (Even Hub) and type this code. It works once, for ten minutes.")
                    }
                    FilledTonalButton(onClick = { scope.launch { try { code = model.backend.pairingCode() } catch (e: Exception) { error = e.message } } }) {
                        Text(if (code == null) "Get a pairing code" else "Get a new code")
                    }
                }
            }
            item {
                Section("Paired glasses") {
                    if (devices.isEmpty()) Secondary("None yet")
                    devices.forEachIndexed { i, d ->
                        if (i > 0) HorizontalDivider()
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(d.label, Modifier.weight(1f))
                            TextButton(onClick = { scope.launch { runCatching { model.backend.unpair(d.id) }; load() } }) { Text("Unpair", color = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }
            item { ErrorText(error) }
        }
    }
}
