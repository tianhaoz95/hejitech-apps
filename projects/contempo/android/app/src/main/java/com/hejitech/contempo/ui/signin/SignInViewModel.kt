package com.hejitech.contempo.ui.signin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.data.ServiceLocator
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SignInUiState(
    val isSigningIn: Boolean = false,
    val errorMessage: String? = null,
)

class SignInViewModel : ViewModel() {
    private val authManager = ServiceLocator.authManager

    private val _uiState = MutableStateFlow(SignInUiState())
    val uiState: StateFlow<SignInUiState> = _uiState.asStateFlow()

    fun signIn() {
        _uiState.value = SignInUiState(isSigningIn = true)
        viewModelScope.launch {
            val result = authManager.signIn()
            _uiState.value = result.fold(
                onSuccess = { SignInUiState(isSigningIn = false) },
                onFailure = { SignInUiState(isSigningIn = false, errorMessage = it.message ?: "Sign-in failed") },
            )
        }
    }
}
