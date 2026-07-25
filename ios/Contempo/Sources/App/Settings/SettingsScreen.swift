import ContempoCore
import SwiftUI

struct SettingsScreen: View {
    @State private var viewModel = SettingsViewModel()
    @Environment(\.contempoPalette) private var palette
    @State private var showDeleteConfirm = false
    @State private var showDeleteModelConfirm = false
    @State private var showWalkthrough = false

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

                if !viewModel.cloudAiEnabled {
                    Text("Cloud AI is temporarily unavailable — only on-device processing works right now.")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.brass)
                }

                if viewModel.inferencePreference != .cloudOnly {
                    onDeviceStatusPanel
                }
            } header: {
                Text("AI model")
            }

            Section("Capture") {
                Toggle("Show language selector", isOn: Binding(
                    get: { viewModel.showLanguageSelector },
                    set: { viewModel.setShowLanguageSelector($0) }
                ))
                Text("Adds a language switcher to the Capture tab. Off by default — capture uses English.")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)
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
    }

    private func label(for option: InferencePreference) -> String {
        switch option {
        case .onDeviceOnly: return "On-device only"
        case .preferOnDevice: return "Prefer on-device (recommended)"
        case .cloudOnly: return "Cloud only"
        }
    }

    private func isDisabled(_ option: InferencePreference) -> Bool {
        option == .cloudOnly && !viewModel.cloudAiEnabled
    }

    @ViewBuilder
    private var onDeviceStatusPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Speech Recognition Model (ASR - Whisper)
            VStack(alignment: .leading, spacing: 4) {
                Text("Speech Recognition")
                    .font(ContempoFont.labelLarge())
                    .foregroundStyle(palette.ink)
                if viewModel.asrAvailable {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(palette.pine)
                        Text("On-device speech model ready (bundled)")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.pine)
                    }
                } else {
                    HStack(spacing: 6) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(palette.brass)
                        Text("On-device speech model unavailable")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.brass)
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
