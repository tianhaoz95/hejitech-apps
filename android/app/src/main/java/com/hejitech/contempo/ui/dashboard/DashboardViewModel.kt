package com.hejitech.contempo.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.Entry
import com.hejitech.core.model.MaterialParticipationTest
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

data class DashboardUiState(
    val confirmedHours: Double = 0.0,
    val thresholdHours: Int = MaterialParticipationTest.THRESHOLD_HOURS,
    val testName: String = MaterialParticipationTest.NAME,
    val entries: List<Entry> = emptyList(),
)

class DashboardViewModel : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository

    val uiState: StateFlow<DashboardUiState> = entryRepository.observeEntries()
        .map { entries ->
            val confirmed = entries.filter { it.statusEnum == com.hejitech.core.model.EntryStatus.CONFIRMED }
            val totalMinutes = confirmed.sumOf { it.durationMinutes }
            DashboardUiState(
                confirmedHours = totalMinutes / 60.0,
                entries = entries,
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DashboardUiState())
}
