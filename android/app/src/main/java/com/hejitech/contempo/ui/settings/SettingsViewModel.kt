package com.hejitech.contempo.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.agent.InferencePreference
import com.hejitech.contempo.agent.OnDeviceModelUiStatus
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.ui.capture.CaptureMode
import com.hejitech.core.model.CaptureLanguage
import com.hejitech.core.model.Role
import com.hejitech.core.model.TokenUsageWeek
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.functions.FirebaseFunctionsException
import com.google.firebase.functions.functions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

data class SettingsUiState(
    val displayName: String?,
    val email: String?,
)

data class DeleteAccountUiState(
    val isDeleting: Boolean = false,
    val errorMessage: String? = null,
    val completed: Boolean = false,
)

class SettingsViewModel : ViewModel() {
    private val aiSettingsStore = ServiceLocator.aiSettingsStore
    private val authManager = ServiceLocator.authManager
    private val onDeviceLlm = ServiceLocator.onDeviceLlm
    private val captureLanguageStore = ServiceLocator.captureLanguageStore
    private val quickCaptureSettingsStore = ServiceLocator.quickCaptureSettingsStore
    private val captureModeStore = ServiceLocator.captureModeStore
    private val remoteConfigStore = ServiceLocator.remoteConfigStore
    private val entryRepository = ServiceLocator.entryRepository

    val inferencePreference: StateFlow<InferencePreference> = aiSettingsStore.preference
    val onDeviceModelStatus: StateFlow<OnDeviceModelUiStatus> = onDeviceLlm.status
    val asrModelAvailable: StateFlow<Boolean> = MutableStateFlow(ServiceLocator.whisperTranscriber.isAvailable).asStateFlow()
    /** App-level now, not per-capture-session — see CaptureScreen's kdoc on why this moved here. */
    val quickCaptureEnabled: StateFlow<Boolean> = quickCaptureSettingsStore.enabled
    val captureLanguage: StateFlow<CaptureLanguage> = captureLanguageStore.selected
    /** Which mode a *fresh* Capture-tab visit opens into — see CaptureViewModel.captureMode's kdoc. */
    val defaultCaptureMode: StateFlow<CaptureMode> = captureModeStore.defaultMode
    /** See RemoteConfigStore's kdoc — "Cloud only" shouldn't be selectable (or read as available) while this is false. */
    val cloudAiEnabled: StateFlow<Boolean> = remoteConfigStore.cloudAiEnabled

    /**
     * Backed by users/{uid}/billing/subscription via ServiceLocator's
     * SubscriptionRepository (synced by the stripeWebhook Cloud Function).
     * Per reports/pricing-proposal-v0.html §3.2, Free accounts are
     * hard-locked to ON_DEVICE_ONLY — "Prefer on-device" and "Cloud only"
     * both have real recurring cloud-LLM cost and must require Pro before
     * they're selectable.
     */
    val hasProEntitlement: StateFlow<Boolean> = ServiceLocator.hasProEntitlement

    val roles: StateFlow<List<Role>> = entryRepository.observeRoles()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    /** This week's on-device/cloud LLM usage — see EntryRepository's observeDeviceTokenUsage/observeCloudTokenUsage kdocs. */
    val deviceTokenUsage: StateFlow<TokenUsageWeek?> = entryRepository.observeDeviceTokenUsage()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)
    val cloudTokenUsage: StateFlow<TokenUsageWeek?> = entryRepository.observeCloudTokenUsage()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    private val _roleError = MutableStateFlow<String?>(null)
    val roleError: StateFlow<String?> = _roleError.asStateFlow()

    private val _deleteAccountState = MutableStateFlow(DeleteAccountUiState())
    val deleteAccountState: StateFlow<DeleteAccountUiState> = _deleteAccountState.asStateFlow()

    fun addRole(name: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            runCatching { entryRepository.createRole(trimmed) }
                .onFailure { e -> _roleError.value = e.message ?: "Couldn't add this role — try again." }
        }
    }

    fun renameRole(role: Role, name: String) {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) return
        viewModelScope.launch {
            runCatching { entryRepository.renameRole(role.id, trimmed) }
                .onFailure { e -> _roleError.value = e.message ?: "Couldn't rename this role — try again." }
        }
    }

    fun deleteRole(role: Role) {
        viewModelScope.launch {
            runCatching { entryRepository.deleteRole(role.id) }
                .onFailure { e -> _roleError.value = e.message ?: "Couldn't delete this role — try again." }
        }
    }

    fun dismissRoleError() {
        _roleError.value = null
    }

    fun currentAccount(): SettingsUiState {
        val user = Firebase.auth.currentUser
        return SettingsUiState(displayName = user?.displayName, email = user?.email)
    }

    fun setInferencePreference(preference: InferencePreference) {
        aiSettingsStore.setPreference(preference)
    }

    fun setQuickCaptureEnabled(value: Boolean) {
        quickCaptureSettingsStore.setEnabled(value)
    }

    fun setCaptureLanguage(value: CaptureLanguage) {
        captureLanguageStore.setSelected(value)
    }

    fun setDefaultCaptureMode(mode: CaptureMode) {
        captureModeStore.setDefaultMode(mode)
    }

    fun retryOnDeviceModelCheck() {
        onDeviceLlm.retry()
    }

    /** Confirmation is the caller's job (see SettingsScreen's confirmation dialog). */
    fun deleteOnDeviceModel() {
        onDeviceLlm.deleteDownloadedModel()
    }

    fun signOut() {
        authManager.signOut()
    }

    /**
     * Calls the deleteAccount Cloud Function (see backend/functions/src/account.ts),
     * which wipes this user's Firestore/Storage data and the Auth account itself
     * server-side via the Admin SDK — deliberately not the client SDK's
     * currentUser.delete(), which would require a recent-sign-in re-auth step first.
     * Deleting the Auth account server-side doesn't clear this device's cached
     * session on its own, so signOut() runs immediately after success to force
     * AuthGate back to SignInScreen rather than leaving a session pointed at a
     * now-deleted account.
     */
    fun deleteAccount() {
        _deleteAccountState.value = DeleteAccountUiState(isDeleting = true)
        viewModelScope.launch {
            try {
                Firebase.functions.getHttpsCallable("deleteAccount").call().await()
                authManager.signOut()
                _deleteAccountState.value = DeleteAccountUiState(completed = true)
            } catch (e: FirebaseFunctionsException) {
                _deleteAccountState.value = DeleteAccountUiState(
                    errorMessage = e.message ?: "Couldn't delete your account. Please try again.",
                )
            }
        }
    }

    fun dismissDeleteAccountError() {
        _deleteAccountState.value = DeleteAccountUiState()
    }
}
