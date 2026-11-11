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
import com.hejitech.fitloop.core.Day
import com.hejitech.fitloop.core.FeedbackTag
import com.hejitech.fitloop.core.NewCheckin
import com.hejitech.fitloop.core.NewFeedback
import com.hejitech.fitloop.core.PlanResponse
import com.hejitech.fitloop.core.ReminderPlanner
import com.hejitech.fitloop.core.Settings
import com.hejitech.fitloop.core.TodayResponse
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.TimeZone

enum class Phase { LAUNCHING, SIGNED_OUT, READY }

/**
 * The app's state: sign-in, today (from the Worker, which merges the plan and check-ins), the plan,
 * settings and reminders. The same flow as the iPhone app's AppModel, without the watch and Health.
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

    /** The workout open in the player (its ref): shown over the tabs, like the iPhone app's full-screen player. */
    var openWorkout by mutableStateOf<String?>(null)

    /** Debug launch extras (MainActivity): which tab to open, and whether to open the first workout. */
    var initialTab = "today"
    var openFirstWorkout = false

    private val prefs = app.getSharedPreferences("fitloop", Context.MODE_PRIVATE)
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
        if (date != null && Day.date(date) != null) this.date = date
        viewModelScope.launch { route() }
    }

    /** After launch and after every sign-in path: to the app, or to sign-in. */
    private suspend fun route() {
        val s = backend.session
        if (s == null) { phase = Phase.SIGNED_OUT; return }
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
    fun startGoogleSignIn(): String {
        val start = backend.oauthStart("google", AUTH_REDIRECT)
        prefs.edit().putString("pkce_verifier", start.verifier).apply()
        error = null
        return start.url
    }

    /** `fitloop://login-callback?code=…` from the browser. */
    fun finishOAuth(callback: Uri) {
        val verifier = prefs.getString("pkce_verifier", null) ?: return
        prefs.edit().remove("pkce_verifier").apply()
        val code = callback.getQueryParameter("code")
        if (code == null) {
            error = "Google sign-in failed: ${callback.getQueryParameter("error_description") ?: "no code in the callback"}"
            return
        }
        viewModelScope.launch {
            try {
                backend.exchangeCode(code, verifier)
                route()
            } catch (e: Exception) {
                error = "Google sign-in failed: ${e.message}"
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
