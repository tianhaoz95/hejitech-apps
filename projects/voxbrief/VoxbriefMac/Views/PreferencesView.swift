import AppKit
import ServiceManagement
import SwiftUI

/// Mac Settings window. Mirrors the iPhone app's `SettingsView` where it makes sense to behave
/// identically (same `@AppStorage` keys for the Ollama toggle, same `OnDeviceLLMService` for the
/// on-device model tier) plus the Mac-only permission/launch-at-login controls this app needs.
struct PreferencesView: View {
    @AppStorage("use_local_llm_endpoint") private var useLocalLLM: Bool = false
    @AppStorage("local_llm_endpoint_url") private var localLLMUrl: String = "http://127.0.0.1:11434/api/generate"
    @AppStorage(LLMCopywriterService.localLLMModelNameKey) private var localLLMModel: String = LLMCopywriterService.defaultLocalLLMModelName
    @AppStorage(ASRService.languageStorageKey) private var asrLanguage: String = "auto"
    @AppStorage(TranscriptionEngine.storageKey) private var transcriptionEngine: String = TranscriptionEngine.whisper.rawValue
    @AppStorage("launch_at_login") private var launchAtLoginStored: Bool = false
    @AppStorage("auto_check_for_updates") private var autoCheckForUpdates: Bool = true
    @AppStorage(NoteProcessingPipeline.defaultTemplateChoiceKey) private var defaultTemplateChoice: TemplateChoice = .none
    @ObservedObject private var templateStore = TemplateStore.shared

    /// Default Format choices: cleaned text, auto-detect, then each enabled template (plus the
    /// current default if that template has since been disabled).
    private var defaultFormatOptions: [TemplateChoice] {
        var options: [TemplateChoice] = [.none, .auto] + templateStore.enabledTemplates.map { .template($0.id) }
        if !options.contains(defaultTemplateChoice) { options.append(defaultTemplateChoice) }
        return options
    }

    @ObservedObject var accessibility: AccessibilityPermissionManager
    let repository: NoteRepository
    @StateObject private var microphone = MicrophonePermissionManager.shared
    @StateObject private var llmService = OnDeviceLLMService.shared
    @StateObject private var dictionaryStore = PersonalDictionaryStore.shared
    @StateObject private var updateChecker = UpdateChecker.shared
    @StateObject private var shortcutStore = FeedbackShortcutStore.shared
    @StateObject private var captureShortcutStore = CaptureShortcutStore.shared
    @StateObject private var cloudSync = CloudSyncService.shared
    @StateObject private var autoExport = AutoExportService.shared
    @State private var appleSpeechStatus: String?
    @State private var exportStatusMessage: String?
    @Environment(\.openWindow) private var openWindow
    @Environment(\.openURL) private var openURL

    private static let byteFormatter: ByteCountFormatter = {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter
    }()

    var body: some View {
        Form {
            Section("Capture") {
                LabeledContent("Global Hotkey") {
                    HStack(spacing: 8) {
                        Text(captureShortcutStore.currentShortcut.displayString)
                            .font(.system(.body, design: .monospaced).weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.appTertiaryFill)
                            .clipShape(RoundedRectangle(cornerRadius: 6))

                        Button(captureShortcutStore.isRecording ? "Press Keys…" : "Record Shortcut") {
                            captureShortcutStore.toggleRecording()
                        }
                        .buttonStyle(.bordered)

                        if captureShortcutStore.isRecording {
                            Button("Cancel") {
                                captureShortcutStore.cancelRecording()
                            }
                            .buttonStyle(.borderless)
                        }
                    }
                }

                Picker("Presets", selection: $captureShortcutStore.selectedPresetIndex) {
                    ForEach(0..<CaptureShortcut.presets.count, id: \.self) { index in
                        Text(CaptureShortcut.presets[index].name).tag(index)
                    }
                    if captureShortcutStore.isCustomShortcut {
                        Text("Custom (\(captureShortcutStore.currentShortcut.displayString))").tag(-1)
                    }
                }

                if captureShortcutStore.currentShortcut != CaptureShortcut.defaultShortcut {
                    Button("Reset to Default") {
                        captureShortcutStore.resetToDefault()
                    }
                    .font(.caption)
                }

                Toggle("Launch at Login", isOn: launchAtLoginBinding)
            }

            Section("Permissions") {
                permissionRow(
                    title: "Microphone",
                    isGranted: microphone.isAuthorized,
                    onFix: microphone.isAuthorized ? nil : { microphone.requestOrOpenSystemSettings() }
                )
                permissionRow(
                    title: "Accessibility",
                    isGranted: accessibility.isTrusted,
                    onFix: accessibility.isTrusted ? nil : { accessibility.requestAccessOrOpenSettings() }
                )
            }

            Section {
                Picker("Engine", selection: Binding(get: { transcriptionEngine }, set: { pickEngine($0) })) {
                    ForEach(TranscriptionEngine.allCases) { engine in
                        Text(engine.displayName).tag(engine.rawValue)
                    }
                }
                if let appleSpeechStatus {
                    Text(appleSpeechStatus)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Picker("Dictation Language", selection: $asrLanguage) {
                    Text("Auto-detect / English").tag("auto")
                    Text("English (en)").tag("en")
                    Text("Spanish (es)").tag("es")
                    Text("French (fr)").tag("fr")
                    Text("German (de)").tag("de")
                    Text("Italian (it)").tag("it")
                    Text("Portuguese (pt)").tag("pt")
                    Text("Chinese (zh)").tag("zh")
                    Text("Japanese (ja)").tag("ja")
                    Text("Korean (ko)").tag("ko")
                }
            } header: {
                Text("Stage 1: Speech-to-Text (ASR)")
            } footer: {
                Text(transcriptionEngine == TranscriptionEngine.appleSpeech.rawValue
                    ? "Apple Speech runs on this Mac using macOS's built-in speech recognizer. If it can't transcribe a recording, Whisper is used automatically."
                    : "WhisperKit runs completely on-device. Apple Speech is also available on macOS 26 and later.")
            }

            Section {
                Toggle("Use Local LLM Endpoint (Ollama)", isOn: $useLocalLLM)
                if useLocalLLM {
                    TextField("http://127.0.0.1:11434/api/generate", text: $localLLMUrl)
                        .font(.subheadline.monospaced())
                        .textFieldStyle(.roundedBorder)

                    HStack {
                        TextField("Model Name (e.g. llama3.2:1b)", text: $localLLMModel)
                            .font(.subheadline.monospaced())
                            .textFieldStyle(.roundedBorder)
                        Menu("Presets") {
                            Button("llama3.2:1b") { localLLMModel = "llama3.2:1b" }
                            Button("llama3.2:3b") { localLLMModel = "llama3.2:3b" }
                            Button("llama3:8b") { localLLMModel = "llama3:8b" }
                            Button("qwen2.5:7b") { localLLMModel = "qwen2.5:7b" }
                            Button("mistral:7b") { localLLMModel = "mistral:7b" }
                        }
                    }
                } else {
                    Picker("Model", selection: $llmService.modelPreference) {
                        ForEach(OnDeviceModelSelection.allCases) { selection in
                            Text(selection.displayName).tag(selection)
                        }
                    }

                    LabeledContent("Active Model") {
                        Text(llmService.activeModelDisplayName)
                            .foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("Stage 2: LLM Cleanup")
            } footer: {
                Text("When enabled, captures are sent to the endpoint below instead of the on-device model. Off by default so nothing ever leaves this Mac unless you opt in.")
            }

            Section {
                Picker("Default Format", selection: $defaultTemplateChoice) {
                    ForEach(defaultFormatOptions, id: \.self) { choice in
                        Text(choice.displayName(in: templateStore.allTemplates)).tag(choice)
                    }
                }
            } header: {
                Text("Note Format")
            } footer: {
                Text("Every note is cleaned up on this Mac: typos, grammar and filler words fixed, your wording kept. Pick a default format to also sort notes into a template; captures you dictate into other apps are always pasted as cleaned text. Format any note later from its Format chip.")
            }

            Section {
                Picker("Model Selection", selection: $llmService.modelPreference) {
                    ForEach(OnDeviceModelSelection.allCases) { selection in
                        Text(selection.displayName).tag(selection)
                    }
                }

                LabeledContent(AppleFoundationModelService.modelDisplayName) {
                    HStack(spacing: 8) {
                        Text(AppleFoundationModelService.isSupportedOnThisDevice ? "Built into your Mac" : "Unsupported on this Mac")
                            .foregroundStyle(.secondary)
                        if AppleFoundationModelService.isSupportedOnThisDevice {
                            if llmService.isUsingAppleFoundationModel {
                                Label("Active (Default)", systemImage: "checkmark.circle.fill")
                                    .foregroundStyle(.green)
                            } else {
                                Button("Set Active") {
                                    llmService.modelPreference = .appleFoundation
                                }
                            }
                        }
                    }
                }

                largeModelRow

                LabeledContent(OnDeviceLLMService.smallModelDisplayName) {
                    HStack(spacing: 8) {
                        Text("Fast and lightweight")
                            .foregroundStyle(.secondary)
                        if llmService.modelPreference == .small {
                            Label("Active", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                        } else {
                            Button("Set Active") {
                                llmService.modelPreference = .small
                            }
                        }
                    }
                }

                if llmService.modelPreference == .large && !llmService.isUsingLargeModel {
                    Text(AppleFoundationModelService.isSupportedOnThisDevice
                        ? "Flash is selected, but not downloaded yet. Using Apple Intelligence until downloaded."
                        : "Flash is selected, but not downloaded yet. Please download it to use it.")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            } header: {
                Text("On-Device Models")
            } footer: {
                Text(AppleFoundationModelService.isSupportedOnThisDevice
                    ? "Apple Intelligence is used by default with zero extra download. Lite and Flash are only used when you choose them."
                    : "On Macs with Apple Intelligence, it's used by default. On other Macs Lite is used, or download Flash for better results.")
            }

            Section(
                header: Text("Personal Dictionary"),
                footer: Text("Add jargon, product names, and people's names the on-device models don't know, so both Stage 1 (speech recognition) and Stage 2 (LLM cleanup) recognize and preserve them.")
            ) {
                Button {
                    openWindow(id: "dictionary")
                } label: {
                    LabeledContent("Manage Terms") {
                        Text("\(dictionaryStore.entries.count)")
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)
            }

            Section {
                Toggle("Sync with iCloud", isOn: $cloudSync.isEnabled)
                if cloudSync.isEnabled {
                    Toggle("Include Audio Files", isOn: $cloudSync.syncAudioFiles)
                    LabeledContent("Status") {
                        Text(cloudSync.status.displayText)
                            .foregroundStyle(.secondary)
                    }
                    if let last = cloudSync.lastSyncedAt {
                        LabeledContent("Last Synced") {
                            Text(last.formatted(date: .abbreviated, time: .shortened))
                                .foregroundStyle(.secondary)
                        }
                    }
                    Button("Sync Now") {
                        cloudSync.syncNow()
                    }
                }
            } header: {
                Text("iCloud Sync")
            } footer: {
                Text("Privately syncs your notes, personal dictionary, and custom templates between your iPhone and Mac through your own iCloud account. No Voxbrief server is ever used.")
            }

            Section {
                Toggle("Auto-Export Markdown Files", isOn: $autoExport.isEnabled)
                    .disabled(!autoExport.hasFolder)

                LabeledContent("Folder") {
                    HStack(spacing: 8) {
                        Text(autoExport.folderDisplayName ?? "Not Selected")
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Button(autoExport.hasFolder ? "Change…" : "Choose Folder…") {
                            chooseAutoExportFolder()
                        }
                    }
                }

                if autoExport.hasFolder {
                    HStack(spacing: 10) {
                        Button("Export All Notes Now") {
                            let count = autoExport.exportAll(repository.notes)
                            exportStatusMessage = "Exported \(count) note\(count == 1 ? "" : "s")."
                        }
                        Button("Clear Folder", role: .destructive) {
                            autoExport.clearFolder()
                            exportStatusMessage = nil
                        }
                    }
                }

                if let msg = exportStatusMessage ?? autoExport.lastError {
                    Text(msg)
                        .font(.caption)
                        .foregroundStyle(autoExport.lastError != nil ? .red : .secondary)
                }
            } header: {
                Text("Auto-Export Folder (Obsidian / Markdown)")
            } footer: {
                Text("Automatically writes and updates a Markdown file with YAML frontmatter whenever a note finishes processing or is edited. Locked notes are never exported.")
            }


            Section {
                Toggle("Enable Feedback Shortcut", isOn: $shortcutStore.currentShortcut.isEnabled)

                if shortcutStore.currentShortcut.isEnabled {
                    LabeledContent("Shortcut") {
                        HStack(spacing: 8) {
                            Text(shortcutStore.currentShortcut.displayString)
                                .font(.system(.body, design: .monospaced).weight(.semibold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.appTertiaryFill)
                                .clipShape(RoundedRectangle(cornerRadius: 6))

                            Button(shortcutStore.isRecording ? "Press Keys…" : "Record Shortcut") {
                                shortcutStore.toggleRecording()
                            }
                            .buttonStyle(.bordered)

                            if shortcutStore.isRecording {
                                Button("Cancel") {
                                    shortcutStore.cancelRecording()
                                }
                                .buttonStyle(.borderless)
                            }
                        }
                    }

                    Picker("Presets", selection: $shortcutStore.selectedPresetIndex) {
                        ForEach(0..<FeedbackShortcut.presets.count, id: \.self) { index in
                            Text(FeedbackShortcut.presets[index].name).tag(index)
                        }
                        if shortcutStore.isCustomShortcut {
                            Text("Custom (\(shortcutStore.currentShortcut.displayString))").tag(-1)
                        }
                    }

                    if shortcutStore.currentShortcut != FeedbackShortcut.defaultShortcut {
                        Button("Reset to Default") {
                            shortcutStore.resetToDefault()
                        }
                        .font(.caption)
                    }
                }
            } header: {
                Text("Feedback")
            } footer: {
                Text("Press this shortcut from anywhere to open the feedback and bug report screen.")
            }

            Section(header: Text("Updates")) {
                Toggle("Automatically Check for Updates", isOn: $autoCheckForUpdates)
                updateStatusRow
            }
        }
        .formStyle(.grouped)
        .frame(width: 480, height: 760)
        .trackFeedbackScreen("Preferences")
        .onAppear { microphone.refresh() }
        .task {
            if autoCheckForUpdates, updateChecker.state == .idle {
                await updateChecker.checkNow()
            }
        }
    }

    @ViewBuilder
    private var updateStatusRow: some View {
        switch updateChecker.state {
        case .idle, .checking:
            HStack {
                Text("Checking for updates…")
                    .foregroundStyle(.secondary)
                Spacer()
                ProgressView()
                    .controlSize(.small)
            }
        case .upToDate:
            LabeledContent("Status") {
                Label("Up to Date", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            }
            Button("Check for Updates") {
                Task { await updateChecker.checkNow() }
            }
        case .updateAvailable(let update):
            VStack(alignment: .leading, spacing: 6) {
                LabeledContent("Status") {
                    Label("Version \(update.version) Available", systemImage: "arrow.down.circle.fill")
                        .foregroundStyle(.blue)
                }
                HStack {
                    Button("Download") { openURL(update.downloadURL) }
                    Button("Release Notes") { openURL(update.releasePageURL) }
                }
            }
        case .failed(let message):
            VStack(alignment: .leading, spacing: 4) {
                LabeledContent("Status") {
                    Label("Check Failed", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                }
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Retry") {
                    Task { await updateChecker.checkNow() }
                }
            }
        }
    }

    private var launchAtLoginBinding: Binding<Bool> {
        Binding(
            get: { launchAtLoginStored },
            set: { newValue in
                do {
                    if newValue {
                        try SMAppService.mainApp.register()
                    } else {
                        try SMAppService.mainApp.unregister()
                    }
                    launchAtLoginStored = newValue
                } catch {
                    print("[PreferencesView] Failed to \(newValue ? "register" : "unregister") launch-at-login: \(error)")
                }
            }
        )
    }

    @ViewBuilder
    private func permissionRow(title: String, isGranted: Bool, onFix: (() -> Void)?) -> some View {
        LabeledContent(title) {
            if isGranted {
                Label("Granted", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
            } else {
                Button("Open System Settings") { onFix?() }
            }
        }
    }

    @ViewBuilder
    private var largeModelRow: some View {
        switch llmService.largeModelState {
        case .notDownloaded:
            LabeledContent(OnDeviceLLMService.largeModelDisplayName) {
                Button("Download (\(Self.byteFormatter.string(fromByteCount: OnDeviceLLMService.largeModelApproxDownloadBytes)))") {
                    llmService.downloadLargeModel()
                }
            }
        case .downloading(let progress):
            VStack(alignment: .leading, spacing: 4) {
                LabeledContent(OnDeviceLLMService.largeModelDisplayName) {
                    Button("Cancel") { llmService.cancelDownload() }
                }
                ProgressView(value: progress)
            }
        case .ready:
            LabeledContent(OnDeviceLLMService.largeModelDisplayName) {
                HStack(spacing: 8) {
                    if llmService.isUsingLargeModel {
                        Label("Active", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    } else {
                        Button("Set Active") {
                            llmService.modelPreference = .large
                        }
                    }
                    Button("Delete", role: .destructive) { llmService.deleteLargeModel() }
                }
            }
        case .failed(let message):
            VStack(alignment: .leading, spacing: 4) {
                LabeledContent(OnDeviceLLMService.largeModelDisplayName) {
                    Button("Retry") { llmService.downloadLargeModel() }
                }
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func pickEngine(_ raw: String) {
        guard raw == TranscriptionEngine.appleSpeech.rawValue else {
            transcriptionEngine = raw
            appleSpeechStatus = nil
            return
        }
        guard #available(macOS 26.0, *), TranscriptionEngine.appleSpeechSupported else {
            appleSpeechStatus = "Apple Speech needs macOS 26 or later."
            return
        }
        appleSpeechStatus = "Getting Apple Speech ready…"
        Task {
            do {
                try await AppleSpeechTranscriber.prepareAssets()
                transcriptionEngine = raw
                appleSpeechStatus = "Apple Speech is ready."
            } catch {
                appleSpeechStatus = "Apple Speech couldn't be set up: \(error.localizedDescription) Whisper stays on."
            }
        }
    }

    private func chooseAutoExportFolder() {
        let panel = NSOpenPanel()
        panel.title = "Choose Markdown Export Folder"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.allowsMultipleSelection = false
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do {
            try autoExport.setFolder(url)
            exportStatusMessage = "Export folder set to \(url.lastPathComponent)."
        } catch {
            exportStatusMessage = "Couldn't set folder: \(error.localizedDescription)"
        }
    }
}
