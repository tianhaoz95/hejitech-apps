package com.hejitech.wear.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.hejitech.wear.BuildConfig
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.Firebase
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.auth
import kotlinx.coroutines.tasks.await
import java.util.UUID

/**
 * Same two-path design as app/auth/AuthManager.kt (see its kdoc) for the
 * emulator path — but the real path leads with a phone relay, not Credential
 * Manager directly. Confirmed live: GetSignInWithGoogleOption AND
 * GetGoogleIdOption(filterByAuthorizedAccounts = false) both throw
 * NoCredentialException on Wear OS even with a real Google account already
 * on the watch — matches Google's own documented Wear OS limitation
 * ("credentials cannot be created on Wear OS"; only Credential Providers
 * with Wear OS integrations can be reused from a phone). So this requests a
 * Firebase custom token from the paired phone first (WatchAuthTokenClient —
 * same fix as iOS/watchOS's WatchAuthTokenRelay, see its kdoc), and only
 * falls back to a direct Credential Manager attempt if the phone is
 * genuinely unreachable (no paired phone nearby at all).
 */
class WearAuthManager(private val context: Context) {

    private val tokenClient = WatchAuthTokenClient(context)

    suspend fun signIn(): Result<Unit> = runCatching {
        if (BuildConfig.USE_FIREBASE_EMULATOR) {
            fakeEmulatorIdToken()
        } else {
            realIdTokenOrCustomToken()
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

    private suspend fun realIdTokenOrCustomToken() {
        when (val result = tokenClient.requestToken()) {
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
            is WatchAuthTokenResult.PhoneUnreachable -> {
                android.util.Log.d("WearAuthDiag", "got PhoneUnreachable, falling back to Credential Manager")
                val idToken = realGoogleIdToken()
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                Firebase.auth.signInWithCredential(credential).await()
            }
        }
    }

    private suspend fun realGoogleIdToken(): String {
        check(BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank()) {
            "GOOGLE_WEB_CLIENT_ID is not set in local.properties — see local.properties.example."
        }
        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
            .setNonce(UUID.randomUUID().toString())
            .build()
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()
        val response = CredentialManager.create(context).getCredential(context, request)
        val credential = response.credential
        check(
            credential is CustomCredential &&
                credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) { "Unexpected credential type from Credential Manager: ${credential.type}" }
        return GoogleIdTokenCredential.createFrom(credential.data).idToken
    }
}
