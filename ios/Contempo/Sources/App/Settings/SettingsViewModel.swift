import ContempoCore
import ContempoFirestore
import FirebaseAuth
import FirebaseFunctions
import Foundation
import Observation

@Observable
@MainActor
final class SettingsViewModel {
    private let authManager = ServiceLocator.authManager
    private let functions = Functions.functions()
    private let aiSettingsStore = ServiceLocator.aiSettingsStore
    private let remoteConfigStore = ServiceLocator.remoteConfigStore
    private let onDeviceLlm = ServiceLocator.onDeviceLlm
    private let whisperTranscriber = ServiceLocator.whisperTranscriber
    private let captureLanguageStore = ServiceLocator.captureLanguageStore
    private let entryRepository = ServiceLocator.entryRepository

    var displayName: String { Auth.auth().currentUser?.displayName ?? "Signed in" }
    var email: String { Auth.auth().currentUser?.email ?? "" }

    var inferencePreference: InferencePreference { aiSettingsStore.preference }
    var cloudAiEnabled: Bool { remoteConfigStore.cloudAiEnabled }
    var onDeviceStatus: OnDeviceModelUiStatus { onDeviceLlm.status }
    var asrAvailable: Bool { whisperTranscriber.isAvailable }

    var showLanguageSelector: Bool { captureLanguageStore.showLanguageSelector }
    var selectedCaptureLanguage: CaptureLanguage { captureLanguageStore.selected }

    var isDeletingAccount = false
    var deleteAccountError: String?

    var csv: String?
    var isExporting = false

    var roles: [ParticipantRole] = []
    var roleError: String?

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
    }

    func setInferencePreference(_ value: InferencePreference) {
        aiSettingsStore.setPreference(value)
    }

    func setShowLanguageSelector(_ value: Bool) {
        captureLanguageStore.setShowLanguageSelector(value)
    }

    func setCaptureLanguage(_ value: CaptureLanguage) {
        captureLanguageStore.setSelected(value)
    }

    func retryOnDeviceModelCheck() {
        onDeviceLlm.retry()
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
                _ = try await functions.httpsCallable("deleteAccount").call()
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
