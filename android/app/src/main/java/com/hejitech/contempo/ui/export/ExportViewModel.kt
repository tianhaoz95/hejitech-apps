package com.hejitech.contempo.ui.export

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.Entry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale

data class ExportUiState(
    val isGenerating: Boolean = false,
    val csv: String? = null,
    val errorMessage: String? = null,
)

/**
 * MVP export: CSV only, generated on-device from whatever's already synced
 * locally. The PRD's polished "CPA-ready package" (narrative + attachments +
 * readiness score) is explicitly fast-follow — see
 * reports/mvp-scope-v0.html Section 5.1. This screen exists so there's
 * *something* a host can hand over today, not the final version.
 */
class ExportViewModel : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository
    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)

    private val _uiState = MutableStateFlow(ExportUiState())
    val uiState: StateFlow<ExportUiState> = _uiState.asStateFlow()

    fun generateCsv() {
        _uiState.value = _uiState.value.copy(isGenerating = true, errorMessage = null)
        viewModelScope.launch {
            try {
                val entries = entryRepository.observeEntries().first()
                _uiState.value = _uiState.value.copy(isGenerating = false, csv = buildCsv(entries))
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isGenerating = false, errorMessage = e.message ?: "Couldn't generate export.")
            }
        }
    }

    private fun buildCsv(entries: List<Entry>): String = buildString {
        appendLine("property,task,duration_minutes,category,status,activity_date,logged_at,is_vague,is_backfilled,days_late")
        entries.forEach { entry ->
            appendLine(
                listOf(
                    csvEscape(entry.propertyName),
                    csvEscape(entry.task),
                    entry.durationMinutes.toString(),
                    entry.category,
                    entry.status,
                    dateFormatter.format(entry.activityDate.toDate()),
                    dateFormatter.format(entry.loggedAt.toDate()),
                    entry.isVague.toString(),
                    entry.isBackfilled.toString(),
                    entry.daysLate.toString(),
                ).joinToString(",")
            )
        }
    }

    private fun csvEscape(value: String): String =
        if (value.contains(',') || value.contains('"') || value.contains('\n')) {
            "\"${value.replace("\"", "\"\"")}\""
        } else {
            value
        }
}
