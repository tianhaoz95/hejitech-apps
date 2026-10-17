package com.hejitech.wear.auth

import android.content.Context
import com.hejitech.core.supabase.ContempoBackend
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth

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

    /**
     * Asks the paired phone for a one-time pairing code (the phone gets it from the Contempo Worker)
     * and exchanges it for this watch's own Supabase session. Replaces the Firebase custom token.
     */
    suspend fun signIn(onWaitingForPhone: () -> Unit = {}): Result<Unit> = runCatching {
        when (val result = tokenClient.requestToken(onWaitingForPhone)) {
            is WatchAuthTokenResult.PairingCode ->
                ContempoBackend.client.auth.verifyEmailOtp(type = OtpType.Email.MAGIC_LINK, tokenHash = result.tokenHash)
            is WatchAuthTokenResult.IsEmulator -> error("Sign in on your phone first")
            is WatchAuthTokenResult.PhoneError -> error(result.message)
        }
    }

    fun signOut() {
        kotlinx.coroutines.runBlocking { runCatching { ContempoBackend.client.auth.signOut() } }
    }
}
