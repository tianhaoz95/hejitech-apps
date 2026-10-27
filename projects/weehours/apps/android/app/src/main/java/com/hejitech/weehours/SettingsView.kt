package com.hejitech.weehours

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.BugReport
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.Watch
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.weehours.core.Baby
import com.hejitech.weehours.core.EventRegistry
import com.hejitech.weehours.core.TiltCompass

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsView(model: AppModel) {
    val context = LocalContext.current
    val revision by model.revision.collectAsState()
    val thumbZone by model.thumbZone.collectAsState()
    val useFlOz by model.useFluidOz.collectAsState()
    val quickCapture by model.quickCapture.collectAsState()
    val speechLocale by model.speechLocale.collectAsState()
    val layaEndpoint by model.layaEndpoint.collectAsState()
    val inviteCode by model.inviteCode.collectAsState()
    val glassesCode by model.glassesCode.collectAsState()
    val accessTokens by model.accessTokens.collectAsState()

    val household = remember(revision) { model.household }

    var editingChild by remember { mutableStateOf<Baby?>(null) }
    var addingChild by remember { mutableStateOf(false) }
    var showWatchSheet by remember { mutableStateOf(false) }
    var showGlassesSheet by remember { mutableStateOf(false) }
    var showFeedbackSheet by remember { mutableStateOf(false) }
    var showMcpSheet by remember { mutableStateOf(false) }
    var showPassSheet by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 110.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item(key = "title") {
            Text(
                text = "Settings",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        }

        // 1. Children Management
        item(key = "children") {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Children", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        TextButton(onClick = { addingChild = true }) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Add Child")
                        }
                    }

                    household.babies.forEach { baby ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                                .clickable { editingChild = baby }
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(14.dp)
                                        .clip(CircleShape)
                                        .background(WeeColors.childColor(baby.color))
                                )
                                Column {
                                    Text(baby.name, fontWeight = FontWeight.SemiBold)
                                    val sub = when {
                                        baby.archived -> "Archived"
                                        baby.isExpected -> "Expecting"
                                        else -> "${(baby.bottleMl ?: household.bottleMl).toInt()} ml · ${baby.defaultFeed ?: household.defaultFeed}"
                                    }
                                    Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            Text("Edit", color = WeeColors.Amber, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
        }

        // 2. Household Sharing, Invite Code & Caregiver Pass
        item(key = "household_sharing") {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Household & Caregiver Sharing", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(
                        text = "${household.name} · ${household.caregivers.size.coerceAtLeast(1)} caregiver(s)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { model.generateInviteCode() },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Invite Partner")
                        }
                        OutlinedButton(
                            onClick = {
                                model.generateCaregiverPass()
                                showPassSheet = true
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.QrCode, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Caregiver Pass")
                        }
                    }

                    if (!inviteCode.isNullOrBlank()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Partner Invite Code", style = MaterialTheme.typography.labelSmall)
                                Text(inviteCode ?: "", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                            }
                            IconButton(
                                onClick = {
                                    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                                    cm?.setPrimaryClip(ClipData.newPlainText("Wee Hours Invite", inviteCode))
                                }
                            ) {
                                Icon(Icons.Default.ContentCopy, contentDescription = "Copy")
                            }
                        }
                    }
                }
            }
        }

        // 3. Companion Surfaces: Wear OS Watch, Even G2 Smart Glasses, MCP Agents
        item(key = "surfaces") {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Wearables & AI Agents", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                    OutlinedButton(
                        onClick = { showWatchSheet = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Watch, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Wear OS Watch & Tilt Compass")
                    }

                    OutlinedButton(
                        onClick = {
                            model.generateGlassesPairingCode()
                            showGlassesSheet = true
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Visibility, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Even G2 Smart Glasses Pairing")
                    }

                    OutlinedButton(
                        onClick = {
                            model.refreshAccessTokens()
                            showMcpSheet = true
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Key, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("MCP / AI Agent Access Tokens (${accessTokens.size})")
                    }
                }
            }
        }

        // 4. Tracked Categories & Milk Stash
        item(key = "tracking") {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Tracked Categories", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        EventRegistry.shared.categories.forEach { cat ->
                            val enabled = cat.id in household.categories
                            FilterChip(
                                selected = enabled,
                                onClick = {
                                    val nextCats = if (enabled) {
                                        household.categories.filter { it != cat.id }
                                    } else {
                                        household.categories + cat.id
                                    }
                                    model.saveHousehold(household.copy(categories = nextCats))
                                },
                                label = { Text(cat.label) }
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Track Milk Stash (FIFO Fridge & Freezer)", fontWeight = FontWeight.Medium)
                            Text("Shows FIFO breastmilk bag inventory on Now", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(
                            checked = household.trackMilkStash,
                            onCheckedChange = { model.saveHousehold(household.copy(trackMilkStash = it)) }
                        )
                    }
                }
            }
        }

        // 5. Smart Reminders
        item(key = "reminders") {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Smart Reminders", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    val rem = household.reminders

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Adaptive Feed Rhythm", fontWeight = FontWeight.Medium)
                            Text("Learns median daytime feed spacing from last 3 days", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(
                            checked = rem.adaptive,
                            onCheckedChange = {
                                model.saveHousehold(household.copy(reminders = rem.copy(adaptive = it)))
                            }
                        )
                    }

                    Text("Feed Reminder Interval:", style = MaterialTheme.typography.labelLarge)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(null to "Off", 120 to "Every 2h", 150 to "2.5h", 180 to "Every 3h", 240 to "Every 4h").forEach { (mins, label) ->
                            FilterChip(
                                selected = rem.feedEveryMinutes == mins,
                                onClick = {
                                    model.saveHousehold(household.copy(reminders = rem.copy(feedEveryMinutes = mins)))
                                },
                                label = { Text(label) }
                            )
                        }
                    }

                    Text("Diaper Check Interval:", style = MaterialTheme.typography.labelLarge)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(null to "Off", 120 to "Every 2h", 180 to "Every 3h", 240 to "Every 4h").forEach { (mins, label) ->
                            FilterChip(
                                selected = rem.diaperEveryMinutes == mins,
                                onClick = {
                                    model.saveHousehold(household.copy(reminders = rem.copy(diaperEveryMinutes = mins)))
                                },
                                label = { Text(label) }
                            )
                        }
                    }
                }
            }
        }

        // 6. Voice, Laya AI & Ergonomics
        item(key = "voice_and_display") {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Voice, Units & One-Handed Ergonomics", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                    Text("Voice Recognition Language:", style = MaterialTheme.typography.labelLarge)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(
                            "auto" to "Auto (Bilingual)",
                            "en" to "English",
                            "zh-Hans" to "中文 (简体)",
                            "zh-Hant" to "中文 (繁體)"
                        ).forEach { (loc, label) ->
                            FilterChip(
                                selected = speechLocale == loc,
                                onClick = { model.setSpeechLocale(loc) },
                                label = { Text(label) }
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Quick Capture (Commit immediately)", fontWeight = FontWeight.Medium)
                            Text("Commit best voice guess immediately without review", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(checked = quickCapture, onCheckedChange = { model.setQuickCapture(it) })
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("One-Handed Thumb Dock", fontWeight = FontWeight.Medium)
                            Text("Keep Feed, Diaper, Sleep & Speak within thumb reach", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Switch(checked = thumbZone, onCheckedChange = { model.setThumbZone(it) })
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Display Volume in fl oz (instead of ml)", fontWeight = FontWeight.Medium)
                        Switch(checked = useFlOz, onCheckedChange = { model.setUseFluidOz(it) })
                    }

                    OutlinedTextField(
                        value = layaEndpoint,
                        onValueChange = { model.setLayaEndpoint(it) },
                        label = { Text("Laya SystemOne Endpoint URL (optional)") },
                        placeholder = { Text("Leave blank for built-in bilingual keyword parser") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            }
        }

        // 7. Data Export, What's New, Feedback & Account
        item(key = "export_and_account") {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Data, Support & Account", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                    OutlinedButton(
                        onClick = {
                            val csvFile = model.exportCsvFile()
                            val uri = FileProvider.getUriForFile(
                                context,
                                "${context.packageName}.fileprovider",
                                csvFile
                            )
                            val share = Intent(Intent.ACTION_SEND).apply {
                                type = "text/csv"
                                putExtra(Intent.EXTRA_STREAM, uri)
                                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            context.startActivity(Intent.createChooser(share, "Export Wee Hours CSV"))
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Download, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Export Full Log as CSV")
                    }

                    OutlinedButton(
                        onClick = { model.openWhatsNew() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.NewReleases, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("What's New in Wee Hours v${AppModel.CURRENT_VERSION}")
                    }

                    OutlinedButton(
                        onClick = { showFeedbackSheet = true },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.BugReport, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Send Feedback / Report Bug")
                    }

                    if (model.supabase.session != null) {
                        HorizontalDivider()
                        Text(
                            text = "Signed in as ${model.supabase.session?.email ?: "Authenticated User"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        TextButton(
                            onClick = { model.signOut() },
                            colors = ButtonDefaults.textButtonColors(contentColor = WeeColors.Crimson)
                        ) {
                            Text("Sign Out")
                        }
                    }
                }
            }
        }
    }

    if (addingChild) {
        ChildEditorSheet(
            initial = null,
            canDelete = false,
            onDismiss = { addingChild = false },
            onSave = { model.saveBaby(it) }
        )
    }

    editingChild?.let { child ->
        ChildEditorSheet(
            initial = child,
            canDelete = household.babies.size > 1,
            onDismiss = { editingChild = null },
            onSave = { model.saveBaby(it) },
            onDelete = { model.deleteBaby(it) }
        )
    }

    if (showWatchSheet) {
        WatchSettingsSheet(model = model, onDismiss = { showWatchSheet = false })
    }
    if (showGlassesSheet) {
        GlassesSettingsSheet(model = model, onDismiss = { showGlassesSheet = false })
    }
    if (showMcpSheet) {
        McpTokensSheet(model = model, onDismiss = { showMcpSheet = false })
    }
    if (showPassSheet) {
        CaregiverPassSheet(model = model, onDismiss = { showPassSheet = false })
    }
    if (showFeedbackSheet) {
        FeedbackSheet(
            onDismiss = { showFeedbackSheet = false },
            onSubmitted = { ok ->
                // Toast handled by caller
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun WatchSettingsSheet(model: AppModel, onDismiss: () -> Unit) {
    val pinned by model.watchPinnedCategories.collectAsState()
    val compassSlots by model.watchCompassSlots.collectAsState()
    val choices = remember {
        listOf("feed", "diaper", "sleep", "vitamin_d", "tummy_time", "bath", "medicine", "temperature")
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text("Wear OS Watch & Tilt Compass", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(
                text = "Customize which care buttons appear on your Wear OS watch and what each 4-way wrist tilt logs in Tilt Mode.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text("Pinned Watch Care Buttons:", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                listOf("bath", "tummy_time", "skin_to_skin", "vitamin_d", "medicine", "temperature", "crying").forEach { cat ->
                    val isPinned = cat in pinned
                    FilterChip(
                        selected = isPinned,
                        onClick = {
                            val next = if (isPinned) pinned.filter { it != cat } else pinned + cat
                            model.updateWatchPinned(next)
                        },
                        label = { Text(cat.replace('_', ' ').replaceFirstChar { it.uppercase() }) }
                    )
                }
            }

            HorizontalDivider()
            Text("Tilt Compass 4-Way Assignments:", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)

            TiltCompass.Direction.entries.forEach { dir ->
                val currentSlot = compassSlots[dir.rawValue]
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("${dir.rawValue.uppercase()} (${dir.gesture}): ${currentSlot?.label ?: dir.rawValue}", fontWeight = FontWeight.Medium)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        choices.forEach { choice ->
                            FilterChip(
                                selected = currentSlot?.action == choice,
                                onClick = {
                                    model.updateWatchCompassSlot(
                                        dir,
                                        CompassSlot(
                                            direction = dir.rawValue,
                                            action = choice,
                                            type = choice,
                                            label = choice.replace('_', ' ').replaceFirstChar { it.uppercase() },
                                            icon = choice
                                        )
                                    )
                                },
                                label = { Text(choice.replace('_', ' ')) }
                            )
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlassesSettingsSheet(model: AppModel, onDismiss: () -> Unit) {
    val code by model.glassesCode.collectAsState()

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Pair Even G2 Smart Glasses", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(
                text = "Open the Wee Hours plugin in Even Hub on your phone and enter this 6-digit pairing code:",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(vertical = 24.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = code?.code ?: "------",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 36.sp,
                    fontWeight = FontWeight.Bold,
                    color = WeeColors.Amber
                )
            }

            Button(onClick = { model.generateGlassesPairingCode() }) {
                Text("Generate New Code")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun McpTokensSheet(model: AppModel, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val tokens by model.accessTokens.collectAsState()
    var tokenName by remember { mutableStateOf("Claude Desktop") }
    var newlyMinted by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("MCP & AI Agent Access Tokens", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(
                text = "Connect Claude, ChatGPT, or any MCP client to your Wee Hours household log.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = tokenName,
                    onValueChange = { tokenName = it },
                    label = { Text("Token Name") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                Button(
                    onClick = {
                        model.mintAccessToken(tokenName) { raw ->
                            newlyMinted = raw
                        }
                    }
                ) {
                    Text("Create")
                }
            }

            if (newlyMinted != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = WeeColors.Amber.copy(alpha = 0.16f)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Copy your new token now (shown once):", style = MaterialTheme.typography.labelSmall)
                            Text(newlyMinted ?: "", fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                        }
                        IconButton(
                            onClick = {
                                val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                                cm?.setPrimaryClip(ClipData.newPlainText("Wee Hours Token", newlyMinted))
                            }
                        ) {
                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy")
                        }
                    }
                }
            }

            tokens.forEach { t ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(t.name, fontWeight = FontWeight.SemiBold)
                        Text("Scope: ${t.scope}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = { model.revokeAccessToken(t.id) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Revoke", tint = WeeColors.Crimson)
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CaregiverPassSheet(model: AppModel, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val passToken by model.caregiverPass.collectAsState()

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Temporary Caregiver Pass", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(
                text = "Share this pass with a grandparent, nanny, or babysitter so they can log feeds and diapers without creating an account.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = passToken ?: "Generating…",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Button(
                onClick = {
                    val link = "weehours://pass?token=${passToken ?: ""}"
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "Join ${model.household.name} on Wee Hours with Caregiver Pass: $passToken ($link)")
                    }
                    context.startActivity(Intent.createChooser(send, "Share Caregiver Pass"))
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Share, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Share Pass")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WhatsNewSheet(onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("What's New in Wee Hours ${AppModel.CURRENT_VERSION}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            listOf(
                "Wear OS Companion & 4-Way Tilt Compass" to "Log feeds, diapers, and sleep eyes-free on your wrist with a 1-second tilt gesture or 1-tap buttons.",
                "Bilingual Voice Capture (English & Chinese)" to "Speak naturally in English or Mandarin — Wee Hours parses relative times, volumes, sides, and multi-child names.",
                "Customizable Now Screen & Rhythm Compare" to "Compare today's feeds, sleep, and diapers with your 7-day rhythm and arrange sections in any order.",
                "Zero-Blue-Light Night HUD & One-Handed Thumb Dock" to "Designed for 3 a.m. feeds without waking your eyes or needing two hands."
            ).forEach { (title, desc) ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(title, fontWeight = FontWeight.Bold)
                        Text(desc, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = WeeColors.Amber)
            ) {
                Text("Got It")
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
