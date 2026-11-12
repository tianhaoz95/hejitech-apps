package com.hejitech.headway.app

import android.app.Application
import android.content.Context
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.Wearable
import com.hejitech.headway.core.model.*
import com.hejitech.headway.core.net.HeadwayApiClient
import com.hejitech.headway.core.net.HeadwayApiException
import com.hejitech.headway.core.net.NotSignedInException
import com.hejitech.headway.core.sync.WatchMessage
import com.hejitech.headway.core.sync.WatchSyncState
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString

/** Where the app is: finding out, at the sign-in screen, or showing the tabs. */
enum class Phase { LAUNCHING, SIGNED_OUT, READY }

/**
 * The app's state: sign-in, the commute board (refreshed while open), settings, glasses pairing,
 * the family group and alert registration. Every board comes from the Worker, which merges the
 * timetable and Caltrain's live feed; the app only shows it. Mirrors the iPhone app's `AppModel`.
 */
class HeadwayViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences("headway", Context.MODE_PRIVATE)
    private val store = SessionStore(application)

    val apiClient = HeadwayApiClient(AppBackend.config(application)).apply {
        restoreSession(store.load())
        onSessionChange = { store.save(it) }
    }

    private val _phase = MutableStateFlow(Phase.LAUNCHING)
    val phase: StateFlow<Phase> = _phase.asStateFlow()

    private val _email = MutableStateFlow<String?>(null)
    val email: StateFlow<String?> = _email.asStateFlow()

    private val _stations = MutableStateFlow(CaltrainStations.ALL)
    val stations: StateFlow<List<Station>> = _stations.asStateFlow()

    private val _board = MutableStateFlow<Board?>(null)
    val board: StateFlow<Board?> = _board.asStateFlow()

    private val _tracked = MutableStateFlow<TrackedWithProgress?>(null)
    val tracked: StateFlow<TrackedWithProgress?> = _tracked.asStateFlow()

    private val _onTrain = MutableStateFlow<OnTrainCard?>(null)
    /** The train your location shows you riding. */
    val onTrain: StateFlow<OnTrainCard?> = _onTrain.asStateFlow()

    private val _commuteDone = MutableStateFlow<CommuteDoneCard?>(null)
    /** The leg you finished today, while its alerts are held back. */
    val commuteDone: StateFlow<CommuteDoneCard?> = _commuteDone.asStateFlow()

    private val _hasCommute = MutableStateFlow(false)
    val hasCommute: StateFlow<Boolean> = _hasCommute.asStateFlow()

    private val _settings = MutableStateFlow(Settings.defaults)
    val settings: StateFlow<Settings> = _settings.asStateFlow()

    private val _settingsSaved = MutableStateFlow(false)
    /** Whether the server has settings for this account (false: these are the defaults). */
    val settingsSaved: StateFlow<Boolean> = _settingsSaved.asStateFlow()

    private val _customPair = MutableStateFlow<Pair<String, String>?>(null)
    /** A pair picked on the Trains tab instead of the commute (null: the commute for the time of day). */
    val customPair: StateFlow<Pair<String, String>?> = _customPair.asStateFlow()
    /** When it was picked: after [MANUAL_PICK_MS] the board goes back to the commute, so an evening flip doesn't hold the next morning. */
    private var customPairAt = 0L

    private val _expressPreference = MutableStateFlow(ExpressPreference.ALL)
    val expressPreference: StateFlow<ExpressPreference> = _expressPreference.asStateFlow()

    private val _pairedDevices = MutableStateFlow<List<PairedDevice>>(emptyList())
    val pairedDevices: StateFlow<List<PairedDevice>> = _pairedDevices.asStateFlow()

    private val _pairingCode = MutableStateFlow<PairingCode?>(null)
    val pairingCode: StateFlow<PairingCode?> = _pairingCode.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _isLocalBackend = MutableStateFlow(AppBackend.isLocal(application))
    val isLocalBackend: StateFlow<Boolean> = _isLocalBackend.asStateFlow()

    private val _family = MutableStateFlow<FamilyState?>(null)
    /** The family group (null until loaded or signed out) and invites to you. */
    val family: StateFlow<FamilyState?> = _family.asStateFlow()

    private val _alertsOn = MutableStateFlow<Boolean?>(null)
    /** Whether this phone is registered for alerts on a server that can send them: null not tried yet. */
    val alertsOn: StateFlow<Boolean?> = _alertsOn.asStateFlow()

    private val _notificationsAllowed = MutableStateFlow(PushService.canNotify(application))
    /** Android's notification permission for Headway. */
    val notificationsAllowed: StateFlow<Boolean> = _notificationsAllowed.asStateFlow()

    private val _notice = MutableStateFlow<String?>(null)
    /** A one-line result to show in Settings ("Test alert sent"). */
    val notice: StateFlow<String?> = _notice.asStateFlow()

    private val _useLocation = MutableStateFlow(prefs.getBoolean(KEY_USE_LOCATION, false))
    /** Estimate the trip to the station from where the phone is (Settings › Location), instead of the leg's fixed minutes. */
    val useLocation: StateFlow<Boolean> = _useLocation.asStateFlow()

    private val rideLocation = RideLocation(application)
    /** The Activity is showing, so following the phone is allowed under "while using the app". */
    private var appVisible = false
    /** The token this phone registered, to take it off the account at sign-out. */
    private var pushToken: String? = null

    init {
        runCatching { prefs.getString(KEY_STATIONS, null)?.let { apiClient.json.decodeFromString<List<Station>>(it) } }
            .getOrNull()?.takeIf { it.isNotEmpty() }?.let { _stations.value = it }
        viewModelScope.launch { start() }
        viewModelScope.launch {
            while (isActive) {
                delay(REFRESH_MS)
                if (appVisible && _phase.value == Phase.READY) refreshNow(quiet = true)
            }
        }
    }

    // ---------------------------------------------------------------- launch and routing

    private suspend fun start() {
        // On the local stack, follow the Worker's demo clock so countdowns agree with boards computed
        // for another moment. Production builds never ask.
        Clock.offsetMs = if (_isLocalBackend.value) runCatching { apiClient.devClockOffsetMs() }.getOrDefault(0L) else 0L
        loadStations()
        route()
    }

    /** After launch and after every sign-in path: to the board, or to sign-in. */
    private suspend fun route() {
        val s = apiClient.session
        if (s == null) { _phase.value = Phase.SIGNED_OUT; return }
        _email.value = s.email
        try {
            val r = apiClient.getSettings()
            _settings.value = r.settings
            _settingsSaved.value = r.saved
            _email.value = r.email ?: s.email
            _expressPreference.value = r.settings.expressPreference
            _errorMessage.value = null
            _phase.value = Phase.READY
            applyRideWatching()
            refreshNow()
            loadFamily()
            registerForAlerts()
        } catch (e: Exception) {
            if (signedOut(e)) {
                _phase.value = Phase.SIGNED_OUT
            } else {
                // Offline at launch: show what we can and retry on refresh.
                _phase.value = Phase.READY
                _errorMessage.value = readable(e)
            }
        }
    }

    private suspend fun loadStations() {
        runCatching { apiClient.getStations() }.getOrNull()?.takeIf { it.isNotEmpty() }?.let {
            _stations.value = it
            prefs.edit().putString(KEY_STATIONS, apiClient.json.encodeToString(it)).apply()
        }
    }

    fun stationName(id: String): String = _stations.value.firstOrNull { it.id == id }?.name ?: id

    private fun signedOut(e: Throwable): Boolean = e is NotSignedInException || (e is HeadwayApiException && e.isUnauthorized)

    private fun readable(e: Throwable): String = when (e) {
        is HeadwayApiException -> e.userMessage
        is NotSignedInException -> "Not signed in"
        else -> e.localizedMessage ?: "Something went wrong"
    }

    fun clearError() { _errorMessage.value = null }

    // ---------------------------------------------------------------- sign-in

    /** The Google sign-in page to open in the browser; it comes back to [AUTH_REDIRECT]. */
    fun startGoogleSignIn(): String {
        val start = apiClient.oauthStart("google", AUTH_REDIRECT)
        prefs.edit().putString(KEY_VERIFIER, start.verifier).apply()
        _errorMessage.value = null
        return start.url
    }

    /** `headway://login-callback?code=…` from the browser. */
    fun finishOAuth(callback: Uri) {
        val verifier = prefs.getString(KEY_VERIFIER, null)
        val code = callback.getQueryParameter("code")
        if (code == null || verifier == null) {
            val reason = callback.getQueryParameter("error_description") ?: "no code in the callback"
            _errorMessage.value = "Google sign-in failed: $reason"
            return
        }
        prefs.edit().remove(KEY_VERIFIER).apply()
        viewModelScope.launch {
            _isLoading.value = true
            try {
                apiClient.exchangeCode(code, verifier)
                route()
            } catch (e: Exception) {
                _errorMessage.value = "Google sign-in failed: ${readable(e)}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    /** Email sign-in for accounts Headway hands out (the store review demo account); no sign-up. [done] gets whether it worked. */
    fun signInWithEmailAccount(email: String, password: String, done: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            try {
                apiClient.reviewSignIn(email.trim(), password)
                route()
                done(true)
            } catch (e: Exception) {
                _errorMessage.value = if (e is HeadwayApiException && e.isUnauthorized) "Wrong email or password." else readable(e)
                done(false)
            }
        }
    }

    /** Debug builds on the local stack: the seed rider. */
    fun signInLocalSeed(email: String = "rider@example.com", password: String = "headway-dev") {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                apiClient.signInEmail(email, password)
                route()
            } catch (e: Exception) {
                _errorMessage.value = "Sign in failed: ${readable(e)}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    /** Debug builds: production or the local stack. A session belongs to one backend, so this signs out. */
    fun setBackendMode(useLocal: Boolean) {
        if (!BuildConfig.DEBUG || useLocal == _isLocalBackend.value) return
        AppBackend.setLocal(getApplication(), useLocal)
        _isLocalBackend.value = useLocal
        apiClient.signOut()
        apiClient.config = AppBackend.config(getApplication())
        clearAccountState()
        _phase.value = Phase.SIGNED_OUT
        viewModelScope.launch { start() }
    }

    private fun clearAccountState() {
        PushService.onToken = null
        pushToken = null
        _alertsOn.value = null
        _notice.value = null
        _board.value = null
        _tracked.value = null
        _onTrain.value = null
        _commuteDone.value = null
        _family.value = null
        _hasCommute.value = false
        _settings.value = Settings.defaults
        _settingsSaved.value = false
        _customPair.value = null
        _pairingCode.value = null
        _pairedDevices.value = emptyList()
        _errorMessage.value = null
        rideLocation.stop()
        OnTrainService.stop(getApplication())
    }

    fun signOut() {
        viewModelScope.launch {
            // Alerts follow the account: this phone stops getting them.
            pushToken?.let { t -> runCatching { apiClient.unregisterPush(t) } }
            apiClient.signOut()
            clearAccountState()
            _phase.value = Phase.SIGNED_OUT
            syncToWatch()
        }
    }

    /** Deletes what Headway keeps about this account, then signs out. */
    fun deleteData() {
        viewModelScope.launch {
            try {
                apiClient.deleteAccount()
                clearAccountState()
                _phase.value = Phase.SIGNED_OUT
                syncToWatch()
            } catch (e: Exception) {
                _errorMessage.value = readable(e)
            }
        }
    }

    // ---------------------------------------------------------------- board

    /** Reloads the board, showing a spinner. */
    fun refresh() {
        viewModelScope.launch { refreshNow() }
    }

    /** For pull-to-refresh: returns when the board is back. */
    suspend fun refreshAndWait() = refreshNow()

    /** Not cancelled with the caller: a released pull-to-refresh or a screen change must not stop a refresh halfway. */
    private suspend fun refreshNow(quiet: Boolean = false) = withContext(NonCancellable) {
        if (_phase.value != Phase.READY) return@withContext
        if (!quiet) _isLoading.value = true
        try {
            reportRide()
            val origin = if (_useLocation.value) rideLocation.lastKnown() else null
            if (_customPair.value != null && System.currentTimeMillis() - customPairAt >= MANUAL_PICK_MS) _customPair.value = null
            val pair = _customPair.value
            val r = apiClient.getMyBoard(from = pair?.first, to = pair?.second, express = _expressPreference.value, origin = origin)
            _board.value = r.board
            _hasCommute.value = r.hasCommute
            _tracked.value = r.tracked
            _onTrain.value = r.onTrain
            _commuteDone.value = r.commuteDone
            _errorMessage.value = null
        } catch (e: Exception) {
            if (signedOut(e)) {
                clearAccountState()
                _phase.value = Phase.SIGNED_OUT
            } else if (!quiet) {
                _errorMessage.value = "Couldn't refresh: ${readable(e)}"
            }
        } finally {
            if (!quiet) _isLoading.value = false
            syncToWatch()
        }
        if (quiet && apiClient.session != null) runCatching { apiClient.getFamily() }.onSuccess { _family.value = it }
    }

    fun setExpressPreference(preference: ExpressPreference) {
        _expressPreference.value = preference
        refresh()
    }

    /** Shows the trains between two stations instead of the commute, for a couple of hours. */
    fun show(from: String, to: String) {
        _customPair.value = from to to
        customPairAt = System.currentTimeMillis()
        refresh()
    }

    fun flip() {
        val b = _board.value ?: return
        show(b.to.id, b.from.id)
    }

    fun showCommute() {
        _customPair.value = null
        refresh()
    }

    fun trackTrain(train: BoardTrain) {
        val b = _board.value ?: return
        act("Couldn't track that train") {
            apiClient.track(Tracked(tripId = train.tripId, serviceDate = train.serviceDate, from = b.from.id, to = b.to.id))
            refreshNow()
        }
    }

    fun untrackTrain() {
        act("Couldn't stop tracking") {
            apiClient.untrack()
            _tracked.value = null
            refreshNow()
        }
    }

    /** A link that follows the tracked train live, with a message to send along. Null (with an error shown) when it couldn't be made. */
    fun shareEta(done: (message: String?) -> Unit) {
        val p = _tracked.value?.progress
        viewModelScope.launch {
            try {
                val res = apiClient.createEtaShare()
                done(if (p != null) "On Caltrain ${p.train}, arriving ${p.to.name} at ${Clock.time(p.predArr)}. Follow it live: ${res.url}" else res.url)
            } catch (e: Exception) {
                _errorMessage.value = "Couldn't create share link: ${readable(e)}"
                done(null)
            }
        }
    }

    /** Runs a change and shows [failure] with the reason when it's refused. */
    private fun act(failure: String, block: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                block()
            } catch (e: Exception) {
                _errorMessage.value = "$failure: ${readable(e)}"
            }
        }
    }

    // ---------------------------------------------------------------- on a train

    /** Sends recent fixes when they could mean a train: moving, or a ride is under way. Standing still makes no request. */
    private suspend fun reportRide() {
        if (!_settings.value.onTrain.usesLocation) return
        val fixes = rideLocation.samples()
        val moving = fixes.takeLast(3).any { (it.speed ?: 0.0) >= 5.0 }
        if (fixes.size < 2 || !(moving || _onTrain.value != null)) return
        runCatching { apiClient.reportOnTrain(fixes) }
    }

    /** Starts or stops following the phone for what the on-train and location settings ask. */
    fun applyRideWatching() {
        val mode = _settings.value.onTrain
        val context = getApplication<Application>()
        val signedIn = _phase.value == Phase.READY
        if (signedIn && appVisible && (mode.usesLocation || _useLocation.value)) rideLocation.start() else rideLocation.stop()
        if (signedIn && mode == OnTrainMode.BACKGROUND && rideLocation.hasBackgroundAccess()) {
            OnTrainService.start(context, apiClient)
        } else {
            OnTrainService.stop(context)
        }
    }

    fun onAppVisible(visible: Boolean) {
        appVisible = visible
        _notificationsAllowed.value = PushService.canNotify(getApplication())
        applyRideWatching()
        if (visible && _phase.value == Phase.READY) {
            refresh()
            loadFamily()
            // Allowed in system settings since last time: register now.
            if (_notificationsAllowed.value && _alertsOn.value != true) registerForAlerts()
        }
    }

    fun hasLocationAccess(): Boolean = rideLocation.hasAccess()
    fun hasBackgroundLocationAccess(): Boolean = rideLocation.hasBackgroundAccess()

    fun setOnTrainMode(mode: OnTrainMode) {
        saveSettings(_settings.value.copy(onTrain = mode)) { ok ->
            if (ok && !mode.usesLocation) _onTrain.value = null
        }
    }

    fun setAlertScope(scope: AlertScope) {
        saveSettings(_settings.value.copy(alerts = _settings.value.alerts.copy(scope = scope)))
    }

    /** Settings: stop a leg's alerts for the day once your location shows you got there. */
    fun setStopWhenDone(on: Boolean) {
        saveSettings(_settings.value.copy(alerts = _settings.value.alerts.copy(stopWhenDone = on)))
    }

    /** The card's button: this leg's alerts come back for today only. */
    fun resumeCommuteAlerts() {
        val was = _commuteDone.value
        _commuteDone.value = null
        viewModelScope.launch {
            try {
                apiClient.resumeCommuteAlerts()
            } catch (e: Exception) {
                _commuteDone.value = was
                _errorMessage.value = readable(e)
            }
        }
    }

    /** Tracks the train you're on, to a stop you pick or the one the card expects. */
    fun trackOnTrain(stop: String? = null) {
        val c = _onTrain.value ?: return
        act("Couldn't track that train") {
            apiClient.track(Tracked(tripId = c.tripId, serviceDate = c.serviceDate, from = c.from.id, to = stop ?: c.to.id))
            refreshNow()
        }
    }

    fun dismissOnTrain() {
        _onTrain.value = null
        viewModelScope.launch { runCatching { apiClient.dismissOnTrain() } }
        syncToWatch()
    }

    /** Turns the location estimate on or off. The screen asks for location access before turning it on. */
    fun setUseLocation(on: Boolean) {
        if (on && !rideLocation.hasAccess()) {
            _useLocation.value = false
            _errorMessage.value = "Location is off for Headway. Turn it on in the phone's settings for Headway."
        } else {
            _useLocation.value = on
        }
        prefs.edit().putBoolean(KEY_USE_LOCATION, _useLocation.value).apply()
        applyRideWatching()
        refresh()
    }

    // ---------------------------------------------------------------- settings

    /** Saves settings through the Worker (the same checks as the web settings page). [done] gets whether it worked. */
    fun saveSettings(newSettings: Settings, done: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            try {
                val resp = apiClient.saveSettings(newSettings)
                _settings.value = resp.settings
                _settingsSaved.value = true
                _errorMessage.value = null
                applyRideWatching()
                refreshNow()
                done(true)
            } catch (e: Exception) {
                _errorMessage.value = readable(e)
                done(false)
            }
        }
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
            } catch (e: Exception) {
                _errorMessage.value = readable(e)
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

    /** What you're told about one member. */
    fun setFollow(userId: String, prefs: FollowPrefs) {
        val follows = (_family.value?.currentFollows ?: emptyMap()).toMutableMap()
        if (prefs.notify.isEmpty() && !prefs.live) follows.remove(userId) else follows[userId] = prefs
        familyChange { it.updateFamily(follows = follows) }
    }

    // ---------------------------------------------------------------- glasses

    fun generatePairingCode() {
        act("Couldn't make a pairing code") {
            _pairingCode.value = apiClient.createPairingCode()
            _pairedDevices.value = apiClient.getDevices()
        }
    }

    fun loadDevices() {
        if (apiClient.session == null) return
        act("Couldn't load your glasses") { _pairedDevices.value = apiClient.getDevices() }
    }

    fun unpairDevice(id: String) {
        act("Couldn't unpair") {
            apiClient.unpairDevice(id)
            _pairedDevices.value = apiClient.getDevices()
        }
    }

    // ---------------------------------------------------------------- alerts (FCM)

    /** Registers this phone for the account's alerts. Called after sign-in, when the token changes, and once notifications are allowed. */
    fun registerForAlerts(token: String? = null) {
        if (apiClient.session == null) return
        val context = getApplication<Application>()
        PushService.ensureChannels(context)
        PushService.onToken = { registerForAlerts(it) }
        _notificationsAllowed.value = PushService.canNotify(context)
        viewModelScope.launch {
            val t = token ?: PushService.token()
            if (t == null) { _alertsOn.value = false; return@launch }
            runCatching { apiClient.registerPush(t, android.os.Build.MODEL ?: "Android phone") }
                .onSuccess { pushToken = t; _alertsOn.value = it }
                .onFailure { _alertsOn.value = false }
        }
    }

    /** The notification permission prompt was answered. */
    fun onNotificationPermission(granted: Boolean) {
        _notificationsAllowed.value = granted
        if (granted) registerForAlerts()
    }

    fun sendTestAlert() {
        viewModelScope.launch {
            _notice.value = try {
                apiClient.testPush()
                "Test alert sent."
            } catch (e: Exception) {
                readable(e)
            }
        }
    }

    // ---------------------------------------------------------------- watch

    /** Pushes the current state to paired Wear OS watches. */
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
                val nodes = Wearable.getNodeClient(context).connectedNodes.await()
                val messageClient = Wearable.getMessageClient(context)
                for (node in nodes) messageClient.sendMessage(node.id, WatchMessage.PATH_SYNC_STATE, bytes).await()
            } catch (_: Exception) {
                // No watch paired, or Play services unavailable: nothing to sync.
            }
        }
    }

    companion object {
        /** Where Supabase sends the browser back after Google sign-in (allow-listed in the shared project). */
        const val AUTH_REDIRECT = "headway://login-callback"
        /** A flip or picked pair lasts this long, then the board is the commute again (as on iPhone and watch). */
        const val MANUAL_PICK_MS = 2 * 60 * 60_000L
        private const val REFRESH_MS = 20_000L
        private const val KEY_VERIFIER = "pkce_verifier"
        private const val KEY_STATIONS = "stations"
        private const val KEY_USE_LOCATION = "use_location"
    }
}
