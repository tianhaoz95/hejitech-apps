package com.hejitech.contempo.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.hejitech.contempo.BuildConfig
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.Firebase
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.auth
import kotlinx.coroutines.tasks.await
import java.util.UUID

/**
 * Google Sign-In, with two entirely separate code paths selected by
 * BuildConfig.USE_FIREBASE_EMULATOR — both end at the same
 * `signInWithCredential(GoogleAuthProvider.getCredential(idToken, null))`
 * call, but they get that idToken very differently:
 *
 *  - Emulator path: the Firebase Auth emulator does not verify federated
 *    (Google/etc.) ID tokens against the real provider — it decodes whatever
 *    string is passed as the token and, if it parses as JSON, takes fields
 *    like `sub`/`email`/`name` as the resulting user's claims. So this skips
 *    Credential Manager and Google Identity Services entirely and hands the
 *    emulator a small fixed fake-identity JSON. No real Firebase project,
 *    SHA-1 fingerprint, or OAuth Web Client ID is needed to exercise this.
 *
 *  - Real path: actual Credential Manager + Google Identity Services flow,
 *    requiring BuildConfig.GOOGLE_WEB_CLIENT_ID to be set (see
 *    local.properties.example) once a real Firebase project exists.
 */
class AuthManager(private val context: Context) {

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

    /**
     * One fixed test identity — consistent with this codebase's existing
     * single-pilot-user assumption elsewhere (anonymous auth before this,
     * hardcoded emulator ports, etc). Re-signing-in returns to the same
     * account/data since `sub` (the emulator's stand-in for uid) is stable.
     */
    private fun fakeEmulatorIdToken(): String =
        """{"sub":"emulator-pilot-user","email":"pilot@example.test","email_verified":true,"name":"Pilot Host"}"""

    private suspend fun realGoogleIdToken(): String {
        check(BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank()) {
            "GOOGLE_WEB_CLIENT_ID is not set in local.properties — see local.properties.example. " +
                "Needed only for real (non-emulator) Google Sign-In."
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
