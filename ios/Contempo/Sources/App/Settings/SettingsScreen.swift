import ContempoCore
import ContempoFirestore
import SwiftUI

struct SettingsScreen: View {
    @State private var viewModel = SettingsViewModel()
    @Environment(\.contempoPalette) private var palette
    @State private var showDeleteConfirm = false
    @State private var showDeleteModelConfirm = false
    @State private var showWalkthrough = false
    @State private var showAddRole = false
    @State private var newRoleName = ""
    @State private var renamingRole: ParticipantRole?
    @State private var renameRoleText = ""
    @State private var showQuickCaptureExplanation = false
    @State private var showShakeToReportExplanation = false

    var body: some View {
        List {
            Section("Account") {
                VStack(alignment: .leading, spacing: 2) {
                    Text(viewModel.displayName).font(ContempoFont.titleMedium())
                    if !viewModel.email.isEmpty {
                        Text(viewModel.email).font(ContempoFont.bodyLarge()).foregroundStyle(palette.inkFaint)
                    }
                }
                Button("Sign out", role: .none) { viewModel.signOut() }
                Button("Delete account", role: .destructive) { showDeleteConfirm = true }
                    .disabled(viewModel.isDeletingAccount)
            }

            Section {
                Text("Controls whether entries and questions are parsed on-device (free, no network) or in the cloud.")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)

                ForEach(InferencePreference.allCases, id: \.self) { option in
                    Button {
                        viewModel.setInferencePreference(option)
                    } label: {
                        HStack {
                            Text(label(for: option))
                                .foregroundStyle(isDisabled(option) ? palette.inkFaint : palette.inkSoft)
                            Spacer()
                            if viewModel.inferencePreference == option {
                                Image(systemName: "checkmark").foregroundStyle(palette.pine)
                            }
                        }
                    }
                    .disabled(isDisabled(option))
                }

                if !viewModel.hasProEntitlement {
                    Text("Free accounts always process on-device. This is a Contempo Pro feature — your plan is managed from your Contempo account on the web.")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.brass)
                } else if !viewModel.cloudAiEnabled {
                    Text("Cloud AI is temporarily unavailable — only on-device processing works right now.")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.brass)
                }

                if viewModel.inferencePreference != .cloudOnly {
                    onDeviceStatusPanel
                }

                tokenUsageSection
            } header: {
                Text("AI model")
            }

            Section("Capture") {
                // App-level now, not a per-capture-session toggle — moved
                // off the Capture tab entirely to keep that screen lean
                // (see CaptureScreen's doc comment). Same
                // label/toggle/info-button shape the old Capture-tab row
                // used, just relocated.
                HStack {
                    Text("Quick Capture")
                    Spacer()
                    Button {
                        showQuickCaptureExplanation = true
                    } label: {
                        Image(systemName: "info.circle")
                            .foregroundStyle(palette.inkSoft)
                    }
                    .buttonStyle(.plain)
                    Toggle("", isOn: Binding(
                        get: { viewModel.quickCaptureEnabled },
                        set: { viewModel.setQuickCaptureEnabled($0) }
                    ))
                    .labelsHidden()
                    .tint(palette.pine)
                }

                ForEach(CaptureLanguage.allCases, id: \.self) { language in
                    Button {
                        viewModel.setCaptureLanguage(language)
                    } label: {
                        HStack {
                            Text(captureLanguageLabel(language)).foregroundStyle(palette.inkSoft)
                            Spacer()
                            if viewModel.selectedCaptureLanguage == language {
                                Image(systemName: "checkmark").foregroundStyle(palette.pine)
                            }
                        }
                    }
                }
                Text("Which Whisper checkpoint transcribes your voice captures.")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)

                ForEach(CaptureMode.allCases, id: \.self) { mode in
                    Button {
                        viewModel.setDefaultCaptureMode(mode)
                    } label: {
                        HStack {
                            Text(captureModeLabel(mode)).foregroundStyle(palette.inkSoft)
                            Spacer()
                            if viewModel.defaultCaptureMode == mode {
                                Image(systemName: "checkmark").foregroundStyle(palette.pine)
                            }
                        }
                    }
                }
                Text("Which mode the Capture tab opens in. You can still switch modes for the current session from the toggle at the top of Capture.")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
            }

            Section {
                Text("Tag entries under a role (Property Manager, Co-host, Cleaner, a contractor, ...) when someone other than you did the work. Only your own hours (no role) count toward the 100-hour/500-hour progress on the Dashboard — the IRS tests require your participation to exceed everyone else's.")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)

                ForEach(viewModel.roles) { role in
                    HStack {
                        Text(role.name)
                        Spacer()
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        renamingRole = role
                        renameRoleText = role.name
                    }
                    .swipeActions {
                        Button(role: .destructive) {
                            viewModel.deleteRole(role)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }

                Button {
                    newRoleName = ""
                    showAddRole = true
                } label: {
                    Label("Add Role", systemImage: "plus.circle.fill")
                }
            } header: {
                Text("Roles")
            }

            Section {
                HStack {
                    Text("Shake to report")
                    Spacer()
                    Button {
                        showShakeToReportExplanation = true
                    } label: {
                        Image(systemName: "info.circle")
                            .foregroundStyle(palette.inkSoft)
                    }
                    .buttonStyle(.plain)
                    Toggle("", isOn: Binding(
                        get: { viewModel.shakeToReportEnabled },
                        set: { viewModel.setShakeToReportEnabled($0) }
                    ))
                    .labelsHidden()
                    .tint(palette.pine)
                }
            } header: {
                Text("Feedback")
            } footer: {
                Text("Shake your device to report a bug or suggest an improvement — captures a screenshot you can box and describe.")
            }

            Section("Watch capture") {
                Text("Start a voice capture from your Apple Watch — it records locally, then syncs to your phone and uploads automatically once your watch and phone are both reachable. Signing in on your watch is a one-time step handed off automatically from your phone.")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
            }

            Section("Export") {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Export").font(ContempoFont.titleMedium())
                    Text("Ready for your CPA").font(ContempoFont.labelSmall()).foregroundStyle(palette.inkFaint)
                }
                if let csv = viewModel.csv {
                    ShareLink(item: csv, preview: SharePreview("Contempo export.csv")) {
                        Label("Share CSV", systemImage: "square.and.arrow.up")
                    }
                } else {
                    Button {
                        viewModel.generateCsv()
                    } label: {
                        if viewModel.isExporting {
                            ProgressView()
                        } else {
                            Text("Export CSV")
                        }
                    }
                    .disabled(viewModel.isExporting)
                }
            }

            Section("Help") {
                Button {
                    showWalkthrough = true
                } label: {
                    Label("Feature Walkthrough", systemImage: "questionmark.circle")
                }
            }

            Section("Legal") {
                NavigationLink("Privacy Policy", value: AppRoute.legal(.privacy))
                NavigationLink("Terms of Service", value: AppRoute.legal(.terms))
            }
        }
        .sheet(isPresented: $showWalkthrough) {
            HelpWalkthroughSheet()
        }
        .sheet(isPresented: $showQuickCaptureExplanation) {
            QuickCaptureExplanationSheet()
        }
        .sheet(isPresented: $showShakeToReportExplanation) {
            ShakeToReportExplanationSheet()
        }
        .navigationTitle("Settings")
        .confirmationDialog(
            "Delete your account?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete permanently", role: .destructive) { viewModel.deleteAccount() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your account and all your logged entries, properties, photos, and voice recordings. This cannot be undone.")
        }
        .confirmationDialog(
            "Delete the downloaded model?",
            isPresented: $showDeleteModelConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) { viewModel.deleteOnDeviceModel() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Frees up about 2.6GB of storage. You can re-download it any time from here, or the app will re-download it automatically the next time on-device AI is needed.")
        }
        .alert("Couldn't delete account", isPresented: Binding(
            get: { viewModel.deleteAccountError != nil },
            set: { if !$0 { viewModel.dismissDeleteAccountError() } }
        )) {
            Button("OK") { viewModel.dismissDeleteAccountError() }
        } message: {
            Text(viewModel.deleteAccountError ?? "")
        }
        .alert("Add Role", isPresented: $showAddRole) {
            TextField("Role name", text: $newRoleName)
            Button("Add") { viewModel.addRole(name: newRoleName) }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Rename Role", isPresented: Binding(
            get: { renamingRole != nil },
            set: { if !$0 { renamingRole = nil } }
        )) {
            TextField("Role name", text: $renameRoleText)
            Button("Save") {
                if let role = renamingRole {
                    viewModel.renameRole(role, name: renameRoleText)
                }
                renamingRole = nil
            }
            Button("Cancel", role: .cancel) { renamingRole = nil }
        }
        .alert("Something went wrong", isPresented: Binding(
            get: { viewModel.roleError != nil },
            set: { if !$0 { viewModel.dismissRoleError() } }
        )) {
            Button("OK") { viewModel.dismissRoleError() }
        } message: {
            Text(viewModel.roleError ?? "")
        }
    }

    private func label(for option: InferencePreference) -> String {
        switch option {
        case .onDeviceOnly: return "On-device only"
        case .preferOnDevice: return "Prefer on-device (Contempo Pro)"
        case .cloudOnly: return "Cloud only (Contempo Pro)"
        }
    }

    private func isDisabled(_ option: InferencePreference) -> Bool {
        switch option {
        case .onDeviceOnly: return false
        case .preferOnDevice: return !viewModel.hasProEntitlement
        case .cloudOnly: return !viewModel.hasProEntitlement || !viewModel.cloudAiEnabled
        }
    }

    private func captureModeLabel(_ mode: CaptureMode) -> String {
        mode == .audioFirst ? "Audio-first" : "Typing"
    }

    private func captureLanguageLabel(_ language: CaptureLanguage) -> String {
        switch language {
        case .english: return "English"
        case .chinese: return "中文"
        case .auto: return "Auto"
        }
    }

    // On-device inference costs us nothing marginally (it runs on the
    // user's own hardware), so this reference value is purely a
    // progress-bar scale, never an enforced cap — every user, free or Pro,
    // is really unlimited. It exists so the bar has *something* to measure
    // fullness against; real usage sits far below it, which is the point
    // (visibly tons of headroom). Cloud's 20 is a real quota — cloud tokens
    // cost real money (see the cloud_ai_enabled Remote Config kill switch)
    // — and is Pro-only, so the row is hidden entirely for free accounts
    // rather than shown locked/empty.
    private static let onDeviceCreditReference = 10_000.0
    private static let cloudCreditQuota = 20.0

    @ViewBuilder
    /// On-device counters are client-written (see EntryRepository.
    /// recordOnDeviceTokenUsage) and refresh live as this device runs
    /// inference; cloud counters are server-written (askAgentFlow/
    /// parseEntryFlow) and refresh live once Firestore syncs the write down
    /// — either way this is a live listener, not a one-shot fetch, so it
    /// updates in place as usage happens. Both reset automatically at the
    /// next ISO week boundary (a new week is simply a new, still-empty
    /// document).
    private var tokenUsageSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AI credits (this week)")
                .font(ContempoFont.labelLarge())
                .foregroundStyle(palette.ink)
            tokenUsageProgressRow(
                label: "On-device",
                usage: viewModel.deviceTokenUsage,
                quota: Self.onDeviceCreditReference,
                quotaLabel: { credits in "\(credits) / Unlimited" },
                tint: palette.pine,
            )
            if viewModel.hasProEntitlement {
                tokenUsageProgressRow(
                    label: "Cloud",
                    usage: viewModel.cloudTokenUsage,
                    quota: Self.cloudCreditQuota,
                    quotaLabel: { credits in "\(credits) / \(Int(Self.cloudCreditQuota)) credits" },
                    tint: palette.brass,
                )
            }
        }
    }

    private func tokenUsageProgressRow(
        label: String,
        usage: TokenUsageWeek?,
        quota: Double,
        quotaLabel: (String) -> String,
        tint: Color,
    ) -> some View {
        let credits = usage?.creditsUsed ?? 0
        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkSoft)
                Spacer()
                Text(quotaLabel(Self.formatCredits(credits)))
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
            }
            ProgressView(value: min(credits / quota, 1.0))
                .tint(tint)
            if let usage, usage.requestCount > 0 {
                Text("\(usage.inputTokens) in / \(usage.outputTokens) out · \(usage.requestCount) requests")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
            } else {
                Text("No usage yet")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
            }
        }
    }

    private static func formatCredits(_ value: Double) -> String {
        if value <= 0 { return "0" }
        if value < 0.01 { return "< 0.01" }
        return String(format: "%.2f", value)
    }

    private var onDeviceStatusPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Speech Recognition Model (ASR - Whisper) — On-Demand
            // Resources, Initial Install tagged (see WhisperTranscriber's
            // kdoc), so this is normally .available almost immediately
            // after launch; .checking/.failed are surfaced defensively
            // rather than assumed away.
            VStack(alignment: .leading, spacing: 4) {
                Text("Speech Recognition")
                    .font(ContempoFont.labelLarge())
                    .foregroundStyle(palette.ink)

                switch viewModel.asrStatus {
                case .checking, .notDownloaded, .downloading:
                    HStack(spacing: 6) {
                        ProgressView().controlSize(.small)
                        Text("Preparing on-device speech model…")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                    }
                case .unavailable:
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(palette.brass)
                        Text("On-device speech model unavailable")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.brass)
                    }
                case .available:
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(palette.pine)
                        Text("On-device speech model ready")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.pine)
                    }
                case .failed(let message):
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Couldn't prepare the on-device speech model: \(message)")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.danger)
                        Button("Retry") { viewModel.retryAsrModelCheck() }
                    }
                }
            }

            Divider()

            // Language Model (LLM - Gemma)
            VStack(alignment: .leading, spacing: 4) {
                Text("Language Model")
                    .font(ContempoFont.labelLarge())
                    .foregroundStyle(palette.ink)

                switch viewModel.onDeviceStatus {
                case .checking:
                    Text("Checking on-device model…")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                case .notDownloaded:
                    VStack(alignment: .leading, spacing: 6) {
                        Text("On-device language model not downloaded.")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                        Button("Download") { viewModel.retryOnDeviceModelCheck() }
                    }
                case .unavailable:
                    Text("Not supported on this device — cloud will be used instead.")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                case .available:
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(palette.pine)
                        Text("On-device language model ready.")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.pine)
                    }
                    Button("Delete downloaded model", role: .destructive) {
                        showDeleteModelConfirm = true
                    }
                    .font(ContempoFont.labelSmall())
                case .downloading(let bytesDownloaded, let totalBytes, let bytesPerSecond, let etaSeconds):
                    VStack(alignment: .leading, spacing: 6) {
                        Text(downloadingHeadline(bytesDownloaded: bytesDownloaded, totalBytes: totalBytes))
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                        if totalBytes > 0 {
                            ProgressView(value: Double(bytesDownloaded), total: Double(totalBytes))
                        } else {
                            ProgressView()
                        }
                        Text(downloadingDetail(bytesPerSecond: bytesPerSecond, etaSeconds: etaSeconds))
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                    }
                case .failed(let message):
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Couldn't prepare the on-device model: \(message)")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.danger)
                        HStack(spacing: 12) {
                            Button("Retry") { viewModel.retryOnDeviceModelCheck() }
                            Button("Delete downloaded model", role: .destructive) {
                                showDeleteModelConfirm = true
                            }
                            .font(ContempoFont.labelSmall())
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(palette.paperRaised)
        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
    }

    private static let byteFormatter: ByteCountFormatter = {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter
    }()

    private func downloadingHeadline(bytesDownloaded: Int64, totalBytes: Int64) -> String {
        guard totalBytes > 0 else { return "Downloading on-device model…" }
        let pct = Int(Double(bytesDownloaded) / Double(totalBytes) * 100)
        let downloadedLabel = Self.byteFormatter.string(fromByteCount: bytesDownloaded)
        let totalLabel = Self.byteFormatter.string(fromByteCount: totalBytes)
        return "Downloading on-device model… \(pct)% (\(downloadedLabel) of \(totalLabel))"
    }

    private func downloadingDetail(bytesPerSecond: Double?, etaSeconds: Int?) -> String {
        var parts: [String] = []
        if let bytesPerSecond, bytesPerSecond > 0 {
            let speedLabel = Self.byteFormatter.string(fromByteCount: Int64(bytesPerSecond))
            parts.append("\(speedLabel)/s")
        }
        if let etaSeconds {
            let minutes = etaSeconds / 60
            let seconds = etaSeconds % 60
            let etaLabel = minutes > 0 ? "\(minutes)m \(seconds)s" : "\(seconds)s"
            parts.append("about \(etaLabel) left")
        }
        return parts.isEmpty ? "Estimating speed…" : parts.joined(separator: " · ")
    }
}

/// Moved here from CaptureScreen along with the toggle it explains — see
/// SettingsScreen's Capture section's doc comment.
private struct QuickCaptureExplanationSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("About Quick Capture")
                    .font(ContempoFont.titleLarge())
                    .foregroundStyle(palette.ink)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(palette.inkSoft)
                }
                .buttonStyle(.plain)
            }

            Text("Quick Capture lets you record multiple voice notes in rapid succession without waiting for on-device transcription or AI structuring.")
                .font(ContempoFont.bodyMedium())
                .foregroundStyle(palette.ink)

            VStack(alignment: .leading, spacing: 12) {
                Label("Recorded notes are saved locally to disk instantly.", systemImage: "bolt.fill")
                Label("Notes are uploaded in the background to your queue.", systemImage: "arrow.clockwise.icloud")
                Label("On-device AI transcribes and converts notes into entries asynchronously.", systemImage: "sparkles")
            }
            .font(ContempoFont.bodySmall())
            .foregroundStyle(palette.inkSoft)

            Spacer()

            Button("Got it") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.pine)
            .frame(maxWidth: .infinity)
        }
        .padding(24)
        .background(palette.paper)
    }
}

private struct ShakeToReportExplanationSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("About Shake to report")
                    .font(ContempoFont.titleLarge())
                    .foregroundStyle(palette.ink)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundStyle(palette.inkSoft)
                }
                .buttonStyle(.plain)
            }

            Text("When this is on, shaking your device anywhere in the app captures a screenshot of what you're looking at.")
                .font(ContempoFont.bodyMedium())
                .foregroundStyle(palette.ink)

            VStack(alignment: .leading, spacing: 12) {
                Label("Box the part of the screen you're reporting on.", systemImage: "rectangle.dashed")
                Label("Add a short note about the bug or improvement.", systemImage: "text.bubble")
                Label("Sent straight to us — no need to describe your device or app version, we capture that automatically.", systemImage: "paperplane.fill")
            }
            .font(ContempoFont.bodySmall())
            .foregroundStyle(palette.inkSoft)

            Spacer()

            Button("Got it") {
                dismiss()
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.pine)
            .frame(maxWidth: .infinity)
        }
        .padding(24)
        .background(palette.paper)
    }
}
