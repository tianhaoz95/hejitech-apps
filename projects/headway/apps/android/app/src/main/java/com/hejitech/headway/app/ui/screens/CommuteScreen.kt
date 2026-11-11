package com.hejitech.headway.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.DarkSurface
import com.hejitech.headway.app.ui.theme.StatusGrey
import com.hejitech.headway.app.ui.theme.StatusRed
import com.hejitech.headway.core.model.*

/**
 * The Commute tab: morning and evening legs, the switch time, alert days and which alerts to send.
 * Saved through the Worker (the same checks as the web settings page).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommuteScreen(viewModel: HeadwayViewModel, onAskNotifications: () -> Unit = {}) {
    val settings by viewModel.settings.collectAsState()
    val settingsSaved by viewModel.settingsSaved.collectAsState()
    val stations by viewModel.stations.collectAsState()
    val error by viewModel.errorMessage.collectAsState()
    val notificationsAllowed by viewModel.notificationsAllowed.collectAsState()

    // Edited here, sent on Save; reset when the saved settings change underneath.
    var draft by remember(settings) { mutableStateOf(settings) }
    // Not keyed on the settings: saving replaces them, and the button should then read "Saved".
    var saved by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    val unchanged = draft == settings && settingsSaved

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Commute", fontWeight = FontWeight.Bold) },
                actions = {
                    TextButton(
                        enabled = !unchanged && !saving,
                        modifier = Modifier.testTag("commute-save"),
                        onClick = {
                            saving = true
                            val toSave = draft
                            viewModel.saveSettings(toSave) { ok ->
                                saving = false
                                saved = ok
                                if (ok && toSave.alerts.anyOn && !notificationsAllowed) onAskNotifications()
                            }
                        }
                    ) { Text(if (saved && unchanged) "Saved" else "Save") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            item {
                LegCard(
                    title = "Morning", leg = draft.morning, stations = stations,
                    make = { Leg.morning("mountain_view", "san_francisco") }, defaultUsual = "08:00",
                    onChange = { draft = draft.copy(morning = it) }
                )
            }
            item {
                LegCard(
                    title = "Evening", leg = draft.evening, stations = stations,
                    make = { Leg.evening("san_francisco", "mountain_view") }, defaultUsual = "17:30",
                    onChange = { draft = draft.copy(evening = it) }
                )
            }
            if (draft.morning != null || draft.evening != null) {
                item {
                    Note("Train preference lets you prefer or only take faster Caltrain express trains. The leave-now reminder targets the first matching train at or after your usual time. Alerts only come inside the watch window. With Location on (Settings), the board estimates your trip from where you are instead of the minutes set here.")
                }
            }
            item {
                FormCard {
                    TimeRow("Switch to evening at", draft.switchAt) { draft = draft.copy(switchAt = it) }
                    Note("Every day, before this time the Trains tab, your watch and your glasses open on your morning trains, and after it on your evening ones.")
                }
            }
            item {
                FormCard {
                    Text("Alerts", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Alert days", style = MaterialTheme.typography.bodyMedium)
                    DaysRow(draft.days) { draft = draft.copy(days = it) }
                    val a = draft.alerts
                    val set = { next: AlertSettings -> draft = draft.copy(alerts = next) }
                    SwitchRow("Delays", a.delay) { set(a.copy(delay = it)) }
                    if (a.delay) StepperRow("At least ${a.delayThreshold} min late", a.delayThreshold, 1..60) { set(a.copy(delayThreshold = it)) }
                    SwitchRow("Cancellations", a.cancellation) { set(a.copy(cancellation = it)) }
                    SwitchRow("Caltrain service alerts", a.service) { set(a.copy(service = it)) }
                    SwitchRow("Faster train alerts", a.betterTrain) { set(a.copy(betterTrain = it)) }
                    SwitchRow("Leave-now reminder", a.leaveNow) { set(a.copy(leaveNow = it)) }
                    SwitchRow("Before my stop", a.arrival) { set(a.copy(arrival = it)) }
                    if (a.arrival) StepperRow("${a.arrivalMinutes} min before arriving", a.arrivalMinutes, 1..60) { set(a.copy(arrivalMinutes = it)) }
                    Note("Commute alerts come only on your alert days, inside each leg's watch window. \"Faster train alerts\" tells you when a later express reaches your destination first. \"Before my stop\" follows the train you track (here or with a long press on the R1 ring), any day.")
                }
            }
            item {
                FormCard {
                    Text("Live ETA sharing", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = draft.shareName ?: "",
                        onValueChange = { v -> draft = draft.copy(shareName = v.take(20).takeIf { it.isNotBlank() }) },
                        label = { Text("Display name") },
                        placeholder = { Text("Optional (e.g. Alex)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Note("Shown on the live ETA web page when you share your ride with friends or family.")
                }
            }
            error?.let { item { Text(it, color = StatusRed, style = MaterialTheme.typography.bodySmall) } }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
fun FormCard(content: @Composable ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = DarkSurface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}

@Composable
fun Note(text: String) = Text(text, style = MaterialTheme.typography.bodySmall, color = StatusGrey)

@Composable
fun SwitchRow(label: String, checked: Boolean, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange, enabled = enabled)
    }
}

@Composable
private fun StepperRow(label: String, value: Int, range: IntRange, onChange: (Int) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.weight(1f))
        FilledTonalIconButton(onClick = { onChange((value - 1).coerceIn(range)) }, enabled = value > range.first) {
            Icon(Icons.Default.Remove, contentDescription = "Less")
        }
        Spacer(Modifier.width(6.dp))
        FilledTonalIconButton(onClick = { onChange((value + 1).coerceIn(range)) }, enabled = value < range.last) {
            Icon(Icons.Default.Add, contentDescription = "More")
        }
    }
}

/** A row with a current choice that opens a menu of the others. */
@Composable
private fun <T> ChoiceRow(label: String, value: T, options: List<T>, title: (T) -> String, onChange: (T) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.weight(1f))
        Box {
            TextButton(onClick = { open = true }) {
                Text(title(value))
                Icon(Icons.Default.ArrowDropDown, contentDescription = null)
            }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                options.forEach { o -> DropdownMenuItem(text = { Text(title(o)) }, onClick = { open = false; onChange(o) }) }
            }
        }
    }
}

/** "7:30 AM" for an "HH:MM" Pacific wall-clock time. */
private fun displayTime(hhmm: String): String {
    val m = Clock.minutes(hhmm) ?: return hhmm
    val h = m / 60
    return String.format(java.util.Locale.US, "%d:%02d %s", if (h % 12 == 0) 12 else h % 12, m % 60, if (h < 12) "AM" else "PM")
}

/** An "HH:MM" string edited with a time picker (Pacific wall-clock time, no date). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimeRow(label: String, hhmm: String, onChange: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.weight(1f))
        FilledTonalButton(onClick = { open = true }) { Text(displayTime(hhmm)) }
    }
    if (open) {
        val start = Clock.minutes(hhmm) ?: 0
        val state = rememberTimePickerState(initialHour = start / 60, initialMinute = start % 60, is24Hour = false)
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text(label) },
            text = { TimePicker(state = state) },
            confirmButton = { TextButton(onClick = { open = false; onChange(Clock.hhmm(state.hour * 60 + state.minute)) }) { Text("Set") } },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun DaysRow(days: List<Int>, onChange: (List<Int>) -> Unit) {
    val names = listOf("M", "T", "W", "T", "F", "S", "S")
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        names.forEachIndexed { i, n ->
            val on = days.contains(i)
            FilterChip(
                selected = on,
                onClick = { onChange(if (on) days - i else (days + i).sorted()) },
                label = { Text(n, modifier = Modifier.fillMaxWidth(), textAlign = androidx.compose.ui.text.style.TextAlign.Center) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

/** One leg of the commute: off, or its stations and how you take it. */
@Composable
private fun LegCard(title: String, leg: Leg?, stations: List<Station>, make: () -> Leg, defaultUsual: String, onChange: (Leg?) -> Unit) {
    var pick by remember { mutableStateOf<String?>(null) }
    val name = { id: String -> stations.firstOrNull { it.id == id }?.name ?: id }
    FormCard {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Switch(checked = leg != null, onCheckedChange = { on -> onChange(if (on) make() else null) }, modifier = Modifier.testTag("leg-${title.lowercase()}"))
        }
        if (leg != null) {
            StationField("From", name(leg.from)) { pick = "from" }
            StationField("To", name(leg.to)) { pick = "to" }
            if (leg.from == leg.to) Text("Pick two different stations.", color = StatusRed, style = MaterialTheme.typography.bodySmall)
            ChoiceRow("Train preference", leg.expressPreference, ExpressPreference.entries, { it.title }) { onChange(leg.copy(expressPreference = it)) }
            SwitchRow("Usual train", leg.usual != null) { on -> onChange(leg.copy(usual = if (on) defaultUsual else null)) }
            leg.usual?.let { usual -> TimeRow("At or after", usual) { onChange(leg.copy(usual = it)) } }
            ChoiceRow("Getting to the station", leg.mode, TravelMode.entries, { it.title }) { onChange(leg.copy(travelMode = it.value)) }
            StepperRow("${leg.mode.title} to the station: ${leg.walkMinutes} min", leg.walkMinutes, 0..90) { onChange(leg.copy(walkMinutes = it)) }
            TimeRow("Watch from", leg.window.start) { onChange(leg.copy(window = leg.window.copy(start = it))) }
            TimeRow("Until", leg.window.end) { onChange(leg.copy(window = leg.window.copy(end = it))) }
        }
    }
    val current = leg
    val which = pick
    if (current != null && which != null && stations.isNotEmpty()) {
        StationPickerDialog(
            title = if (which == "from") "From" else "To",
            stations = stations,
            selectedStation = stations.firstOrNull { it.id == (if (which == "from") current.from else current.to) } ?: stations.first(),
            onStationSelected = { onChange(if (which == "from") current.copy(from = it.id) else current.copy(to = it.id)) },
            onDismiss = { pick = null }
        )
    }
}
