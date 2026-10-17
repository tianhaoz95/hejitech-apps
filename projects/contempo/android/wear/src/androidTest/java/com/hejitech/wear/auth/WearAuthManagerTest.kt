package com.hejitech.wear.auth

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for WearAuthManager's emulator sign-in path (the only
 * path exercisable without a real Google account on the test device — see
 * its kdoc for the real-Credential-Manager path). Runs against the real
 * Firebase Auth emulator, already connected via WearApp.onCreate at process
 * startup (debug builds set USE_FIREBASE_EMULATOR = true) — same assumption
 * every other emulator-backed test in this repo makes. Requires the Firebase
 * emulator suite running and adb-reversed to the device under test.
 */
@RunWith(AndroidJUnit4::class)
class WearAuthManagerTest {

    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val authManager = WearAuthManager(context)

    @Before
    fun signOut() {
        Firebase.auth.signOut()
    }

    @Test
    fun signIn_withEmulatorFakeIdentity_populatesExpectedUser() = runBlocking {
        val result = authManager.signIn()

        assertTrue(result.isSuccess)
        val user = Firebase.auth.currentUser
        // Not a literal "emulator-pilot-user" — confirmed live, the Auth
        // emulator mints its own internal (but stable, see the
        // calledTwice test below) uid for a federated identity's "sub"
        // claim rather than using that claim as the Firebase uid directly.
        assertFalse(user?.uid.isNullOrBlank())
        assertEquals("pilot@example.test", user?.email)
    }

    @Test
    fun signIn_calledTwice_bothSucceedAndLandOnSameUser() = runBlocking {
        authManager.signIn()
        val firstUid = Firebase.auth.currentUser?.uid

        Firebase.auth.signOut()
        authManager.signIn()
        val secondUid = Firebase.auth.currentUser?.uid

        assertEquals(firstUid, secondUid)
    }

    @Test
    fun signOut_clearsCurrentUser() = runBlocking {
        authManager.signIn()
        assertTrue(Firebase.auth.currentUser != null)

        authManager.signOut()

        assertNull(Firebase.auth.currentUser)
    }
}
