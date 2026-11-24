package com.hejitech.g2digest.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.Warning
import com.hejitech.g2digest.core.BriefValidator
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    private val vm: G2DigestViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BuildConfig.DEBUG && intent?.getBooleanExtra("autoSignIn", false) == true) {
            vm.signInSeedLocal()
        }
        intent?.data?.let { vm.handleAuthCallback(it) }
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF4ADE80),
                    secondary = Color(0xFF86EFAC),
                ),
            ) {
                G2DigestRoot(vm)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.data?.let { vm.handleAuthCallback(it) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun G2DigestRoot(vm: G2DigestViewModel) {
    val ui by vm.ui.collectAsState()
    val ctx = LocalContext.current

    if (ui.showWhatsNew) {
        AlertDialog(
            onDismissRequest = vm::dismissWhatsNew,
            title = { Text("What's New in G2 Digest ${G2DigestViewModel.CURRENT_VERSION}") },
            text = {
                Text("G2 Digest for Android: read your compiled morning cards, full editions, and G2 HUD preview, listen to continuous glance and deep-dive audio, search your archive, bookmark cards, and monitor build agent diagnostics.")
            },
            confirmButton = { Button(onClick = vm::dismissWhatsNew) { Text("Continue") } },
        )
    }

    if (!ui.signedIn && !ui.paired) {
        SignInScreen(
            ui = ui,
            onGoogle = {
                val url = vm.startGoogleSignIn()
                CustomTabsIntent.Builder().build().launchUrl(ctx, Uri.parse(url))
            },
            onPair = vm::pairWithCode,
            onSeedLocal = vm::signInSeedLocal,
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(ui.edition?.title ?: "G2 Digest", maxLines = 1) },
                actions = {
                    IconButton(onClick = vm::bookmarkCurrentCard) { Icon(Icons.Default.Bookmark, "Bookmark") }
                    if (ui.signedIn) {
                        IconButton(onClick = vm::createShareLink) { Icon(Icons.Default.Share, "Share") }
                    }
                    IconButton(onClick = vm::refreshAll) { Icon(Icons.Default.Refresh, "Refresh") }
                },
            )
        },
        bottomBar = {
            Column {
                if (ui.playingTitle != null) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.Headphones, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Text(
                            ui.playingTitle ?: "",
                            modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                            maxLines = 1,
                            fontWeight = FontWeight.SemiBold,
                        )
                        TextButton(onClick = vm::cyclePlaybackRate) { Text("${ui.playbackRate}×", fontSize = 12.sp) }
                        IconButton(onClick = vm::togglePlayPause) {
                            Icon(if (ui.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow, "Play or pause")
                        }
                        IconButton(onClick = vm::nextAudio) { Icon(Icons.Default.SkipNext, "Next card") }
                        IconButton(onClick = vm::stopAudio) { Icon(Icons.Default.Stop, "Stop audio") }
                    }
                }
                NavigationBar {
                    NavigationBarItem(selected = ui.tab == AppTab.READ, onClick = { vm.selectTab(AppTab.READ) }, icon = { Icon(Icons.Default.Newspaper, null) }, label = { Text("Read") })
                    if (ui.signedIn) {
                        NavigationBarItem(selected = ui.tab == AppTab.BRIEF, onClick = { vm.selectTab(AppTab.BRIEF) }, icon = { Icon(Icons.Default.EditNote, null) }, label = { Text("Brief") })
                    }
                    NavigationBarItem(selected = ui.tab == AppTab.ARCHIVE, onClick = { vm.selectTab(AppTab.ARCHIVE) }, icon = { Icon(Icons.Default.History, null) }, label = { Text("Archive") })
                    NavigationBarItem(selected = ui.tab == AppTab.AGENTS, onClick = { vm.selectTab(AppTab.AGENTS) }, icon = { Icon(Icons.Default.Build, null) }, label = { Text("Agents") })
                    NavigationBarItem(selected = ui.tab == AppTab.SETTINGS, onClick = { vm.selectTab(AppTab.SETTINGS) }, icon = { Icon(Icons.Default.Settings, null) }, label = { Text("Settings") })
                }
            }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .consumeWindowInsets(padding)
                .padding(16.dp),
        ) {
            ui.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 8.dp)) }
            ui.statusBanner?.let { Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 8.dp)) }
            ui.shareUrl?.let { Text("Share link: $it", fontSize = 12.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.padding(bottom = 8.dp)) }

            when (ui.tab) {
                AppTab.READ -> ReadTab(ui, vm)
                AppTab.BRIEF -> BriefTab(ui, vm)
                AppTab.ARCHIVE -> ArchiveTab(ui, vm)
                AppTab.AGENTS -> AgentsTab(ui, vm)
                AppTab.SETTINGS -> SettingsTab(ui, vm)
            }
        }
    }
}

@Composable
private fun SignInScreen(ui: UiState, onGoogle: () -> Unit, onPair: (String) -> Unit, onSeedLocal: () -> Unit) {
    var code by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("G2 Digest", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text("Glanceable cards for Even G2 glasses and audio for headphones.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(24.dp))
        Button(onClick = onGoogle, modifier = Modifier.fillMaxWidth()) { Text("Continue with Google") }
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(value = code, onValueChange = { code = it }, label = { Text("Or enter 6-digit pairing code") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = { onPair(code) }, enabled = code.filter(Char::isDigit).length == 6, modifier = Modifier.fillMaxWidth()) { Text("Pair Reader") }
        if (BuildConfig.DEBUG) {
            Spacer(Modifier.height(16.dp))
            TextButton(onClick = onSeedLocal) { Text("Debug: Sign in to local stack") }
        }
        ui.error?.let { Spacer(Modifier.height(12.dp)); Text(it, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun ReadTab(ui: UiState, vm: G2DigestViewModel) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        ReaderMode.entries.forEach { m ->
            FilterChip(selected = ui.readerMode == m, onClick = { vm.selectReaderMode(m) }, label = { Text(m.label, maxLines = 1, softWrap = false) })
        }
    }
    Spacer(Modifier.height(8.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = { vm.playAll(deepDive = false) }) { Text("Play All Glances") }
        OutlinedButton(onClick = { vm.playAll(deepDive = true) }) { Text("Play Deep Dives") }
    }
    Spacer(Modifier.height(12.dp))
    val ed = ui.edition
    if (ed == null) {
        Text("No edition loaded yet. Tap refresh or connect your build agent.")
        return
    }
    when (ui.readerMode) {
        ReaderMode.CARDS -> {
            val cards = ed.bundle.cards
            val card = cards.getOrNull(ui.cardIndex)
            if (card != null) {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("${ui.cardIndex + 1} / ${cards.size} · ${card.kind.uppercase()}", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.height(6.dp))
                        Text(card.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(8.dp))
                        Text(card.body, style = MaterialTheme.typography.bodyLarge)
                    }
                }
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    OutlinedButton(onClick = { vm.selectCard(ui.cardIndex - 1) }, enabled = ui.cardIndex > 0) { Text("Previous") }
                    Button(onClick = { vm.selectCard(ui.cardIndex + 1) }, enabled = ui.cardIndex + 1 < cards.size) { Text("Next") }
                }
            }
        }
        ReaderMode.HUD -> {
            val card = ed.bundle.cards.getOrNull(ui.cardIndex)
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(Color.Black, RoundedCornerShape(10.dp))
                    .border(2.dp, Color(0xFF4ADE80), RoundedCornerShape(10.dp))
                    .padding(16.dp),
            ) {
                Text(card?.title ?: "", color = Color(0xFF4ADE80), fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text(card?.body ?: "", color = Color(0xFF4ADE80), fontFamily = FontFamily.Monospace)
            }
        }
        ReaderMode.EDITION -> {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(ed.bundle.edition.sections) { sec ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(14.dp)) {
                            Text(sec.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Spacer(Modifier.height(6.dp))
                            Text(sec.body)
                            sec.methodology?.let {
                                Spacer(Modifier.height(6.dp))
                                Text("How it works: $it", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ArchiveTab(ui: UiState, vm: G2DigestViewModel) {
    var query by remember { mutableStateOf("") }
    OutlinedTextField(
        value = query,
        onValueChange = { query = it; vm.search(it) },
        label = { Text("Search editions & sources") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(10.dp))
    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (ui.searchHits.isNotEmpty()) {
            item { Text("Search Results", fontWeight = FontWeight.Bold) }
            items(ui.searchHits) { hit ->
                Card(onClick = { vm.loadEdition(hit.date) }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text("${hit.date} · ${hit.cardTitle}", fontWeight = FontWeight.SemiBold)
                        Text(hit.snippet, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        if (ui.bookmarks.isNotEmpty()) {
            item { Text("Bookmarked Cards", fontWeight = FontWeight.Bold) }
            items(ui.bookmarks) { bm ->
                Card(onClick = { vm.loadEdition(bm.editionDate) }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text("${bm.editionDate} · ${bm.cardTitle}", fontWeight = FontWeight.SemiBold)
                        Text(bm.body, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        item { Text("Editions", fontWeight = FontWeight.Bold) }
        items(ui.editions) { ed ->
            Card(onClick = { vm.loadEdition(ed.date) }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text(ed.title, fontWeight = FontWeight.SemiBold)
                    Text("${ed.date} · ${ed.totalCards} cards", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun BriefTab(ui: UiState, vm: G2DigestViewModel) {
    val brief = ui.brief
    if (brief == null) {
        Text("Sign in and tap refresh to load your brief.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Your Brief (v${ui.briefVersion})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Button(
                    onClick = vm::saveBrief,
                    enabled = ui.briefDirty && ui.briefIssues.isEmpty() && !ui.loading,
                ) { Text("Save Brief") }
            }
        }
        if (ui.briefIssues.isNotEmpty()) {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Fix before saving:", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                        ui.briefIssues.forEach { issue ->
                            Text("• ${issue.message}", fontSize = 12.sp, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Edition & Delivery", fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = brief.title,
                        onValueChange = { v -> vm.updateBrief { it.copy(title = v) } },
                        label = { Text("Edition title") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = brief.delivery.time,
                            onValueChange = { v -> vm.updateBrief { it.copy(delivery = it.delivery.copy(time = v)) } },
                            label = { Text("Time (HH:MM)") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = brief.maxTotalCards.toString(),
                            onValueChange = { v -> v.toIntOrNull()?.let { n -> vm.updateBrief { it.copy(maxTotalCards = n) } } },
                            label = { Text("Max cards") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    OutlinedTextField(
                        value = brief.delivery.timezone,
                        onValueChange = { v -> vm.updateBrief { it.copy(delivery = it.delivery.copy(timezone = v)) } },
                        label = { Text("Timezone (IANA)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                        BriefValidator.WEEKDAYS.forEach { day ->
                            val active = day in brief.delivery.days
                            FilterChip(
                                selected = active,
                                onClick = {
                                    vm.updateBrief { b ->
                                        val next = if (active) b.delivery.days - day else b.delivery.days + day
                                        b.copy(delivery = b.delivery.copy(days = BriefValidator.WEEKDAYS.filter { it in next }))
                                    }
                                },
                                label = { Text(day.take(2).uppercase(), fontSize = 11.sp, maxLines = 1, softWrap = false) },
                            )
                        }
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Sections (${brief.sections.size})", fontWeight = FontWeight.Bold)
                OutlinedButton(onClick = vm::addBriefSection) {
                    Icon(Icons.Default.Add, contentDescription = null)
                    Text(" Add Section")
                }
            }
        }
        items(brief.sections.size) { idx ->
            val sec = brief.sections[idx]
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text("${idx + 1}. ${sec.title.ifBlank { "Untitled" }}", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        IconButton(onClick = { vm.moveBriefSection(idx, -1) }, enabled = idx > 0) { Icon(Icons.Default.ArrowUpward, "Move up") }
                        IconButton(onClick = { vm.moveBriefSection(idx, 1) }, enabled = idx + 1 < brief.sections.size) { Icon(Icons.Default.ArrowDownward, "Move down") }
                        IconButton(onClick = { vm.removeBriefSection(idx) }) { Icon(Icons.Default.Delete, "Remove section") }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = sec.title,
                            onValueChange = { v ->
                                vm.updateBrief { b -> b.copy(sections = b.sections.mapIndexed { i, s -> if (i == idx) s.copy(title = v) else s }) }
                            },
                            label = { Text("Title (≤18)") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = sec.id,
                            onValueChange = { v ->
                                vm.updateBrief { b -> b.copy(sections = b.sections.mapIndexed { i, s -> if (i == idx) s.copy(id = v) else s }) }
                            },
                            label = { Text("ID") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        BriefValidator.TEMPLATES.forEach { tmpl ->
                            FilterChip(
                                selected = sec.template == tmpl,
                                onClick = {
                                    vm.updateBrief { b -> b.copy(sections = b.sections.mapIndexed { i, s -> if (i == idx) s.copy(template = tmpl) else s }) }
                                },
                                label = { Text(tmpl, fontSize = 11.sp, maxLines = 1, softWrap = false) },
                            )
                        }
                    }
                    OutlinedTextField(
                        value = sec.instructions,
                        onValueChange = { v ->
                            vm.updateBrief { b -> b.copy(sections = b.sections.mapIndexed { i, s -> if (i == idx) s.copy(instructions = v) else s }) }
                        },
                        label = { Text("Agent instructions") },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

@Composable
private fun AgentsTab(ui: UiState, vm: G2DigestViewModel) {
    var tokenName by remember { mutableStateOf("Daily build") }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        ui.onboarding?.let { status ->
            if (status.delivery.missed) {
                item {
                    Card(Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                            Column {
                                Text("Missed delivery for ${status.delivery.expectedDate}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                                Text("Expected by ${status.delivery.deliveryTime} (${status.delivery.timezone}). Check recent build runs below.", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Setup Checklist", fontWeight = FontWeight.Bold)
                        ChecklistRow(status.briefConfigured, "Configure your brief")
                        ChecklistRow(status.agentConnected, "Connect a build agent")
                        ChecklistRow(status.firstValidationPassed, "Pass first validation dry-run")
                        ChecklistRow(status.firstEditionPublished, "Publish first edition")
                    }
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text("MCP Server", fontWeight = FontWeight.Bold)
                    Text("https://g2digest.hejitech.workers.dev/mcp", fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                }
            }
        }
        if (ui.signedIn) {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Agent Tokens", fontWeight = FontWeight.Bold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(value = tokenName, onValueChange = { tokenName = it }, label = { Text("Token name") }, singleLine = true, modifier = Modifier.weight(1f))
                            Button(onClick = { vm.createAgentToken(tokenName) }) { Text("Create") }
                        }
                        ui.createdAgentToken?.let { tok ->
                            Text("New token (copy now): $tok", fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                        }
                        ui.tokens.forEach { t ->
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(t.name, modifier = Modifier.weight(1f), fontSize = 13.sp)
                                TextButton(onClick = { vm.revokeAgentToken(t.id) }) { Text("Revoke") }
                            }
                        }
                    }
                }
            }
        }
        item { Text("Recent Build Runs", fontWeight = FontWeight.Bold) }
        if (ui.buildRuns.isEmpty()) {
            item { Text("No build agent runs recorded yet.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        } else {
            items(ui.buildRuns) { run ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text("${run.action.uppercase()} · ${run.editionDate ?: "unknown"} (${run.status})", fontWeight = FontWeight.SemiBold)
                        run.errors.take(3).forEach { err ->
                            Text("• ${err.code}: ${err.message}", fontSize = 12.sp, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChecklistRow(done: Boolean, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(
            if (done) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
            contentDescription = null,
            tint = if (done) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(label, fontSize = 13.sp)
    }
}

@Composable
private fun SettingsTab(ui: UiState, vm: G2DigestViewModel) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Account", fontWeight = FontWeight.Bold)
                    Text(ui.email ?: if (ui.paired) "Paired Reader" else "Signed out")
                    Text("G2 Digest Pro: ${if (ui.pro?.pro == true) "Active" else "Not active"}")
                    Text("Offline cache: ${if (ui.isOffline) "Active (offline mode)" else "Synced (up to 5 editions)"}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("Push notifications (FCM): ${if (ui.fcmRegistered) "Registered" else "Ready (POST /api/push/fcm)"}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (ui.signedIn) {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Pair Even G2 Glasses", fontWeight = FontWeight.Bold)
                        Button(onClick = vm::generatePairingCode) { Text("Generate 6-digit code") }
                        ui.pairingCode?.let { Text("Code: ${it.code}", fontSize = 22.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold) }
                    }
                }
            }
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Private Podcast Feeds", fontWeight = FontWeight.Bold)
                        OutlinedButton(onClick = vm::createPodcastFeed) { Text("Create feed links") }
                        ui.feedLinks?.let {
                            Text("All: ${it.url}", fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            it.glanceUrl?.let { g -> Text("Glances: $g", fontSize = 11.sp, fontFamily = FontFamily.Monospace) }
                            it.deepDiveUrl?.let { d -> Text("Deep dives: $d", fontSize = 11.sp, fontFamily = FontFamily.Monospace) }
                        }
                    }
                }
            }
        }
        if (BuildConfig.DEBUG) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Debug: Local stack (127.0.0.1)")
                    Switch(checked = ui.useLocalStack, onCheckedChange = vm::toggleLocalStack)
                }
            }
        }
        item {
            OutlinedButton(onClick = vm::signOut, modifier = Modifier.fillMaxWidth()) { Text("Sign Out") }
        }
    }
}
