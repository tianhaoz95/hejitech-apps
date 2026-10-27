package com.hejitech.weehours

import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DashboardCustomize
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Kitchen
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material.icons.filled.NightlightRound
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Straighten
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Image
import android.graphics.BitmapFactory
import com.hejitech.weehours.core.FieldValue
import com.hejitech.weehours.core.LogEvent
import com.hejitech.weehours.core.LogService
import com.hejitech.weehours.core.MilkStash
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

@Composable
fun HomeView(model: AppModel) {
    val layout by model.nowLayout.collectAsState()
    val revision by model.revision.collectAsState()
    val now by model.nowTick.collectAsState()
    val syncing by model.syncInProgress.collectAsState()

    var showCustomizeSheet by remember { mutableStateOf(false) }
    var showDoctorVisitSheet by remember { mutableStateOf(false) }
    var showGrowthSheet by remember { mutableStateOf(false) }
    var showCareSheetCategory by remember { mutableStateOf<String?>(null) }

    val primaryBaby = remember(revision, now) { model.primaryBaby }
    val derived = remember(revision) { model.derived(primaryBaby.id) }
    val latestEventId = remember(revision) { derived.counted.lastOrNull()?.id }

    val photoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null && latestEventId != null) {
            model.attachPhotoFromUri(latestEventId, uri)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header Row: Household title + Quick Actions (Night HUD, Doctor Visit Pack, Customize Layout, Sync)
        item(key = "header") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = model.household.name,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold
                    )
                    val ageOrDue = primaryBaby.dueDate?.let { due ->
                        val daysLeft = max(0L, (due.time - now.time) / 86_400_000L)
                        "Expecting · ${daysLeft}d to due date"
                    } ?: primaryBaby.birthDate?.let { bd ->
                        val daysOld = max(0L, (now.time - bd.time) / 86_400_000L)
                        val weeks = daysOld / 7
                        if (weeks >= 2) "${weeks}w ${daysOld % 7}d old" else "${daysOld}d old"
                    } ?: "Ready to log"
                    Text(
                        text = "${primaryBaby.name} · $ageOrDue",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    IconButton(onClick = { showDoctorVisitSheet = true }) {
                        Icon(Icons.Default.Description, contentDescription = "Doctor Visit Summary")
                    }
                    IconButton(onClick = { model.toggleNightHud() }) {
                        Icon(Icons.Default.NightlightRound, contentDescription = "Night HUD")
                    }
                    IconButton(onClick = { showCustomizeSheet = true }) {
                        Icon(Icons.Default.DashboardCustomize, contentDescription = "Customize Now Screen")
                    }
                    if (model.supabase.isAuthenticated) {
                        IconButton(onClick = { model.syncNow() }, enabled = !syncing) {
                            Icon(Icons.Default.Sync, contentDescription = "Sync")
                        }
                    }
                }
            }
        }

        items(layout.active, key = { it.id }) { section ->
            when (section) {
                NowSection.STATUS -> StatusAndDutyCard(
                    model = model,
                    onAttachPhoto = {
                        if (latestEventId != null) {
                            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        }
                    }
                )
                NowSection.PARTNER -> PartnerPulseBanner(model = model)
                NowSection.DETAILS -> NeedsDetailsAndReviewSection(model = model)
                NowSection.TILES -> QuickTilesSection(model = model)
                NowSection.NOTE -> ShiftNoteCard(model = model)
                NowSection.RHYTHM -> RhythmCompareCard(model = model)
                NowSection.PREGNANCY -> {
                    if (primaryBaby.isExpected || "movement" in model.household.enabled) {
                        PregnancySectionCard(model = model)
                    }
                }
                NowSection.CARE -> CareActivitiesSectionCard(
                    model = model,
                    onOpenCareSheet = { cat -> showCareSheetCategory = cat }
                )
                NowSection.STASH -> {
                    if (model.household.trackMilkStash || "pumping" in model.household.enabled) {
                        MilkStashSectionCard(model = model)
                    }
                }
                NowSection.GROWTH -> GrowthSummaryCard(
                    model = model,
                    onOpenGrowthSheet = { showGrowthSheet = true }
                )
                NowSection.PHOTOS -> OngoingPhotosSectionCard(
                    model = model,
                    onPickPhoto = {
                        if (latestEventId != null) {
                            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        }
                    }
                )
                NowSection.DIGEST -> ShiftDigestSectionCard(model = model)
            }
        }
    }

    if (showCustomizeSheet) {
        NowCustomizeSheet(model = model, onDismiss = { showCustomizeSheet = false })
    }
    if (showDoctorVisitSheet) {
        DoctorVisitSheet(model = model, onDismiss = { showDoctorVisitSheet = false })
    }
    if (showGrowthSheet) {
        GrowthSheet(model = model, onDismiss = { showGrowthSheet = false })
    }
    showCareSheetCategory?.let { cat ->
        CareActivitySheet(
            model = model,
            initialCategory = cat,
            onDismiss = { showCareSheetCategory = null }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StatusAndDutyCard(
    model: AppModel,
    onAttachPhoto: () -> Unit
) {
    val revision by model.revision.collectAsState()
    val now by model.nowTick.collectAsState()
    val selectedIds by model.selectedBabyIds.collectAsState()
    val babies = remember(revision) { model.activeBabies }
    val primary = remember(revision, selectedIds) { model.primaryBaby }
    val derived = remember(revision, primary) { model.derived(primary.id) }
    val duty = remember(revision) { derived.duty }
    val openTimed = remember(revision, primary) { model.service.openTimedActivities(primary.id) }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(20.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Multi-child selector bar
            if (babies.size > 1) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val allSelected = selectedIds.size == babies.size
                    FilterChip(
                        selected = allSelected,
                        onClick = { model.selectAllBabies() },
                        label = { Text("Everyone") }
                    )
                    babies.forEach { b ->
                        val isSel = b.id in selectedIds && !allSelected
                        FilterChip(
                            selected = isSel,
                            onClick = { model.selectOnlyBaby(b.id) },
                            label = { Text(b.name) }
                        )
                    }
                }
            }

            // Per-child status rows
            model.shownBabies.forEach { b ->
                val line = model.statusLine(b.id, now)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f))
                        .clickable { model.selectOnlyBaby(b.id) }
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(12.dp)
                            .clip(CircleShape)
                            .background(WeeColors.childColor(b.color))
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = b.name,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = line,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconButton(onClick = { model.voice.speak("${b.name}. $line") }) {
                        Icon(
                            imageVector = Icons.Default.NotificationsActive,
                            contentDescription = "Read Status Aloud",
                            tint = WeeColors.Amber
                        )
                    }
                }
            }

            // Open timed activities (Tummy time, skin-to-skin, crying)
            openTimed.forEach { (cat, startEv) ->
                val elapsedMin = max(0L, (now.time - startEv.occurredAt.time) / 60_000L)
                val elapsedSec = max(0L, ((now.time - startEv.occurredAt.time) / 1_000L) % 60L)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(WeeColors.CareCoral.copy(alpha = 0.15f))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${cat.replace('_', ' ').replaceFirstChar { it.uppercase() }} in progress · ${elapsedMin}m ${elapsedSec}s",
                        fontWeight = FontWeight.SemiBold,
                        color = WeeColors.CareCoral
                    )
                    Button(
                        onClick = { model.stopTimedActivity(cat, babyId = primary.id) },
                        colors = ButtonDefaults.buttonColors(containerColor = WeeColors.CareCoral)
                    ) {
                        Icon(Icons.Default.Stop, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Finish")
                    }
                }
            }

            // On-duty caregiver handoff row + Attach Photo to last entry
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val caregivers = model.household.caregivers
                val onDutyName = model.household.caregiverName(duty?.caregiver)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.clickable {
                        val nextCg = if (caregivers.isEmpty()) {
                            null
                        } else {
                            val idx = caregivers.indexOfFirst { it.id == duty?.caregiver }
                            caregivers.getOrNull((idx + 1) % caregivers.size)?.id
                        }
                        model.toggleDuty(nextCg)
                    }
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        tint = WeeColors.Amber,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = "On duty: $onDutyName (tap to switch)",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium
                    )
                }

                if (derived.counted.isNotEmpty()) {
                    TextButton(onClick = onAttachPhoto) {
                        Icon(Icons.Default.AddAPhoto, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Add Photo")
                    }
                }
            }
        }
    }
}

@Composable
private fun PartnerPulseBanner(model: AppModel) {
    val pulse by model.partnerActivity.collectAsState()
    val act = pulse ?: return
    val caregiverName = model.household.caregiverName(act.caregiver)
    Card(
        colors = CardDefaults.cardColors(containerColor = WeeColors.Amber.copy(alpha = 0.16f)),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(WeeColors.Amber)
            )
            Text(
                text = "$caregiverName just logged: ${act.kind}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun NeedsDetailsAndReviewSection(model: AppModel) {
    val revision by model.revision.collectAsState()
    val pendingCaptures = remember(revision) { model.service.pendingCaptures() }
    val duplicates = remember(revision) { model.service.derived(baby = null).duplicates }
    val needsDetails = remember(revision) { model.service.needsDetailsEvents(baby = model.primaryBaby.id) }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (pendingCaptures.isNotEmpty() || duplicates.isNotEmpty()) {
            Card(
                colors = CardDefaults.cardColors(containerColor = WeeColors.Amber.copy(alpha = 0.18f)),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { model.openReviewSheet() }
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${pendingCaptures.size + duplicates.size} item(s) waiting for review",
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Tap to confirm voice captures or resolve duplicates",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Button(onClick = { model.openReviewSheet() }) {
                        Text("Review")
                    }
                }
            }
        }

        needsDetails.take(3).forEach { ev ->
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Fill in details · ${model.service.describe(ev)}",
                        fontWeight = FontWeight.SemiBold
                    )
                    if (ev.type.startsWith("diaper.")) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("wet" to "Wet", "dirty" to "Dirty", "both" to "Both").forEach { (k, label) ->
                                OutlinedButton(
                                    onClick = {
                                        model.fillEventDetails(
                                            original = ev,
                                            updatedType = "diaper.$k",
                                            extraFields = emptyMap()
                                        )
                                    }
                                ) {
                                    Text(label)
                                }
                            }
                        }
                    } else {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(60.0, 90.0, 120.0, 150.0).forEach { ml ->
                                OutlinedButton(
                                    onClick = {
                                        model.fillEventDetails(
                                            original = ev,
                                            extraFields = mapOf("consumed_ml" to FieldValue.Num(ml))
                                        )
                                    }
                                ) {
                                    Text("${ml.toInt()} ml")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShiftNoteCard(model: AppModel) {
    val revision by model.revision.collectAsState()
    val currentNote = remember(revision) { model.derived( null).shiftNote ?: "" }
    var editing by remember { mutableStateOf(false) }
    var draft by remember(currentNote) { mutableStateOf(currentNote) }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth()
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
                Text("Shift Handoff Note", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                IconButton(onClick = { editing = !editing }) {
                    Icon(if (editing) Icons.Default.Close else Icons.Default.Edit, contentDescription = "Edit Note")
                }
            }

            if (editing) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    label = { Text("Pinned note for the next shift (e.g. Vitamin D given, fussy after 2pm)") },
                    modifier = Modifier.fillMaxWidth()
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(
                        onClick = {
                            model.saveShiftNote("")
                            draft = ""
                            editing = false
                        }
                    ) {
                        Text("Clear")
                    }
                    Button(
                        onClick = {
                            model.saveShiftNote(draft)
                            editing = false
                        }
                    ) {
                        Text("Save Note")
                    }
                }
            } else {
                Text(
                    text = currentNote.ifBlank { "No handoff note pinned — tap edit to leave a note for your partner." },
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (currentNote.isBlank()) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

@Composable
private fun RhythmCompareCard(model: AppModel) {
    val revision by model.revision.collectAsState()
    val now by model.nowTick.collectAsState()
    val baby = remember(revision, now) { model.primaryBaby }
    val derived = remember(revision, baby) { model.derived(baby.id) }

    val stats = remember(revision, now) {
        val cal = Calendar.getInstance().apply { time = now }
        val startOfToday = (cal.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.time

        val todayEvents = derived.counted.filter { !it.occurredAt.before(startOfToday) && !it.occurredAt.after(now) }
        val todayFeeds = todayEvents.count { it.type.startsWith("feed.") && !it.type.endsWith(".start") && !it.type.endsWith(".switch") }
        val todayMl = todayEvents.mapNotNull { model.household.milliliters(it) }.sum()
        val todayDiapers = todayEvents.count { it.type.startsWith("diaper.") }
        val todaySleepHrs = derived.sessions
            .filter { it.kind == com.hejitech.weehours.core.Session.Kind.SLEEP && (it.start?.after(startOfToday) == true) }
            .mapNotNull { it.duration }
            .sum() / 3600.0

        Triple(todayFeeds to todayMl, todayDiapers, todaySleepHrs)
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Today's Rhythm · ${baby.name}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                RhythmMetricColumn(
                    label = "Feeds",
                    value = "${stats.first.first}",
                    sub = if (stats.first.second > 0) model.formatVolume(stats.first.second) else "logged today",
                    color = WeeColors.FeedOrange
                )
                RhythmMetricColumn(
                    label = "Sleep",
                    value = String.format(Locale.US, "%.1fh", stats.third),
                    sub = "total today",
                    color = WeeColors.SleepBlue
                )
                RhythmMetricColumn(
                    label = "Diapers",
                    value = "${stats.second}",
                    sub = "changes today",
                    color = WeeColors.DiaperGreen
                )
            }
        }
    }
}

@Composable
private fun RhythmMetricColumn(label: String, value: String, sub: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text = value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = color)
        Text(text = sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun PregnancySectionCard(model: AppModel) {
    val baby = model.primaryBaby
    val now by model.nowTick.collectAsState()
    var kickTimerStart by remember { mutableStateOf<Date?>(null) }
    var kickCount by remember { mutableIntStateOf(0) }

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
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Favorite, contentDescription = null, tint = WeeColors.PregnancyPlum)
                Text("Pregnancy & Kick Counter", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }

            if (kickTimerStart == null) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { model.logMovement(babyId = baby.id) },
                        colors = ButtonDefaults.buttonColors(containerColor = WeeColors.PregnancyPlum),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Felt a Kick")
                    }
                    OutlinedButton(
                        onClick = {
                            kickTimerStart = Date()
                            kickCount = 1
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Start 10-Kick Count")
                    }
                }
            } else {
                val elapsedMin = max(1, ((now.time - (kickTimerStart?.time ?: now.time)) / 60_000L).toInt())
                LinearProgressIndicator(
                    progress = { (kickCount / 10f).coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth(),
                    color = WeeColors.PregnancyPlum
                )
                Text("Kick $kickCount of 10 · ${elapsedMin}m elapsed", fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            val next = kickCount + 1
                            if (next >= 10) {
                                model.logKickSession(
                                    kicks = next,
                                    durationMinutes = elapsedMin,
                                    startedAt = kickTimerStart,
                                    babyId = baby.id
                                )
                                kickTimerStart = null
                                kickCount = 0
                            } else {
                                kickCount = next
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = WeeColors.PregnancyPlum),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("+1 Kick (${kickCount}/10)")
                    }
                    OutlinedButton(
                        onClick = {
                            if (kickCount > 0) {
                                model.logKickSession(
                                    kicks = kickCount,
                                    durationMinutes = elapsedMin,
                                    startedAt = kickTimerStart,
                                    babyId = baby.id
                                )
                            }
                            kickTimerStart = null
                            kickCount = 0
                        }
                    ) {
                        Text("Save & Stop")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CareActivitiesSectionCard(
    model: AppModel,
    onOpenCareSheet: (String) -> Unit
) {
    val baby = model.primaryBaby
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
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.MedicalServices, contentDescription = null, tint = WeeColors.CareCoral)
                Text("Care, Health & Timed Activities", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                AssistChip(
                    onClick = { model.logCare("vitamin_d", babyId = baby.id) },
                    label = { Text("☀️ Vitamin D (1-tap)") }
                )
                AssistChip(
                    onClick = { model.startTimedActivity("tummy_time", baby.id) },
                    label = { Text("⏱️ Start Tummy Time") }
                )
                AssistChip(
                    onClick = { model.startTimedActivity("skin_to_skin", baby.id) },
                    label = { Text("🤱 Start Skin-to-Skin") }
                )
                AssistChip(
                    onClick = { onOpenCareSheet("temperature") },
                    label = { Text("🌡️ Temperature") }
                )
                AssistChip(
                    onClick = { onOpenCareSheet("medicine") },
                    label = { Text("💊 Medicine") }
                )
                AssistChip(
                    onClick = { onOpenCareSheet("bath") },
                    label = { Text("🛁 Bath") }
                )
                AssistChip(
                    onClick = { onOpenCareSheet("milestone") },
                    label = { Text("⭐ Milestone") }
                )
            }
        }
    }
}

@Composable
private fun MilkStashSectionCard(model: AppModel) {
    val revision by model.revision.collectAsState()
    val now by model.nowTick.collectAsState()
    val stash = remember(revision, now) { model.milkStash(now) }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Kitchen, contentDescription = null, tint = WeeColors.PumpTeal)
                Text("Milk Stash (FIFO)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Fridge: ${model.formatVolume(stash.fridgeMl)} (${stash.fridgeLots} bags)")
                Text("Freezer: ${model.formatVolume(stash.freezerMl)} (${stash.freezerBags} bags)")
            }

            val nextBag = stash.batches.firstOrNull()
            if (nextBag != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Use First: ${model.formatVolume(nextBag.ml)} (${nextBag.location})",
                            fontWeight = FontWeight.SemiBold
                        )
                        val daysLeft = max(0.0, (nextBag.expiresAt.time - now.time) / 86_400_000.0)
                        Text(
                            text = String.format(Locale.US, "Expires in %.1f days", daysLeft),
                            style = MaterialTheme.typography.bodySmall,
                            color = if (nextBag.isExpiringSoon || nextBag.isExpired) WeeColors.Crimson else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    OutlinedButton(onClick = { model.quickBottle(ml = nextBag.ml, babyId = model.primaryBaby.id) }) {
                        Text("Use Bag")
                    }
                }
            }
        }
    }
}

@Composable
private fun GrowthSummaryCard(
    model: AppModel,
    onOpenGrowthSheet: () -> Unit
) {
    val revision by model.revision.collectAsState()
    val baby = remember(revision) { model.primaryBaby }
    val latestGrowth = remember(revision, baby) {
        model.derived(baby.id).counted.lastOrNull { it.type == "growth.measurement" }
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Default.Straighten, contentDescription = null, tint = WeeColors.GrowthPurple)
                    Text("Growth & WHO Percentiles", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                }
                Text(
                    text = latestGrowth?.let { model.service.describe(it) } ?: "No growth measurements logged yet",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            OutlinedButton(onClick = onOpenGrowthSheet) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("Measure")
            }
        }
    }
}

@Composable
private fun OngoingPhotosSectionCard(
    model: AppModel,
    onPickPhoto: () -> Unit
) {
    val revision by model.revision.collectAsState()
    val photos = remember(revision) { model.derived(model.primaryBaby.id).allPhotos.takeLast(8).reversed() }

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
                Text("Recent Moment Photos", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                TextButton(onClick = onPickPhoto) {
                    Icon(Icons.Default.AddAPhoto, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Attach")
                }
            }

            if (photos.isEmpty()) {
                Text(
                    text = "Attach a photo to any feed, milestone, or diaper entry to keep a visual journal.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(photos, key = { it.id }) { p ->
                        val file = model.localPhotoFile(p)
                        val bmp = remember(file.absolutePath, file.exists()) {
                            if (file.exists()) BitmapFactory.decodeFile(file.absolutePath) else null
                        }
                        Box(
                            modifier = Modifier
                                .size(84.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center
                        ) {
                            if (bmp != null) {
                                Image(
                                    bitmap = bmp.asImageBitmap(),
                                    contentDescription = "Entry photo",
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                Icon(Icons.Default.AddAPhoto, contentDescription = null)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShiftDigestSectionCard(model: AppModel) {
    val revision by model.revision.collectAsState()
    val now by model.nowTick.collectAsState()
    val summary = remember(revision, now) { model.shiftSummary(now) }

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(18.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text("Current Shift Digest", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            if (summary == null) {
                Text(
                    text = "No shift handoff active yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            } else {
                val sleepHrs = String.format(Locale.US, "%.1fh", summary.sleepSeconds / 3600.0)
                Text(
                    text = "Feeds: ${summary.feedCount} (${model.formatVolume(summary.bottleMl)}) · Diapers: ${summary.wetDiapers + summary.dirtyDiapers} · Sleep: $sleepHrs",
                    style = MaterialTheme.typography.bodyMedium
                )
                if (summary.medications.isNotEmpty() || summary.notes.isNotEmpty()) {
                    (summary.medications + summary.notes).forEach { b ->
                        Text(
                            text = "• $b",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DoctorVisitSheet(model: AppModel, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val pack = remember { model.doctorVisitPack() }
    val markdown = remember(pack) { pack.plainTextSummary(model.primaryBaby.name, model.household) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Pediatrician Visit Pack", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                IconButton(
                    onClick = {
                        val send = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, "Wee Hours Summary · ${model.primaryBaby.name}")
                            putExtra(Intent.EXTRA_TEXT, markdown)
                        }
                        context.startActivity(Intent.createChooser(send, "Share Doctor Visit Pack"))
                    }
                ) {
                    Icon(Icons.Default.Share, contentDescription = "Share")
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = markdown,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(14.dp)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NowCustomizeSheet(model: AppModel, onDismiss: () -> Unit) {
    val layout by model.nowLayout.collectAsState()

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Customize Now Screen", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                TextButton(onClick = { model.updateNowLayout(NowLayout()) }) {
                    Text("Reset")
                }
            }

            Text("Active Sections", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            layout.active.forEachIndexed { index, section ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(section.title, fontWeight = FontWeight.SemiBold)
                            Text(section.subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Row {
                            IconButton(
                                onClick = { model.updateNowLayout(layout.moveUp(section)) },
                                enabled = index > 0
                            ) {
                                Icon(Icons.Default.ArrowUpward, contentDescription = "Move Up")
                            }
                            IconButton(
                                onClick = { model.updateNowLayout(layout.moveDown(section)) },
                                enabled = index < layout.active.lastIndex
                            ) {
                                Icon(Icons.Default.ArrowDownward, contentDescription = "Move Down")
                            }
                            if (section != NowSection.STATUS && section != NowSection.TILES) {
                                IconButton(onClick = { model.updateNowLayout(layout.remove(section)) }) {
                                    Icon(Icons.Default.Close, contentDescription = "Hide")
                                }
                            }
                        }
                    }
                }
            }

            if (layout.available.isNotEmpty()) {
                HorizontalDivider()
                Text("Hidden Sections (tap to add)", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                layout.available.forEach { section ->
                    OutlinedButton(
                        onClick = { model.updateNowLayout(layout.add(section)) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text(section.title)
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
