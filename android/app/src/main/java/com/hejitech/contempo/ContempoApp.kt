package com.hejitech.contempo

import android.app.Application
import com.hejitech.contempo.data.ServiceLocator
import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.google.firebase.auth.auth
import com.google.firebase.firestore.firestore
import com.google.firebase.firestore.firestoreSettings
import com.google.firebase.firestore.memoryCacheSettings
import com.google.firebase.functions.functions
import com.google.firebase.initialize
import com.google.firebase.storage.storage

/**
 * Emulator wiring lives here, gated by BuildConfig.USE_FIREBASE_EMULATOR
 * (true for debug builds — see app/build.gradle.kts). Talks to "localhost"
 * on the assumption that whatever launched the app has already run
 * `adb reverse tcp:PORT tcp:PORT` for each emulator port — that's what maps
 * the device/emulator's own "localhost" back to the host machine's, and
 * works identically for the AVD and a physical device over USB (see
 * scripts/run-android-with-emulators.sh).
 */
class ContempoApp : Application() {

    override fun onCreate() {
        super.onCreate()
        Firebase.initialize(this)

        if (BuildConfig.USE_FIREBASE_EMULATOR) {
            connectToEmulators()
            Firebase.appCheck.installAppCheckProviderFactory(
                DebugAppCheckProviderFactory.getInstance()
            )
        } else {
            Firebase.appCheck.installAppCheckProviderFactory(
                PlayIntegrityAppCheckProviderFactory.getInstance()
            )
        }

        ServiceLocator.initialize(this)
        // No anonymous sign-in here anymore — auth.currentUser stays null
        // until the user actually signs in via SignInScreen/AuthManager.
    }

    private fun connectToEmulators() {
        val host = EMULATOR_HOST
        Firebase.auth.useEmulator(host, 9099)
        Firebase.firestore.useEmulator(host, 8080)
        // Disk-persisted local cache would otherwise survive across app
        // launches/reinstalls and resurrect documents that were wiped
        // server-side via the emulator's REST clear endpoint (the SDK has no
        // way to know about a delete that bypassed it) — memory-only cache
        // keeps each emulator run's data scoped to that process lifetime.
        Firebase.firestore.firestoreSettings = firestoreSettings {
            setLocalCacheSettings(memoryCacheSettings {})
        }
        Firebase.storage.useEmulator(host, 9199)
        Firebase.functions.useEmulator(host, 5001)
    }

    companion object {
        private const val EMULATOR_HOST = "localhost"
    }
}
