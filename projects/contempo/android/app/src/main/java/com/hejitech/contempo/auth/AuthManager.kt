package com.hejitech.contempo.auth

import android.content.Context
import com.hejitech.core.supabase.ContempoBackend
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.Apple
import io.github.jan.supabase.auth.providers.Google

/**
 * Sign-in through Supabase Auth (the shared HEJI project). Google and Apple through the browser
 * (PKCE), back through com.hejitech.contempoapp://login-callback, which MainActivity hands to the
 * client (handleDeeplinks). No Google client ids in the app and no Credential Manager; the session
 * is persisted and refreshed by the client.
 */
class AuthManager(@Suppress("unused") private val context: Context) {

    /** Opens the browser for Google sign-in; the session arrives with the deep link. */
    suspend fun signIn(): Result<Unit> = runCatching {
        ContempoBackend.client.auth.signInWith(Google)
    }

    /** Opens the browser for Sign in with Apple so iPhone Apple accounts work on Android too. */
    suspend fun signInWithApple(): Result<Unit> = runCatching {
        ContempoBackend.client.auth.signInWith(Apple)
    }

    fun signOut() {
        kotlinx.coroutines.runBlocking { runCatching { ContempoBackend.client.auth.signOut() } }
    }
}
