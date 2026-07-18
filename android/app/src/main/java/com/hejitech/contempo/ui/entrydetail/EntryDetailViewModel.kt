package com.hejitech.contempo.ui.entrydetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.Entry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class EntryDetailUiState(
    val entry: Entry? = null,
    val isLoading: Boolean = true,
    val isDeleting: Boolean = false,
    val deleteError: String? = null,
)

class EntryDetailViewModel(private val entryId: String) : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository

    private val _uiState = MutableStateFlow(EntryDetailUiState())
    val uiState: StateFlow<EntryDetailUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val entry = runCatching { entryRepository.getEntry(entryId) }.getOrNull()
            _uiState.value = EntryDetailUiState(entry = entry, isLoading = false)
        }
    }

    fun delete(onDeleted: () -> Unit) {
        _uiState.value = _uiState.value.copy(isDeleting = true, deleteError = null)
        viewModelScope.launch {
            try {
                entryRepository.deleteEntry(entryId)
                onDeleted()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isDeleting = false, deleteError = e.message ?: "Couldn't delete — try again.")
            }
        }
    }

    fun dismissDeleteError() {
        _uiState.value = _uiState.value.copy(deleteError = null)
    }

    class Factory(private val entryId: String) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T = EntryDetailViewModel(entryId) as T
    }
}
