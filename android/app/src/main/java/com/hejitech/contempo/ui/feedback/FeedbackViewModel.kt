package com.hejitech.contempo.ui.feedback

import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.BuildConfig
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.feedback.PendingFeedbackCaptureStore
import com.hejitech.contempo.ui.navigation.CurrentScreenTracker
import com.hejitech.core.model.FeedbackRegion
import java.io.File
import java.util.Locale
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class FeedbackSubmitUiState(
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
    val submitted: Boolean = false,
)

class FeedbackViewModel : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository

    private val _uiState = MutableStateFlow(FeedbackSubmitUiState())
    val uiState: StateFlow<FeedbackSubmitUiState> = _uiState.asStateFlow()

    fun submit(imageFile: File, region: FeedbackRegion?, description: String) {
        _uiState.value = FeedbackSubmitUiState(isSubmitting = true)
        viewModelScope.launch {
            runCatching {
                entryRepository.submitFeedback(
                    imageFile = imageFile,
                    region = region,
                    description = description,
                    screenName = CurrentScreenTracker.currentScreen.value,
                    appVersion = BuildConfig.VERSION_NAME,
                    buildNumber = BuildConfig.VERSION_CODE.toString(),
                    osVersion = Build.VERSION.RELEASE ?: "",
                    deviceModel = Build.MODEL ?: "",
                    locale = Locale.getDefault().toLanguageTag(),
                )
            }.onSuccess {
                PendingFeedbackCaptureStore.clear()
                _uiState.value = FeedbackSubmitUiState(submitted = true)
            }.onFailure { e ->
                _uiState.value = FeedbackSubmitUiState(
                    errorMessage = e.message ?: "Couldn't submit feedback — try again.",
                )
            }
        }
    }

    fun cancel() {
        PendingFeedbackCaptureStore.clear()
    }
}
