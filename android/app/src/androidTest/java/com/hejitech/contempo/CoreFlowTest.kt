package com.hejitech.contempo

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import com.google.firebase.Firebase
import com.google.firebase.Timestamp
import com.google.firebase.auth.auth
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.CaptureSource
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
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
 * End-to-end instrumented tests of the real app loop against the Firebase
 * emulator suite (Firestore/Auth) — fake identity sign-in (see
 * AuthManager.kt), no mocks. Requires the emulator suite running and
 * adb-reversed to the device under test (see
 * scripts/run-android-with-emulators.sh); does not start emulators itself.
 *
 * These are correctness checks, not pure UI smoke tests: each asserts real
 * state (Firestore documents, persisted settings) round-tripped through the
 * app's actual repository/ViewModel layer, not just that some text appeared
 * on screen.
 *
 * Runs single-threaded/ordered (@FixMethodOrder) — later tests don't depend
 * on earlier ones' data (each clears Firestore in @Before), but sharing one
 * Activity instance across the class keeps this fast for an MVP with a
 * handful of flows to cover, not a fixture per test.
 */
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
@RunWith(AndroidJUnit4::class)
class CoreFlowTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    // POST_NOTIFICATIONS is declared in the manifest (see FCM setup) and, on
    // a fresh install, Android prompts for it the first time the app process
    // starts — that system dialog steals window focus long enough to break
    // performTextInput on whatever the test does next (performClick still
    // works, since it invokes the semantics action directly rather than
    // injecting a real touch/IME event). GrantPermissionRule (the standard
    // fix) doesn't work on this device: its underlying
    // UiAutomation.grantRuntimePermissionAsUser call throws SecurityException
    // on this OEM's (ColorOS) locked-down permission stack, same restriction
    // hit trying a plain `adb shell pm grant`. Dismissing the dialog directly
    // via UiAutomator — device-level, not tied to that API — works regardless.
    private fun dismissNotificationPermissionDialogIfPresent() {
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        device.wait(Until.findObject(By.textContains("notifications")), 3_000)
        device.findObject(By.text("Allow"))?.click()
    }

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
        dismissNotificationPermissionDialogIfPresent()
    }

    @Test
    fun test1_signInAndCaptureManualEntry_appearsCorrectlyOnDashboard() {
        signIn()
        saveScreenshot("capture")

        // -- Manual entry (skips AI parsing — deterministic, no network dependency) --
        // "Enter manually instead" is demoted behind "Type instead" in the
        // voice/camera-first redesign — see CaptureScreen.kt's kdoc.
        composeTestRule.onNodeWithContentDescription("Type instead").performClick()
        composeTestRule.onNodeWithText("Enter manually instead").performClick()
        composeTestRule.waitUntil(timeoutMillis = 10_000) {
            composeTestRule.onAllNodesWithText("Confirm entry").fetchSemanticsNodes().isNotEmpty()
        }

        composeTestRule.onNodeWithText("Property", substring = true).performTextInput(testProperty)
        composeTestRule.onNodeWithText("What you did", substring = true).performTextInput(testTask)
        composeTestRule.onNodeWithText("Duration (minutes)", substring = true).performTextInput(testDurationMinutes)
        saveScreenshot("confirm_filled")

        composeTestRule.onNodeWithText("Confirm").performClick()

        // -- Verify it landed on the dashboard with the exact data round-tripped --
        // First wait on "Your progress" (the dashboard's own title) rather
        // than the property/task text — those are ambiguous while still
        // mid-navigation, since the Confirm screen's own (still-mounted)
        // input fields already echo back the same "Maple Cottage" text as
        // their EditableText, which would make a wait on testProperty pass
        // immediately without actually confirming navigation happened.
        // ConfirmViewModel's own SAVE_TIMEOUT_MS (10s) plus its
        // disableNetwork/enableNetwork retry path (see resetFirestoreConnection)
        // for a stuck gRPC channel can genuinely take longer than a plain
        // "should be instant" wait — this needs to comfortably exceed that,
        // not paper over a real hang.
        composeTestRule.waitUntil(timeoutMillis = 30_000) {
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
    fun test2_navigateAskAndSettingsTabs_andGenerateExport() {
        signIn()

        // Bottom-nav label is "Ask AI" (see ContempoNavHost's nav_chat
        // string) — deliberately emphasizes the AI feature, not a generic
        // "Ask" chat inbox.
        composeTestRule.onNodeWithText("Ask AI").performClick()
        composeTestRule.waitForIdle()
        saveScreenshot("chat")

        // Export lives inside the Settings tab (there's no separate "Export"
        // bottom-nav destination) — navigate there first, then exercise the
        // actual "Export CSV" button rather than tapping the static "Export"
        // section header, which isn't itself clickable and would silently
        // no-op.
        composeTestRule.onNodeWithText("Settings").performClick()
        composeTestRule.waitForIdle()
        composeTestRule.onNodeWithText("Export CSV").performClick()
        // Each test method cold-starts a fresh Activity (ServiceLocator,
        // on-device model status checks, etc. all reinitialize), which can
        // compete with the CSV generation's own Firestore round-trip for
        // I/O right at this moment — 10s proved marginal in that specific
        // window even though manual reproduction (a long-warm process)
        // completes in ~2s, so this gets a more generous bound.
        composeTestRule.waitUntil(timeoutMillis = 20_000) {
            composeTestRule.onAllNodesWithText("Share").fetchSemanticsNodes().isNotEmpty()
        }
        saveScreenshot("export")
    }

    /** Regression test for QuickCaptureSettingsStore's SharedPreferences persistence — see SettingsViewModel.setQuickCaptureEnabled. */
    @Test
    fun test3_quickCaptureToggle_persistsAcrossActivityRecreate() {
        signIn()

        val toggle = "Quick capture toggle"
        // App-level now (moved off Capture to keep that screen lean — see
        // CaptureScreen's kdoc), so this lives in Settings instead of the
        // default (Capture) tab signIn() lands on.
        composeTestRule.onNodeWithText("Settings").performClick()
        composeTestRule.waitForIdle()

        // Doesn't assume a starting state: SharedPreferences (unlike
        // Firestore, which @Before clears) persist across installs and any
        // other manual testing done on this real device, so a hardcoded
        // assertIsOff() precondition here is a real, previously-hit source
        // of flakiness, not a hypothetical one. Flip once, confirm the flip
        // survived a recreate, then flip back to whatever it started as so
        // this test leaves device state the way it found it.
        val wasOnAtStart = isQuickCaptureToggleOn(toggle)
        composeTestRule.onNodeWithContentDescription(toggle).performClick()
        assertToggleState(toggle, on = !wasOnAtStart)

        composeTestRule.activityRule.scenario.recreate()
        composeTestRule.waitUntil(timeoutMillis = 15_000) {
            composeTestRule.onAllNodesWithText("Tap to speak").fetchSemanticsNodes().isNotEmpty()
        }
        composeTestRule.onNodeWithText("Settings").performClick()
        composeTestRule.waitForIdle()
        assertToggleState(toggle, on = !wasOnAtStart)

        composeTestRule.onNodeWithContentDescription(toggle).performClick()
        assertToggleState(toggle, on = wasOnAtStart)
    }

    private fun isQuickCaptureToggleOn(contentDescription: String): Boolean =
        composeTestRule.onNodeWithContentDescription(contentDescription).fetchSemanticsNode()
            .config.getOrNull(SemanticsProperties.ToggleableState) == ToggleableState.On

    private fun assertToggleState(contentDescription: String, on: Boolean) {
        if (on) composeTestRule.onNodeWithContentDescription(contentDescription).assertIsOn()
        else composeTestRule.onNodeWithContentDescription(contentDescription).assertIsOff()
    }

    /** Regression test for the swipe-to-delete gesture added to the Dashboard this session — a real delete, not just a visual dismiss. */
    @Test
    fun test4_dashboardSwipeToDelete_removesEntryFromFirestore() {
        signIn()

        val swipeTestTask = "Swipe-to-delete regression check"
        composeTestRule.onNodeWithContentDescription("Type instead").performClick()
        composeTestRule.onNodeWithText("Enter manually instead").performClick()
        composeTestRule.waitUntil(timeoutMillis = 10_000) {
            composeTestRule.onAllNodesWithText("Confirm entry").fetchSemanticsNodes().isNotEmpty()
        }
        composeTestRule.onNodeWithText("Property", substring = true).performTextInput("Swipe Test Property")
        composeTestRule.onNodeWithText("What you did", substring = true).performTextInput(swipeTestTask)
        composeTestRule.onNodeWithText("Duration (minutes)", substring = true).performTextInput("15")
        composeTestRule.onNodeWithText("Confirm").performClick()

        // See test1's identical wait for why this needs real headroom
        // beyond ConfirmViewModel's own SAVE_TIMEOUT_MS + retry path.
        composeTestRule.waitUntil(timeoutMillis = 30_000) {
            composeTestRule.onAllNodesWithText(swipeTestTask).fetchSemanticsNodes().isNotEmpty()
        }

        composeTestRule.onNodeWithTag("entry_row").performTouchInput { swipeLeft() }

        composeTestRule.waitUntil(timeoutMillis = 10_000) {
            composeTestRule.onAllNodesWithText(swipeTestTask).fetchSemanticsNodes().isEmpty()
        }
        composeTestRule.onNodeWithText("No entries yet. Capture your first one to get started.").assertExists()
    }

    /**
     * Regression test for the "ongoing work" indicator's dedicated Complete
     * button (see CaptureScreen.kt's OngoingWorkBanner — completing used to
     * require tapping the whole card, which had no visible affordance and
     * was reported confusing; now it's a full-width, labeled Pause/Complete/
     * Cancel button row, easier to tap accurately than the original bare
     * IconButtons — see OngoingActionButtonRow's kdoc), including the
     * completion time/location it still records the same way.
     */
    @Test
    fun test5_ongoingWorkBanner_completeButton_closesTimerEntryWithStopLocation() {
        signIn()

        val entryId = runBlocking {
            ServiceLocator.timerEntryCoordinator.handleStart(
                property = "Ongoing Work Property",
                task = "Ongoing work task",
                category = null,
                source = CaptureSource.VOICE,
                startedAt = Timestamp.now(),
            ).entryId
        }

        composeTestRule.waitUntil(timeoutMillis = 10_000) {
            composeTestRule.onAllNodesWithText("Complete").fetchSemanticsNodes().isNotEmpty()
        }
        composeTestRule.onNodeWithText("In progress — Ongoing Work Property").assertExists()

        composeTestRule.onNodeWithText("Complete").performClick()

        // The Complete/Pause/Cancel buttons give way to a "tap to add
        // details" completed state as soon as isCompleted flips true (see
        // OngoingWorkBanner) — well before the few-second grace period the
        // whole banner then lingers for, so this is a fast, reliable signal
        // that the tap actually closed the entry.
        composeTestRule.waitUntil(timeoutMillis = 10_000) {
            composeTestRule.onAllNodesWithText("Complete").fetchSemanticsNodes().isEmpty()
        }

        val closed = runBlocking { ServiceLocator.entryRepository.getEntry(entryId) }
        assertNotNull(closed)
        assertFalse("timer entry should no longer be in progress after tapping Complete", closed!!.inProgress)
        assertNotNull("stoppedAt should be recorded by Complete", closed.stoppedAt)
    }

    /**
     * Retries because of a real, reproducible race just found live: a
     * brand-new fake-identity sign-in's very first Firestore listener attach
     * (CaptureViewModel's openTripEntry/openTimerEntry) can transiently get
     * PERMISSION_DENIED before the emulator-issued token has fully
     * propagated — which triggers this app's own defensive
     * auto-sign-out-on-PERMISSION_DENIED (see DashboardViewModel/
     * CaptureViewModel's .catch blocks, added earlier for genuinely stale
     * sessions), bouncing straight back to the sign-in screen. Confirmed via
     * logcat (`Listen for Query(...) failed: Status{code=PERMISSION_DENIED`)
     * on a completely fresh emulator restart, so it isn't stale-session
     * leftovers — just re-clicking sign-in reliably recovers.
     */
    private fun signIn() {
        repeat(3) {
            if (composeTestRule.onAllNodesWithText("Sign in with Google").fetchSemanticsNodes().isNotEmpty()) {
                composeTestRule.onNodeWithText("Sign in with Google").performClick()
            }
            if (waitUntilOrFalse(timeoutMillis = 15_000) {
                    composeTestRule.onAllNodesWithText("Tap to speak").fetchSemanticsNodes().isNotEmpty()
                }
            ) return
        }
        error("Sign-in never reached the Capture screen after retries")
    }

    private fun waitUntilOrFalse(timeoutMillis: Long, condition: () -> Boolean): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMillis
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return true
            Thread.sleep(200)
        }
        return condition()
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
