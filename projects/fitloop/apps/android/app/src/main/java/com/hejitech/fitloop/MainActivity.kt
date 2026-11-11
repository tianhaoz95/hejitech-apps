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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.hejitech.fitloop.ui.FitLoopTheme
import com.hejitech.fitloop.ui.MainTabs
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
    private val askNotifications = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) model.scheduleReminders()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val debug = BuildConfig.DEBUG
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
                            LaunchedEffect(Unit) { askForNotificationsOnce() }
                            MainTabs(model)
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
    }

    /** `fitloop://login-callback?code=…`: the browser coming back from Google sign-in. */
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

    /** From Settings, after saving reminders that are switched on. */
    fun askForNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && !ReminderScheduler.canNotify(this)) askNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
