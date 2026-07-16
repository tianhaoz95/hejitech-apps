package com.hejitech.contempo

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

private const val READY_TEXT = "On-device model ready."
private const val UNAVAILABLE_TEXT = "Not supported on this device — cloud will be used instead."
private const val CHECKING_TEXT = "Checking on-device model…"
private const val UNAVAILABLE_INLINE_TEXT = "On-device model isn't supported on this device. Switch to Cloud in Settings."

/**
 * Verifies ON_DEVICE_ONLY end to end against whatever this test device's
 * real hardware/storage actually supports for the active OnDeviceLlm
 * implementation (LiteRtLlm as of this writing — see OnDeviceLlm's kdoc).
 * Two honest outcomes, both asserted:
 *
 *  - If the on-device model genuinely becomes ready on this device, this
 *    proves a real on-device AI response works with ON_DEVICE_ONLY selected
 *    — not a mocked or cloud-fallback response, an actual local inference.
 *  - If the hardware doesn't support on-device inference at all (a real,
 *    expected outcome on non-flagship devices), this proves the app
 *    correctly detects that via the real status API and blocks the AI
 *    action with guidance instead of silently failing, hanging, or letting
 *    the user submit into a guaranteed error.
 *
 * A test that only handled the first case would be untestable on most real
 * devices; a test that only handled the second would never actually verify
 * on-device inference works when it can. Asserting whichever is genuinely
 * true is the honest verification given hardware support isn't something
 * this test controls.
 */
@RunWith(AndroidJUnit4::class)
class OnDeviceModelStatusTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun resetState() {
        Firebase.auth.signOut()
    }

    @Test
    fun onDeviceOnlyMode_realOnDeviceResponseOrCorrectlyBlockedWithGuidance() {
        composeTestRule.onNodeWithText("Sign in with Google").performClick()
        composeTestRule.waitUntil(timeoutMillis = 15_000) {
            composeTestRule.onAllNodesWithText("Tap to speak").fetchSemanticsNodes().isNotEmpty()
        }

        // -- Switch to On-device only via the real Settings UI, not by poking AiSettingsStore directly. --
        composeTestRule.onNodeWithContentDescription("Settings").performClick()
        composeTestRule.waitUntil(timeoutMillis = 10_000) {
            composeTestRule.onAllNodesWithText("On-device only").fetchSemanticsNodes().isNotEmpty()
        }
        composeTestRule.onNodeWithText("On-device only").performClick()

        // -- Wait for the monitor to resolve out of "Checking" (status check is near-instant; a real download is not). --
        composeTestRule.waitUntil(timeoutMillis = 20_000) {
            composeTestRule.onAllNodesWithText(CHECKING_TEXT).fetchSemanticsNodes().isEmpty()
        }
        var ready = composeTestRule.onAllNodesWithText(READY_TEXT).fetchSemanticsNodes().isNotEmpty()
        var unavailable = composeTestRule.onAllNodesWithText(UNAVAILABLE_TEXT).fetchSemanticsNodes().isNotEmpty()

        if (!ready && !unavailable) {
            // Must be downloading (or a transient Failed state) — give a real
            // download a genuinely generous window rather than assuming it's
            // fast; this is the actual "does it eventually become usable"
            // check, not just a status-check smoke test.
            composeTestRule.waitUntil(timeoutMillis = 180_000) {
                composeTestRule.onAllNodesWithText(READY_TEXT).fetchSemanticsNodes().isNotEmpty() ||
                    composeTestRule.onAllNodesWithText(UNAVAILABLE_TEXT).fetchSemanticsNodes().isNotEmpty()
            }
            ready = composeTestRule.onAllNodesWithText(READY_TEXT).fetchSemanticsNodes().isNotEmpty()
            unavailable = composeTestRule.onAllNodesWithText(UNAVAILABLE_TEXT).fetchSemanticsNodes().isNotEmpty()
        }

        check(ready || unavailable) {
            "On-device model status never resolved to Ready or Unavailable within the timeout " +
                "(stuck Checking/Downloading/Failed) — that's a real bug, not a hardware limitation."
        }

        composeTestRule.onNodeWithContentDescription("Back").performClick()

        composeTestRule.waitUntil(timeoutMillis = 10_000) {
            composeTestRule.onAllNodesWithText("Tap to speak").fetchSemanticsNodes().isNotEmpty()
        }

        // Typing is demoted behind "Type instead" in the voice/camera-first
        // redesign — see CaptureScreen.kt's kdoc — so the field must be
        // expanded before it can be found/typed into.
        composeTestRule.onNodeWithText("Type instead").performClick()
        val captureField = hasText("Say or type what you did…") and hasSetTextAction()

        if (ready) {
            // Real hardware support: prove ON_DEVICE_ONLY produces an actual
            // successful on-device response, not just that the UI is enabled.
            // performScrollTo() first: the capture screen's own content is
            // now tall enough (big voice button) that once the keyboard is
            // up, the Send row can be scrolled out of the viewport — see
            // CaptureScreen.kt's verticalScroll — and performClick() doesn't
            // auto-scroll a node into view before dispatching.
            composeTestRule.onNode(captureField).performScrollTo().performTextInput("Cleaned the pool for 20 minutes")
            composeTestRule.onNodeWithText("Send").performScrollTo().performClick()
            // A cold Engine load (first generate() call since process start —
            // see LiteRtLlm.ensureEngine) has to mmap/load the full ~2.6GB
            // model off flash before it can run inference at all; 30s proved
            // too tight once the model file's page cache goes cold, so this
            // gets the same "genuinely generous window" treatment as the
            // download-progress wait above rather than a tighter bound that
            // just papers over real device variance.
            composeTestRule.waitUntil(timeoutMillis = 90_000) {
                composeTestRule.onAllNodesWithText("Confirm entry").fetchSemanticsNodes().isNotEmpty() ||
                    composeTestRule.onAllNodesWithText(UNAVAILABLE_INLINE_TEXT).fetchSemanticsNodes().isNotEmpty()
            }
            check(composeTestRule.onAllNodesWithText(UNAVAILABLE_INLINE_TEXT).fetchSemanticsNodes().isEmpty()) {
                "Settings reported the on-device model Ready, but Capture still blocked the send action " +
                    "as unavailable — the two status reads disagree."
            }
            composeTestRule.onNodeWithText("Confirm entry").assertExists()
        } else {
            // No on-device support on this hardware: the AI action must be
            // visibly and correctly blocked, not silently broken.
            composeTestRule.onNodeWithText(UNAVAILABLE_INLINE_TEXT).assertExists()
            composeTestRule.onNode(captureField).performScrollTo().performTextInput("Cleaned the pool")
            composeTestRule.onNodeWithText("Send").assertIsNotEnabled()
        }
    }
}
