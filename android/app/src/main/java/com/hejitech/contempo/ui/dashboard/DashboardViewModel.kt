package com.hejitech.contempo.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.data.recoverFromAuthRaceOrSignOut
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import com.hejitech.core.model.MaterialParticipationTest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DashboardUiState(
    val confirmedHours: Double = 0.0,
    val thresholdHours: Int = MaterialParticipationTest.THRESHOLD_HOURS,
    val testName: String = MaterialParticipationTest.NAME,
    val entries: List<Entry> = emptyList(),
    val pendingCount: Int = 0,
    /** The one open start/stop timer, if any — see TimerEntryCoordinator. Surfaced separately from the generic pending list/count. */
    val openTimerEntry: Entry? = null,
    /** The one open mileage trip, if any — see MileageTripCoordinator. Scoped by isTrip so it and openTimerEntry never match the same entry, since a timer and a trip can be open simultaneously. */
    val openTripEntry: Entry? = null,
    /** Sum of `miles` across every entry — a separate tax deduction from the hours progress above, deliberately not folded into that math. */
    val totalMiles: Double = 0.0,
    /** Multi-select state — see DashboardScreen's long-press-to-select UI. Selection mode is implicit: active whenever this is non-empty. */
    val selectedIds: Set<String> = emptySet(),
    val isDeleting: Boolean = false,
    val deleteError: String? = null,
    val isSyncing: Boolean = false,
    val syncStatusMessage: String = "",
    val syncProgressFraction: Float = 0f,
    val syncNotice: String? = null,
)

/** Local, non-Firestore-derived selection state — kept separate from the entries flow below so a bulk-delete in flight (or a stale selection) doesn't get wiped by every incoming snapshot. */
private data class SelectionState(
    val selectedIds: Set<String> = emptySet(),
    val isDeleting: Boolean = false,
    val deleteError: String? = null,
)

private data class SyncState(
    val isSyncing: Boolean = false,
    val syncStatusMessage: String = "",
    val syncProgressFraction: Float = 0f,
    val syncNotice: String? = null,
)

class DashboardViewModel : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository

    private val entriesState: StateFlow<DashboardUiState> = entryRepository.observeEntries()
        .map { entries ->
            val confirmed = entries.filter { it.statusEnum == EntryStatus.CONFIRMED }
            val totalMinutes = confirmed.sumOf { it.durationMinutes }
            DashboardUiState(
                confirmedHours = totalMinutes / 60.0,
                entries = entries,
                pendingCount = entries.count { it.statusEnum == EntryStatus.PENDING_REVIEW && !it.inProgress },
                openTimerEntry = entries.find { it.inProgress && !it.isTrip },
                openTripEntry = entries.find { it.inProgress && it.isTrip },
                totalMiles = entries.sumOf { it.miles },
            )
        }
        .recoverFromAuthRaceOrSignOut { DashboardUiState() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DashboardUiState())

    private val _selection = MutableStateFlow(SelectionState())
    private val _syncState = MutableStateFlow(SyncState())

    val uiState: StateFlow<DashboardUiState> = combine(entriesState, _selection, _syncState) { entriesUiState, selection, sync ->
        val validIds = entriesUiState.entries.mapTo(HashSet()) { it.id }
        entriesUiState.copy(
            selectedIds = selection.selectedIds.intersect(validIds),
            isDeleting = selection.isDeleting,
            deleteError = selection.deleteError,
            isSyncing = sync.isSyncing,
            syncStatusMessage = sync.syncStatusMessage,
            syncProgressFraction = sync.syncProgressFraction,
            syncNotice = sync.syncNotice,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DashboardUiState())

    fun toggleSelected(entryId: String) {
        _selection.update { state ->
            val selected = state.selectedIds.toMutableSet()
            if (!selected.remove(entryId)) selected.add(entryId)
            state.copy(selectedIds = selected, deleteError = null)
        }
    }

    fun selectAll() {
        _selection.update { it.copy(selectedIds = entriesState.value.entries.mapTo(HashSet()) { entry -> entry.id }) }
    }

    fun clearSelection() {
        _selection.update { it.copy(selectedIds = emptySet(), deleteError = null) }
    }

    suspend fun deleteEntry(entryId: String): Boolean =
        runCatching { entryRepository.deleteEntries(listOf(entryId)) }.isSuccess

    fun deleteSelected() {
        val ids = uiState.value.selectedIds
        if (ids.isEmpty()) return
        _selection.update { it.copy(isDeleting = true, deleteError = null) }
        viewModelScope.launch {
            try {
                entryRepository.deleteEntries(ids.toList())
                _selection.value = SelectionState()
            } catch (e: Exception) {
                _selection.update { it.copy(isDeleting = false, deleteError = e.message ?: "Couldn't delete — try again.") }
            }
        }
    }

    fun dismissDeleteError() {
        _selection.update { it.copy(deleteError = null) }
    }

    fun refreshAndProcessPendingAudios() {
        viewModelScope.launch {
            _syncState.update { it.copy(isSyncing = true, syncNotice = null) }

            val localPending = ServiceLocator.pendingCaptureStore.listPending()
            val cloudPending = runCatching { ServiceLocator.audioCaptureQueue.listPending() }.getOrDefault(emptyList())
            val total = localPending.size + cloudPending.size

            if (total == 0) {
                _syncState.update {
                    it.copy(
                        syncStatusMessage = "Checking for pending voice entries...",
                        syncProgressFraction = 1f,
                    )
                }
                kotlinx.coroutines.delay(400)
                _syncState.update {
                    it.copy(
                        isSyncing = false,
                        syncNotice = "Dashboard up to date — no pending voice notes.",
                    )
                }
                kotlinx.coroutines.delay(3000)
                _syncState.update {
                    if (it.syncNotice == "Dashboard up to date — no pending voice notes.") it.copy(syncNotice = null) else it
                }
                return@launch
            }

            // Phase 1: Uploading local pending WAVs
            localPending.forEachIndexed { index, item ->
                val step = index + 1
                _syncState.update {
                    it.copy(
                        syncStatusMessage = "Uploading voice recording $step of $total...",
                        syncProgressFraction = step.toFloat() / (total + 1),
                    )
                }
                com.hejitech.contempo.capture.PendingCaptureSyncer.syncOne(item)
            }

            // Phase 2: Transcribing & parsing cloud queue
            val processedCount = com.hejitech.contempo.wear.AudioCaptureProcessor.processPendingCaptures { current, _, stage ->
                val step = localPending.size + current
                val stageText = when (stage) {
                    com.hejitech.contempo.wear.AudioProcessingStage.DOWNLOADING -> "Downloading audio"
                    com.hejitech.contempo.wear.AudioProcessingStage.TRANSCRIBING -> "Transcribing voice note"
                    com.hejitech.contempo.wear.AudioProcessingStage.PARSING -> "Structuring entry"
                    com.hejitech.contempo.wear.AudioProcessingStage.SAVING -> "Saving entry"
                }
                _syncState.update {
                    it.copy(
                        syncStatusMessage = "$stageText ($step of $total)...",
                        syncProgressFraction = step.toFloat() / (total + 1),
                    )
                }
            }

            val totalDone = maxOf(processedCount, localPending.size)
            val notice = if (totalDone > 0) {
                "Successfully processed $totalDone pending voice ${if (totalDone == 1) "entry" else "entries"}"
            } else {
                "Dashboard refreshed"
            }

            _syncState.update {
                it.copy(
                    isSyncing = false,
                    syncProgressFraction = 1f,
                    syncStatusMessage = "Sync complete",
                    syncNotice = notice,
                )
            }

            kotlinx.coroutines.delay(4000)
            _syncState.update { it.copy(syncNotice = null) }
        }
    }
}
