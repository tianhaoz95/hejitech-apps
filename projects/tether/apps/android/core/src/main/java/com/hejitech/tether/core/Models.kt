package com.hejitech.tether.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import java.security.MessageDigest
import java.util.Base64
import java.util.UUID
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

object TetherConstants {
    const val MAX_PANES = 4
    const val MIN_SPLIT_RATIO = 0.2
    const val MAX_SPLIT_RATIO = 0.8
    const val SPLIT_RATIO_STEP = 0.05
    const val MIN_TERMINAL_FONT_SIZE = 12
    const val MAX_TERMINAL_FONT_SIZE = 20
    const val DEFAULT_TERMINAL_FONT_SIZE = 14
    const val MIN_SCROLLBACK_LINES = 10_000
    const val DEFAULT_WEB_HOME_URL = "https://example.com"
    const val DEFAULT_SEARCH_ENGINE_URL = "https://duckduckgo.com/?q=%s"

    val TERMINAL_PASSTHROUGH_CTRL_KEYS: Set<String> = setOf(
        "C", "D", "Z", "R", "A", "E", "K", "U", "W", "L"
    )

    val FORBIDDEN_SECRET_KEYS: Set<String> = setOf(
        "password",
        "passphrase",
        "privatekey",
        "private_key",
        "privatekeypem",
        "private_key_pem",
        "secretkey",
        "secret_key",
        "rawpassword",
        "sshpassword"
    )
}

@Serializable
enum class SplitDirection {
    @SerialName("horizontal") HORIZONTAL,
    @SerialName("vertical") VERTICAL
}

@Serializable
enum class TabType {
    @SerialName("web") WEB,
    @SerialName("ssh") SSH,
    @SerialName("files") FILES
}

@Serializable
enum class FilesMode {
    @SerialName("local") LOCAL,
    @SerialName("sftp") SFTP
}

@Serializable
data class Tab(
    val id: String = "tab-${UUID.randomUUID().toString().take(8)}",
    val type: TabType,
    val title: String,
    val url: String? = null,
    val hostId: String? = null,
    val filesMode: FilesMode? = null,
    val path: String? = null
)

@Serializable
sealed class TreeNode {
    @Serializable
    @SerialName("pane")
    data class Pane(
        val id: String,
        val tabs: List<Tab>,
        val activeTabId: String
    ) : TreeNode() {
        val activeTab: Tab?
            get() = tabs.firstOrNull { it.id == activeTabId } ?: tabs.firstOrNull()
    }

    @Serializable
    @SerialName("split")
    data class Split(
        val id: String,
        val direction: SplitDirection,
        val ratio: Double = 0.5,
        val first: TreeNode,
        val second: TreeNode
    ) : TreeNode()
}

@Serializable
data class PaneTree(
    val version: Int = 1,
    val root: TreeNode,
    val focusedPaneId: String,
    val maximisedPaneId: String? = null
)

@Serializable
enum class SshAuthType {
    @SerialName("key") KEY,
    @SerialName("password") PASSWORD,
    @SerialName("keyAndPassword") KEY_AND_PASSWORD
}

@Serializable
data class SshHost(
    val id: String = "host-${UUID.randomUUID().toString().take(8)}",
    val label: String? = null,
    val host: String,
    val port: Int = 22,
    val username: String,
    val auth: SshAuthType = SshAuthType.KEY,
    val keyId: String? = null,
    val rememberPassword: Boolean? = false,
    val autoReconnectOnDisplayReconnect: Boolean? = false,
    val autoConnect: Boolean? = false
) {
    val displayTitle: String
        get() = label?.trim()?.takeIf { it.isNotEmpty() } ?: "$username@$host"

    val connectionString: String
        get() = "$username@$host:$port"
}

@Serializable
data class KnownHostKey(
    val host: String,
    val port: Int,
    val keyType: String,
    val sha256Fingerprint: String,
    val firstSeenAt: String = "2026-10-27T00:00:00Z"
)

sealed class HostKeyVerificationResult {
    data class Matched(val entry: KnownHostKey) : HostKeyVerificationResult()
    data class FirstConnect(
        val host: String,
        val port: Int,
        val keyType: String,
        val sha256Fingerprint: String
    ) : HostKeyVerificationResult()
    data class ChangedWarning(
        val existing: KnownHostKey,
        val presentedKeyType: String,
        val presentedFingerprint: String
    ) : HostKeyVerificationResult()
}

@Serializable
data class Bookmark(
    val id: String = "bm-${UUID.randomUUID().toString().take(8)}",
    val title: String,
    val url: String,
    val createdAt: String = "2026-10-27T00:00:00Z"
)

@Serializable
enum class ThemeMode {
    @SerialName("system") SYSTEM,
    @SerialName("light") LIGHT,
    @SerialName("dark") DARK
}

@Serializable
enum class LayoutPresetId(val wireValue: String, val displayName: String) {
    @SerialName("single") SINGLE("single", "Single Pane"),
    @SerialName("two-column") TWO_COLUMN("two-column", "Two Columns (50 / 50)"),
    @SerialName("left-plus-two-right") LEFT_PLUS_TWO_RIGHT("left-plus-two-right", "Left + Two Stacked Right"),
    @SerialName("two-by-two") TWO_BY_TWO("two-by-two", "2×2 Grid (4 Panes)")
}

@Serializable
data class TetherSettings(
    val version: Int = 1,
    val defaultSearchEngineUrl: String = TetherConstants.DEFAULT_SEARCH_ENGINE_URL,
    val terminalFontSizePt: Int = TetherConstants.DEFAULT_TERMINAL_FONT_SIZE,
    val theme: ThemeMode = ThemeMode.DARK,
    val defaultLayoutPreset: LayoutPresetId = LayoutPresetId.TWO_COLUMN
)

@Serializable
data class WorkspaceSnapshot(
    val tree: PaneTree,
    val settings: TetherSettings,
    val hosts: List<SshHost> = emptyList(),
    val bookmarks: List<Bookmark> = emptyList(),
    val updatedAt: String = "2026-10-27T00:00:00Z"
)

enum class FocusDirection { LEFT, RIGHT, UP, DOWN }

object PaneTreeOps {
    fun clampSplitRatio(ratio: Double): Double {
        if (!ratio.isFinite()) return 0.5
        val clamped = min(TetherConstants.MAX_SPLIT_RATIO, max(TetherConstants.MIN_SPLIT_RATIO, ratio))
        return (clamped * 1000.0).roundToInt() / 1000.0
    }

    fun stepSplitRatio(ratio: Double, delta: Double): Double = clampSplitRatio(ratio + delta)

    fun createDefaultTab(
        type: TabType,
        id: String = "tab-${UUID.randomUUID().toString().take(8)}",
        hosts: List<SshHost> = emptyList()
    ): Tab = when (type) {
        TabType.WEB -> Tab(id = id, type = TabType.WEB, title = "Web: example.com", url = TetherConstants.DEFAULT_WEB_HOME_URL)
        TabType.SSH -> {
            val h = hosts.firstOrNull()
            val title = if (h != null) "SSH: ${h.displayTitle}" else "SSH: Not connected"
            Tab(id = id, type = TabType.SSH, title = title, hostId = h?.id)
        }
        TabType.FILES -> Tab(id = id, type = TabType.FILES, title = "Files: /", filesMode = FilesMode.LOCAL, path = "/")
    }

    fun computeTabTitle(tab: Tab, hosts: List<SshHost> = emptyList()): String = when (tab.type) {
        TabType.WEB -> {
            val trimmed = tab.title.trim()
            if (trimmed.startsWith("Web: ")) trimmed
            else if (trimmed.isNotEmpty() && trimmed != "Web") "Web: $trimmed"
            else "Web: example.com"
        }
        TabType.SSH -> {
            val host = hosts.firstOrNull { it.id == tab.hostId }
            if (host != null) "SSH: ${host.displayTitle}" else "SSH: Not connected"
        }
        TabType.FILES -> {
            val raw = (tab.path ?: "/").trim()
            if (raw.isEmpty() || raw == "/") "Files: /"
            else "Files: ${raw.trim('/').substringAfterLast('/', raw.trim('/'))}"
        }
    }

    fun createDefaultPaneTree(): PaneTree {
        val webTab = createDefaultTab(TabType.WEB, id = "tab-web-1")
        val sshTab = createDefaultTab(TabType.SSH, id = "tab-ssh-1")
        val left = TreeNode.Pane(id = "pane-1", tabs = listOf(webTab), activeTabId = webTab.id)
        val right = TreeNode.Pane(id = "pane-2", tabs = listOf(sshTab), activeTabId = sshTab.id)
        return PaneTree(
            version = 1,
            root = TreeNode.Split(
                id = "split-root",
                direction = SplitDirection.HORIZONTAL,
                ratio = 0.5,
                first = left,
                second = right
            ),
            focusedPaneId = left.id,
            maximisedPaneId = null
        )
    }

    fun collectPanes(node: TreeNode): List<TreeNode.Pane> = when (node) {
        is TreeNode.Pane -> listOf(node)
        is TreeNode.Split -> collectPanes(node.first) + collectPanes(node.second)
    }

    fun countPanes(node: TreeNode): Int = collectPanes(node).size

    fun findPane(node: TreeNode, paneId: String): TreeNode.Pane? =
        collectPanes(node).firstOrNull { it.id == paneId }

    fun splitPane(
        tree: PaneTree,
        paneId: String = tree.focusedPaneId,
        direction: SplitDirection,
        initialTab: Tab? = null,
        newPaneId: String = "pane-${UUID.randomUUID().toString().take(8)}",
        newSplitId: String = "split-${UUID.randomUUID().toString().take(8)}"
    ): PaneTree {
        if (countPanes(tree.root) >= TetherConstants.MAX_PANES) return tree
        if (findPane(tree.root, paneId) == null) return tree
        val tab = initialTab ?: createDefaultTab(TabType.WEB)
        val created = TreeNode.Pane(id = newPaneId, tabs = listOf(tab), activeTabId = tab.id)

        fun replace(node: TreeNode): TreeNode = when (node) {
            is TreeNode.Pane -> if (node.id == paneId) {
                TreeNode.Split(
                    id = newSplitId,
                    direction = direction,
                    ratio = 0.5,
                    first = node,
                    second = created
                )
            } else node
            is TreeNode.Split -> node.copy(first = replace(node.first), second = replace(node.second))
        }

        return tree.copy(root = replace(tree.root), focusedPaneId = created.id, maximisedPaneId = null)
    }

    fun closePane(tree: PaneTree, paneId: String = tree.focusedPaneId): PaneTree {
        val panes = collectPanes(tree.root)
        if (panes.size <= 1) return tree
        val idx = panes.indexOfFirst { it.id == paneId }
        if (idx < 0) return tree

        fun remove(node: TreeNode): TreeNode? = when (node) {
            is TreeNode.Pane -> if (node.id == paneId) null else node
            is TreeNode.Split -> {
                val f = remove(node.first)
                val s = remove(node.second)
                when {
                    f == null -> s
                    s == null -> f
                    else -> node.copy(first = f, second = s)
                }
            }
        }

        val nextRoot = remove(tree.root) ?: return tree
        val remaining = collectPanes(nextRoot)
        val nextFocused = if (tree.focusedPaneId == paneId) {
            remaining.getOrElse(max(0, idx - 1)) { remaining.first() }.id
        } else {
            tree.focusedPaneId
        }
        val nextMax = if (tree.maximisedPaneId == paneId) null else tree.maximisedPaneId
        return tree.copy(root = nextRoot, focusedPaneId = nextFocused, maximisedPaneId = nextMax)
    }

    fun focusPane(tree: PaneTree, paneId: String): PaneTree {
        if (findPane(tree.root, paneId) == null) return tree
        val nextMax = if (tree.maximisedPaneId != null && tree.maximisedPaneId != paneId) null else tree.maximisedPaneId
        return tree.copy(focusedPaneId = paneId, maximisedPaneId = nextMax)
    }

    fun focusNextPane(tree: PaneTree, reverse: Boolean = false): PaneTree {
        val panes = collectPanes(tree.root)
        if (panes.size <= 1) return tree
        val idx = panes.indexOfFirst { it.id == tree.focusedPaneId }.coerceAtLeast(0)
        val delta = if (reverse) -1 else 1
        val nextIdx = (idx + delta + panes.size) % panes.size
        return focusPane(tree, panes[nextIdx].id)
    }

    fun swapFocusedWithNext(tree: PaneTree): PaneTree {
        val panes = collectPanes(tree.root)
        if (panes.size <= 1) return tree
        val idx = panes.indexOfFirst { it.id == tree.focusedPaneId }.coerceAtLeast(0)
        val paneA = panes[idx]
        val paneB = panes[(idx + 1) % panes.size]

        fun swap(node: TreeNode): TreeNode = when (node) {
            is TreeNode.Pane -> when (node.id) {
                paneA.id -> paneB
                paneB.id -> paneA
                else -> node
            }
            is TreeNode.Split -> node.copy(first = swap(node.first), second = swap(node.second))
        }
        return tree.copy(root = swap(tree.root))
    }

    fun toggleMaximiseFocusedPane(tree: PaneTree): PaneTree {
        val next = if (tree.maximisedPaneId == tree.focusedPaneId) null else tree.focusedPaneId
        return tree.copy(maximisedPaneId = next)
    }

    fun updateSplitRatio(tree: PaneTree, splitId: String, ratio: Double): PaneTree {
        val clamped = clampSplitRatio(ratio)
        fun update(node: TreeNode): TreeNode = when (node) {
            is TreeNode.Pane -> node
            is TreeNode.Split -> node.copy(
                ratio = if (node.id == splitId) clamped else node.ratio,
                first = update(node.first),
                second = update(node.second)
            )
        }
        return tree.copy(root = update(tree.root))
    }

    fun applyLayoutPreset(
        tree: PaneTree,
        preset: LayoutPresetId,
        hosts: List<SshHost> = emptyList()
    ): PaneTree {
        val existingPanes = collectPanes(tree.root)
        val targetCount = when (preset) {
            LayoutPresetId.SINGLE -> 1
            LayoutPresetId.TWO_COLUMN -> 2
            LayoutPresetId.LEFT_PLUS_TWO_RIGHT -> 3
            LayoutPresetId.TWO_BY_TWO -> 4
        }
        val buckets = Array(targetCount) { mutableListOf<Tab>() }
        if (existingPanes.size >= targetCount) {
            existingPanes.forEachIndexed { idx, pane ->
                buckets[min(idx, targetCount - 1)].addAll(pane.tabs)
            }
        } else {
            existingPanes.forEachIndexed { idx, pane ->
                buckets[idx].addAll(pane.tabs)
            }
            for (b in existingPanes.size until targetCount) {
                val donor = buckets.firstOrNull { it.size > 1 }
                if (donor != null) {
                    buckets[b].add(donor.removeAt(donor.lastIndex))
                } else {
                    val fallbackType = when (b) {
                        1 -> TabType.SSH
                        2 -> TabType.FILES
                        else -> TabType.WEB
                    }
                    buckets[b].add(createDefaultTab(fallbackType, id = "tab-preset-${b + 1}", hosts = hosts))
                }
            }
        }

        val panes = buckets.mapIndexed { idx, tabs ->
            val safeTabs = tabs.ifEmpty { listOf(createDefaultTab(TabType.WEB, id = "tab-safe-${idx + 1}", hosts = hosts)) }
            val paneId = existingPanes.getOrNull(idx)?.id ?: "pane-${idx + 1}"
            val prevActive = existingPanes.getOrNull(idx)?.activeTabId
            val activeId = if (safeTabs.any { it.id == prevActive }) prevActive!! else safeTabs.first().id
            TreeNode.Pane(id = paneId, tabs = safeTabs, activeTabId = activeId)
        }

        val root: TreeNode = when (preset) {
            LayoutPresetId.SINGLE -> panes[0]
            LayoutPresetId.TWO_COLUMN -> TreeNode.Split(
                id = "split-root",
                direction = SplitDirection.HORIZONTAL,
                ratio = 0.5,
                first = panes[0],
                second = panes[1]
            )
            LayoutPresetId.LEFT_PLUS_TWO_RIGHT -> TreeNode.Split(
                id = "split-root",
                direction = SplitDirection.HORIZONTAL,
                ratio = 0.5,
                first = panes[0],
                second = TreeNode.Split(
                    id = "split-right",
                    direction = SplitDirection.VERTICAL,
                    ratio = 0.5,
                    first = panes[1],
                    second = panes[2]
                )
            )
            LayoutPresetId.TWO_BY_TWO -> TreeNode.Split(
                id = "split-root",
                direction = SplitDirection.HORIZONTAL,
                ratio = 0.5,
                first = TreeNode.Split(
                    id = "split-left",
                    direction = SplitDirection.VERTICAL,
                    ratio = 0.5,
                    first = panes[0],
                    second = panes[2]
                ),
                second = TreeNode.Split(
                    id = "split-right",
                    direction = SplitDirection.VERTICAL,
                    ratio = 0.5,
                    first = panes[1],
                    second = panes[3]
                )
            )
        }

        val focused = if (panes.any { it.id == tree.focusedPaneId }) tree.focusedPaneId else panes[0].id
        return PaneTree(version = 1, root = root, focusedPaneId = focused, maximisedPaneId = null)
    }

    private fun mapPane(node: TreeNode, paneId: String, transform: (TreeNode.Pane) -> TreeNode.Pane): TreeNode =
        when (node) {
            is TreeNode.Pane -> if (node.id == paneId) transform(node) else node
            is TreeNode.Split -> node.copy(
                first = mapPane(node.first, paneId, transform),
                second = mapPane(node.second, paneId, transform)
            )
        }

    fun openTab(tree: PaneTree, tab: Tab, inPaneId: String = tree.focusedPaneId): PaneTree {
        if (findPane(tree.root, inPaneId) == null) return tree
        val nextRoot = mapPane(tree.root, inPaneId) { p ->
            p.copy(tabs = p.tabs + tab, activeTabId = tab.id)
        }
        return tree.copy(root = nextRoot, focusedPaneId = inPaneId)
    }

    fun closeTab(tree: PaneTree, paneId: String = tree.focusedPaneId, tabId: String? = null): PaneTree {
        val pane = findPane(tree.root, paneId) ?: return tree
        val targetTabId = tabId ?: pane.activeTabId
        val idx = pane.tabs.indexOfFirst { it.id == targetTabId }
        if (idx < 0) return tree
        if (pane.tabs.size == 1) {
            if (countPanes(tree.root) > 1) return closePane(tree, paneId)
            val replacement = createDefaultTab(TabType.WEB)
            val nextRoot = mapPane(tree.root, paneId) { p ->
                p.copy(tabs = listOf(replacement), activeTabId = replacement.id)
            }
            return tree.copy(root = nextRoot)
        }
        val nextTabs = pane.tabs.filterNot { it.id == targetTabId }
        val nextActive = if (pane.activeTabId == targetTabId) {
            nextTabs[max(0, idx - 1)].id
        } else pane.activeTabId
        val nextRoot = mapPane(tree.root, paneId) { p ->
            p.copy(tabs = nextTabs, activeTabId = nextActive)
        }
        return tree.copy(root = nextRoot)
    }

    fun selectTab(tree: PaneTree, paneId: String, tabId: String): PaneTree {
        val pane = findPane(tree.root, paneId) ?: return tree
        if (pane.tabs.none { it.id == tabId }) return tree
        val nextRoot = mapPane(tree.root, paneId) { p -> p.copy(activeTabId = tabId) }
        return tree.copy(root = nextRoot, focusedPaneId = paneId)
    }

    fun updateTab(tree: PaneTree, paneId: String, tabId: String, transform: (Tab) -> Tab): PaneTree {
        val nextRoot = mapPane(tree.root, paneId) { p ->
            p.copy(tabs = p.tabs.map { if (it.id == tabId) transform(it) else it })
        }
        return tree.copy(root = nextRoot)
    }

    fun resolveAddressBarInput(
        rawInput: String,
        searchEngineUrl: String = TetherConstants.DEFAULT_SEARCH_ENGINE_URL
    ): String {
        val trimmed = rawInput.trim()
        if (trimmed.isEmpty()) return TetherConstants.DEFAULT_WEB_HOME_URL
        if (Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://").containsMatchIn(trimmed)) return trimmed
        val looksLikeHost = !trimmed.contains(" ") && (
            trimmed.contains(".") || trimmed.startsWith("localhost") ||
                Regex("^\\d{1,3}(\\.\\d{1,3}){3}(:\\d+)?(/.*)?$").matches(trimmed)
        )
        if (looksLikeHost) {
            val scheme = if (trimmed.startsWith("localhost")) "http" else "https"
            return "$scheme://$trimmed"
        }
        val encoded = java.net.URLEncoder.encode(trimmed, "UTF-8").replace("+", "%20")
        return if (searchEngineUrl.contains("%s")) {
            searchEngineUrl.replace("%s", encoded)
        } else {
            "$searchEngineUrl$encoded"
        }
    }

    fun calculateTerminalGrid(
        widthPx: Double,
        heightPx: Double,
        cellWidthPx: Double,
        cellHeightPx: Double
    ): Pair<Int, Int> {
        if (cellWidthPx <= 0 || cellHeightPx <= 0 || widthPx <= 0 || heightPx <= 0) {
            return 80 to 24
        }
        val cols = max(20, floor(widthPx / cellWidthPx).toInt())
        val rows = max(5, floor(heightPx / cellHeightPx).toInt())
        return cols to rows
    }

    fun isMultiLinePaste(text: String): Boolean = text.contains('\n') || text.contains('\r')

    fun computeSha256Fingerprint(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(data)
        val b64 = Base64.getEncoder().withoutPadding().encodeToString(digest)
        return "SHA256:$b64"
    }

    fun findForbiddenSecretPath(element: JsonElement, path: String = "root"): String? {
        return when (element) {
            is JsonArray -> {
                element.forEachIndexed { idx, item ->
                    val found = findForbiddenSecretPath(item, "$path[$idx]")
                    if (found != null) return found
                }
                null
            }
            is JsonObject -> {
                for ((k, v) in element.entries) {
                    val norm = k.lowercase().replace('-', '_')
                    if (TetherConstants.FORBIDDEN_SECRET_KEYS.contains(norm)) {
                        return "$path.$k"
                    }
                    val nested = findForbiddenSecretPath(v, "$path.$k")
                    if (nested != null) return nested
                }
                null
            }
            else -> null
        }
    }
}
