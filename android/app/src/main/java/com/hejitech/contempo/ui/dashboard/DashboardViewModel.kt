package com.hejitech.contempo.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import com.hejitech.core.model.MaterialParticipationTest
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
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
)

/** Local, non-Firestore-derived selection state — kept separate from the entries flow below so a bulk-delete in flight (or a stale selection) doesn't get wiped by every incoming snapshot. */
private data class SelectionState(
    val selectedIds: Set<String> = emptySet(),
    val isDeleting: Boolean = false,
    val deleteError: String? = null,
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
                // Excludes the open timer/trip — they're "still running,"
                // not "needs completing," and get their own callouts instead.
                pendingCount = entries.count { it.statusEnum == EntryStatus.PENDING_REVIEW && !it.inProgress },
                openTimerEntry = entries.find { it.inProgress && !it.isTrip },
                openTripEntry = entries.find { it.inProgress && it.isTrip },
                totalMiles = entries.sumOf { it.miles },
            )
        }
        // See CaptureViewModel.openTripEntry's comment — an uncaught
        // Firestore listener error here crashes the whole app on this
        // screen specifically, since it's an eagerly-collected StateFlow.
        .catch { e ->
            if (e is FirebaseFirestoreException &&
                (e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED ||
                    e.code == FirebaseFirestoreException.Code.UNAUTHENTICATED)
            ) {
                ServiceLocator.authManager.signOut()
            }
            emit(DashboardUiState())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), DashboardUiState())

    private val _selection = MutableStateFlow(SelectionState())

    val uiState: StateFlow<DashboardUiState> = combine(entriesState, _selection) { entriesUiState, selection ->
        // Prunes selections for entries that vanished from underneath the
        // user (deleted elsewhere, or a stale id after this delete
        // completes) so a phantom "N selected" can never linger.
        val validIds = entriesUiState.entries.mapTo(HashSet()) { it.id }
        entriesUiState.copy(
            selectedIds = selection.selectedIds.intersect(validIds),
            isDeleting = selection.isDeleting,
            deleteError = selection.deleteError,
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

    /**
     * Single-entry delete via the Dashboard's swipe-to-delete gesture —
     * separate from the multi-select batch path above; reuses the same
     * repository call with a one-element list. Suspends (rather than firing
     * off its own viewModelScope.launch) and reports success/failure so the
     * caller — DashboardScreen's LaunchedEffect — can snap the swiped row
     * back if the delete didn't actually go through.
     */
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
}
