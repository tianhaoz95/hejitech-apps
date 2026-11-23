package com.hejitech.fitloop

import android.app.Application
import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.fitloop.core.Backend
import com.hejitech.fitloop.core.BackendConfig
import com.hejitech.fitloop.core.BackendException
import com.hejitech.fitloop.core.CheckinData
import com.hejitech.fitloop.core.Day
import com.hejitech.fitloop.core.FeedbackTag
import com.hejitech.fitloop.core.NewCheckin
import com.hejitech.fitloop.core.NewFeedback
import com.hejitech.fitloop.core.PlanResponse
import com.hejitech.fitloop.core.ReminderPlanner
import com.hejitech.fitloop.core.Settings
import com.hejitech.fitloop.core.TodayResponse
import com.hejitech.fitloop.core.WatchWorkout
import com.hejitech.fitloop.core.WorkoutState
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.util.TimeZone

enum class Phase { LAUNCHING, SIGNED_OUT, READY }

/**
 * The app's state: sign-in, today (from the Worker, which merges the plan and check-ins), the plan,
 * settings, reminders and Health Connect. The same flow as the iPhone app's AppModel.
 */
class AppModel(app: Application) : AndroidViewModel(app) {
    var phase by mutableStateOf(Phase.LAUNCHING)
        private set
    var email by mutableStateOf<String?>(null)
        private set
    var date by mutableStateOf(Day.today())
        private set
    var today by mutableStateOf<TodayResponse?>(null)
        private set
    var plan by mutableStateOf<PlanResponse?>(null)
        private set
    var settings by mutableStateOf(Settings())
        private set
    var error by mutableStateOf<String?>(null)
    var loading by mutableStateOf(false)
        private set

    /** Sign in with Apple through the browser works once the shared project's Apple provider has a web secret. */
    var appleAvailable by mutableStateOf(false)
        private set

    /** The workout open in the player (its ref): shown over the tabs, like the iPhone app's full-screen player. */
    var openWorkout by mutableStateOf<String?>(null)

    /** Debug launch extras (MainActivity): which tab to open, and whether to open the first workout. */
    var initialTab = "today"
    var openFirstWorkout = false

    private val prefs = app.getSharedPreferences("fitloop", Context.MODE_PRIVATE)

    /** Health Connect: the daily summary and saved workouts. MainActivity asks for its permissions. */
    val health = HealthConnect(app)
    var requestHealthPermissions: ((Set<String>) -> Unit)? = null

    /** The Wear OS watch during a workout, and its latest heart rate. */
    val wear = WearLink(app)
    var heartRate by mutableStateOf<Int?>(null)
        private set
    /** The open player's Set done, for the watch's button. */
    var watchSetDone: (() -> Unit)? = null
    private var watchWorkout = WatchWorkout()
    private var lastLivePost = 0L

    /** "Save workouts to Health Connect" (this phone only, on by default, like the iPhone's switch). */
    var saveWorkouts by mutableStateOf(prefs.getBoolean("save_workouts", true))
        private set
    fun switchSaveWorkouts(on: Boolean) {
        saveWorkouts = on
        prefs.edit().putBoolean("save_workouts", on).apply()
        if (on) askHealth()
    }
    private val store = SessionStore(app)
    lateinit var backend: Backend
        private set
    private var started = false

    val isLocal: Boolean get() = backend.config == BackendConfig.LOCAL

    /** Once per process, from MainActivity. Debug builds use the local stack unless `production`. */
    fun start(production: Boolean, date: String?) {
        if (started) return
        started = true
        val config = if (BuildConfig.DEBUG && !production) BackendConfig.LOCAL else BackendConfig.PRODUCTION
        backend = Backend(config, store.load())
        backend.onSessionChange = store::save
        wear.onHeartRate = { bpm -> viewModelScope.launch { watchHeartRate(bpm) } }
        wear.onSetDone = { viewModelScope.launch { watchSetDone?.invoke() } }
        wear.current = { watchWorkout }
        wear.start()
        if (date != null && Day.date(date) != null) this.date = date
        viewModelScope.launch { route() }
    }

    /** After launch and after every sign-in path: to the app, or to sign-in. */
    private suspend fun route() {
        val s = backend.session
        if (s == null) {
            phase = Phase.SIGNED_OUT
            if (!appleAvailable) viewModelScope.launch { appleAvailable = backend.providerAvailable("apple", AUTH_REDIRECT) }
            return
        }
        email = s.email
        try {
            val r = backend.settings()
            settings = r.settings
            email = r.email ?: s.email
            // The agent's "today" follows the phone's time zone.
            val zone = TimeZone.getDefault().id
            if (settings.timezone != zone) settings = runCatching { backend.save(settings.copy(timezone = zone)).settings }.getOrDefault(settings)
            error = null
            phase = Phase.READY
            refresh()
            syncHealth()
        } catch (e: BackendException) {
            if (e is BackendException.NotSignedIn || e.isUnauthorized) {
                backend.signOut()
                phase = Phase.SIGNED_OUT
            } else {
                phase = Phase.READY
                error = e.message
            }
        } catch (e: Exception) {
            phase = Phase.READY
            error = "Couldn't reach FitLoop: ${e.message}"
        }
    }

    // ---- sign-in

    /** Google through the browser with PKCE: the URL to open. The callback comes back to `finishOAuth`. */
    fun startGoogleSignIn(): String = startOAuth("google")

    /** Apple through the browser with PKCE, for accounts made with Sign in with Apple on iPhone. */
    fun startAppleSignIn(): String = startOAuth("apple")

    private fun startOAuth(provider: String): String {
        val start = backend.oauthStart(provider, AUTH_REDIRECT)
        prefs.edit().putString("pkce_verifier", start.verifier).putString("pkce_provider", provider).apply()
        error = null
        return start.url
    }

    /** `fitloop://login-callback?code=…` from the browser. */
    fun finishOAuth(callback: Uri) {
        val verifier = prefs.getString("pkce_verifier", null) ?: return
        val provider = if (prefs.getString("pkce_provider", "google") == "apple") "Apple" else "Google"
        prefs.edit().remove("pkce_verifier").remove("pkce_provider").apply()
        val code = callback.getQueryParameter("code")
        if (code == null) {
            error = "$provider sign-in failed: ${callback.getQueryParameter("error_description") ?: "no code in the callback"}"
            return
        }
        viewModelScope.launch {
            try {
                backend.exchangeCode(code, verifier)
                route()
            } catch (e: Exception) {
                error = "$provider sign-in failed: ${e.message}"
            }
        }
    }

    /** Email and password on the local stack (the seed athlete; debug builds). */
    fun signInLocal(email: String, password: String) = viewModelScope.launch {
        try {
            backend.signIn(email, password)
            route()
        } catch (e: Exception) {
            error = e.message
        }
    }

    /** Email sign-in for accounts FitLoop hands out (the reviewers' demo account); no sign-up. */
    suspend fun signInWithEmailAccount(email: String, password: String): Boolean = try {
        backend.reviewSignIn(email.trim(), password)
        route()
        true
    } catch (e: Exception) {
        error = if (e is BackendException.Http && e.code == 401) "Wrong email or password." else e.message
        false
    }

    fun signOut() {
        backend.signOut()
        today = null
        plan = null
        openWorkout = null
        settings = Settings()
        ReminderScheduler.schedule(getApplication(), emptyList())
        phase = Phase.SIGNED_OUT
    }

    suspend fun deleteData() {
        try {
            backend.deleteData()
            signOut()
        } catch (e: Exception) {
            error = e.message
        }
    }

    // ---- data

    /** Not cancelled with the caller: a released pull-to-refresh must not stop a refresh halfway. */
    suspend fun refresh() = withContext(NonCancellable) {
        if (phase != Phase.READY) return@withContext
        loading = true
        try {
            coroutineScope {
                val t = async { backend.today(date) }
                val p = async { backend.plan() }
                today = t.await()
                plan = p.await()
            }
            error = null
            scheduleReminders()
        } catch (e: BackendException) {
            if (e is BackendException.NotSignedIn || e.isUnauthorized) phase = Phase.SIGNED_OUT else error = "Couldn't refresh: ${e.message}"
        } catch (e: Exception) {
            error = "Couldn't refresh: ${e.message}"
        } finally {
            loading = false
        }
    }

    /** The app came back to the front: a new day since it was last open is shown. */
    fun resumed() {
        if (phase != Phase.READY) return
        if (date < Day.today()) date = Day.today()
        viewModelScope.launch { refresh() }
    }

    suspend fun show(date: String) {
        this.date = date
        refresh()
    }

    suspend fun checkin(c: NewCheckin) {
        try {
            backend.checkin(listOf(c))
            today = backend.today(date)
        } catch (e: Exception) {
            error = e.message
        }
    }

    suspend fun sendFeedback(ref: String?, text: String, tags: Collection<FeedbackTag>): Boolean = try {
        backend.sendFeedback(NewFeedback(date, ref, text, tags.map { it.raw }))
        true
    } catch (e: Exception) {
        error = e.message
        false
    }

    suspend fun save(s: Settings): Boolean = try {
        settings = backend.save(s).settings
        scheduleReminders()
        true
    } catch (e: Exception) {
        error = e.message
        false
    }

    // ---- workouts and Health Connect

    /** A workout opened in the player: FitLoop opens on the watch too. */
    fun beginWorkout() {
        heartRate = null
        viewModelScope.launch { wear.openOnWatch() }
    }

    /** Where the open workout is, for the watch. */
    fun updateWatch(w: WatchWorkout) {
        if (w == watchWorkout) return
        watchWorkout = w
        viewModelScope.launch { wear.send(w) }
    }

    /** The player closed: the watch stops, and the glasses' live heart rate clears. */
    fun endWorkout() {
        updateWatch(WatchWorkout())
        if (heartRate != null && settings.vitals.liveHr) viewModelScope.launch { runCatching { backend.live(null, null) } }
        heartRate = null
    }

    private fun watchHeartRate(bpm: Int) {
        heartRate = bpm
        // Relayed to the Worker for the glasses, at most every 4 s (as the iPhone app does).
        val now = System.currentTimeMillis()
        if (!settings.vitals.liveHr || now - lastLivePost < 4_000 || !watchWorkout.open) return
        lastLivePost = now
        viewModelScope.launch { runCatching { backend.live(bpm, watchWorkout.ref) } }
    }

    /** The workout's check-in (with how long it took) and, when switched on, the session in Health Connect. */
    suspend fun finishWorkout(state: WorkoutState, status: String, started: Instant, heartRate: Int? = null) {
        val end = Instant.now()
        checkin(NewCheckin(date, state.ref, "workout", status, CheckinData(durationSec = (end.epochSecond - started.epochSecond).toInt(), avgHr = heartRate ?: this.heartRate)))
        if (saveWorkouts) runCatching { health.saveWorkout(state.workout.kind, state.workout.title, state.ref, date, started, end) }
    }

    /** What to ask Health Connect for: the summary's reads when that's on, writing workouts when that's on. */
    fun healthPermissionsWanted(): Set<String> = buildSet {
        if (settings.vitals.healthDaily) addAll(HealthConnect.READ)
        if (saveWorkouts) add(HealthConnect.WRITE_WORKOUT)
    }

    /** Asks for what's switched on and not yet allowed (the system sheet; nothing if all are granted). */
    fun askHealth() = viewModelScope.launch {
        if (!health.available) return@launch
        val missing = healthPermissionsWanted() - runCatching { health.granted() }.getOrDefault(emptySet())
        if (missing.isNotEmpty()) requestHealthPermissions?.invoke(missing)
    }

    /** The last 14 days' summary from Health Connect, when that option is on and allowed. */
    suspend fun syncHealth() {
        if (!settings.vitals.healthDaily || !health.available) return
        val vitals = runCatching { health.dailySummary(14) }.getOrDefault(emptyList())
        if (vitals.isNotEmpty()) runCatching { backend.sendVitals(vitals) }
    }

    // ---- reminders (local notifications)

    fun scheduleReminders() {
        val context = getApplication<Application>()
        if (!ReminderScheduler.canNotify(context)) return
        ReminderScheduler.schedule(context, ReminderPlanner.plan(plan?.current, settings, Day.today()))
    }

    companion object {
        /** Where Supabase sends the browser back after Google sign-in (the same address as the iPhone app). */
        const val AUTH_REDIRECT = "fitloop://login-callback"
    }
}
