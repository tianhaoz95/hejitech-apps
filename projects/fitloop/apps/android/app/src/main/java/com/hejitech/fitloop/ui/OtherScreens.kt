package com.hejitech.fitloop.ui

import android.graphics.BitmapFactory
import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.hejitech.fitloop.AppModel
import com.hejitech.fitloop.core.Day
import com.hejitech.fitloop.core.Feedback
import com.hejitech.fitloop.core.FeedbackTag
import com.hejitech.fitloop.core.Photo
import com.hejitech.fitloop.core.Plan
import com.hejitech.fitloop.core.ProgressResponse
import com.hejitech.fitloop.core.Vital
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream

private val dayNames = mapOf("mon" to "Monday", "tue" to "Tuesday", "wed" to "Wednesday", "thu" to "Thursday", "fri" to "Friday", "sat" to "Saturday", "sun" to "Sunday")

/** The Plan tab: what the agent planned and why, goals, limits, targets, the week, versions. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanScreen(model: AppModel, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    val cur = model.plan?.current
    Column(modifier.fillMaxSize()) {
        TopAppBar(title = { Text(cur?.plan?.title ?: "Plan") })
        PullToRefreshBox(isRefreshing = model.loading, onRefresh = { scope.launch { model.refresh() } }, modifier = Modifier.fillMaxSize()) {
            LazyColumn(Modifier.fillMaxSize()) {
                if (cur == null) {
                    item { Empty("No plan yet", "Your AI agent publishes plans to FitLoop over MCP. Connect it in Settings → Agents.") }
                    return@LazyColumn
                }
                val p = cur.plan
                item {
                    Section("Version ${cur.version} · from ${p.startsOn}") {
                        Text(p.summary)
                        if (cur.changeNote.isNotEmpty()) Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.AutoAwesome, null, Modifier.padding(end = 6.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            Secondary(cur.changeNote)
                        }
                    }
                }
                if (p.goals.isNotEmpty()) item { Section("Goals") { p.goals.forEach { Text(it.text) } } }
                if (p.constraints.isNotEmpty()) item { Section("Planned around") { p.constraints.forEach { Text(it) } } }
                p.targets?.let { t -> item { Section("Daily targets") { Text(t.summary) } } }
                item {
                    Section("The week") {
                        Plan.WEEKDAYS.forEachIndexed { i, d ->
                            val day = p.week[d] ?: return@forEachIndexed
                            var open by remember { mutableStateOf(false) }
                            if (i > 0) HorizontalDivider()
                            Row(Modifier.fillMaxWidth().clickable { open = !open }, verticalAlignment = Alignment.CenterVertically) {
                                Text(dayNames[d] ?: d, Modifier.weight(1f), fontWeight = FontWeight.Medium)
                                Text(day.title + if (open) "  ▴" else "  ▾", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            if (open) {
                                for (w in day.workouts) {
                                    Text("${w.time?.let { "$it · " } ?: ""}${w.title} (${w.durationMin} min)", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                    for (e in w.exercises) Secondary("${e.name}: ${e.sets} × ${e.target}")
                                }
                                for (m in day.meals) Secondary("${m.time?.let { "$it · " } ?: ""}${m.name}: ${m.items.joinToString(", ") { it.name }}")
                            }
                        }
                    }
                }
                item {
                    Section(
                        "Versions",
                        footer = "Plans and targets are written by the AI agent you connected — not medical or clinical nutrition advice. Talk to a doctor before starting a new exercise or diet program, and stop if anything hurts, you feel dizzy or have chest symptoms.",
                    ) {
                        for (v in model.plan?.versions.orEmpty()) Column {
                            Text("v${v.version} · from ${v.startsOn}", fontWeight = FontWeight.SemiBold)
                            Secondary(v.changeNote.ifEmpty { v.title })
                        }
                    }
                }
            }
        }
    }
}

private val vitalLabels = mapOf(
    "weight" to "Weight (kg)", "waist" to "Waist (cm)", "body_fat" to "Body fat (%)", "energy" to "Energy (1-5)", "mood" to "Mood (1-5)",
    "soreness" to "Soreness (1-5)", "sleep_hours" to "Sleep (h)", "resting_hr" to "Resting HR", "hrv" to "HRV (ms)", "steps" to "Steps",
    "active_energy" to "Active energy (kcal)",
)
private val manualMetrics = listOf("weight", "waist", "body_fat", "energy", "mood", "soreness", "sleep_hours")

/** The Progress tab: adherence over four weeks, vitals, manual entries and progress photos (each shown only when its option is on). */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ProgressScreen(model: AppModel, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var progress by remember { mutableStateOf<ProgressResponse?>(null) }
    var photos by remember { mutableStateOf<List<Photo>>(emptyList()) }
    var images by remember { mutableStateOf<Map<String, Bitmap>>(emptyMap()) }
    var metric by remember { mutableStateOf("weight") }
    var value by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }

    suspend fun load() {
        loading = true
        try {
            progress = model.backend.progress(Day.adding(-27, Day.today()), Day.today())
            photos = if (model.settings.vitals.photos) model.backend.photos() else emptyList()
            error = null
            for (p in photos) if (p.id !in images) p.url?.let { url ->
                runCatching { model.backend.download(url) }.getOrNull()?.let { b ->
                    BitmapFactory.decodeByteArray(b, 0, b.size)?.let { images = images + (p.id to it) }
                }
            }
        } catch (e: Exception) { error = e.message } finally { loading = false }
    }
    LaunchedEffect(Unit) { load() }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            try {
                val jpeg = withContext(Dispatchers.IO) {
                    val bmp = context.contentResolver.openInputStream(uri)!!.use { BitmapFactory.decodeStream(it) }
                    val scale = minOf(1f, 2048f / maxOf(bmp.width, bmp.height))
                    val sized = if (scale < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * scale).toInt(), (bmp.height * scale).toInt(), true) else bmp
                    ByteArrayOutputStream().also { sized.compress(Bitmap.CompressFormat.JPEG, 80, it) }.toByteArray()
                }
                model.backend.uploadPhoto(jpeg, Day.today())
                load()
            } catch (e: Exception) { error = e.message }
        }
    }

    Column(modifier.fillMaxSize()) {
        TopAppBar(title = { Text("Progress") })
        PullToRefreshBox(isRefreshing = loading && progress != null, onRefresh = { scope.launch { load() } }, modifier = Modifier.fillMaxSize()) {
            LazyColumn(Modifier.fillMaxSize()) {
                progress?.adherence?.let { a ->
                    item {
                        Section("Last 4 weeks") {
                            LabeledRow("Plan done", "${(a.average * 100).toInt()}%")
                            LabeledRow("Workouts", "${a.workouts.done}/${a.workouts.planned}")
                            LabeledRow("Meals", "${a.meals.done}/${a.meals.planned}")
                            LabeledRow("Streak", "${a.streak} day${if (a.streak == 1) "" else "s"}")
                            Row(Modifier.fillMaxWidth().height(54.dp), horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.Bottom) {
                                for (d in a.days) {
                                    val planned = d.workoutsPlanned + d.mealsPlanned > 0
                                    Box(
                                        Modifier.weight(1f).height(maxOf(4.0, 50 * d.completion).dp).clip(RoundedCornerShape(2.dp))
                                            .background(if (planned) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant),
                                    )
                                }
                            }
                        }
                    }
                }
                item {
                    Section("Vitals") {
                        val latest = progress?.vitals.orEmpty().groupBy { it.metric }
                        if (latest.isEmpty()) Secondary("Nothing yet.")
                        for (k in latest.keys.sorted()) {
                            val v = latest.getValue(k).last().value
                            LabeledRow(vitalLabels[k] ?: k, if (v % 1.0 == 0.0) v.toLong().toString() else "%.1f".format(v))
                        }
                        if (model.settings.vitals.manual) {
                            var menu by remember { mutableStateOf(false) }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(Modifier.weight(1f)) {
                                    OutlinedButton(onClick = { menu = true }) { Text(vitalLabels.getValue(metric)) }
                                    DropdownMenu(menu, { menu = false }) {
                                        for (m in manualMetrics) DropdownMenuItem({ Text(vitalLabels.getValue(m)) }, { metric = m; menu = false })
                                    }
                                }
                                OutlinedTextField(value, { value = it }, Modifier.width(90.dp), singleLine = true, placeholder = { Text("Value") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                                TextButton(enabled = value.toDoubleOrNull() != null, onClick = {
                                    scope.launch {
                                        try {
                                            model.backend.sendVitals(listOf(Vital(Day.today(), metric, value.toDouble(), "manual")))
                                            value = ""
                                            load()
                                        } catch (e: Exception) { error = e.message }
                                    }
                                }) { Text("Add") }
                            }
                        }
                    }
                }
                if (model.settings.vitals.photos) item {
                    Section("Progress photos", footer = "Long-press a photo to delete it.") {
                        TextButton(onClick = { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) { Text("Add a photo") }
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            for (p in photos) {
                                var confirm by remember { mutableStateOf(false) }
                                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.combinedClickable(onClick = {}, onLongClick = { confirm = true })) {
                                    val img = images[p.id]
                                    if (img != null) Image(img.asImageBitmap(), null, Modifier.size(90.dp, 120.dp).clip(RoundedCornerShape(8.dp)), contentScale = ContentScale.Crop)
                                    else Box(Modifier.size(90.dp, 120.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant))
                                    Text(p.takenOn, style = MaterialTheme.typography.labelSmall)
                                }
                                if (confirm) AlertDialog(
                                    onDismissRequest = { confirm = false },
                                    title = { Text("Delete this photo?") },
                                    confirmButton = { TextButton(onClick = { confirm = false; scope.launch { runCatching { model.backend.deletePhoto(p.id) }; load() } }) { Text("Delete") } },
                                    dismissButton = { TextButton(onClick = { confirm = false }) { Text("Cancel") } },
                                )
                            }
                        }
                    }
                }
                item { ErrorText(error) }
            }
        }
    }
}

/** The Feedback tab: every note left for the agent, with its replies; a new note. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedbackScreen(model: AppModel, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<Feedback>>(emptyList()) }
    var writing by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(false) }
    suspend fun load() {
        loading = true
        items = runCatching { model.backend.feedback() }.getOrDefault(items)
        loading = false
    }
    LaunchedEffect(Unit) { load() }
    Box(modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            TopAppBar(title = { Text("Feedback") })
            PullToRefreshBox(isRefreshing = loading, onRefresh = { scope.launch { load() } }, modifier = Modifier.fillMaxSize()) {
                LazyColumn(Modifier.fillMaxSize()) {
                    if (items.isEmpty() && !loading) item {
                        Empty("No notes yet", "Leave one from any workout or meal, on your glasses or here. Your agent reads them before it changes your plan.")
                    }
                    items(items, key = { it.id }) { f ->
                        Section {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Secondary(listOfNotNull(f.ref, f.date).firstOrNull() ?: "General", Modifier.weight(1f))
                                Text(if (f.status == "addressed") "Answered" else "Open", style = MaterialTheme.typography.labelMedium, color = if (f.status == "addressed") Good else Warn)
                                IconButton(onClick = { scope.launch { runCatching { model.backend.deleteFeedback(f.id) }; load() } }) {
                                    Icon(Icons.Filled.Delete, "Delete", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            if (f.tags.isNotEmpty()) Text(f.tags.mapNotNull { FeedbackTag.of(it)?.label }.joinToString(" · "), fontWeight = FontWeight.SemiBold)
                            if (f.text.isNotEmpty()) Text(f.text)
                            f.agentReply?.let { r ->
                                Row {
                                    Icon(Icons.Outlined.AutoAwesome, null, Modifier.padding(end = 6.dp), tint = MaterialTheme.colorScheme.primary)
                                    Text(r, color = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                    }
                    item { androidx.compose.foundation.layout.Spacer(Modifier.height(88.dp)) }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = { writing = true }, icon = { Icon(Icons.Outlined.Edit, null) }, text = { Text("New note") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }
    if (writing) NoteSheet(model, NoteTarget(null, "Note for my agent", FeedbackTag.entries)) { writing = false; scope.launch { load() } }
}
