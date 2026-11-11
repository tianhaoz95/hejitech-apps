package com.hejitech.headway.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.Wearable
import com.hejitech.headway.core.model.*
import com.hejitech.headway.core.net.BackendConfig
import com.hejitech.headway.core.net.HeadwayApiClient
import com.hejitech.headway.core.net.HeadwayApiException
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
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

    private val _onTrain = MutableStateFlow<OnTrainCard?>(null)
    val onTrain: StateFlow<OnTrainCard?> = _onTrain.asStateFlow()

    private val rideLocation = RideLocation(application)
    /** The Activity is showing, so following the phone is allowed under "while using the app". */
    private var appVisible = false

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

    private val _family = MutableStateFlow<FamilyState?>(null)
    /** The family group (null until loaded or signed out) and invites to you. */
    val family: StateFlow<FamilyState?> = _family.asStateFlow()

    /** Whether this phone is registered for alerts: null signed out or not tried yet. */
    private val _alertsOn = MutableStateFlow<Boolean?>(null)
    val alertsOn: StateFlow<Boolean?> = _alertsOn.asStateFlow()

    private val _notice = MutableStateFlow<String?>(null)
    /** A one-line result to show in Settings ("Test alert sent"). */
    val notice: StateFlow<String?> = _notice.asStateFlow()

    /** The token this phone registered, to take it off the account at sign-out. */
    private var pushToken: String? = null

    private val isEmulator = android.os.Build.FINGERPRINT.contains("generic") || android.os.Build.HARDWARE in setOf("ranchu", "goldfish")

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
        apiClient.config = if (!useLocal) BackendConfig.PRODUCTION else if (isEmulator) BackendConfig.LOCAL_EMULATOR else BackendConfig.LOCAL_DEVICE
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
        if (apiClient.session != null) runCatching { apiClient.getFamily() }.onSuccess { _family.value = it }
    }

    // ---------------------------------------------------------------- family group

    fun loadFamily() {
        if (apiClient.session == null) { _family.value = null; return }
        viewModelScope.launch { runCatching { apiClient.getFamily() }.onSuccess { _family.value = it } }
    }

    /** Runs a family change and shows the group as the Worker returns it; [done] gets whether it worked. */
    fun familyChange(done: (Boolean) -> Unit = {}, op: suspend (HeadwayApiClient) -> FamilyState) {
        viewModelScope.launch {
            try {
                _family.value = op(apiClient)
                _errorMessage.value = null
                done(true)
            } catch (e: HeadwayApiException) {
                _errorMessage.value = apiError(e)
                done(false)
            } catch (e: Exception) {
                _errorMessage.value = e.localizedMessage ?: "Something went wrong"
                done(false)
            }
        }
    }

    /** Turns a share on (for [viewers]) or off. */
    fun setShare(kind: ShareKind, on: Boolean, viewers: List<String>) {
        val shares = (_family.value?.currentShares ?: emptyMap()).toMutableMap()
        if (on) shares[kind] = viewers else shares.remove(kind)
        familyChange { it.updateFamily(shares = shares) }
    }

    /** The Worker's `{ "error": "…" }`, or the status. */
    private fun apiError(e: HeadwayApiException): String {
        val body = e.message?.substringAfter(": ", "") ?: ""
        return runCatching { apiClient.json.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.content }.getOrNull() ?: (e.message ?: "Request failed")
    }

    private suspend fun loadBoardInternal() {
        if (apiClient.session != null) {
            reportRide()
            val myBoard = apiClient.getMyBoard(
                from = _selectedFrom.value.id,
                to = _selectedTo.value.id,
                express = _expressPreference.value
            )
            _board.value = myBoard.board
            _hasCommute.value = myBoard.hasCommute
            _tracked.value = myBoard.tracked
            _onTrain.value = myBoard.onTrain
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

    /** Sends recent fixes when they could mean a train: moving, or a ride is under way. Standing still makes no request. */
    private suspend fun reportRide() {
        if (!_settings.value.onTrain.usesLocation) return
        val fixes = rideLocation.samples()
        val moving = fixes.takeLast(3).any { (it.speed ?: 0.0) >= 5.0 }
        if (fixes.size < 2 || !(moving || _onTrain.value != null)) return
        runCatching { apiClient.reportOnTrain(fixes) }
    }

    /** Starts or stops following the phone for what the on-train setting asks. */
    fun applyRideWatching() {
        val mode = _settings.value.onTrain
        val context = getApplication<Application>()
        if (mode.usesLocation && appVisible) rideLocation.start() else rideLocation.stop()
        if (mode == OnTrainMode.BACKGROUND && rideLocation.hasBackgroundAccess()) {
            OnTrainService.start(context, apiClient)
        } else {
            OnTrainService.stop(context)
        }
    }

    fun onAppVisible(visible: Boolean) {
        appVisible = visible
        applyRideWatching()
    }

    fun setOnTrainMode(mode: OnTrainMode) {
        saveSettings(_settings.value.copy(onTrain = mode))
        _settings.value = _settings.value.copy(onTrain = mode)
        if (!mode.usesLocation) _onTrain.value = null
        applyRideWatching()
    }

    fun setAlertScope(scope: AlertScope) {
        saveSettings(_settings.value.copy(alerts = _settings.value.alerts.copy(scope = scope)))
    }

    /** Tracks the train you're on, to a stop you pick or the one the card expects. */
    fun trackOnTrain(stop: String? = null) {
        val c = _onTrain.value ?: return
        viewModelScope.launch {
            try {
                apiClient.track(Tracked(tripId = c.tripId, serviceDate = c.serviceDate, from = c.from.id, to = stop ?: c.to.id))
                refresh()
            } catch (e: Exception) {
                _errorMessage.value = "Failed to track train: ${e.localizedMessage}"
            }
        }
    }

    fun dismissOnTrain() {
        _onTrain.value = null
        viewModelScope.launch { runCatching { apiClient.dismissOnTrain() } }
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
                applyRideWatching()
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
                applyRideWatching()
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
                registerForAlerts()
                refresh()
                loadSettings()
                loadFamily()
            } catch (e: Exception) {
                _errorMessage.value = "Sign in failed: ${e.localizedMessage}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    // ---------------------------------------------------------------- alerts (FCM)

    /** Registers this phone for the account's alerts. Call after sign-in and when the token changes. */
    fun registerForAlerts(token: String? = null) {
        if (apiClient.session == null) return
        PushService.ensureChannels(getApplication())
        PushService.onToken = { registerForAlerts(it) }
        viewModelScope.launch {
            val t = token ?: PushService.token()
            if (t == null) { _alertsOn.value = false; return@launch }
            runCatching { apiClient.registerPush(t, android.os.Build.MODEL ?: "Android phone") }
                .onSuccess { pushToken = t; _alertsOn.value = it }
                .onFailure { _alertsOn.value = false }
        }
    }

    fun sendTestAlert() {
        viewModelScope.launch {
            _notice.value = try {
                apiClient.testPush()
                "Test alert sent."
            } catch (e: HeadwayApiException) {
                apiError(e)
            } catch (e: Exception) {
                e.localizedMessage ?: "Couldn't send a test alert"
            }
        }
    }

    fun signOut() {
        // Alerts follow the account: this phone stops getting them (with the session it still has).
        PushService.onToken = null
        _alertsOn.value = null
        _notice.value = null
        val token = pushToken
        pushToken = null
        if (token != null && apiClient.session != null) {
            val leaving = HeadwayApiClient(apiClient.config).also { it.setSession(apiClient.session) }
            viewModelScope.launch { runCatching { leaving.unregisterPush(token) } }
        }
        apiClient.setSession(null)
        _family.value = null
        _tracked.value = null
        _onTrain.value = null
        rideLocation.stop()
        OnTrainService.stop(getApplication())
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
                    onTrain = _onTrain.value,
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
