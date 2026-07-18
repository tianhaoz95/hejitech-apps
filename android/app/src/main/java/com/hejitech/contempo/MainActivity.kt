package com.hejitech.contempo

import android.Manifest
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.animation.AccelerateInterpolator
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.ui.navigation.ContempoNavHost
import com.hejitech.contempo.ui.signin.SignInScreen
import com.hejitech.contempo.ui.theme.ContempoTheme
import com.hejitech.contempo.wear.AudioCaptureProcessor
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

private const val SPLASH_EXIT_ANIM_DURATION_MS = 280L

private const val PENDING_AUDIO_PROCESS_INTERVAL_MS = 2 * 60 * 1000L

class MainActivity : ComponentActivity() {
    // Whether the persistent processing notification is visible — there's no
    // foreground service on the phone side anymore, this is just for any
    // future notification this app posts; nothing to react to either way.
    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        // Must be called before super.onCreate() — see Theme.Contempo.Starting
        // (res/values/themes.xml) for the theme/icon-animation side of this.
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // The system's default splash exit is an abrupt cut; a short
        // fade+scale-down on the icon as it hands off to the real content
        // reads as deliberate rather than a loading screen just disappearing.
        // This only touches the exit — the entrance animation (ring draw +
        // dot pop) is entirely declarative, driven by the AnimatedVectorDrawable
        // referenced from the splash theme.
        splashScreen.setOnExitAnimationListener { splashScreenView ->
            val fadeScale = ObjectAnimator.ofPropertyValuesHolder(
                splashScreenView.iconView,
                PropertyValuesHolder.ofFloat("alpha", 1f, 0f),
                PropertyValuesHolder.ofFloat("scaleX", 1f, 0.8f),
                PropertyValuesHolder.ofFloat("scaleY", 1f, 0.8f),
            )
            fadeScale.duration = SPLASH_EXIT_ANIM_DURATION_MS
            fadeScale.interpolator = AccelerateInterpolator()
            fadeScale.addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) = splashScreenView.remove()
            })
            fadeScale.start()
        }
        // Checked first, not just launched unconditionally — re-requesting
        // every cold start re-shows the system dialog every time the user
        // hasn't granted it yet, which is both annoying and (worse) steals
        // foreground focus from this Activity for as long as it's up,
        // delaying RESUMED and everything gated on it below.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        // Drains the watch's pending-audio backlog immediately whenever this
        // app is open, instead of leaving it entirely to the periodic
        // background job (15-minute floor) — see AudioCaptureProcessor's
        // kdoc. Repeats for as long as the app stays in the foreground since
        // there might be nothing pending on the very first attempt.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                while (isActive) {
                    AudioCaptureProcessor.processPendingCaptures()
                    delay(PENDING_AUDIO_PROCESS_INTERVAL_MS)
                }
            }
        }

        setContent { ContempoRoot() }
    }
}

/** Named distinctly from the ContempoApp Application class — same name
 *  caused a real overload-resolution-ambiguity compile error (a bare
 *  Application subclass has an implicit no-arg constructor, which collides
 *  with a same-named zero-arg @Composable call site). */
@Composable
private fun ContempoRoot() {
    ContempoTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
            AuthGate { ContempoNavHost() }
        }
    }
}

/**
 * Renders SignInScreen until Google Sign-In (see AuthManager) completes, then
 * swaps to `content` — reacts live via FirebaseAuth.AuthStateListener, so
 * signing out from Settings bounces straight back here too.
 */
@Composable
private fun AuthGate(content: @Composable () -> Unit) {
    var signedIn by remember { mutableStateOf(Firebase.auth.currentUser != null) }

    // A cached FirebaseUser can outlive the backend session it was issued
    // against — most commonly here, a local Firebase Auth emulator
    // restarting (its state is in-memory only, see
    // ContempoApp.connectToEmulators) invalidates every refresh token minted
    // before the restart, but the Android SDK still returns the stale
    // cached FirebaseUser regardless, so `currentUser != null` looks
    // signed-in while every later Firestore call silently fails with
    // UNAUTHENTICATED/INVALID_REFRESH_TOKEN and the app just stops being
    // able to read or write anything, with no visible sign-out — confirmed
    // live via Firestore's own verbose logs (FirebaseFirestore.setLoggingEnabled).
    // Forcing one token refresh on launch surfaces that failure immediately
    // and recovers by re-authenticating, instead of leaving the user stuck
    // in an unrecoverable "signed in but nothing works" state.
    LaunchedEffect(Unit) {
        val user = Firebase.auth.currentUser ?: return@LaunchedEffect
        runCatching { user.getIdToken(true).await() }
            .onFailure {
                ServiceLocator.authManager.signOut()
                if (BuildConfig.USE_FIREBASE_EMULATOR) {
                    // Dev-only: re-authenticate with the same fixed fake
                    // identity right away so this recovery is invisible —
                    // there's no real user to prompt for a real sign-in.
                    ServiceLocator.authManager.signIn()
                }
            }
    }

    DisposableEffect(Unit) {
        val listener = com.google.firebase.auth.FirebaseAuth.AuthStateListener { auth ->
            signedIn = auth.currentUser != null
        }
        Firebase.auth.addAuthStateListener(listener)
        onDispose { Firebase.auth.removeAuthStateListener(listener) }
    }

    if (signedIn) {
        content()
    } else {
        SignInScreen()
    }
}
