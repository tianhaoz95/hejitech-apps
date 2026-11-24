package com.hejitech.fitloop

import android.Manifest
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.hejitech.fitloop.ui.FitLoopTheme
import com.hejitech.fitloop.ui.MainTabs
import com.hejitech.fitloop.ui.ProScreen
import com.hejitech.fitloop.ui.SignInScreen
import kotlinx.coroutines.launch
import androidx.lifecycle.lifecycleScope

/**
 * The one activity. Debug launch extras (`adb shell am start -n com.hejitech.fitloop/.MainActivity …`),
 * the Android side of the iPhone app's launch arguments: `--ez autoSignIn true` (the seed athlete
 * on the local stack), `--ez reviewSignIn true` (the reviewers' sign-in path), `--es screen
 * today|plan|progress|feedback|settings`, `--es date YYYY-MM-DD`, `--ez openWorkout true`,
 * `--ez production true`.
 */
class MainActivity : ComponentActivity() {
    private val model: AppModel by viewModels()
    /** FitLoop Pro: Play Billing and the account's answer (ProStore.kt). */
    private val pro by lazy { ProStore(this) { model.backend } }
    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) model.scheduleReminders()
    }

    private val askHealth = registerForActivityResult(HealthConnect.permissionContract()) { granted ->
        if (granted.isNotEmpty()) lifecycleScope.launch { model.syncHealth() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val debug = BuildConfig.DEBUG
        model.requestHealthPermissions = { askHealth.launch(it) }
        model.start(production = debug && intent.getBooleanExtra("production", false), date = if (debug) intent.getStringExtra("date") else null)
        if (debug && savedInstanceState == null) {
            intent.getStringExtra("screen")?.let { model.initialTab = it }
            model.openFirstWorkout = intent.getBooleanExtra("openWorkout", false)
            if (intent.getBooleanExtra("autoSignIn", false)) model.signInLocal("athlete@example.com", "fitloop-dev")
            if (intent.getBooleanExtra("reviewSignIn", false)) lifecycleScope.launch { model.signInWithEmailAccount("review@example.com", "fitloop-review-dev") }
        }
        handle(intent)
        setContent {
            FitLoopTheme {
                Surface(Modifier.fillMaxSize()) {
                    when (model.phase) {
                        Phase.LAUNCHING -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                        Phase.SIGNED_OUT -> SignInScreen(model)
                        Phase.READY -> {
                            // FitLoop Pro is the account's (any store): checked after sign-in (ProStore.kt).
                            LaunchedEffect(Unit) { pro.refresh() }
                            val proChecked by pro.checked.collectAsState()
                            val proStatus by pro.status.collectAsState()
                            when {
                                proStatus?.pro == true || (proStatus == null && pro.cachedPro) -> {
                                    LaunchedEffect(Unit) { askForNotificationsOnce(); askForHealthOnce() }
                                    MainTabs(model)
                                }
                                !proChecked -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                                else -> ProScreen(pro, model.backend.config.site, proStatus?.email, onSignOut = { pro.forget(); model.signOut() })
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    override fun onResume() {
        super.onResume()
        model.resumed()
        // Back in the app: a purchase or renewal made elsewhere (another phone, the web) shows up.
        if (model.phase == Phase.READY) lifecycleScope.launch { pro.refresh() }
    }

    /** `fitloop://login-callback?code=…`: the browser coming back from Google or Apple sign-in. */
    private fun handle(intent: Intent) {
        val data = intent.data ?: return
        if (data.scheme == "fitloop" && data.host == "login-callback") {
            model.finishOAuth(data)
            intent.data = null
        }
    }

    /** Reminders are on by default, so ask once when the app first opens signed in. */
    private fun askForNotificationsOnce() {
        if (Build.VERSION.SDK_INT < 33 || ReminderScheduler.canNotify(this)) return
        val prefs = getSharedPreferences("fitloop", Context.MODE_PRIVATE)
        if (prefs.getBoolean("asked_notifications", false)) return
        prefs.edit().putBoolean("asked_notifications", true).apply()
        askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    /** The daily summary and saved workouts are on by default: ask Health Connect once, like the iPhone asks Health. */
    private fun askForHealthOnce() {
        val prefs = getSharedPreferences("fitloop", Context.MODE_PRIVATE)
        if (BuildConfig.DEBUG && intent.getBooleanExtra("noHealth", false)) return
        if (!model.health.available || prefs.getBoolean("asked_health", false)) return
        prefs.edit().putBoolean("asked_health", true).apply()
        model.askHealth()
    }

    /** From Settings, after saving reminders that are switched on. */
    fun askForNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && !ReminderScheduler.canNotify(this)) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
