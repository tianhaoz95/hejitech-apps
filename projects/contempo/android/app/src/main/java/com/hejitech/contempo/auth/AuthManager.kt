package com.hejitech.contempo.auth

import android.content.Context
import com.hejitech.core.supabase.ContempoBackend
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Google

/**
 * Sign-in through Supabase Auth (the shared HEJI project). Google, the monorepo's way: a browser
 * tab to Supabase's /authorize (PKCE), back through com.hejitech.contempoapp://login-callback,
 * which MainActivity hands to the client (handleDeeplinks). No Google client ids in the app and
 * no Credential Manager; the session is persisted and refreshed by the client.
 */
class AuthManager(@Suppress("unused") private val context: Context) {

    /** Opens the browser; the session arrives with the deep link, observed via ContempoBackend.signedIn. */
    suspend fun signIn(): Result<Unit> = runCatching {
        ContempoBackend.client.auth.signInWith(Google)
    }

    fun signOut() {
        kotlinx.coroutines.runBlocking { runCatching { ContempoBackend.client.auth.signOut() } }
    }
}
