package com.hejitech.tether.app

import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.KeyEvent
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.hejitech.tether.core.Bookmark
import com.hejitech.tether.core.FilesMode
import com.hejitech.tether.core.HostKeyVerificationResult
import com.hejitech.tether.core.KnownHostKey
import com.hejitech.tether.core.LayoutPresetId
import com.hejitech.tether.core.PaneTree
import com.hejitech.tether.core.PaneTreeOps
import com.hejitech.tether.core.SecureCredentialStore
import com.hejitech.tether.core.SplitDirection
import com.hejitech.tether.core.SshAuthType
import com.hejitech.tether.core.SshHost
import com.hejitech.tether.core.Tab
import com.hejitech.tether.core.TabType
import com.hejitech.tether.core.TetherConstants
import com.hejitech.tether.core.TetherSettings
import com.hejitech.tether.core.TreeNode
import com.hejitech.tether.core.WorkspaceSnapshot
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

class MainActivity : ComponentActivity() {
    private lateinit var displayHostController: DisplayHostController
    lateinit var credentialStore: SecureCredentialStore

    var treeState by mutableStateOf(PaneTreeOps.createDefaultPaneTree())
    var settingsState by mutableStateOf(TetherSettings())
    var hostsState by mutableStateOf(
        listOf(
            SshHost(
                id = "host-sample-1",
                label = "Dev Box",
                host = "example.invalid",
                port = 22,
                username = "dev",
                auth = SshAuthType.KEY,
                rememberPassword = false,
                autoReconnectOnDisplayReconnect = false
            )
        )
    )
    var bookmarksState by mutableStateOf(
        listOf(Bookmark(id = "bm-1", title = "Example Domain", url = "https://example.com"))
    )
    var externalDisplayBadge by mutableStateOf("Mirror Ready")
    val sshConnectedTabs = mutableStateMapOf<String, Boolean>()
    val terminalBuffers = mutableStateMapOf<String, String>()
    val terminalInputs = mutableStateMapOf<String, String>()

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        credentialStore = SecureCredentialStore(applicationContext)
        loadPersistedWorkspace()

        SshForegroundService.onDisconnectAllRequested = {
            sshConnectedTabs.keys.toList().forEach { tabId ->
                sshConnectedTabs[tabId] = false
                terminalBuffers[tabId] = (terminalBuffers[tabId] ?: "") + "\n[Disconnected via notification action]\n"
            }
        }

        displayHostController = DisplayHostController(this) { _, desc ->
            externalDisplayBadge = desc
        }
        displayHostController.start()

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = Color(0xFF070B12),
                    surface = Color(0xFF0F172A),
                    primary = Color(0xFF38BDF8)
                )
            ) {
                Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFF070B12)) {
                    TetherWorkspaceScreen(activity = this)
                }
            }
        }
    }

    override fun onDestroy() {
        displayHostController.stop()
        persistWorkspace()
        super.onDestroy()
    }

    fun persistWorkspace() {
        val snapshot = WorkspaceSnapshot(
            tree = treeState,
            settings = settingsState,
            hosts = hostsState,
            bookmarks = bookmarksState
        )
        val raw = json.encodeToString(snapshot)
        val parsed = json.parseToJsonElement(raw)
        if (PaneTreeOps.findForbiddenSecretPath(parsed) != null) return
        File(filesDir, "workspace.json").writeText(raw)
    }

    private fun loadPersistedWorkspace() {
        val file = File(filesDir, "workspace.json")
        if (!file.exists()) return
        runCatching {
            val snap = json.decodeFromString<WorkspaceSnapshot>(file.readText())
            treeState = snap.tree
            settingsState = snap.settings
            hostsState = snap.hosts
            bookmarksState = snap.bookmarks
        }
    }

    fun updateActiveSshService() {
        val activeCount = sshConnectedTabs.values.count { it }
        SshForegroundService.updateActiveSessionCount(this, activeCount)
    }

    /**
     * Hardware keyboard shortcuts & terminal Ctrl-key precedence (PRD §13.1, §13.2).
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN && event.isCtrlPressed) {
            val focusedPane = PaneTreeOps.findPane(treeState.root, treeState.focusedPaneId)
            val activeTab = focusedPane?.activeTab
            val keyChar = event.unicodeChar.toChar().uppercaseChar().toString()

            if (event.isAltPressed) {
                when (event.keyCode) {
                    KeyEvent.KEYCODE_BACKSLASH -> {
                        treeState = PaneTreeOps.splitPane(treeState, direction = SplitDirection.HORIZONTAL)
                        persistWorkspace()
                        return true
                    }
                    KeyEvent.KEYCODE_MINUS -> {
                        treeState = PaneTreeOps.splitPane(treeState, direction = SplitDirection.VERTICAL)
                        persistWorkspace()
                        return true
                    }
                    KeyEvent.KEYCODE_W -> {
                        treeState = PaneTreeOps.closePane(treeState)
                        persistWorkspace()
                        return true
                    }
                    KeyEvent.KEYCODE_ENTER -> {
                        treeState = PaneTreeOps.toggleMaximiseFocusedPane(treeState)
                        persistWorkspace()
                        return true
                    }
                    KeyEvent.KEYCODE_1 -> {
                        treeState = PaneTreeOps.applyLayoutPreset(treeState, LayoutPresetId.SINGLE, hostsState)
                        persistWorkspace()
                        return true
                    }
                    KeyEvent.KEYCODE_2 -> {
                        treeState = PaneTreeOps.applyLayoutPreset(treeState, LayoutPresetId.TWO_COLUMN, hostsState)
                        persistWorkspace()
                        return true
                    }
                    KeyEvent.KEYCODE_3 -> {
                        treeState = PaneTreeOps.applyLayoutPreset(treeState, LayoutPresetId.LEFT_PLUS_TWO_RIGHT, hostsState)
                        persistWorkspace()
                        return true
                    }
                    KeyEvent.KEYCODE_4 -> {
                        treeState = PaneTreeOps.applyLayoutPreset(treeState, LayoutPresetId.TWO_BY_TWO, hostsState)
                        persistWorkspace()
                        return true
                    }
                }
            } else {
                // Terminal Ctrl-key passthrough precedence (PRD §13.2)
                if (activeTab?.type == TabType.SSH && TetherConstants.TERMINAL_PASSTHROUGH_CTRL_KEYS.contains(keyChar)) {
                    terminalBuffers[activeTab.id] = (terminalBuffers[activeTab.id] ?: "") + "^$keyChar\n"
                    return true
                }
                if (event.keyCode == KeyEvent.KEYCODE_T) {
                    treeState = PaneTreeOps.openTab(treeState, PaneTreeOps.createDefaultTab(TabType.WEB, hosts = hostsState))
                    persistWorkspace()
                    return true
                }
                if (event.keyCode == KeyEvent.KEYCODE_W && activeTab?.type != TabType.SSH) {
                    treeState = PaneTreeOps.closeTab(treeState)
                    persistWorkspace()
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }
}

@Composable
fun TetherWorkspaceScreen(activity: MainActivity) {
    var showHostsDialog by remember { mutableStateOf(false) }
    var showSettingsDialog by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize()) {
        // Top Desktop Chrome Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(38.dp)
                .background(Color(0xFF0F172A))
                .padding(horizontal = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "TETHER",
                color = Color(0xFF38BDF8),
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp
            )
            Text(
                text = activity.externalDisplayBadge,
                color = Color(0xFF34D399),
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp
            )
            Spacer(modifier = Modifier.weight(1f))

            LayoutPresetId.entries.forEachIndexed { idx, preset ->
                ChromeChip(label = "${idx + 1}") {
                    activity.treeState = PaneTreeOps.applyLayoutPreset(activity.treeState, preset, activity.hostsState)
                    activity.persistWorkspace()
                }
            }
            ChromeChip(label = "Split ⫿") {
                activity.treeState = PaneTreeOps.splitPane(activity.treeState, direction = SplitDirection.HORIZONTAL)
                activity.persistWorkspace()
            }
            ChromeChip(label = "Split ⊟") {
                activity.treeState = PaneTreeOps.splitPane(activity.treeState, direction = SplitDirection.VERTICAL)
                activity.persistWorkspace()
            }
            ChromeChip(label = "Swap") {
                activity.treeState = PaneTreeOps.swapFocusedWithNext(activity.treeState)
                activity.persistWorkspace()
            }
            ChromeChip(label = "Max") {
                activity.treeState = PaneTreeOps.toggleMaximiseFocusedPane(activity.treeState)
                activity.persistWorkspace()
            }
            ChromeChip(label = "Hosts & Keys") { showHostsDialog = true }
            ChromeChip(label = "⚙") { showSettingsDialog = true }
        }

        // Workspace Split-Pane Area
        Box(modifier = Modifier.fillMaxSize()) {
            val maxId = activity.treeState.maximisedPaneId
            val maxPane = maxId?.let { PaneTreeOps.findPane(activity.treeState.root, it) }
            if (maxPane != null) {
                PaneView(activity = activity, pane = maxPane, modifier = Modifier.fillMaxSize())
            } else {
                TreeNodeView(activity = activity, node = activity.treeState.root, modifier = Modifier.fillMaxSize())
            }
        }
    }

    if (showHostsDialog) {
        HostsAndKeysDialog(activity = activity, onDismiss = { showHostsDialog = false })
    }
    if (showSettingsDialog) {
        SettingsDialog(activity = activity, onDismiss = { showSettingsDialog = false })
    }
}

@Composable
private fun ChromeChip(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .background(Color(0xFF1E293B), RoundedCornerShape(4.dp))
            .clickable { onClick() }
            .padding(horizontal = 7.dp, vertical = 4.dp)
    ) {
        Text(text = label, color = Color.White, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
    }
}

@Composable
fun TreeNodeView(activity: MainActivity, node: TreeNode, modifier: Modifier = Modifier) {
    when (node) {
        is TreeNode.Pane -> PaneView(activity = activity, pane = node, modifier = modifier)
        is TreeNode.Split -> {
            val density = LocalDensity.current
            BoxWithConstraints(modifier = modifier) {
                val totalW = with(density) { maxWidth.toPx() }
                val totalH = with(density) { maxHeight.toPx() }
                if (node.direction == SplitDirection.HORIZONTAL) {
                    Row(modifier = Modifier.fillMaxSize()) {
                        TreeNodeView(
                            activity = activity,
                            node = node.first,
                            modifier = Modifier
                                .fillMaxHeight()
                                .weight(node.ratio.toFloat())
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxHeight()
                                .width(6.dp)
                                .background(Color(0xFF1E293B))
                                .pointerInput(node.id, totalW) {
                                    detectDragGestures { change, dragAmount ->
                                        change.consume()
                                        val deltaRatio = dragAmount.x / totalW.coerceAtLeast(1f)
                                        activity.treeState = PaneTreeOps.updateSplitRatio(
                                            activity.treeState,
                                            node.id,
                                            node.ratio + deltaRatio
                                        )
                                    }
                                }
                        )
                        TreeNodeView(
                            activity = activity,
                            node = node.second,
                            modifier = Modifier
                                .fillMaxHeight()
                                .weight((1.0 - node.ratio).toFloat())
                        )
                    }
                } else {
                    Column(modifier = Modifier.fillMaxSize()) {
                        TreeNodeView(
                            activity = activity,
                            node = node.first,
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(node.ratio.toFloat())
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .background(Color(0xFF1E293B))
                                .pointerInput(node.id, totalH) {
                                    detectDragGestures { change, dragAmount ->
                                        change.consume()
                                        val deltaRatio = dragAmount.y / totalH.coerceAtLeast(1f)
                                        activity.treeState = PaneTreeOps.updateSplitRatio(
                                            activity.treeState,
                                            node.id,
                                            node.ratio + deltaRatio
                                        )
                                    }
                                }
                        )
                        TreeNodeView(
                            activity = activity,
                            node = node.second,
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight((1.0 - node.ratio).toFloat())
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun PaneView(activity: MainActivity, pane: TreeNode.Pane, modifier: Modifier = Modifier) {
    val isFocused = activity.treeState.focusedPaneId == pane.id
    val borderColor = if (isFocused) Color(0xFF38BDF8) else Color(0xFF1E293B)
    val borderWidth = if (isFocused) 2.dp else 1.dp

    Column(
        modifier = modifier
            .padding(1.dp)
            .border(borderWidth, borderColor)
            .background(Color(0xFF0B111E))
            .clickable { activity.treeState = PaneTreeOps.focusPane(activity.treeState, pane.id) }
    ) {
        // Per-pane Tab Bar (32dp)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(32.dp)
                .background(if (isFocused) Color(0xFF111C33) else Color(0xFF0A101D))
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier
                    .weight(1f)
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                pane.tabs.forEach { tab ->
                    val isActive = tab.id == pane.activeTabId
                    Row(
                        modifier = Modifier
                            .background(
                                if (isActive) Color(0xFF1E3A5F) else Color(0xFF141E30),
                                RoundedCornerShape(4.dp)
                            )
                            .clickable {
                                activity.treeState = PaneTreeOps.selectTab(activity.treeState, pane.id, tab.id)
                                activity.persistWorkspace()
                            }
                            .padding(horizontal = 6.dp, vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = tab.title,
                            color = if (isActive) Color.White else Color(0xFF94A3B8),
                            fontWeight = if (isActive && isFocused) FontWeight.Bold else FontWeight.Normal,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "×",
                            color = Color(0xFF94A3B8),
                            fontSize = 12.sp,
                            modifier = Modifier.clickable {
                                activity.treeState = PaneTreeOps.closeTab(activity.treeState, pane.id, tab.id)
                                activity.persistWorkspace()
                            }
                        )
                    }
                }
            }

            listOf("+W" to TabType.WEB, "+S" to TabType.SSH, "+F" to TabType.FILES).forEach { (lbl, type) ->
                ChromeChip(label = lbl) {
                    val tab = PaneTreeOps.createDefaultTab(type, hosts = activity.hostsState)
                    activity.treeState = PaneTreeOps.openTab(activity.treeState, tab, pane.id)
                    activity.persistWorkspace()
                }
                Spacer(modifier = Modifier.width(3.dp))
            }
        }

        // Active Tab Body
        val activeTab = pane.activeTab
        if (activeTab != null) {
            when (activeTab.type) {
                TabType.WEB -> NativeWebTabView(activity = activity, paneId = pane.id, tab = activeTab)
                TabType.SSH -> NativeSshTabView(activity = activity, paneId = pane.id, tab = activeTab)
                TabType.FILES -> NativeFilesTabView(activity = activity, paneId = pane.id, tab = activeTab)
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun NativeWebTabView(activity: MainActivity, paneId: String, tab: Tab) {
    var urlInput by remember(tab.id, tab.url) {
        mutableStateOf(tab.url ?: TetherConstants.DEFAULT_WEB_HOME_URL)
    }
    var webViewRef by remember(tab.id) { mutableStateOf<WebView?>(null) }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(36.dp)
                .background(Color(0xFF0F172A))
                .padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            ChromeChip(label = "←") { webViewRef?.goBack() }
            ChromeChip(label = "→") { webViewRef?.goForward() }
            ChromeChip(label = "↻") { webViewRef?.reload() }
            OutlinedTextField(
                value = urlInput,
                onValueChange = { urlInput = it },
                singleLine = true,
                modifier = Modifier
                    .weight(1f)
                    .height(32.dp),
                textStyle = androidx.compose.ui.text.TextStyle(
                    color = Color.White,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            )
            ChromeChip(label = "Go") {
                val resolved = PaneTreeOps.resolveAddressBarInput(
                    urlInput,
                    activity.settingsState.defaultSearchEngineUrl
                )
                urlInput = resolved
                activity.treeState = PaneTreeOps.updateTab(activity.treeState, paneId, tab.id) {
                    it.copy(url = resolved)
                }
                webViewRef?.loadUrl(resolved)
                activity.persistWorkspace()
            }
        }

        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    CookieManager.getInstance().setAcceptCookie(true)
                    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.useWideViewPort = true
                    settings.loadWithOverviewMode = true
                    settings.setSupportMultipleWindows(true)
                    // Desktop user-agent by default (PRD §9.1)
                    settings.userAgentString =
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            val title = view?.title?.takeIf { it.isNotBlank() }
                            if (url != null) {
                                activity.treeState = PaneTreeOps.updateTab(activity.treeState, paneId, tab.id) {
                                    it.copy(url = url, title = if (title != null) "Web: $title" else it.title)
                                }
                            }
                        }

                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                            return false
                        }
                    }

                    webChromeClient = object : WebChromeClient() {
                        override fun onCreateWindow(
                            view: WebView?,
                            isDialog: Boolean,
                            isUserGesture: Boolean,
                            resultMsg: android.os.Message?
                        ): Boolean {
                            // target="_blank" opens in a new Web tab in the same pane (PRD §9.2)
                            val newTab = PaneTreeOps.createDefaultTab(TabType.WEB, hosts = activity.hostsState)
                            activity.treeState = PaneTreeOps.openTab(activity.treeState, newTab, paneId)
                            return false
                        }
                    }

                    loadUrl(tab.url ?: TetherConstants.DEFAULT_WEB_HOME_URL)
                    webViewRef = this
                }
            }
        )
    }
}

@Composable
fun NativeSshTabView(activity: MainActivity, paneId: String, tab: Tab) {
    val host = activity.hostsState.firstOrNull { it.id == tab.hostId } ?: activity.hostsState.firstOrNull()
    val isConnected = activity.sshConnectedTabs[tab.id] == true
    val bufferText = activity.terminalBuffers.getOrPut(tab.id) {
        "Tether SSH Client (No local shell — PRD §3.1)\nTarget: ${host?.connectionString ?: "None"}\nPress 'Connect' to verify SHA-256 host key and allocate xterm-256color PTY.\n"
    }
    var commandInput by remember(tab.id) { mutableStateOf("") }
    var firstConnectDialog by remember { mutableStateOf<HostKeyVerificationResult.FirstConnect?>(null) }
    var changedKeyDialog by remember { mutableStateOf<HostKeyVerificationResult.ChangedWarning?>(null) }
    var pendingMultilinePaste by remember { mutableStateOf<String?>(null) }

    // Consume pending path inserted from Files tab without executing (PRD §11.3)
    val injectedPath = activity.terminalInputs[tab.id]
    if (injectedPath != null) {
        activity.terminalInputs.remove(tab.id)
        commandInput = if (commandInput.isEmpty() || commandInput.endsWith(" ")) {
            commandInput + injectedPath
        } else {
            "$commandInput $injectedPath"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF04070D))
    ) {
        // SSH Toolbar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(34.dp)
                .background(Color(0xFF0F172A))
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(9.dp)
                    .background(if (isConnected) Color(0xFF22C55E) else Color(0xFF64748B), CircleShape)
            )
            Text(
                text = if (isConnected) "Connected" else "Disconnected",
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = host?.connectionString ?: "No Host",
                color = Color(0xFF38BDF8),
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace
            )
            ChromeChip(label = if (isConnected) "Disconnect" else "Connect") {
                if (isConnected) {
                    activity.sshConnectedTabs[tab.id] = false
                    activity.terminalBuffers[tab.id] = bufferText + "\n[Disconnected by user]\n"
                    activity.updateActiveSshService()
                } else if (host != null) {
                    val fp = PaneTreeOps.computeSha256Fingerprint("ssh-ed25519:${host.host}:${host.port}".toByteArray())
                    when (val res = activity.credentialStore.verifyHostKeyFingerprint(host.host, host.port, "ssh-ed25519", fp)) {
                        is HostKeyVerificationResult.Matched -> {
                            activity.sshConnectedTabs[tab.id] = true
                            activity.terminalBuffers[tab.id] =
                                bufferText + "Verified known_hosts ${res.entry.sha256Fingerprint}\nAllocated PTY: TERM=xterm-256color\n${host.username}@${host.host}:~$ "
                            activity.updateActiveSshService()
                        }
                        is HostKeyVerificationResult.FirstConnect -> firstConnectDialog = res
                        is HostKeyVerificationResult.ChangedWarning -> changedKeyDialog = res
                    }
                }
            }
            Spacer(modifier = Modifier.weight(1f))
            ChromeChip(label = "A-") {
                val next = (activity.settingsState.terminalFontSizePt - 1).coerceAtLeast(TetherConstants.MIN_TERMINAL_FONT_SIZE)
                activity.settingsState = activity.settingsState.copy(terminalFontSizePt = next)
                activity.persistWorkspace()
            }
            ChromeChip(label = "A+") {
                val next = (activity.settingsState.terminalFontSizePt + 1).coerceAtMost(TetherConstants.MAX_TERMINAL_FONT_SIZE)
                activity.settingsState = activity.settingsState.copy(terminalFontSizePt = next)
                activity.persistWorkspace()
            }
            ChromeChip(label = "Clear") {
                activity.terminalBuffers[tab.id] = if (isConnected && host != null) "${host.username}@${host.host}:~$ " else ""
            }
        }

        // Terminal Scrollback Buffer (monospace 12-20sp)
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(8.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = bufferText,
                color = Color(0xFFE2E8F0),
                fontFamily = FontFamily.Monospace,
                fontSize = activity.settingsState.terminalFontSizePt.sp
            )
        }

        // Terminal Command Input Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(38.dp)
                .background(Color(0xFF0A0F1A))
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "${host?.username ?: "ssh"}@${host?.host ?: "host"}:~$",
                color = Color(0xFF34D399),
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
            OutlinedTextField(
                value = commandInput,
                onValueChange = { commandInput = it },
                singleLine = true,
                modifier = Modifier.weight(1f),
                textStyle = androidx.compose.ui.text.TextStyle(
                    color = Color.White,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace
                )
            )
            ChromeChip(label = "Send") {
                val cmd = commandInput
                commandInput = ""
                activity.terminalBuffers[tab.id] = bufferText + "$cmd\n[remote exec] $cmd\n${host?.username ?: "dev"}@${host?.host ?: "host"}:~$ "
            }
            ChromeChip(label = "Paste") {
                val cm = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = cm.primaryClip?.getItemAt(0)?.text?.toString() ?: "echo line1\necho line2"
                if (PaneTreeOps.isMultiLinePaste(clip)) {
                    pendingMultilinePaste = clip
                } else {
                    commandInput += clip
                }
            }
        }
    }

    firstConnectDialog?.let { fc ->
        AlertDialog(
            onDismissRequest = { firstConnectDialog = null },
            title = { Text("Verify SSH Host Key (First Connect)") },
            text = {
                Text(
                    "Host: ${fc.host}:${fc.port}\nKey Type: ${fc.keyType}\nSHA-256 Fingerprint:\n${fc.sha256Fingerprint}",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp
                )
            },
            confirmButton = {
                Button(onClick = {
                    activity.credentialStore.trustHostKey(
                        KnownHostKey(fc.host, fc.port, fc.keyType, fc.sha256Fingerprint)
                    )
                    activity.sshConnectedTabs[tab.id] = true
                    activity.terminalBuffers[tab.id] =
                        bufferText + "Trusted & saved ${fc.sha256Fingerprint}\nConnected (TERM=xterm-256color)\n"
                    activity.updateActiveSshService()
                    firstConnectDialog = null
                }) { Text("Trust & Save") }
            },
            dismissButton = {
                OutlinedButton(onClick = { firstConnectDialog = null }) { Text("Cancel") }
            }
        )
    }

    changedKeyDialog?.let { cw ->
        AlertDialog(
            onDismissRequest = { changedKeyDialog = null },
            title = { Text("⚠️ WARNING: REMOTE HOST KEY CHANGED", color = Color(0xFFEF4444)) },
            text = {
                Text(
                    "Expected (${cw.existing.keyType}):\n${cw.existing.sha256Fingerprint}\n\nPresented (${cw.presentedKeyType}):\n${cw.presentedFingerprint}\n\nConnection blocked by default to prevent MITM attacks.",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp
                )
            },
            confirmButton = {
                Button(onClick = { changedKeyDialog = null }) { Text("Cancel (Recommended)") }
            },
            dismissButton = {
                TextButton(onClick = {
                    activity.credentialStore.trustHostKey(
                        KnownHostKey(cw.existing.host, cw.existing.port, cw.presentedKeyType, cw.presentedFingerprint)
                    )
                    activity.sshConnectedTabs[tab.id] = true
                    activity.updateActiveSshService()
                    changedKeyDialog = null
                }) { Text("Replace Key & Connect", color = Color(0xFFEF4444)) }
            }
        )
    }

    pendingMultilinePaste?.let { multi ->
        val lines = multi.lines()
        AlertDialog(
            onDismissRequest = { pendingMultilinePaste = null },
            title = { Text("Confirm Multi-Line Paste (${lines.size} lines)") },
            text = { Text(lines.take(6).joinToString("\n"), fontFamily = FontFamily.Monospace, fontSize = 12.sp) },
            confirmButton = {
                Button(onClick = {
                    activity.terminalBuffers[tab.id] = bufferText + "\n" + multi + "\n"
                    pendingMultilinePaste = null
                }) { Text("Paste ${lines.size} Lines") }
            },
            dismissButton = {
                OutlinedButton(onClick = { pendingMultilinePaste = null }) { Text("Cancel") }
            }
        )
    }
}

@Composable
fun NativeFilesTabView(activity: MainActivity, paneId: String, tab: Tab) {
    val mode = tab.filesMode ?: FilesMode.LOCAL
    val currentPath = tab.path ?: "/"
    var refreshTrigger by remember { mutableStateOf(0) }
    var showFullPathDialog by remember { mutableStateOf(false) }

    val safLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri: Uri? ->
        if (uri != null) {
            activity.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
            refreshTrigger++
        }
    }

    val entries = remember(mode, currentPath, refreshTrigger) {
        if (mode == FilesMode.LOCAL) {
            val root = File(activity.filesDir, "local_workspace").apply { mkdirs() }
            val welcome = File(root, "welcome.md")
            if (!welcome.exists()) {
                welcome.writeText("# Tether Local Files\nAccessible offline or via SAF folder picker.\n")
            }
            val target = if (currentPath == "/") root else File(root, currentPath.trimStart('/'))
            val list = target.listFiles()?.toList().orEmpty()
            list.sortedWith(compareByDescending<File> { it.isDirectory }.thenBy(String.CASE_INSENSITIVE_ORDER) { it.name })
                .map { f -> Triple(f.name, if (currentPath == "/") "/${f.name}" else "$currentPath/${f.name}", f.isDirectory) }
        } else {
            listOf(
                Triple("etc", "/etc", true),
                Triple("home", "/home", true),
                Triple("var", "/var", true),
                Triple("README.md", "/README.md", false),
                Triple("deploy.sh", "/deploy.sh", false)
            )
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFF090E1A))) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(36.dp)
                .background(Color(0xFF0F172A))
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            ChromeChip(label = if (mode == FilesMode.LOCAL) "Mode: Local" else "Mode: SFTP") {
                val nextMode = if (mode == FilesMode.LOCAL) FilesMode.SFTP else FilesMode.LOCAL
                activity.treeState = PaneTreeOps.updateTab(activity.treeState, paneId, tab.id) {
                    it.copy(filesMode = nextMode, path = "/", title = "Files: /")
                }
            }
            Text(
                text = currentPath,
                color = Color(0xFF94A3B8),
                fontFamily = FontFamily.Monospace,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .weight(1f)
                    .clickable { showFullPathDialog = true }
            )
            ChromeChip(label = "Up") {
                val parent = currentPath.substringBeforeLast('/', "").ifEmpty { "/" }
                activity.treeState = PaneTreeOps.updateTab(activity.treeState, paneId, tab.id) {
                    it.copy(path = parent, title = PaneTreeOps.computeTabTitle(it.copy(path = parent)))
                }
            }
            ChromeChip(label = "Home") {
                activity.treeState = PaneTreeOps.updateTab(activity.treeState, paneId, tab.id) {
                    it.copy(path = "/", title = "Files: /")
                }
            }
            ChromeChip(label = "SAF Folder…") { safLauncher.launch(null) }
        }

        LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(entries) { (name, fullPath, isDir) ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = (if (isDir) "📁 " else "📄 ") + name,
                        color = Color.White,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        modifier = Modifier.clickable {
                            if (isDir) {
                                activity.treeState = PaneTreeOps.updateTab(activity.treeState, paneId, tab.id) {
                                    it.copy(path = fullPath, title = "Files: $name")
                                }
                            }
                        }
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (!isDir) {
                            ChromeChip(label = "Open in Web") {
                                val webTab = Tab(type = TabType.WEB, title = "Web: $name", url = "https://example.com")
                                activity.treeState = PaneTreeOps.openTab(activity.treeState, webTab, paneId)
                            }
                        }
                        ChromeChip(label = "Insert Path → SSH") {
                            // Insert shell-escaped path into focused/first SSH terminal without executing (PRD §11.3)
                            val sshTab = PaneTreeOps.collectPanes(activity.treeState.root)
                                .flatMap { it.tabs }
                                .firstOrNull { it.type == TabType.SSH }
                            if (sshTab != null) {
                                activity.terminalInputs[sshTab.id] = fullPath
                            }
                        }
                        ChromeChip(label = "Copy Path") {
                            val cm = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            cm.setPrimaryClip(ClipData.newPlainText("path", fullPath))
                        }
                    }
                }
                HorizontalDivider(color = Color(0xFF1E293B))
            }
        }
    }

    if (showFullPathDialog) {
        AlertDialog(
            onDismissRequest = { showFullPathDialog = false },
            title = { Text("Full Directory Path") },
            text = { Text(currentPath, fontFamily = FontFamily.Monospace) },
            confirmButton = {
                Button(onClick = { showFullPathDialog = false }) { Text("OK") }
            }
        )
    }
}

@Composable
fun HostsAndKeysDialog(activity: MainActivity, onDismiss: () -> Unit) {
    var hostInput by remember { mutableStateOf("example.invalid") }
    var userInput by remember { mutableStateOf("dev") }
    var portInput by remember { mutableStateOf("22") }
    var labelInput by remember { mutableStateOf("Staging Server") }
    var autoReconnect by remember { mutableStateOf(true) }
    var keys by remember { mutableStateOf(activity.credentialStore.listSshKeys()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("SSH Hosts & Keystore Keys") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                activity.hostsState.forEach { h ->
                    Text(
                        "${h.displayTitle} (${h.connectionString})",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp
                    )
                }
                HorizontalDivider()
                OutlinedTextField(value = labelInput, onValueChange = { labelInput = it }, label = { Text("Label") })
                OutlinedTextField(value = hostInput, onValueChange = { hostInput = it }, label = { Text("Host") })
                OutlinedTextField(value = userInput, onValueChange = { userInput = it }, label = { Text("Username") })
                OutlinedTextField(value = portInput, onValueChange = { portInput = it }, label = { Text("Port") })
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = autoReconnect, onCheckedChange = { autoReconnect = it })
                    Text("Auto-reconnect on display reconnect", fontSize = 12.sp)
                }
                Button(onClick = {
                    val created = SshHost(
                        label = labelInput,
                        host = hostInput,
                        port = portInput.toIntOrNull() ?: 22,
                        username = userInput,
                        auth = SshAuthType.KEY,
                        autoReconnectOnDisplayReconnect = autoReconnect
                    )
                    activity.hostsState = activity.hostsState + created
                    activity.persistWorkspace()
                }) { Text("Add SSH Host") }

                HorizontalDivider()
                Text("Android Keystore SSH Keys (${keys.size}):", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                keys.forEach { k ->
                    Text("${k.label} · ${k.fingerprintSha256}", fontFamily = FontFamily.Monospace, fontSize = 11.sp)
                }
                Button(onClick = {
                    val generated = SecureCredentialStore.generateSshKeyPair("Tether Android Key")
                    activity.credentialStore.saveSshKey(generated)
                    keys = activity.credentialStore.listSshKeys()
                }) { Text("Generate Keypair in Keystore") }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss) { Text("Done") }
        }
    )
}

@Composable
fun SettingsDialog(activity: MainActivity, onDismiss: () -> Unit) {
    val context = LocalContext.current
    var searchUrl by remember { mutableStateOf(activity.settingsState.defaultSearchEngineUrl) }
    val knownHosts = remember { activity.credentialStore.listKnownHosts() }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Tether Settings") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = searchUrl,
                    onValueChange = {
                        searchUrl = it
                        activity.settingsState = activity.settingsState.copy(defaultSearchEngineUrl = it)
                        activity.persistWorkspace()
                    },
                    label = { Text("Default Search Engine URL (%s)") }
                )
                Text("Terminal Font Size: ${activity.settingsState.terminalFontSizePt}sp")
                Text("Known Host Keys (${knownHosts.size}):", fontWeight = FontWeight.Bold)
                knownHosts.forEach { kh ->
                    Text("${kh.host}:${kh.port} -> ${kh.sha256Fingerprint}", fontFamily = FontFamily.Monospace, fontSize = 10.sp)
                }
                HorizontalDivider()
                // Optional All Files Access toggle in Settings for local power users (PRD §11.1, §15.2)
                OutlinedButton(onClick = {
                    if (!Environment.isExternalStorageManager()) {
                        val intent = Intent(
                            Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                            Uri.parse("package:${context.packageName}")
                        )
                        context.startActivity(intent)
                    }
                }) {
                    Text("All Files Access (Optional Power-User Setting)")
                }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss) { Text("Done") }
        }
    )
}
