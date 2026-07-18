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
 * Same two-path design as app/auth/AuthManager.kt (see its kdoc) — an
 * emulator fake-identity path needing no real project, and a real Credential
 * Manager + Google Identity Services path. A Wear OS 3+ device with a Google
 * account added in Settings can complete the real path directly, on-device,
 * no phone relay needed.
 */
class WearAuthManager(private val context: Context) {

    suspend fun signIn(): Result<Unit> = runCatching {
        val idToken = if (BuildConfig.USE_FIREBASE_EMULATOR) {
            fakeEmulatorIdToken()
        } else {
            realGoogleIdToken()
        }
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        Firebase.auth.signInWithCredential(credential).await()
        Unit
    }

    fun signOut() {
        Firebase.auth.signOut()
    }

    /** Same fixed test identity as the phone app, so both land on the same emulator-mode user. */
    private fun fakeEmulatorIdToken(): String =
        """{"sub":"emulator-pilot-user","email":"pilot@example.test","email_verified":true,"name":"Pilot Host"}"""

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
