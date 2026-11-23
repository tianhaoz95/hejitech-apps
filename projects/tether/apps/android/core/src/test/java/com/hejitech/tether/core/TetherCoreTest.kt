package com.hejitech.tether.core

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TetherCoreTest {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    @Test
    fun defaultPaneTreeAndSerializationRoundTrip() {
        val tree = PaneTreeOps.createDefaultPaneTree()
        assertEquals(2, PaneTreeOps.countPanes(tree.root))
        val encoded = json.encodeToString(tree)
        val decoded = json.decodeFromString<PaneTree>(encoded)
        assertEquals(tree, decoded)
    }

    @Test
    fun splitUpToMax4PanesAndCloseRebalance() {
        var tree = PaneTreeOps.createDefaultPaneTree()
        tree = PaneTreeOps.splitPane(tree, direction = SplitDirection.VERTICAL, newPaneId = "pane-3")
        assertEquals(3, PaneTreeOps.countPanes(tree.root))

        tree = PaneTreeOps.splitPane(tree, direction = SplitDirection.HORIZONTAL, newPaneId = "pane-4")
        assertEquals(4, PaneTreeOps.countPanes(tree.root))

        // 5th split rejected
        val fifth = PaneTreeOps.splitPane(tree, direction = SplitDirection.VERTICAL, newPaneId = "pane-5")
        assertEquals(4, PaneTreeOps.countPanes(fifth.root))

        tree = PaneTreeOps.closePane(tree, "pane-4")
        assertEquals(3, PaneTreeOps.countPanes(tree.root))
        tree = PaneTreeOps.closePane(tree, "pane-3")
        assertEquals(2, PaneTreeOps.countPanes(tree.root))
        tree = PaneTreeOps.closePane(tree, "pane-2")
        assertEquals(1, PaneTreeOps.countPanes(tree.root))
    }

    @Test
    fun layoutPresetsPreserveAllOpenTabsWithoutLoss() {
        var tree = PaneTreeOps.createDefaultPaneTree()
        val panes = PaneTreeOps.collectPanes(tree.root)
        tree = PaneTreeOps.openTab(
            tree,
            Tab(id = "tab-files-1", type = TabType.FILES, title = "Files: /", filesMode = FilesMode.LOCAL, path = "/"),
            panes[0].id
        )
        tree = PaneTreeOps.openTab(
            tree,
            Tab(id = "tab-web-2", type = TabType.WEB, title = "Web: docs", url = "https://example.com/docs"),
            panes[1].id
        )
        val expectedIds = PaneTreeOps.collectPanes(tree.root).flatMap { it.tabs }.map { it.id }.toSet()
        assertEquals(4, expectedIds.size)

        for (preset in LayoutPresetId.entries) {
            tree = PaneTreeOps.applyLayoutPreset(tree, preset)
            val currentIds = PaneTreeOps.collectPanes(tree.root).flatMap { it.tabs }.map { it.id }.toSet()
            assertTrue("Preset $preset lost tabs", currentIds.containsAll(expectedIds))
        }
    }

    @Test
    fun mandatoryHostKeyVerificationAndKeyGeneration() {
        val store = SecureCredentialStore(context = null)
        val key = SecureCredentialStore.generateSshKeyPair("Android Test Key")
        assertTrue(key.publicKeyOpenSsh.startsWith("ssh-rsa "))
        assertTrue(key.fingerprintSha256.startsWith("SHA256:"))
        store.saveSshKey(key, passphrase = "secret")
        assertEquals(1, store.listSshKeys().size)

        val s1 = store.verifyHostKeyFingerprint("example.invalid", 22, "ssh-ed25519", "SHA256:fp111")
        assertTrue(s1 is HostKeyVerificationResult.FirstConnect)

        store.trustHostKey(KnownHostKey("example.invalid", 22, "ssh-ed25519", "SHA256:fp111"))

        val s2 = store.verifyHostKeyFingerprint("example.invalid", 22, "ssh-ed25519", "SHA256:fp111")
        assertTrue(s2 is HostKeyVerificationResult.Matched)

        val s3 = store.verifyHostKeyFingerprint("example.invalid", 22, "ssh-ed25519", "SHA256:MITM_999")
        assertTrue(s3 is HostKeyVerificationResult.ChangedWarning)
    }

    @Test
    fun secretKeyRejectionAndAddressResolution() {
        val clean = json.parseToJsonElement("""{"host":"example.invalid","rememberPassword":true}""")
        assertNull(PaneTreeOps.findForbiddenSecretPath(clean))

        val dirty = json.parseToJsonElement("""{"hosts":[{"host":"example.invalid","privateKey":"SECRET"}]}""")
        assertEquals("root.hosts[0].privateKey", PaneTreeOps.findForbiddenSecretPath(dirty))

        assertEquals("https://example.com", PaneTreeOps.resolveAddressBarInput("example.com"))
        assertEquals("about:home", PaneTreeOps.resolveAddressBarInput("about:home"))
        assertFalse(PaneTreeOps.isMultiLinePaste("ls -la"))
        assertTrue(PaneTreeOps.isMultiLinePaste("echo 1\necho 2"))
        assertEquals("'/tmp/my file.txt'", PaneTreeOps.shellQuotedPath("/tmp/my file.txt"))
    }

    @Test
    fun presetAvoidsDuplicatePaneIdsAndPreservesTwoByTwoOrder() {
        var tree = PaneTreeOps.createDefaultPaneTree()
        tree = PaneTreeOps.closePane(tree, "pane-1")
        val twoCol = PaneTreeOps.applyLayoutPreset(tree, LayoutPresetId.TWO_COLUMN)
        val ids = PaneTreeOps.collectPanes(twoCol.root).map { it.id }
        assertEquals(2, ids.toSet().size)

        val grid1 = PaneTreeOps.applyLayoutPreset(twoCol, LayoutPresetId.TWO_BY_TWO)
        val order1 = PaneTreeOps.collectPanes(grid1.root).map { it.id }
        val grid2 = PaneTreeOps.applyLayoutPreset(grid1, LayoutPresetId.TWO_BY_TWO)
        val order2 = PaneTreeOps.collectPanes(grid2.root).map { it.id }
        assertEquals(order1, order2)
    }
}
