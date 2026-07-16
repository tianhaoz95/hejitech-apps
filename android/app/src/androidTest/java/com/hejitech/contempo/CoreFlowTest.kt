package com.hejitech.contempo

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

/**
 * End-to-end instrumented test of the real MVP loop: sign in (fake identity,
 * via the emulator path — see AuthManager.kt) -> capture a manual entry ->
 * confirm it -> land on the dashboard and see it reflected correctly.
 *
 * Requires the Firebase emulator suite running and `adb reverse`'d to the
 * device under test (see scripts/run-android-with-emulators.sh) — this test
 * does not start emulators itself, same assumption the app's own
 * BuildConfig.USE_FIREBASE_EMULATOR debug path already makes.
 *
 * This is a correctness check, not a UI smoke test: it asserts the entry
 * that comes back out of Firestore (property name, task text, duration)
 * matches exactly what was typed in, round-tripped through the real
 * Firestore emulator and the app's actual repository/ViewModel layer.
 *
 * Runs single-threaded/ordered (@FixMethodOrder) because later tests in this
 * class depend on the entry created earlier — not worth a fixture per test
 * for an MVP with one real flow to cover.
 */
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
@RunWith(AndroidJUnit4::class)
class CoreFlowTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    private val testProperty = "Maple Cottage"
    private val testTask = "Cleaned the pool and replaced the filter"
    private val testDurationMinutes = "45"

    // Reset happens only in @Before, not @After: signing out right after a
    // test finishes races the Dashboard's Firestore listener, which
    // SharingStarted.WhileSubscribed(5000) keeps alive briefly past the last
    // subscriber — an immediate sign-out mid-teardown throws an uncaught
    // PERMISSION_DENIED on a background thread that kills the whole run.
    // JUnit already guarantees the previous test's Activity (and therefore
    // its ViewModels/listeners) are fully torn down before the next test's
    // @Before runs, so resetting only here is both sufficient and safe.
    @Before
    fun resetState() {
        Firebase.auth.signOut()
        clearFirestoreEmulatorData()
    }

    @Test
    fun test1_signInAndCaptureManualEntry_appearsCorrectlyOnDashboard() {
        // -- Sign in (emulator fake-identity path, no real Google UI) --
        composeTestRule.onNodeWithText("Sign in with Google").performClick()
        composeTestRule.waitUntil(timeoutMillis = 15_000) {
            composeTestRule.onAllNodesWithText("Tap to speak").fetchSemanticsNodes().isNotEmpty()
        }
        saveScreenshot("capture")

        // -- Manual entry (skips AI parsing — deterministic, no network dependency) --
        // "Enter manually instead" is demoted behind "Type instead" in the
        // voice/camera-first redesign — see CaptureScreen.kt's kdoc.
        composeTestRule.onNodeWithText("Type instead").performClick()
        composeTestRule.onNodeWithText("Enter manually instead").performClick()
        composeTestRule.waitUntil(timeoutMillis = 10_000) {
            composeTestRule.onAllNodesWithText("Confirm entry").fetchSemanticsNodes().isNotEmpty()
        }

        composeTestRule.onNodeWithText("Property").performTextInput(testProperty)
        composeTestRule.onNodeWithText("What you did").performTextInput(testTask)
        composeTestRule.onNodeWithText("Duration (minutes)").performTextInput(testDurationMinutes)
        saveScreenshot("confirm_filled")

        composeTestRule.onNodeWithText("Confirm").performClick()

        // -- Verify it landed on the dashboard with the exact data round-tripped --
        // First wait on "Your progress" (the dashboard's own title) rather
        // than the property/task text — those are ambiguous while still
        // mid-navigation, since the Confirm screen's own (still-mounted)
        // input fields already echo back the same "Maple Cottage" text as
        // their EditableText, which would make a wait on testProperty pass
        // immediately without actually confirming navigation happened.
        composeTestRule.waitUntil(timeoutMillis = 15_000) {
            composeTestRule.onAllNodesWithText("Your progress").fetchSemanticsNodes().isNotEmpty()
        }
        // Now that we're confirmed on the Dashboard, separately wait for the
        // entry itself: the Dashboard shell (incl. "Your progress") renders
        // immediately on navigation, independent of whether the Firestore
        // listener has delivered the just-confirmed write yet — asserting
        // testProperty without this second wait is a real race, not a
        // hypothetical one (write commit + listener round-trip can outlast
        // the navigation transition).
        composeTestRule.waitUntil(timeoutMillis = 10_000) {
            composeTestRule.onAllNodesWithText(testProperty).fetchSemanticsNodes().isNotEmpty()
        }
        composeTestRule.onNodeWithText(testProperty).assertExists()
        composeTestRule.onNodeWithText(testTask).assertExists()
        composeTestRule.onNodeWithText("${testDurationMinutes}m").assertExists()
        saveScreenshot("dashboard")
    }

    @Test
    fun test2_navigateRemainingTabs_forScreenshots() {
        composeTestRule.onNodeWithText("Sign in with Google").performClick()
        composeTestRule.waitUntil(timeoutMillis = 15_000) {
            composeTestRule.onAllNodesWithText("Tap to speak").fetchSemanticsNodes().isNotEmpty()
        }

        composeTestRule.onNodeWithText("Ask").performClick()
        composeTestRule.waitForIdle()
        saveScreenshot("chat")

        composeTestRule.onNodeWithText("Export").performClick()
        composeTestRule.waitForIdle()
        saveScreenshot("export")
    }

    private fun saveScreenshot(name: String) {
        val bitmap = composeTestRule.onRoot().captureToImage().asAndroidBitmap()
        val dir = InstrumentationRegistry.getInstrumentation().targetContext
            .getExternalFilesDir("screenshots")!!
        dir.mkdirs()
        FileOutputStream(File(dir, "$name.png")).use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        }
    }

    /** Best-effort — a failed clear (e.g. fresh/empty emulator) shouldn't fail the test. */
    private fun clearFirestoreEmulatorData() {
        runCatching {
            val url = URL(
                "http://localhost:8080/emulator/v1/projects/contempo-platform/databases/(default)/documents"
            )
            (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "DELETE"
                connectTimeout = 5_000
                connect()
                responseCode
                disconnect()
            }
        }
    }
}
