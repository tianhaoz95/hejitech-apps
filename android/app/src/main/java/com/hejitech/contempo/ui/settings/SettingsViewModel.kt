package com.hejitech.contempo.ui.settings

import androidx.lifecycle.ViewModel
import com.hejitech.contempo.agent.InferencePreference
import com.hejitech.contempo.agent.OnDeviceModelUiStatus
import com.hejitech.contempo.data.ServiceLocator
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.flow.StateFlow

data class SettingsUiState(
    val displayName: String?,
    val email: String?,
)

class SettingsViewModel : ViewModel() {
    private val aiSettingsStore = ServiceLocator.aiSettingsStore
    private val authManager = ServiceLocator.authManager
    private val onDeviceLlm = ServiceLocator.onDeviceLlm

    val inferencePreference: StateFlow<InferencePreference> = aiSettingsStore.preference
    val onDeviceModelStatus: StateFlow<OnDeviceModelUiStatus> = onDeviceLlm.status

    fun currentAccount(): SettingsUiState {
        val user = Firebase.auth.currentUser
        return SettingsUiState(displayName = user?.displayName, email = user?.email)
    }

    fun setInferencePreference(preference: InferencePreference) {
        aiSettingsStore.setPreference(preference)
    }

    fun retryOnDeviceModelCheck() {
        onDeviceLlm.retry()
    }

    fun signOut() {
        authManager.signOut()
    }
}
