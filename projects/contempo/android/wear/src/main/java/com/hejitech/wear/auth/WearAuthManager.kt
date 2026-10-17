package com.hejitech.wear.auth

import android.content.Context
import com.hejitech.wear.BuildConfig
import com.google.firebase.Firebase
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.auth
import kotlinx.coroutines.tasks.await

/**
 * Same two-path design as app/auth/AuthManager.kt (see its kdoc) for the
 * emulator path — but the real path is a phone relay, not Credential
 * Manager. Confirmed live: GetSignInWithGoogleOption AND
 * GetGoogleIdOption(filterByAuthorizedAccounts = false) both throw
 * NoCredentialException on Wear OS even with a real Google account already
 * on the watch — matches Google's own documented Wear OS limitation
 * ("credentials cannot be created on Wear OS"; only Credential Providers
 * with Wear OS integrations can be reused from a phone) — so there's no
 * on-watch fallback to attempt; this always requests a Firebase custom token
 * from the paired phone (WatchAuthTokenClient — same fix as iOS/watchOS's
 * WatchAuthTokenRelay, see its kdoc). If the phone isn't reachable for an
 * immediate round trip, WatchAuthTokenClient waits for its proactive
 * DataClient push instead of failing outright — [onWaitingForPhone] lets the
 * caller reflect that "will complete automatically once reconnected" state
 * in the UI rather than showing a dead-end error.
 */
class WearAuthManager(private val context: Context) {

    private val tokenClient = WatchAuthTokenClient(context)

    suspend fun signIn(onWaitingForPhone: () -> Unit = {}): Result<Unit> = runCatching {
        if (BuildConfig.USE_FIREBASE_EMULATOR) {
            fakeEmulatorIdToken()
        } else {
            when (val result = tokenClient.requestToken(onWaitingForPhone)) {
                is WatchAuthTokenResult.CustomToken -> {
                    android.util.Log.d("WearAuthDiag", "got CustomToken from phone, signing in")
                    Firebase.auth.signInWithCustomToken(result.token).await()
                }
                is WatchAuthTokenResult.IsEmulator -> {
                    android.util.Log.d("WearAuthDiag", "got IsEmulator result")
                    fakeEmulatorIdToken()
                }
                is WatchAuthTokenResult.PhoneError -> {
                    android.util.Log.d("WearAuthDiag", "got PhoneError: ${result.message}")
                    error(result.message)
                }
            }
        }
    }

    fun signOut() {
        Firebase.auth.signOut()
    }

    /** Same fixed test identity as the phone app, so both land on the same emulator-mode user. */
    private suspend fun fakeEmulatorIdToken() {
        val idToken = """{"sub":"emulator-pilot-user","email":"pilot@example.test","email_verified":true,"name":"Pilot Host"}"""
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        Firebase.auth.signInWithCredential(credential).await()
    }
}
