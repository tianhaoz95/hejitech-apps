import SwiftUI
import UniformTypeIdentifiers

public struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("use_local_llm_endpoint") private var useLocalLLM: Bool = false
    @AppStorage("local_llm_endpoint_url") private var localLLMUrl: String = "http://127.0.0.1:11434/api/generate"
    @AppStorage(LLMCopywriterService.localLLMModelNameKey) private var localLLMModel: String = LLMCopywriterService.defaultLocalLLMModelName
    @AppStorage(ASRService.languageStorageKey) private var asrLanguage: String = "auto"
    @AppStorage(TranscriptionEngine.storageKey) private var transcriptionEngine: String = TranscriptionEngine.whisper.rawValue
    @State private var appleSpeechStatus: String?
    @AppStorage("app_appearance") private var appearance: String = "system"
    @AppStorage(NoteProcessingPipeline.defaultTemplateChoiceKey) private var defaultTemplateChoice: TemplateChoice = .none
    @AppStorage(LiveTranscriber.enabledKey) private var liveTranscriptEnabled: Bool = true
    @AppStorage(FeedbackSettings.shakeEnabledKey) private var feedbackShakeEnabled: Bool = true
    @AppStorage("playback_trim_silence") private var trimSilence: Bool = false
    @AppStorage(BackgroundProcessingManager.keepScreenOnKey) private var keepScreenOn: Bool = false
    @StateObject private var llmService = OnDeviceLLMService.shared
    @StateObject private var dictionaryStore = PersonalDictionaryStore.shared
    @StateObject private var templateStore = TemplateStore.shared

    /// Settings' Default Format choices: cleaned text, auto-detect, then each enabled template
    /// (plus the current default if that template has since been disabled).
    private var defaultFormatOptions: [TemplateChoice] {
        var options: [TemplateChoice] = [.none, .auto] + templateStore.enabledTemplates.map { .template($0.id) }
        if !options.contains(defaultTemplateChoice) { options.append(defaultTemplateChoice) }
        return options
    }
    @StateObject private var watchSync = WatchSyncService.shared
    @State private var showingSimulationAlert = false
    @State private var simulatedTitle = ""
    @State private var storageUsage: AudioFileManager.StorageUsage = AudioFileManager.shared.calculateStorageUsage()
    @State private var showingPurgeAlert = false
    @State private var purgeResult = ""
    @State private var showingWhatsNew = false
    @State private var showingFileImporter = false
    @State private var showingBackupAlert = false
    @State private var backupAlertMessage = ""

    private static let byteFormatter: ByteCountFormatter = {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter
    }()

    public init() {}

    /// Picking Apple Speech has iOS install the language's model now, so the first recording
    /// doesn't wait for it; if that fails, Whisper stays.
    private func pickEngine(_ raw: String) {
        guard raw == TranscriptionEngine.appleSpeech.rawValue else {
            transcriptionEngine = raw
            appleSpeechStatus = nil
            return
        }
        guard #available(iOS 26.0, *), TranscriptionEngine.appleSpeechSupported else {
            appleSpeechStatus = "Apple Speech needs iOS 26 or later."
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

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Appearance")) {
                    Picker("Theme", selection: $appearance) {
                        Text("System").tag("system")
                        Text("Light").tag("light")
                        Text("Dark").tag("dark")
                    }
                    .pickerStyle(.segmented)
                }

                Section(
                    header: Text("Stage 1: Speech-to-Text (ASR)"),
                    footer: Text(transcriptionEngine == TranscriptionEngine.appleSpeech.rawValue
                        ? "Apple Speech is built into iOS and runs on this iPhone: many languages, no download from Voxbrief, made for long recordings. Live text while recording stays on Whisper, and if Apple Speech can't transcribe a recording, Whisper does."
                        : "WhisperKit runs completely on-device. Set language to bias speech recognition, or leave on Auto-detect. Apple Speech is the other engine on iOS 26 and later.")
                ) {
                    Picker(selection: Binding(get: { transcriptionEngine }, set: { pickEngine($0) })) {
                        ForEach(TranscriptionEngine.allCases) { engine in
                            Text(engine.displayName).tag(engine.rawValue)
                        }
                    } label: {
                        Text("Engine")
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
                }

                Section(
                    header: Text("Audio Playback"),
                    footer: Text("Automatically skip long pauses and silence (>1.2s) during playback. Can be toggled off at any time.")
                ) {
                    Toggle("Trim Silence in Playback", isOn: $trimSilence)
                }

                Section(
                    header: Text("Processing"),
                    footer: Text("Keeps your iPhone from locking while Voxbrief is processing notes, so long recordings finish without waiting for you to open the app again. The screen locks as usual once processing is done. Uses more battery while on.")
                ) {
                    Toggle("Keep Screen On While Processing", isOn: $keepScreenOn)
                }

                Section(
                    header: Text("Stage 2: LLM Cleanup"),
                    footer: Text("When enabled, notes are sent to the endpoint below instead of the on-device model. Off by default so nothing ever leaves this device unless you opt in.")
                ) {
                    Toggle("Use Local LLM Endpoint (Ollama)", isOn: $useLocalLLM)

                    if useLocalLLM {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Endpoint URL")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            TextField("http://127.0.0.1:11434/api/generate", text: $localLLMUrl)
                                .font(.subheadline.monospaced())
                                .textFieldStyle(.roundedBorder)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text("Model Name")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Spacer()
                                Menu("Presets") {
                                    Button("llama3.2:1b") { localLLMModel = "llama3.2:1b" }
                                    Button("llama3.2:3b") { localLLMModel = "llama3.2:3b" }
                                    Button("llama3:8b") { localLLMModel = "llama3:8b" }
                                    Button("qwen2.5:7b") { localLLMModel = "qwen2.5:7b" }
                                    Button("mistral:7b") { localLLMModel = "mistral:7b" }
                                }
                                .font(.caption)
                            }
                            TextField("llama3.2:1b", text: $localLLMModel)
                                .font(.subheadline.monospaced())
                                .textFieldStyle(.roundedBorder)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                        }
                    } else {
                        Picker("Model", selection: $llmService.modelPreference) {
                            ForEach(OnDeviceModelSelection.allCases) { selection in
                                Text(selection.displayName).tag(selection)
                            }
                        }

                        HStack {
                            Label("Active Model", systemImage: "cpu")
                            Spacer()
                            Text(activeModelSummary)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section(
                    header: Text("iPhone Action Button & Controls"),
                    footer: Text("Set your iPhone Action Button or Control Center to \"Start Capture\" to instantly record voice notes hands-free from anywhere.")
                ) {
                    NavigationLink {
                        ActionButtonGuideView()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "button.programmable")
                                .font(.title3)
                                .foregroundStyle(Color.accentColor)
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Configure Action Button")
                                    .foregroundStyle(.primary)
                                Text("Tap for step-by-step iOS setup guide")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Button {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        HStack {
                            Label("Open iPhone Settings", systemImage: "gearshape")
                            Spacer()
                            Image(systemName: "arrow.up.right")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                        }
                    }

                    Button {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                            NotificationCenter.default.post(
                                name: .voxbriefNavigate,
                                object: nil,
                                userInfo: ["screen": "record", "source": "action_button_test"]
                            )
                        }
                    } label: {
                        Label("Test Capture Trigger", systemImage: "play.circle")
                    }
                }

                Section(
                    header: Text("Live Transcript"),
                    footer: Text("Shows your words while you record on this iPhone. When it keeps up, the note skips the transcription step after you stop. Uses a little more battery while recording; Apple Watch recordings are transcribed after they sync, as before.")
                ) {
                    Toggle("Transcribe While Recording", isOn: $liveTranscriptEnabled)
                }

                Section(
                    header: Text("Note Format"),
                    footer: Text("Every note is cleaned up on-device: typos, grammar and filler words fixed, your wording kept. Pick a default format to also sort new notes into a template; you can pick one before each recording, or format any note later from its Format chip.")
                ) {
                    Picker("Default Format", selection: $defaultTemplateChoice) {
                        ForEach(defaultFormatOptions, id: \.self) { choice in
                            Text(choice.displayName(in: templateStore.allTemplates)).tag(choice)
                        }
                    }
                }

                Section(
                    header: Text("Personal Dictionary"),
                    footer: Text("Add jargon, product names, and people's names the on-device models don't know, so both Stage 1 (speech recognition) and Stage 2 (LLM cleanup) recognize and preserve them.")
                ) {
                    NavigationLink {
                        PersonalDictionaryView(store: dictionaryStore)
                    } label: {
                        HStack {
                            Label("Manage Terms", systemImage: "text.book.closed")
                            Spacer()
                            Text("\(dictionaryStore.entries.count)")
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Section(
                    header: Text("Templates"),
                    footer: Text("Voxbrief automatically picks the best-fitting template (Design Doc, Email, Short Tweet, General Notes, or one of your own) for each note's Stage 2 rewrite. Add your own to teach it a new format.")
                ) {
                    NavigationLink {
                        TemplatesView(store: templateStore)
                    } label: {
                        HStack {
                            Label("Manage Templates", systemImage: "doc.text")
                            Spacer()
                            Text("\(templateStore.allTemplates.count)")
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Section(
                    header: Text("On-Device Models"),
                    footer: Text(AppleFoundationModelService.isSupportedOnThisDevice
                        ? "Apple Intelligence is used by default with zero extra download. Lite and Flash are only used when you choose them."
                        : "On devices with Apple Intelligence, it's used by default. On other devices Lite is used, or download Flash for better results.")
                ) {
                    Picker("Model Preference", selection: $llmService.modelPreference) {
                        ForEach(OnDeviceModelSelection.allCases) { selection in
                            Text(selection.displayName).tag(selection)
                        }
                    }

                    modelRow(
                        name: AppleFoundationModelService.modelDisplayName,
                        detail: AppleFoundationModelService.isSupportedOnThisDevice
                            ? "Built into your device · Default"
                            : "Unavailable (requires Apple Intelligence)",
                        trailing: AnyView(
                            HStack(spacing: 8) {
                                appleFoundationModelStatusBadge
                                if AppleFoundationModelService.isSupportedOnThisDevice && !llmService.isUsingAppleFoundationModel {
                                    Button("Use This") {
                                        llmService.modelPreference = .appleFoundation
                                    }
                                    .font(.caption.weight(.semibold))
                                }
                            }
                        )
                    )

                    largeModelRow

                    modelRow(
                        name: OnDeviceLLMService.smallModelDisplayName,
                        detail: "Fast and lightweight · included",
                        trailing: AnyView(
                            HStack(spacing: 8) {
                                smallModelStatusBadge
                                if OnDeviceLLMService.isSupportedOnThisDevice && llmService.modelPreference != .small {
                                    Button("Use This") {
                                        llmService.modelPreference = .small
                                    }
                                    .font(.caption.weight(.semibold))
                                }
                            }
                        )
                    )

                    if llmService.modelPreference == .large && !llmService.isUsingLargeModel {
                        Text(AppleFoundationModelService.isSupportedOnThisDevice
                            ? "Flash is selected, but not downloaded yet. Using Apple Intelligence until downloaded."
                            : "Flash is selected, but not downloaded yet. Please download it to use it.")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
                
                Section(header: Text("Stage 1 ASR (Speech Recognition)")) {
                    HStack {
                        Label("Recognition Engine", systemImage: "waveform")
                        Spacer()
                        Text(transcriptionEngine == TranscriptionEngine.appleSpeech.rawValue ? "Apple Speech (built into iOS)" : "Whisper (on-device, WhisperKit)")
                            .foregroundColor(.secondary)
                    }
                    if transcriptionEngine == TranscriptionEngine.whisper.rawValue {
                        HStack {
                            Label("Model", systemImage: "cpu")
                            Spacer()
                            Text(ASRService.defaultModel)
                                .foregroundColor(.secondary)
                        }
                    }
                    HStack {
                        Label("Language", systemImage: "globe")
                        Spacer()
                        Text("English (US)")
                            .foregroundColor(.secondary)
                    }
                }
                
                Section(
                    header: Text("Storage & Media"),
                    footer: Text("Audio recordings are preserved for playback and scrubbing. You can purge older audio files while keeping all structured notes and transcripts intact.")
                ) {
                    HStack {
                        Label("Audio Recordings", systemImage: "waveform")
                        Spacer()
                        Text("\(storageUsage.fileCount) files (\(storageUsage.formattedBytes))")
                            .foregroundColor(.secondary)
                    }

                    Button(role: .destructive) {
                        let preservedIds = Set(NoteRepository.shared.notes.compactMap { $0.audioFileName })
                        let purged = AudioFileManager.shared.purgeAudioFiles(olderThanDays: 30, preservingFileNames: preservedIds)
                        storageUsage = AudioFileManager.shared.calculateStorageUsage()
                        purgeResult = "Purged \(purged) audio recording(s) older than 30 days."
                        showingPurgeAlert = true
                    } label: {
                        Label("Purge Audio Older Than 30 Days", systemImage: "trash")
                            .foregroundColor(.red)
                    }
                }

                Section(header: Text("Apple Watch")) {
                    NavigationLink {
                        WatchSyncStatusView(syncService: watchSync, embedded: true)
                    } label: {
                        HStack {
                            Label("Watch Companion", systemImage: "applewatch")
                            Spacer()
                            Text(watchSync.isReachable ? "Connected" : (watchSync.isPaired ? "Idle" : "Not Paired"))
                                .foregroundColor(watchSync.isReachable ? .green : .secondary)
                        }
                    }
                }

                Section(header: Text("Library Insights")) {
                    HStack {
                        Label("Total Notes", systemImage: "doc.on.doc")
                        Spacer()
                        Text("\(NoteRepository.shared.notes.count)")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Label("Total Audio Captured", systemImage: "waveform")
                        Spacer()
                        Text(NoteRepository.shared.totalAudioDuration.formattedDuration)
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Label("Total Words Captured", systemImage: "text.word.spacing")
                        Spacer()
                        Text("\(NoteRepository.shared.totalWordCount)")
                            .foregroundColor(.secondary)
                    }

                    let actionStats = NoteRepository.shared.totalActionItemsStats
                    HStack {
                        Label("Tasks Completed", systemImage: "checklist")
                        Spacer()
                        Text("\(actionStats.completed) of \(actionStats.total)")
                            .foregroundColor(.secondary)
                    }
                }

                Section(
                    header: Text("Data Management & Backups"),
                    footer: Text("Export your entire note library to a portable JSON backup file, or restore previously exported notes.")
                ) {
                    if let backupURL = DataBackupService.shared.createBackupFile(for: NoteRepository.shared.notes) {
                        ShareLink(item: backupURL) {
                            Label("Export Library Backup (JSON)", systemImage: "square.and.arrow.up.on.square")
                        }
                    }

                    Button {
                        showingFileImporter = true
                    } label: {
                        Label("Restore Notes from Backup", systemImage: "square.and.arrow.down.on.square")
                    }
                }

                Section(header: Text("Simulator & Developer Tools")) {
                    Button {
                        simulateIncomingWatchMemo()
                    } label: {
                        Label("Simulate Incoming Watch Audio Sync", systemImage: "applewatch.and.arrow.forward")
                    }
                    
                    Text("Injects a simulated voice memo from the Apple Watch to test the background sync ingestion and 2-stage processing pipeline.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Section(header: Text("Feedback")) {
                    Toggle("Shake to Feedback", isOn: $feedbackShakeEnabled)
                }

                Section(header: Text("About Voxbrief")) {
                    HStack {
                        VoxbriefLogoView(size: .inline)
                        Spacer()
                    }
                    .padding(.vertical, 2)

                    Button {
                        showingWhatsNew = true
                    } label: {
                        Label("What's New in Voxbrief", systemImage: "sparkles")
                    }

                    HStack {
                        Text("Version")
                        Spacer()
                        Text(WhatsNewView.currentVersion)
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Text("Architecture")
                        Spacer()
                        Text("iOS + watchOS Companion")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .sheet(isPresented: $showingWhatsNew) {
                WhatsNewView()
            }
            .fileImporter(
                isPresented: $showingFileImporter,
                allowedContentTypes: [.json],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    guard let fileURL = urls.first else { return }
                    guard fileURL.startAccessingSecurityScopedResource() else {
                        backupAlertMessage = "Permission denied accessing the backup file."
                        showingBackupAlert = true
                        return
                    }
                    defer { fileURL.stopAccessingSecurityScopedResource() }
                    do {
                        let restored = try DataBackupService.shared.restoreNotes(from: fileURL)
                        NoteRepository.shared.restoreAllNotes(importedNotes: restored)
                        backupAlertMessage = "Successfully imported \(restored.count) note(s) into your library."
                        showingBackupAlert = true
                    } catch {
                        backupAlertMessage = "Failed to restore backup: \(error.localizedDescription)"
                        showingBackupAlert = true
                    }
                case .failure(let error):
                    backupAlertMessage = "File selection failed: \(error.localizedDescription)"
                    showingBackupAlert = true
                }
            }
            .alert("Data Backup", isPresented: $showingBackupAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(backupAlertMessage)
            }
            .navigationTitle("Settings & Pipeline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .alert("Simulated Memo Ingested", isPresented: $showingSimulationAlert) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("Simulated memo '\(simulatedTitle)' has been added and processed through Stage 1 ASR and Stage 2 LLM cleanup.")
            }
            .alert("Storage Cleaned", isPresented: $showingPurgeAlert) {
                Button("OK", role: .cancel) { }
            } message: {
                Text(purgeResult)
            }
            .trackFeedbackScreen("Settings")
            .onAppear {
                storageUsage = AudioFileManager.shared.calculateStorageUsage()
            }
        }
    }

    // MARK: - On-Device Model Manager

    private var activeModelSummary: String {
        if llmService.isUsingAppleFoundationModel {
            return "\(AppleFoundationModelService.modelDisplayName) (System)"
        } else if llmService.isUsingLargeModel {
            return "\(OnDeviceLLMService.largeModelDisplayName) (downloaded)"
        } else if llmService.isUsingQwenModel {
            return OnDeviceLLMService.smallModelDisplayName
        } else if AppleFoundationModelService.isSupportedOnThisDevice {
            return "\(AppleFoundationModelService.modelDisplayName) (System)"
        } else {
            return llmService.activeModelDisplayName
        }
    }

    private func modelRow(name: String, detail: String, trailing: AnyView) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(.subheadline.weight(.medium))
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            trailing
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private var appleFoundationModelStatusBadge: some View {
        if !AppleFoundationModelService.isSupportedOnThisDevice {
            Label("Unsupported", systemImage: "exclamationmark.triangle.fill")
                .labelStyle(.titleAndIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        } else if llmService.isUsingAppleFoundationModel {
            Label("Active", systemImage: "checkmark.circle.fill")
                .labelStyle(.titleAndIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.green)
        } else {
            Text("Ready")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var largeModelRow: some View {
        let sizeString = Self.byteFormatter.string(fromByteCount: OnDeviceLLMService.largeModelApproxDownloadBytes)

        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(OnDeviceLLMService.largeModelDisplayName)
                        .font(.subheadline.weight(.medium))
                    Text("Best quality · \(sizeString) download")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                largeModelStatusBadge
            }

            switch llmService.largeModelState {
            case .notDownloaded:
                Button {
                    llmService.downloadLargeModel()
                } label: {
                    Label("Download Model", systemImage: "arrow.down.circle")
                        .font(.subheadline.weight(.semibold))
                }

            case .downloading(let progress):
                ProgressView(value: progress)
                HStack {
                    Text("\(Int(progress * 100))%")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Button("Cancel") {
                        llmService.cancelDownload()
                    }
                    .font(.caption)
                }

            case .ready:
                HStack(spacing: 12) {
                    if !llmService.isUsingLargeModel {
                        Button {
                            llmService.modelPreference = .large
                        } label: {
                            Label("Use This Model", systemImage: "checkmark.circle")
                                .font(.caption.weight(.semibold))
                        }
                    }
                    Button(role: .destructive) {
                        llmService.deleteLargeModel()
                    } label: {
                        Label("Delete Downloaded Model", systemImage: "trash")
                            .font(.caption)
                    }
                }

            case .failed(let message):
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.red)
                Button {
                    llmService.downloadLargeModel()
                } label: {
                    Label("Retry Download", systemImage: "arrow.clockwise")
                        .font(.subheadline.weight(.semibold))
                }
            }
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private var smallModelStatusBadge: some View {
        if !OnDeviceLLMService.isSupportedOnThisDevice {
            Label("Unsupported", systemImage: "exclamationmark.triangle.fill")
                .labelStyle(.titleAndIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        } else if llmService.modelPreference == .small {
            Label("Active", systemImage: "checkmark.circle.fill")
                .labelStyle(.titleAndIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.green)
        } else {
            Text("Optional")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private var largeModelStatusBadge: some View {
        switch llmService.largeModelState {
        case .notDownloaded:
            Text("Not Downloaded")
                .font(.caption)
                .foregroundStyle(.secondary)
        case .downloading:
            Label("Downloading", systemImage: "arrow.down.circle")
                .labelStyle(.titleAndIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.blue)
        case .ready:
            if llmService.isUsingLargeModel {
                Label("Active", systemImage: "checkmark.circle.fill")
                    .labelStyle(.titleAndIcon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.green)
            } else {
                Text("Downloaded")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        case .failed:
            Label("Failed", systemImage: "exclamationmark.triangle.fill")
                .labelStyle(.titleAndIcon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.red)
        }
    }

    private func simulateIncomingWatchMemo() {
        let noteId = UUID()
        let sampleTranscript = "Hey, so um we need to build the authentication flow for the voice note companion app. First condition is if biometric auth is enabled, use Face ID. Second condition is if user cancels Face ID, fall back to device passcode. Then make sure to encrypt all audio files on disk with AES-256. Requirements include instant lock on backgrounding and support for watch face complications. Remember to check with the security team."
        
        Task {
            let llmResult = try? await LLMCopywriterService.shared.processTranscript(sampleTranscript, mode: .full)
            let lightResult = try? await LLMCopywriterService.shared.processTranscript(sampleTranscript, mode: .light)

            let simulatedNote = VoiceNote(
                id: noteId,
                createdAt: Date(),
                duration: 35.0,
                audioFileName: nil,
                title: llmResult?.title ?? "Authentication Flow Spec",
                summary: llmResult?.summary ?? "Biometric auth and encryption requirements captured from Apple Watch.",
                rawTranscript: sampleTranscript,
                cleanedNote: llmResult?.cleanedMarkdown ?? sampleTranscript,
                requirements: llmResult?.requirements ?? [
                    "Encrypt all audio files on disk with AES-256",
                    "Instant lock on backgrounding",
                    "Support for watch face complications"
                ],
                conditions: llmResult?.conditions ?? [
                    "If biometric auth is enabled, use Face ID",
                    "If user cancels Face ID, fall back to device passcode"
                ],
                actionItems: llmResult?.actionItems ?? [
                    "Check with the security team"
                ],
                tags: llmResult?.tags ?? ["#iOS", "#watchOS", "#security"],
                status: .ready,
                source: .watchComplication,
                cleanupEngine: llmResult?.engine,
                lightCleanedNote: lightResult?.cleanedMarkdown,
                lightCleanupEngine: lightResult?.engine
            )
            
            await NoteRepository.shared.save(simulatedNote)
            simulatedTitle = simulatedNote.title
            showingSimulationAlert = true
        }
    }
}
