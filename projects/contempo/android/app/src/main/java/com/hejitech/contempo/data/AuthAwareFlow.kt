package com.hejitech.contempo.data

import io.github.jan.supabase.exceptions.RestException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.retryWhen

private const val AUTH_RACE_RETRY_DELAY_MS = 1_000L

/** 401/403 from Supabase (or a "used before sign-in" from ContempoBackend) — an auth problem, not data. */
private fun isAuthError(cause: Throwable): Boolean =
    (cause is RestException && (cause.statusCode == 401 || cause.statusCode == 403)) ||
        (cause is IllegalStateException && cause.message?.contains("before sign-in") == true)

/**
 * The standard handling for every eagerly-collected live query (Capture/Dashboard/Confirm
 * ViewModels): retry once after a short delay (a token can lag a fresh sign-in), then sign out
 * and emit [fallback] rather than crash.
 */
fun <T> Flow<T>.recoverFromAuthRaceOrSignOut(fallback: suspend () -> T): Flow<T> =
    retryWhen { cause, attempt ->
        if (isAuthError(cause) && attempt == 0L) {
            delay(AUTH_RACE_RETRY_DELAY_MS)
            true
        } else {
            false
        }
    }.catch { e ->
        if (isAuthError(e)) {
            runCatching { ServiceLocator.authManager.signOut() }
        }
        emit(fallback())
    }
