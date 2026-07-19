package com.hejitech.contempo.data

import com.google.firebase.crashlytics.crashlytics
import com.google.firebase.Firebase
import com.google.firebase.firestore.FirebaseFirestoreException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.retryWhen

private const val AUTH_RACE_RETRY_DELAY_MS = 1_000L

private fun isAuthError(cause: Throwable): Boolean =
    cause is FirebaseFirestoreException &&
        (cause.code == FirebaseFirestoreException.Code.PERMISSION_DENIED ||
            cause.code == FirebaseFirestoreException.Code.UNAUTHENTICATED)

/**
 * Every eagerly-collected Firestore listener in the app (CaptureViewModel's
 * openTripEntry/openTimerEntry, DashboardViewModel's entriesState,
 * ConfirmViewModel's properties listener) needs to survive a
 * PERMISSION_DENIED/UNAUTHENTICATED without crashing the screen — originally
 * handled by signing out immediately, on the assumption that only a
 * genuinely stale/invalid session could produce that error.
 *
 * That assumption turned out to be wrong: a brand-new sign-in's very first
 * listener attach can transiently get PERMISSION_DENIED before the
 * just-issued token has fully propagated (confirmed live, see
 * CoreFlowTest.kt's signIn() kdoc) — a real production race, not just an
 * emulator quirk, since it's about token propagation timing, not anything
 * emulator-specific. Signing a real user out on that transient blip is a
 * worse experience than a one-second pause, so this retries once after a
 * short delay (giving the token time to catch up and the listener a chance
 * to resubscribe with it) before falling back to the original
 * sign-out-and-emit-[fallback] behavior for anything that still fails after
 * the retry — that second failure is what actually indicates a genuinely
 * stale/invalid session.
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
            // Reaching here means the one retry above already happened and
            // still failed — the interesting case to have visibility into,
            // since it's what actually forces a real user back to sign-in.
            // A non-fatal (not recordException-as-fatal) since the app
            // itself recovers cleanly; this is purely for knowing how often
            // it happens in the field. runCatching here is deliberate: this
            // whole block runs inside Flow's catch{} operator, which has no
            // catch of its own — an exception escaping *this* body (e.g. a
            // Crashlytics/Auth SDK call failing) would propagate uncaught
            // instead of being recoverable, defeating the entire point of
            // this function.
            runCatching { Firebase.crashlytics.recordException(e) }
            runCatching { ServiceLocator.authManager.signOut() }
        }
        emit(fallback())
    }
