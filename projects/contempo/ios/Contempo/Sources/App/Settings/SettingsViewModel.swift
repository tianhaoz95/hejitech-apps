import ContempoCore
import ContempoData
@preconcurrency import Supabase
import Foundation
import Observation

@Observable
@MainActor
final class SettingsViewModel {
    private let authManager = ServiceLocator.authManager
    private let onDeviceLlm = ServiceLocator.onDeviceLlm
    private let whisperTranscriber = ServiceLocator.whisperTranscriber
    private let captureLanguageStore = ServiceLocator.captureLanguageStore
    private let quickCaptureSettingsStore = ServiceLocator.quickCaptureSettingsStore
    private let captureModeStore = ServiceLocator.captureModeStore
    private let shakeToReportSettingsStore = ServiceLocator.shakeToReportSettingsStore
    private let entryRepository = ServiceLocator.entryRepository

    var displayName: String { ContempoBackend.client.auth.currentUser?.userMetadata["full_name"]?.stringValue ?? "Signed in" }
    var email: String { ContempoBackend.email ?? "" }

    /// Backed by users/{uid}/billing/subscription via ServiceLocator's
    /// SubscriptionStore (synced by the stripeWebhook Cloud Function). Per
    /// reports/pricing-proposal-v0.html §3.2, Free accounts are hard-locked
    /// to onDeviceOnly — preferOnDevice and cloudOnly both have real
    /// recurring cloud-LLM cost and must require Pro before they're selectable.
    var hasProEntitlement: Bool { ServiceLocator.subscriptionStore.hasProEntitlement }
    var onDeviceStatus: OnDeviceModelUiStatus { onDeviceLlm.status }
    var asrStatus: OnDeviceModelUiStatus { whisperTranscriber.status }

    var selectedCaptureLanguage: CaptureLanguage { captureLanguageStore.selected }
    /// App-level now, not a per-capture-session toggle — see CaptureScreen's doc comment on why this moved here.
    var quickCaptureEnabled: Bool { quickCaptureSettingsStore.enabled }
    /// Which mode a *fresh* Capture-tab visit opens into — see CaptureViewModel.captureMode's doc comment.
    var defaultCaptureMode: CaptureMode { captureModeStore.defaultMode }
    var shakeToReportEnabled: Bool { shakeToReportSettingsStore.enabled }

    var isDeletingAccount = false
    var deleteAccountError: String?

    var csv: String?
    var pdfUrl: URL?
    var isExporting = false

    var roles: [ParticipantRole] = []
    var roleError: String?

    /// This week's on-device/cloud LLM usage — see EntryRepository's
    /// observeDeviceTokenUsage/observeCloudTokenUsage doc comments.
    var deviceTokenUsage: TokenUsageWeek?

    init() {
        let repository = entryRepository
        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { [] },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeRoles() }
            )
            do {
                for try await roles in stream {
                    guard let self else { return }
                    self.roles = roles
                }
            } catch {
                // Stream ended with a non-auth error — nothing else to do here.
            }
        }
        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { nil },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeDeviceTokenUsage() }
            )
            do {
                for try await usage in stream {
                    guard let self else { return }
                    self.deviceTokenUsage = usage
                }
            } catch {
                // Stream ended with a non-auth error — nothing else to do here.
            }
        }
    }

    func setQuickCaptureEnabled(_ value: Bool) {
        quickCaptureSettingsStore.setEnabled(value)
    }

    func setCaptureLanguage(_ value: CaptureLanguage) {
        captureLanguageStore.setSelected(value)
    }

    func setDefaultCaptureMode(_ mode: CaptureMode) {
        captureModeStore.setDefaultMode(mode)
    }

    func setShakeToReportEnabled(_ value: Bool) {
        shakeToReportSettingsStore.setEnabled(value)
    }

    func retryOnDeviceModelCheck() {
        onDeviceLlm.retry()
    }

    func retryAsrModelCheck() {
        whisperTranscriber.retry()
    }

    /// Confirmation is the caller's job (see `SettingsScreen`'s confirmation
    /// dialog) — this only performs the deletion once the user has agreed.
    func deleteOnDeviceModel() {
        onDeviceLlm.deleteDownloadedModel()
    }

    func signOut() {
        try? authManager.signOut()
    }

    /// Confirmation is the caller's job (see `SettingsScreen`'s alert) — this
    /// only performs the deletion once the user has already agreed.
    func deleteAccount() {
        isDeletingAccount = true
        deleteAccountError = nil
        Task {
            do {
                _ = try await ContempoBackend.api("account/delete")
                try? authManager.signOut()
                isDeletingAccount = false
            } catch {
                isDeletingAccount = false
                deleteAccountError = error.localizedDescription
            }
        }
    }

    func dismissDeleteAccountError() {
        deleteAccountError = nil
    }

    func generateCsv() {
        isExporting = true
        Task {
            let entries = (try? await ServiceLocator.entryRepository.observeEntries().first { _ in true }) ?? []
            csv = ExportGenerator.generateCsv(entries: entries)
            isExporting = false
        }
    }

    func generatePdf() {
        isExporting = true
        Task {
            let entries = (try? await ServiceLocator.entryRepository.observeEntries().first { _ in true }) ?? []
            pdfUrl = PdfExportGenerator.generatePdf(entries: entries)
            isExporting = false
        }
    }

    func addRole(name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        Task {
            do {
                _ = try await entryRepository.createRole(name: trimmed)
            } catch {
                roleError = error.localizedDescription
            }
        }
    }

    func renameRole(_ role: ParticipantRole, name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, let roleId = role.id else { return }
        Task {
            do {
                try await entryRepository.renameRole(roleId: roleId, name: trimmed)
            } catch {
                roleError = error.localizedDescription
            }
        }
    }

    func deleteRole(_ role: ParticipantRole) {
        guard let roleId = role.id else { return }
        Task {
            do {
                try await entryRepository.deleteRole(roleId: roleId)
            } catch {
                roleError = error.localizedDescription
            }
        }
    }

    func dismissRoleError() {
        roleError = nil
    }
}
