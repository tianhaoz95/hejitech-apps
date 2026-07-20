import ContempoCore
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
    private let captureLanguageStore = ServiceLocator.captureLanguageStore

    var displayName: String { Auth.auth().currentUser?.displayName ?? "Signed in" }
    var email: String { Auth.auth().currentUser?.email ?? "" }

    var inferencePreference: InferencePreference { aiSettingsStore.preference }
    var cloudAiEnabled: Bool { remoteConfigStore.cloudAiEnabled }
    var onDeviceStatus: OnDeviceModelUiStatus { onDeviceLlm.status }

    var showLanguageSelector: Bool { captureLanguageStore.showLanguageSelector }
    var selectedCaptureLanguage: CaptureLanguage { captureLanguageStore.selected }

    var isDeletingAccount = false
    var deleteAccountError: String?

    var csv: String?
    var isExporting = false

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
}
