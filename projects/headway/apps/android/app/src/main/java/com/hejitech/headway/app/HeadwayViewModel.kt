package com.hejitech.headway.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.Wearable
import com.hejitech.headway.core.model.*
import com.hejitech.headway.core.net.BackendConfig
import com.hejitech.headway.core.net.HeadwayApiClient
import com.hejitech.headway.core.sync.WatchMessage
import com.hejitech.headway.core.sync.WatchSyncState
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class HeadwayViewModel(application: Application) : AndroidViewModel(application) {

    val apiClient = HeadwayApiClient(BackendConfig.PRODUCTION)

    private val _stations = MutableStateFlow(CaltrainStations.ALL)
    val stations: StateFlow<List<Station>> = _stations.asStateFlow()

    private val _selectedFrom = MutableStateFlow(CaltrainStations.defaultMorningFrom)
    val selectedFrom: StateFlow<Station> = _selectedFrom.asStateFlow()

    private val _selectedTo = MutableStateFlow(CaltrainStations.defaultMorningTo)
    val selectedTo: StateFlow<Station> = _selectedTo.asStateFlow()

    private val _expressPreference = MutableStateFlow(ExpressPreference.ALL)
    val expressPreference: StateFlow<ExpressPreference> = _expressPreference.asStateFlow()

    private val _board = MutableStateFlow<Board?>(null)
    val board: StateFlow<Board?> = _board.asStateFlow()

    private val _tracked = MutableStateFlow<TrackedWithProgress?>(null)
    val tracked: StateFlow<TrackedWithProgress?> = _tracked.asStateFlow()

    private val _hasCommute = MutableStateFlow(false)
    val hasCommute: StateFlow<Boolean> = _hasCommute.asStateFlow()

    private val _settings = MutableStateFlow(Settings.defaults)
    val settings: StateFlow<Settings> = _settings.asStateFlow()

    private val _pairedDevices = MutableStateFlow<List<PairedDevice>>(emptyList())
    val pairedDevices: StateFlow<List<PairedDevice>> = _pairedDevices.asStateFlow()

    private val _pairingCode = MutableStateFlow<PairingCode?>(null)
    val pairingCode: StateFlow<PairingCode?> = _pairingCode.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _isLocalBackend = MutableStateFlow(false)
    val isLocalBackend: StateFlow<Boolean> = _isLocalBackend.asStateFlow()

    private var pollJob: Job? = null

    init {
        refresh()
        startPolling()
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                delay(20_000)
                refreshSilently()
            }
        }
    }

    fun setStations(from: Station, to: Station) {
        _selectedFrom.value = from
        _selectedTo.value = to
        refresh()
    }

    fun flipStations() {
        val currentFrom = _selectedFrom.value
        val currentTo = _selectedTo.value
        _selectedFrom.value = currentTo
        _selectedTo.value = currentFrom
        refresh()
    }

    fun setExpressPreference(preference: ExpressPreference) {
        _expressPreference.value = preference
        refresh()
    }

    fun setBackendMode(useLocal: Boolean) {
        _isLocalBackend.value = useLocal
        apiClient.config = if (useLocal) BackendConfig.LOCAL_EMULATOR else BackendConfig.PRODUCTION
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            try {
                loadBoardInternal()
            } catch (e: Exception) {
                _errorMessage.value = e.localizedMessage ?: "Failed to load board"
            } finally {
                _isLoading.value = false
            }
        }
    }

    private suspend fun refreshSilently() {
        try {
            loadBoardInternal()
        } catch (_: Exception) {}
    }

    private suspend fun loadBoardInternal() {
        if (apiClient.session != null) {
            val myBoard = apiClient.getMyBoard(
                from = _selectedFrom.value.id,
                to = _selectedTo.value.id,
                express = _expressPreference.value
            )
            _board.value = myBoard.board
            _hasCommute.value = myBoard.hasCommute
            _tracked.value = myBoard.tracked
        } else {
            val b = apiClient.getBoard(
                from = _selectedFrom.value.id,
                to = _selectedTo.value.id,
                express = _expressPreference.value
            )
            _board.value = b
        }
        syncToWatch()
    }

    fun trackTrain(train: BoardTrain) {
        viewModelScope.launch {
            try {
                val trackedItem = Tracked(
                    tripId = train.tripId,
                    serviceDate = train.serviceDate,
                    from = _selectedFrom.value.id,
                    to = _selectedTo.value.id
                )
                apiClient.track(trackedItem)
                refresh()
            } catch (e: Exception) {
                _errorMessage.value = "Failed to track train: ${e.localizedMessage}"
            }
        }
    }

    fun untrackTrain() {
        viewModelScope.launch {
            try {
                apiClient.untrack()
                _tracked.value = null
                refresh()
            } catch (e: Exception) {
                _errorMessage.value = "Failed to untrack: ${e.localizedMessage}"
            }
        }
    }

    fun loadSettings() {
        viewModelScope.launch {
            try {
                val resp = apiClient.getSettings()
                _settings.value = resp.settings
            } catch (e: Exception) {
                _errorMessage.value = "Failed to load settings: ${e.localizedMessage}"
            }
        }
    }

    fun saveSettings(newSettings: Settings) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val resp = apiClient.saveSettings(newSettings)
                _settings.value = resp.settings
                _hasCommute.value = true
                refresh()
            } catch (e: Exception) {
                _errorMessage.value = "Failed to save settings: ${e.localizedMessage}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun generatePairingCode() {
        viewModelScope.launch {
            try {
                val code = apiClient.createPairingCode()
                _pairingCode.value = code
                loadDevices()
            } catch (e: Exception) {
                _errorMessage.value = "Failed to generate pairing code: ${e.localizedMessage}"
            }
        }
    }

    fun loadDevices() {
        viewModelScope.launch {
            try {
                val devs = apiClient.getDevices()
                _pairedDevices.value = devs
            } catch (e: Exception) {
                _errorMessage.value = "Failed to load devices: ${e.localizedMessage}"
            }
        }
    }

    fun unpairDevice(id: String) {
        viewModelScope.launch {
            try {
                apiClient.unpairDevice(id)
                loadDevices()
            } catch (e: Exception) {
                _errorMessage.value = "Failed to unpair: ${e.localizedMessage}"
            }
        }
    }

    fun signInDebug(email: String = "rider@example.com", pass: String = "headway-dev") {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                apiClient.signInEmail(email, pass)
                refresh()
                loadSettings()
            } catch (e: Exception) {
                _errorMessage.value = "Sign in failed: ${e.localizedMessage}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun signOut() {
        apiClient.setSession(null)
        _tracked.value = null
        _hasCommute.value = false
        refresh()
    }

    fun deleteAccount() {
        viewModelScope.launch {
            try {
                apiClient.deleteAccount()
                signOut()
            } catch (e: Exception) {
                _errorMessage.value = "Account deletion failed: ${e.localizedMessage}"
            }
        }
    }

    /**
     * Pushes current state snapshot to paired Wear OS watches.
     */
    fun syncToWatch() {
        viewModelScope.launch {
            try {
                val state = WatchSyncState(
                    board = _board.value,
                    tracked = _tracked.value,
                    hasCommute = _hasCommute.value,
                    stations = _stations.value,
                    expressPreference = _expressPreference.value,
                    authToken = apiClient.session?.accessToken
                )
                val bytes = state.encode()
                val context = getApplication<Application>()
                val nodeClient = Wearable.getNodeClient(context)
                val messageClient = Wearable.getMessageClient(context)
                val nodes = nodeClient.connectedNodes.await()
                for (node in nodes) {
                    messageClient.sendMessage(node.id, WatchMessage.PATH_SYNC_STATE, bytes).await()
                }
            } catch (_: Exception) {
                // Watch sync fails gracefully if no watch is paired
            }
        }
    }
}
