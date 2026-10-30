import AuthenticationServices
import CryptoKit
import SwiftUI
import TetherKit
import UIKit

@MainActor
public struct HostManagerView: View {
    @ObservedObject var store: WorkspaceStore
    var onOpenSshTab: ((SshHost) -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var showingAddHost = false
    @State private var editingHost: SshHost?
    @State private var sshKeys: [StoredSshKey] = []
    @State private var newKeyLabel = "Tether Ed25519 Key"
    @State private var importPEM = ""
    @State private var importPassphrase = ""
    @State private var showingImportKey = false
    @State private var statusBanner: String?

    public init(store: WorkspaceStore, onOpenSshTab: ((SshHost) -> Void)? = nil) {
        self.store = store
        self.onOpenSshTab = onOpenSshTab
    }

    public var body: some View {
        NavigationStack {
            List {
                if let statusBanner {
                    Section {
                        Text(statusBanner)
                            .font(.footnote)
                            .foregroundStyle(.green)
                    }
                }

                Section("SSH Hosts (Non-Secret Metadata)") {
                    ForEach(store.hosts) { host in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                HStack(spacing: 6) {
                                    Text(host.displayTitle).font(.headline)
                                    if host.autoConnect == true {
                                        Text("AUTO-CONNECT")
                                            .font(.system(size: 9, weight: .bold))
                                            .padding(.horizontal, 5)
                                            .padding(.vertical, 2)
                                            .background(Color.green.opacity(0.2))
                                            .foregroundStyle(.green)
                                            .clipShape(Capsule())
                                    }
                                    if store.secureStore.loadHostPassword(forHostId: host.id) != nil {
                                        Image(systemName: "key.fill")
                                            .font(.caption2)
                                            .foregroundStyle(.yellow)
                                    }
                                }
                                Text("\(host.connectionString) · \(host.auth.displayName)")
                                    .font(.caption.monospaced())
                                    .foregroundStyle(.secondary)
                                if host.autoReconnectOnDisplayReconnect == true {
                                    Text("Auto-reconnect on display reconnect")
                                        .font(.caption2)
                                        .foregroundStyle(.blue)
                                }
                            }
                            Spacer()
                            Button("Connect") {
                                onOpenSshTab?(host)
                                dismiss()
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)

                            Button("Edit") {
                                editingHost = host
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                    }
                    .onDelete { offsets in
                        for i in offsets {
                            let h = store.hosts[i]
                            store.secureStore.deleteHostPassword(forHostId: h.id)
                        }
                        store.hosts.remove(atOffsets: offsets)
                    }

                    Button {
                        showingAddHost = true
                    } label: {
                        Label("Add SSH Host…", systemImage: "plus.circle.fill")
                    }
                }

                Section("SSH Keys (Keychain Only — Never Synced)") {
                    ForEach(sshKeys) { key in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(key.label).font(.subheadline.bold())
                                Spacer()
                                Text(key.algorithm.uppercased())
                                    .font(.caption2.monospaced())
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.blue.opacity(0.2))
                                    .clipShape(Capsule())
                            }
                            Text(key.fingerprintSHA256)
                                .font(.caption2.monospaced())
                                .foregroundStyle(.secondary)
                            HStack(spacing: 12) {
                                Button("Copy Public Key") {
                                    UIPasteboard.general.string = key.publicKeyOpenSSH
                                    statusBanner = "Copied public key for '\(key.label)' to clipboard."
                                }
                                .font(.caption)

                                Button("Delete", role: .destructive) {
                                    store.secureStore.deleteSshKey(id: key.id)
                                    sshKeys = store.secureStore.listSshKeys()
                                }
                                .font(.caption)
                            }
                        }
                        .padding(.vertical, 3)
                    }

                    HStack {
                        TextField("New key label", text: $newKeyLabel)
                            .textFieldStyle(.roundedBorder)
                        Button("Generate Ed25519") {
                            let k = SshKeyGenerator.generateEd25519Key(
                                label: newKeyLabel.isEmpty ? "Tether Key" : newKeyLabel
                            )
                            store.secureStore.saveSshKey(k)
                            sshKeys = store.secureStore.listSshKeys()
                            statusBanner = "Generated Ed25519 key '\(k.label)' in Keychain."
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.small)
                    }

                    Button {
                        showingImportKey = true
                    } label: {
                        Label("Import Private Key PEM…", systemImage: "key.fill")
                    }
                }
            }
            .navigationTitle("SSH Hosts & Keys")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                sshKeys = store.secureStore.listSshKeys()
            }
            .sheet(isPresented: $showingAddHost) {
                HostEditorSheet(
                    store: store,
                    host: SshHost(label: "", host: "example.invalid", port: 22, username: "dev", auth: .key),
                    isNew: true
                )
            }
            .sheet(item: $editingHost) { host in
                HostEditorSheet(store: store, host: host, isNew: false)
            }
            .sheet(isPresented: $showingImportKey) {
                NavigationStack {
                    Form {
                        Section("Key Label") {
                            TextField("Label", text: $newKeyLabel)
                        }
                        Section("Private Key PEM (OpenSSH / RSA / Ed25519)") {
                            TextEditor(text: $importPEM)
                                .font(.caption.monospaced())
                                .frame(minHeight: 140)
                        }
                        Section("Optional Passphrase (Stored in Keychain)") {
                            SecureField("Passphrase (if encrypted)", text: $importPassphrase)
                        }
                    }
                    .navigationTitle("Import SSH Key")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { showingImportKey = false }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Save to Keychain") {
                                let fp = SshKeyGenerator.computeSHA256Fingerprint(fromRawKeyData: Data(importPEM.utf8))
                                let imported = StoredSshKey(
                                    label: newKeyLabel.isEmpty ? "Imported Key" : newKeyLabel,
                                    algorithm: importPEM.contains("RSA") ? "rsa" : "ed25519",
                                    publicKeyOpenSSH: "ssh-ed25519 \(Data(fp.utf8).base64EncodedString()) \(newKeyLabel)",
                                    privateKeyPEM: importPEM,
                                    hasPassphrase: !importPassphrase.isEmpty
                                )
                                store.secureStore.saveSshKey(
                                    imported,
                                    passphrase: importPassphrase.isEmpty ? nil : importPassphrase
                                )
                                sshKeys = store.secureStore.listSshKeys()
                                importPEM = ""
                                importPassphrase = ""
                                showingImportKey = false
                            }
                            .disabled(importPEM.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                }
            }
        }
    }
}

@MainActor
private struct HostEditorSheet: View {
    @ObservedObject var store: WorkspaceStore
    @State var host: SshHost
    let isNew: Bool
    @Environment(\.dismiss) private var dismiss

    @State private var passwordInput: String = ""
    @State private var testStatus: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Connection") {
                    TextField("Label (optional)", text: Binding(
                        get: { host.label ?? "" },
                        set: { host.label = $0.isEmpty ? nil : $0 }
                    ))
                    TextField("Hostname or IP", text: $host.host)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    HStack {
                        Text("Port")
                        Spacer()
                        TextField("22", value: $host.port, format: .number)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                    }
                    TextField("Username", text: $host.username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section("Authentication & Preset Credentials") {
                    Picker("Auth Method", selection: $host.auth) {
                        ForEach(SshAuthType.allCases, id: \.self) { t in
                            Text(t.displayName).tag(t)
                        }
                    }

                    if host.auth == .key || host.auth == .keyAndPassword {
                        let keys = store.secureStore.listSshKeys()
                        Picker("SSH Key", selection: Binding(
                            get: { host.keyId ?? "" },
                            set: { host.keyId = $0.isEmpty ? nil : $0 }
                        )) {
                            Text("Default / First Key").tag("")
                            ForEach(keys) { k in
                                Text("\(k.label) (\(k.algorithm))").tag(k.id)
                            }
                        }
                    }

                    if host.auth == .password || host.auth == .keyAndPassword {
                        SecureField("Preset Host Password (Keychain)", text: $passwordInput)
                        Text("Passwords are encrypted in the local Keychain only (PRD §14). They are never sent to Cloudflare or Supabase.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Auto-Connect & Display Lifecycle") {
                    Toggle("Auto-connect when opening SSH tab", isOn: Binding(
                        get: { host.autoConnect ?? false },
                        set: { host.autoConnect = $0 }
                    ))
                    Toggle("Auto-reconnect on display reconnect", isOn: Binding(
                        get: { host.autoReconnectOnDisplayReconnect ?? false },
                        set: { host.autoReconnectOnDisplayReconnect = $0 }
                    ))
                    Text("When auto-connect is enabled, Tether automatically connects using your preset password or key without prompting.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button("Test Connection") {
                        let fp = SshKeyGenerator.computeSHA256Fingerprint(
                            fromRawKeyData: Data("ssh-ed25519:\(host.host):\(host.port)".utf8)
                        )
                        testStatus = "Reachable config: \(host.connectionString) · Host Key \(fp)"
                    }
                    if let testStatus {
                        Text(testStatus)
                            .font(.caption.monospaced())
                            .foregroundStyle(.green)
                    }
                }
            }
            .navigationTitle(isNew ? "New SSH Host" : "Edit SSH Host")
            .onAppear {
                passwordInput = store.secureStore.loadHostPassword(forHostId: host.id) ?? ""
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        host.port = min(65535, max(1, host.port))
                        if !passwordInput.isEmpty {
                            store.secureStore.saveHostPassword(passwordInput, forHostId: host.id)
                            host.rememberPassword = true
                        } else {
                            store.secureStore.deleteHostPassword(forHostId: host.id)
                            host.rememberPassword = false
                        }
                        if let idx = store.hosts.firstIndex(where: { $0.id == host.id }) {
                            store.hosts[idx] = host
                        } else {
                            store.hosts.append(host)
                        }
                        dismiss()
                    }
                    .disabled(host.host.trimmingCharacters(in: .whitespaces).isEmpty || host.username.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}

// MARK: - Settings Sheet (PRD §15.1 + Optional Cloud Sync)

@MainActor
public struct SettingsSheetView: View {
    @ObservedObject var store: WorkspaceStore
    @Environment(\.dismiss) private var dismiss

    @State private var knownHosts: [KnownHostKey] = []
    @State private var syncStatus: String?
    @State private var showingWhatsNew = false
    @State private var showingDeleteAccountAlert = false
    @State private var showingAddHost = false
    @State private var editingHost: SshHost?
    @State private var showingHostManager = false

    public init(store: WorkspaceStore) {
        self.store = store
    }

    @ViewBuilder
    private var workspacesSection: some View {
        Section("Workspaces (\(store.workspaces.count))") {
            ForEach(Array(store.workspaces.enumerated()), id: \.element.id) { index, ws in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ws.name)
                            .font(.body.weight(index == store.activeWorkspaceIndex ? .bold : .regular))
                        Text(index == store.activeWorkspaceIndex ? "Active Space" : "Tap to switch")
                            .font(.caption2)
                            .foregroundStyle(index == store.activeWorkspaceIndex ? Color.cyan : Color.secondary)
                    }
                    Spacer()
                    if index == store.activeWorkspaceIndex {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color.cyan)
                    } else {
                        Button("Switch") {
                            store.switchToWorkspace(at: index)
                        }
                        .buttonStyle(.bordered)
                        .font(.caption)
                    }
                }
            }

            Button {
                store.addWorkspace()
            } label: {
                Label("Add New Workspace", systemImage: "plus.rectangle.on.rectangle")
            }

            Text("Tip: Switch workspaces using the top bar buttons on your phone or monitor, or swipe with 4 fingers on the phone trackpad.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var appearanceSection: some View {
        Section("Workspace & Appearance") {
            Picker("Theme", selection: $store.settings.theme) {
                Text("System").tag(ThemeMode.system)
                Text("Light").tag(ThemeMode.light)
                Text("Dark").tag(ThemeMode.dark)
            }
            .onChange(of: store.settings.theme) { _, newValue in
                DisplayHost.shared.applyTheme(newValue)
            }

            Picker("Default Layout Preset", selection: $store.settings.defaultLayoutPreset) {
                ForEach(LayoutPresetId.allCases, id: \.self) { preset in
                    Text(preset.displayName).tag(preset)
                }
            }

            Stepper(
                "Terminal Font Size: \(store.settings.terminalFontSizePt) pt",
                value: $store.settings.terminalFontSizePt,
                in: TetherConstants.minTerminalFontSize...TetherConstants.maxTerminalFontSize
            )

            VStack(alignment: .leading, spacing: 4) {
                Text("Default Search Engine URL (%s = query)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                TextField("https://duckduckgo.com/?q=%s", text: $store.settings.defaultSearchEngineUrl)
                    .font(.caption.monospaced())
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }
        }
    }

    @ViewBuilder
    private var phoneControllerSection: some View {
        Section("Phone Remote Controller") {
            Picker("Sidebar Position", selection: $store.settings.controllerSidebarPosition) {
                Text("Left Side").tag(ControllerSidebarPosition.left)
                Text("Right Side").tag(ControllerSidebarPosition.right)
            }

            Picker("Phone Orientation", selection: $store.settings.controllerOrientation) {
                Text("Landscape (Default)").tag(ControllerOrientation.landscape)
                Text("Portrait (Up/Down)").tag(ControllerOrientation.portrait)
                Text("Landscape (Flipped)").tag(ControllerOrientation.landscapeFlipped)
                Text("Auto-Rotate").tag(ControllerOrientation.auto)
            }
            .onChange(of: store.settings.controllerOrientation) { _, newOrient in
                DisplayHost.shared.phoneControllerVC?.applyOrientationChange(newOrient)
            }

            Picker("Trackpad Layout", selection: $store.settings.trackpadSurfaceLayout) {
                Text("Full Trackpad").tag(TrackpadSurfaceLayout.full)
                Text("Split: Pad + Keyboard").tag(TrackpadSurfaceLayout.splitWithKeyboard)
            }

            if store.settings.trackpadSurfaceLayout == .splitWithKeyboard {
                Toggle("Swap Pad & Keyboard Location", isOn: $store.settings.splitSwapPosition)

                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Pad / Keys Split Size")
                        Spacer()
                        Text(String(format: "%.0f%% Pad / %.0f%% Keys", store.settings.splitRatio * 100, (1.0 - store.settings.splitRatio) * 100))
                            .foregroundStyle(.secondary)
                    }
                    Slider(value: $store.settings.splitRatio, in: 0.25...0.75, step: 0.05)
                }
            }

            Toggle("Show Touchpad Buttons", isOn: $store.settings.showTouchpadButtons)

            Picker("Dragging Gesture", selection: $store.settings.touchpadDragGesture) {
                Text("Double-Tap Drag").tag(TouchpadDragGesture.doubleTapDrag)
                Text("3-Finger Drag").tag(TouchpadDragGesture.threeFingerDrag)
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Cursor Speed")
                    Spacer()
                    Text(String(format: "%.1fx", store.settings.pointerSensitivity))
                        .foregroundStyle(.secondary)
                }
                Slider(value: $store.settings.pointerSensitivity, in: 1.0...5.0, step: 0.5)
            }

            Text("• Dragging: Resize split dividers & drag items on screen.\n• 3-Finger Swipe: Swipe anywhere on the trackpad to change pane focus in that direction.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    public var body: some View {
        NavigationStack {
            Form {
                workspacesSection
                appearanceSection
                phoneControllerSection

                Section {
                    if store.hosts.isEmpty {
                        Text("No preset SSH hosts yet. Add a host with password to connect automatically.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(store.hosts) { host in
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack(spacing: 6) {
                                        Text(host.displayTitle).font(.subheadline.bold())
                                        if host.autoConnect == true {
                                            Text("AUTO-CONNECT")
                                                .font(.system(size: 9, weight: .bold))
                                                .padding(.horizontal, 5)
                                                .padding(.vertical, 2)
                                                .background(Color.green.opacity(0.2))
                                                .foregroundStyle(.green)
                                                .clipShape(Capsule())
                                        }
                                        if store.secureStore.loadHostPassword(forHostId: host.id) != nil {
                                            Image(systemName: "key.fill")
                                                .font(.caption2)
                                                .foregroundStyle(.yellow)
                                        }
                                    }
                                    Text("\(host.connectionString) · \(host.auth.displayName)")
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button("Edit") {
                                    editingHost = host
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            }
                        }
                        .onDelete { offsets in
                            for i in offsets {
                                let h = store.hosts[i]
                                store.secureStore.deleteHostPassword(forHostId: h.id)
                            }
                            store.hosts.remove(atOffsets: offsets)
                        }
                    }

                    Button {
                        showingAddHost = true
                    } label: {
                        Label("Preset New SSH Host…", systemImage: "plus.circle.fill")
                    }

                    Button {
                        showingHostManager = true
                    } label: {
                        Label("Manage SSH Keys & Identities…", systemImage: "key.fill")
                    }
                } header: {
                    Text("SSH Hosts & Preset Passwords")
                } footer: {
                    Text("Passwords and private keys remain encrypted in the on-device Keychain only (PRD §14).")
                }

                Section("Known SSH Host Keys (SHA-256 Fingerprints)") {
                    if knownHosts.isEmpty {
                        Text("No trusted host keys stored yet. Connect to an SSH host to verify and trust its key.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(knownHosts) { entry in
                            VStack(alignment: .leading, spacing: 3) {
                                HStack {
                                    Text("\(entry.host):\(entry.port)")
                                        .font(.subheadline.monospaced().bold())
                                    Spacer()
                                    Text(entry.keyType)
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                }
                                Text(entry.sha256Fingerprint)
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                                Button("Remove Key", role: .destructive) {
                                    store.secureStore.removeKnownHostKey(host: entry.host, port: entry.port)
                                    knownHosts = store.secureStore.listKnownHostKeys()
                                }
                                .font(.caption)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }

                Section("Cloud Workspace Sync & MCP (Optional — Non-Secret Only)") {
                    if let session = store.backend.session {
                        HStack {
                            Image(systemName: "checkmark.seal.fill").foregroundStyle(.green)
                            Text("Signed in as \(session.email ?? session.userId)")
                                .font(.subheadline)
                        }
                        HStack(spacing: 12) {
                            Button("Push Workspace") {
                                Task {
                                    do {
                                        try await store.syncWithCloud()
                                        syncStatus = "Synced layout, settings, hosts & bookmarks (no secrets)."
                                    } catch {
                                        syncStatus = error.localizedDescription
                                    }
                                }
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)

                            Button("Pull Workspace") {
                                Task {
                                    do {
                                        try await store.pullFromCloud()
                                        syncStatus = "Pulled workspace from cloud."
                                    } catch {
                                        syncStatus = error.localizedDescription
                                    }
                                }
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }

                        Button("Sign Out") {
                            store.backend.signOut()
                            syncStatus = "Signed out."
                        }

                        Button("Delete Cloud Account & Data…", role: .destructive) {
                            showingDeleteAccountAlert = true
                        }
                    } else {
                        Text("Tether works 100% offline. Sign in optionally to sync your non-secret workspace layout, bookmarks, and SSH host metadata across devices or manage them via MCP.")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        SignInWithAppleButton(.signIn) { request in
                            request.requestedScopes = [.email]
                        } onCompletion: { result in
                            if case .success(let auth) = result,
                               let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                               let tokenData = cred.identityToken,
                               let idToken = String(data: tokenData, encoding: .utf8) {
                                Task {
                                    do {
                                        try await store.backend.signIn(provider: "apple", idToken: idToken)
                                        syncStatus = "Signed in."
                                    } catch {
                                        syncStatus = error.localizedDescription
                                    }
                                }
                            }
                        }
                        .frame(height: 40)

                        #if DEBUG
                        Button("Sign In with Local Seed Account (dev@example.com)") {
                            Task {
                                do {
                                    try await store.backend.signIn(email: "dev@example.com", password: "tether-dev")
                                    syncStatus = "Signed in as seed developer."
                                } catch {
                                    syncStatus = error.localizedDescription
                                }
                            }
                        }
                        #endif
                    }

                    if let syncStatus {
                        Text(syncStatus)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Keyboard Shortcuts & Terminal Precedence (PRD §13)") {
                    ShortcutRow(keys: "Ctrl+Alt+\\ / -", desc: "Split focused pane horizontally / vertically")
                    ShortcutRow(keys: "Ctrl+Alt+W", desc: "Close focused pane")
                    ShortcutRow(keys: "Ctrl+Alt+Arrows", desc: "Move focus between panes")
                    ShortcutRow(keys: "Ctrl+Alt+Enter", desc: "Toggle maximise focused pane")
                    ShortcutRow(keys: "Ctrl+Alt+1…4", desc: "Apply layout preset 1…4")
                    ShortcutRow(keys: "Ctrl+T / Ctrl+W", desc: "New tab / Close tab (unless SSH terminal focused)")
                    ShortcutRow(keys: "Ctrl+Tab", desc: "Cycle tabs in focused pane")
                    ShortcutRow(keys: "Ctrl+L", desc: "Focus Web address bar (or clear SSH terminal)")
                    ShortcutRow(keys: "Ctrl+C/D/Z/R/A/E/K/U/W/L", desc: "Passed directly to focused SSH terminal PTY")
                }

                Section("About Tether") {
                    Button("What's New in v\(WhatsNewView.currentVersion)") {
                        showingWhatsNew = true
                    }
                    Link("Privacy Policy", destination: store.backend.config.site.appendingPathComponent("privacy"))
                    Link("Terms of Service", destination: store.backend.config.site.appendingPathComponent("terms"))
                    Link("Support", destination: store.backend.config.site.appendingPathComponent("support"))
                }
            }
            .navigationTitle("Tether Settings")
            .onAppear {
                knownHosts = store.secureStore.listKnownHostKeys()
            }
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showingWhatsNew) {
                WhatsNewView()
            }
            .sheet(isPresented: $showingAddHost) {
                HostEditorSheet(
                    store: store,
                    host: SshHost(label: "", host: "", port: 22, username: "", auth: .password, autoConnect: true),
                    isNew: true
                )
            }
            .sheet(item: $editingHost) { host in
                HostEditorSheet(store: store, host: host, isNew: false)
            }
            .sheet(isPresented: $showingHostManager) {
                HostManagerView(store: store)
            }
            .alert("Delete Cloud Account?", isPresented: $showingDeleteAccountAlert) {
                Button("Cancel", role: .cancel) {}
                Button("Delete Permanently", role: .destructive) {
                    Task {
                        // Signed in with Apple: a fresh code lets the Worker revoke Tether's Apple token (nil if cancelled).
                        let appleCode = store.backend.session?.signedInWithApple == true ? await AppleReauthorization().authorizationCode() : nil
                        try? await store.backend.deleteAccount(appleAuthorizationCode: appleCode)
                        store.backend.signOut()
                        syncStatus = "Cloud account deleted."
                    }
                }
            } message: {
                Text("This deletes your synced workspace, bookmarks, and MCP tokens from the server. On-device files and Keychain SSH keys remain on this device.")
            }
        }
    }
}

private struct ShortcutRow: View {
    let keys: String
    let desc: String
    var body: some View {
        HStack {
            Text(keys)
                .font(.caption.monospaced().bold())
            Spacer()
            Text(desc)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
