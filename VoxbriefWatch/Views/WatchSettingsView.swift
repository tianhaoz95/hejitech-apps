import SwiftUI

public struct WatchSettingsView: View {
    @ObservedObject private var syncService = WatchSyncService.shared
    @ObservedObject private var storage = WatchStorage.shared
    @State private var showingPurgeConfirmation = false
    @State private var purgeFeedbackText: String? = nil

    public init() {}

    public var body: some View {
        List {
            // MARK: - Sync Status
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(syncService.isReachable ? Color.green : Color.orange)
                            .frame(width: 8, height: 8)
                        Text(syncService.isReachable ? "iPhone Connected" : "iPhone Standalone")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.primary)
                    }

                    Text(syncService.isReachable
                         ? "Recordings transfer immediately to iPhone for AI processing."
                         : "Saved locally. Transfers automatically once iPhone is nearby.")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 2)

                Button {
                    syncService.syncPendingNotes()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                            .font(.system(size: 12, weight: .bold))
                        Text(storage.pendingNotes().isEmpty ? "Check Connection" : "Sync Pending (\(storage.pendingNotes().count))")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color.accentColor)
                .listRowBackground(Color.clear)
            } header: {
                Text("Companion Sync")
                    .font(.system(size: 11, weight: .bold))
            }

            // MARK: - Storage & Cache Management
            Section {
                VStack(spacing: 6) {
                    HStack {
                        Text("Local Audio")
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                        Spacer()
                        Text(storage.totalLocalStorageSize())
                            .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    }

                    HStack {
                        Text("Stored Memos")
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("\(storage.notes.count)")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                    }

                    if !storage.notes.isEmpty {
                        let pendingCount = storage.pendingNotes().count
                        let syncedCount = max(0, storage.notes.count - pendingCount)
                        let syncRatio = Double(syncedCount) / Double(storage.notes.count)

                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text("Sync Status")
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text("\(syncedCount) synced, \(pendingCount) pending")
                                    .font(.system(size: 10))
                                    .foregroundColor(.secondary)
                            }
                            ProgressView(value: syncRatio)
                                .tint(Color.accentColor)
                        }
                        .padding(.vertical, 2)
                    }
                }
                .padding(.vertical, 2)

                Button(role: .destructive) {
                    storage.purgeAllSyncedRecordings()
                    purgeFeedbackText = "Cleaned!"
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        purgeFeedbackText = nil
                    }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "trash")
                            .font(.system(size: 11))
                        Text(purgeFeedbackText ?? "Purge Synced Audio")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .listRowBackground(Color.clear)
            } header: {
                Text("Storage")
                    .font(.system(size: 11, weight: .bold))
            }

            // MARK: - Pipeline Info
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Two-Stage Pipeline")
                        .font(.system(size: 12, weight: .semibold))
                    Text("• Stage 1: WhisperKit ASR")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                    Text("• Stage 2: Qwen3 On-Device LLM")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                    Text("• 100% Private, On-Device")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(Color.accentColor)
                }
                .padding(.vertical, 2)
            } header: {
                Text("AI Engine")
                    .font(.system(size: 11, weight: .bold))
            }

            // MARK: - App Version
            Section {
                HStack(spacing: 8) {
                    VoxbriefLogoView(size: .watch)
                    Spacer()
                    Text("v1.25.2")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle("Settings")
    }
}
