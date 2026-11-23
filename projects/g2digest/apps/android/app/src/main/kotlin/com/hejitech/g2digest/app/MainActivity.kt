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
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Stop
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
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Default.Headphones, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Text(
                            ui.playingTitle ?: "",
                            modifier = Modifier.weight(1f).padding(horizontal = 10.dp),
                            maxLines = 1,
                            fontWeight = FontWeight.SemiBold,
                        )
                        IconButton(onClick = vm::stopAudio) { Icon(Icons.Default.Stop, "Stop audio") }
                    }
                }
                NavigationBar {
                    NavigationBarItem(selected = ui.tab == AppTab.READ, onClick = { vm.selectTab(AppTab.READ) }, icon = { Icon(Icons.Default.Newspaper, null) }, label = { Text("Read") })
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
                AppTab.ARCHIVE -> ArchiveTab(ui, vm)
                AppTab.AGENTS -> AgentsTab(ui)
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
private fun AgentsTab(ui: UiState) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text("MCP Server", fontWeight = FontWeight.Bold)
                    Text("https://g2digest.hejitech.workers.dev/mcp", fontFamily = FontFamily.Monospace, fontSize = 12.sp)
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
private fun SettingsTab(ui: UiState, vm: G2DigestViewModel) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Account", fontWeight = FontWeight.Bold)
                    Text(ui.email ?: if (ui.paired) "Paired Reader" else "Signed out")
                    Text("G2 Digest Pro: ${if (ui.pro?.pro == true) "Active" else "Not active"}")
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
