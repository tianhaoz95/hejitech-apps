package com.hejitech.contempo.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.agent.InferencePreference
import com.hejitech.contempo.agent.OnDeviceModelUiStatus
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.Role
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
    private val captureLanguageSelectorVisibilityStore = ServiceLocator.captureLanguageSelectorVisibilityStore
    private val remoteConfigStore = ServiceLocator.remoteConfigStore
    private val entryRepository = ServiceLocator.entryRepository

    val inferencePreference: StateFlow<InferencePreference> = aiSettingsStore.preference
    val onDeviceModelStatus: StateFlow<OnDeviceModelUiStatus> = onDeviceLlm.status
    val asrModelAvailable: StateFlow<Boolean> = MutableStateFlow(ServiceLocator.whisperTranscriber.isAvailable).asStateFlow()
    val showLanguageSelector: StateFlow<Boolean> = captureLanguageSelectorVisibilityStore.visible
    /** See RemoteConfigStore's kdoc — "Cloud only" shouldn't be selectable (or read as available) while this is false. */
    val cloudAiEnabled: StateFlow<Boolean> = remoteConfigStore.cloudAiEnabled

    val roles: StateFlow<List<Role>> = entryRepository.observeRoles()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

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

    fun setShowLanguageSelector(value: Boolean) {
        captureLanguageSelectorVisibilityStore.setVisible(value)
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
