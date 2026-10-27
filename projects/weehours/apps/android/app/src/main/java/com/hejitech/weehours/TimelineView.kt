package com.hejitech.weehours

import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Undo
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.hejitech.weehours.core.EventStatus
import com.hejitech.weehours.core.FieldValue
import com.hejitech.weehours.core.LogEvent
import com.hejitech.weehours.core.VoiceInterpreter
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.UUID

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TimelineView(model: AppModel) {
    val revision by model.revision.collectAsState()
    val density by model.timelineDensity.collectAsState()
    var dayOffset by remember { mutableIntStateOf(0) } // 0 = today, -1 = yesterday, etc.
    var categoryFilter by remember { mutableStateOf("all") }
    var searchQuery by remember { mutableStateOf("") }
    var editingEvent by remember { mutableStateOf<LogEvent?>(null) }
    var photoTargetEventId by remember { mutableStateOf<UUID?>(null) }

    val photoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        val target = photoTargetEventId
        if (uri != null && target != null) {
            model.attachPhotoFromUri(target, uri)
        }
    }

    val selectedDayStartEnd = remember(dayOffset) {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        cal.add(Calendar.DAY_OF_YEAR, dayOffset)
        val start = cal.time
        cal.add(Calendar.DAY_OF_YEAR, 1)
        val end = cal.time
        start to end
    }

    val baby = remember(revision) { model.primaryBaby }
    val derived = remember(revision, baby) { model.derived(baby.id) }
    val dayFmt = remember { SimpleDateFormat("EEE, MMM d", Locale.US) }
    val timeFmt = remember { SimpleDateFormat("HH:mm", Locale.US) }

    val dayEvents = remember(revision, selectedDayStartEnd, categoryFilter, searchQuery, density) {
        val (start, end) = selectedDayStartEnd
        val base = if (density == TimelineDensity.AUDIT) derived.all else derived.counted
        base.filter { e ->
            val inDay = !e.occurredAt.before(start) && e.occurredAt.before(end)
            val catOk = when (categoryFilter) {
                "all" -> true
                "feed" -> e.type.startsWith("feed.")
                "sleep" -> e.type.startsWith("sleep")
                "diaper" -> e.type.startsWith("diaper")
                "care" -> !e.type.startsWith("feed.") && !e.type.startsWith("sleep") && !e.type.startsWith("diaper")
                else -> true
            }
            val searchOk = if (searchQuery.isBlank()) {
                true
            } else {
                val q = searchQuery.lowercase(Locale.US)
                VoiceInterpreter.label(e.type, e.fields).lowercase(Locale.US).contains(q) ||
                    e.type.lowercase(Locale.US).contains(q) ||
                    (e.provenance.rawTranscript?.lowercase(Locale.US)?.contains(q) == true)
            }
            inDay && catOk && searchOk
        }.sortedByDescending { it.occurredAt.time }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header + Density Switcher
        item(key = "header") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Timeline · ${baby.name}",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TimelineDensity.entries.forEach { d ->
                        FilterChip(
                            selected = density == d,
                            onClick = { model.setTimelineDensity(d) },
                            label = { Text(d.label) }
                        )
                    }
                }
            }
        }

        // Day Strip Navigator + 24-Hour Sparkline
        item(key = "day_strip") {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { dayOffset -= 1 }) {
                            Icon(Icons.Default.ChevronLeft, contentDescription = "Previous Day")
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = when (dayOffset) {
                                    0 -> "Today · ${dayFmt.format(selectedDayStartEnd.first)}"
                                    -1 -> "Yesterday · ${dayFmt.format(selectedDayStartEnd.first)}"
                                    else -> dayFmt.format(selectedDayStartEnd.first)
                                },
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = "${dayEvents.size} entries",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        IconButton(
                            onClick = { if (dayOffset < 0) dayOffset += 1 },
                            enabled = dayOffset < 0
                        ) {
                            Icon(Icons.Default.ChevronRight, contentDescription = "Next Day")
                        }
                    }

                    // 24-hour visual sparkline bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(34.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .padding(horizontal = 4.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                        verticalAlignment = Alignment.Bottom
                    ) {
                        val cal = Calendar.getInstance()
                        for (hour in 0 until 24) {
                            val hourEvents = dayEvents.filter { ev ->
                                cal.time = ev.occurredAt
                                cal.get(Calendar.HOUR_OF_DAY) == hour
                            }
                            val firstEv = hourEvents.firstOrNull()
                            val barColor = when {
                                firstEv == null -> Color.Transparent
                                firstEv.type.startsWith("feed") -> WeeColors.FeedOrange
                                firstEv.type.startsWith("sleep") -> WeeColors.SleepBlue
                                firstEv.type.startsWith("diaper") -> WeeColors.DiaperGreen
                                else -> WeeColors.CareCoral
                            }
                            val fraction = if (hourEvents.isEmpty()) 0.15f else (0.35f + 0.22f * hourEvents.size).coerceAtMost(1f)
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight(fraction)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(
                                        if (hourEvents.isEmpty())
                                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.15f)
                                        else barColor
                                    )
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("00:00", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("06:00", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("12:00", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("18:00", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("23:59", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        // Category Filter Chips & Search
        item(key = "filters") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(
                        "all" to "All",
                        "feed" to "Feeds",
                        "sleep" to "Sleep",
                        "diaper" to "Diapers",
                        "care" to "Care & Health"
                    ).forEach { (k, label) ->
                        FilterChip(
                            selected = categoryFilter == k,
                            onClick = { categoryFilter = k },
                            label = { Text(label) }
                        )
                    }
                }

                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search notes, transcripts, foods, meds…") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear")
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        }

        if (density == TimelineDensity.GRID) {
            item(key = "grid_matrix") {
                HourGridMatrix(events = dayEvents, onSelectEvent = { editingEvent = it })
            }
        } else {
            if (dayEvents.isEmpty()) {
                item(key = "empty") {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "No entries recorded for this day.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(20.dp)
                        )
                    }
                }
            }

            items(dayEvents, key = { it.id }) { event ->
                val st = derived.status[event.id] ?: EventStatus.ACTIVE
                val isInactive = st != EventStatus.ACTIVE
                val photos = derived.photos(forEvent = event)

                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (isInactive)
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
                        else MaterialTheme.colorScheme.surface
                    ),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { editingEvent = event }
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(
                                    text = timeFmt.format(event.occurredAt),
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    color = WeeColors.Amber
                                )
                                Column {
                                    Text(
                                        text = VoiceInterpreter.label(event.type, event.fields),
                                        fontWeight = FontWeight.SemiBold,
                                        textDecoration = if (isInactive) TextDecoration.LineThrough else TextDecoration.None
                                    )
                                    val meta = buildString {
                                        append(model.household.caregiverName(event.loggedBy))
                                        append(" · ")
                                        append(event.provenance.surface.rawValue)
                                        if (density == TimelineDensity.AUDIT) {
                                            append(" · ")
                                            append(st.rawValue)
                                        }
                                        event.provenance.rawTranscript?.let {
                                            append(" · \"")
                                            append(it)
                                            append("\"")
                                        }
                                    }
                                    Text(
                                        text = meta,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }

                            if (!isInactive) {
                                Row {
                                    IconButton(
                                        onClick = {
                                            photoTargetEventId = event.id
                                            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                                        }
                                    ) {
                                        Icon(Icons.Default.AddAPhoto, contentDescription = "Attach Photo", modifier = Modifier.size(18.dp))
                                    }
                                    IconButton(onClick = { model.undoEvent(event.id) }) {
                                        Icon(Icons.Default.Undo, contentDescription = "Undo", modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                        }

                        if (photos.isNotEmpty()) {
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                items(photos, key = { it.id }) { p ->
                                    val file = model.localPhotoFile(p)
                                    val bmp = remember(file.absolutePath, file.exists()) {
                                        if (file.exists()) BitmapFactory.decodeFile(file.absolutePath) else null
                                    }
                                    if (bmp != null) {
                                        Image(
                                            bitmap = bmp.asImageBitmap(),
                                            contentDescription = "Attached photo",
                                            contentScale = ContentScale.Crop,
                                            modifier = Modifier
                                                .size(64.dp)
                                                .clip(RoundedCornerShape(10.dp))
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    editingEvent?.let { ev ->
        EditEventSheet(
            model = model,
            event = ev,
            onDismiss = { editingEvent = null }
        )
    }
}

@Composable
private fun HourGridMatrix(
    events: List<LogEvent>,
    onSelectEvent: (LogEvent) -> Unit
) {
    val cal = Calendar.getInstance()
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            for (hour in 23 downTo 0) {
                val hourEvents = events.filter {
                    cal.time = it.occurredAt
                    cal.get(Calendar.HOUR_OF_DAY) == hour
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = String.format(Locale.US, "%02d:00", hour),
                        fontFamily = FontFamily.Monospace,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.width(46.dp)
                    )
                    if (hourEvents.isEmpty()) {
                        HorizontalDivider(modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.surfaceVariant)
                    } else {
                        Row(
                            modifier = Modifier.weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            hourEvents.forEach { ev ->
                                val c = when {
                                    ev.type.startsWith("feed") -> WeeColors.FeedOrange
                                    ev.type.startsWith("sleep") -> WeeColors.SleepBlue
                                    ev.type.startsWith("diaper") -> WeeColors.DiaperGreen
                                    else -> WeeColors.CareCoral
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(c.copy(alpha = 0.2f))
                                        .clickable { onSelectEvent(ev) }
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = VoiceInterpreter.label(ev.type, ev.fields),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = c,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditEventSheet(
    model: AppModel,
    event: LogEvent,
    onDismiss: () -> Unit
) {
    val timeFmt = remember { SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US) }
    var timeText by remember(event) { mutableStateOf(timeFmt.format(event.occurredAt)) }
    var mlText by remember(event) {
        mutableStateOf(event.number("consumed_ml")?.toInt()?.toString() ?: "")
    }
    var diaperKind by remember(event) {
        mutableStateOf(event.string("kind") ?: "wet")
    }
    var noteText by remember(event) {
        mutableStateOf(event.string("note") ?: event.string("transcript") ?: "")
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Edit, contentDescription = null, tint = WeeColors.Amber)
                Text(
                    text = "Edit Entry · ${VoiceInterpreter.label(event.type, event.fields)}",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            OutlinedTextField(
                value = timeText,
                onValueChange = { timeText = it },
                label = { Text("Occurred At (YYYY-MM-DD HH:mm)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            if (event.type.startsWith("feed.bottle")) {
                OutlinedTextField(
                    value = mlText,
                    onValueChange = { mlText = it },
                    label = { Text("Consumed Amount (ml)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            if (event.type == "diaper") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("wet" to "Wet", "dirty" to "Dirty", "both" to "Both").forEach { (k, label) ->
                        FilterChip(
                            selected = diaperKind == k,
                            onClick = { diaperKind = k },
                            label = { Text(label) }
                        )
                    }
                }
            }

            OutlinedTextField(
                value = noteText,
                onValueChange = { noteText = it },
                label = { Text("Note") },
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                TextButton(
                    onClick = {
                        model.undoEvent(event.id)
                        onDismiss()
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = WeeColors.Crimson)
                ) {
                    Icon(Icons.Default.Delete, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("Undo / Delete")
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel")
                    }
                    Button(
                        onClick = {
                            val parsedTime = try { timeFmt.parse(timeText) } catch (_: Exception) { null } ?: event.occurredAt
                            val newFields = event.fields.toMutableMap()
                            newFields.remove(LogEvent.NEEDS_DETAILS)
                            mlText.toDoubleOrNull()?.let { newFields["consumed_ml"] = FieldValue.Num(it) }
                            if (event.type == "diaper") {
                                newFields["kind"] = FieldValue.Str(diaperKind)
                            }
                            if (noteText.isNotBlank()) {
                                newFields["note"] = FieldValue.Str(noteText.trim())
                            }
                            model.editEvent(
                                original = event,
                                newOccurredAt = parsedTime,
                                newFields = newFields
                            )
                            onDismiss()
                        }
                    ) {
                        Text("Save Changes")
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
