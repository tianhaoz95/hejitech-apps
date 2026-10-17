package com.hejitech.wear.capture

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.wear.compose.material.MaterialTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Compose UI tests for the two stateless Wear screens (WearSignInScreen,
 * WearCaptureScreen) in isolation — fixed WearUiState snapshots rendered
 * directly (no Activity, no ViewModel, no Firebase), verifying what each
 * state actually shows and that the click callbacks it exposes fire.
 * WearCaptureViewModelTest and MainActivityFlowTest cover the real
 * state-producing logic and full integration respectively; this suite is
 * the fast, deterministic layer in between — every branch in
 * WearCaptureScreen.kt's `when`/conditionals gets its own case here.
 */
@RunWith(AndroidJUnit4::class)
class WearCaptureScreenUiTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    // -- WearSignInScreen --

    @Test
    fun signInScreen_idle_showsSignInChip_andInvokesCallbackOnTap() {
        var tapped = false
        composeTestRule.setContent {
            MaterialTheme {
                WearSignInScreen(isSigningIn = false, errorMessage = null, onSignIn = { tapped = true })
            }
        }

        composeTestRule.onNodeWithText("Sign in").performClick()
        assertEquals(true, tapped)
    }

    @Test
    fun signInScreen_signingIn_hidesSignInLabel() {
        composeTestRule.setContent {
            MaterialTheme {
                WearSignInScreen(isSigningIn = true, errorMessage = null, onSignIn = {})
            }
        }

        assertTrue(composeTestRule.onAllNodesWithText("Sign in").fetchSemanticsNodes().isEmpty())
    }

    @Test
    fun signInScreen_withError_showsErrorMessage() {
        composeTestRule.setContent {
            MaterialTheme {
                WearSignInScreen(isSigningIn = false, errorMessage = "Sign-in failed — try again.", onSignIn = {})
            }
        }

        composeTestRule.onNodeWithText("Sign-in failed — try again.").assertExists()
    }

    // -- WearCaptureScreen --

    private fun idleState() = WearUiState(confirmedHours = 42.0)

    @Test
    fun captureScreen_idle_showsTapToSpeakAndHoursProgress_noUploadChip() {
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(idleState(), amplitude = 0f, onMicTap = {}, onUploadPendingNow = {}, onDismissMessages = {})
            }
        }

        composeTestRule.onNodeWithText("Tap to speak").assertExists()
        composeTestRule.onNodeWithText("42 / 100 hrs").assertExists()
        assertTrue(composeTestRule.onAllNodesWithText("Upload now").fetchSemanticsNodes().isEmpty())
    }

    @Test
    fun captureScreen_recording_showsListeningAndInvokesMicTapCallback() {
        var micTapped = false
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(
                    idleState().copy(isRecording = true),
                    amplitude = 0.5f,
                    onMicTap = { micTapped = true },
                    onUploadPendingNow = {},
                    onDismissMessages = {},
                )
            }
        }

        composeTestRule.onNodeWithText("Listening…").assertExists()
        assertTrue(composeTestRule.onAllNodesWithText("Tap to speak").fetchSemanticsNodes().isEmpty())
        // While recording, VolumeBars (no contentDescription) replaces the
        // Mic icon that normally carries "Tap to speak" — testTag targets
        // the button regardless of which child it's currently showing.
        composeTestRule.onNodeWithTag("mic_button").performClick()
        assertEquals(true, micTapped)
    }

    @Test
    fun captureScreen_idle_micTap_invokesCallback() {
        var micTapped = false
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(idleState(), amplitude = 0f, onMicTap = { micTapped = true }, onUploadPendingNow = {}, onDismissMessages = {})
            }
        }

        composeTestRule.onNodeWithTag("mic_button").performClick()
        assertEquals(true, micTapped)
    }

    @Test
    fun captureScreen_lastSavedSummary_takesPriorityOverIdleMessage() {
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(
                    idleState().copy(lastSavedSummary = "Saved — uploading shortly"),
                    amplitude = 0f,
                    onMicTap = {},
                    onUploadPendingNow = {},
                    onDismissMessages = {},
                )
            }
        }

        composeTestRule.onNodeWithText("Saved — uploading shortly").assertExists()
        assertTrue(composeTestRule.onAllNodesWithText("Tap to speak").fetchSemanticsNodes().isEmpty())
    }

    @Test
    fun captureScreen_errorMessage_shownWhenNoSummaryPresent() {
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(
                    idleState().copy(errorMessage = "3 still pending — check connection"),
                    amplitude = 0f,
                    onMicTap = {},
                    onUploadPendingNow = {},
                    onDismissMessages = {},
                )
            }
        }

        composeTestRule.onNodeWithText("3 still pending — check connection").assertExists()
    }

    @Test
    fun captureScreen_pendingAndUploadedCounts_showStatsLine() {
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(
                    idleState().copy(pendingCount = 2, uploadedTodayCount = 5),
                    amplitude = 0f,
                    onMicTap = {},
                    onUploadPendingNow = {},
                    onDismissMessages = {},
                )
            }
        }

        composeTestRule.onNodeWithText("2 pending · 5 today").assertExists()
    }

    @Test
    fun captureScreen_pendingCountPositive_showsUploadChip_andInvokesCallbackOnTap() {
        var uploadTapped = false
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(
                    idleState().copy(pendingCount = 1),
                    amplitude = 0f,
                    onMicTap = {},
                    onUploadPendingNow = { uploadTapped = true },
                    onDismissMessages = {},
                )
            }
        }

        composeTestRule.onNodeWithText("Upload now").performClick()
        assertEquals(true, uploadTapped)
    }

    @Test
    fun captureScreen_uploadingPending_hidesUploadNowLabel() {
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(
                    idleState().copy(pendingCount = 1, isUploadingPending = true),
                    amplitude = 0f,
                    onMicTap = {},
                    onUploadPendingNow = {},
                    onDismissMessages = {},
                )
            }
        }

        assertTrue(composeTestRule.onAllNodesWithText("Upload now").fetchSemanticsNodes().isEmpty())
    }

    @Test
    fun captureScreen_pendingWhileRecording_hidesUploadChip() {
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(
                    idleState().copy(pendingCount = 1, isRecording = true),
                    amplitude = 0f,
                    onMicTap = {},
                    onUploadPendingNow = {},
                    onDismissMessages = {},
                )
            }
        }

        assertTrue(composeTestRule.onAllNodesWithText("Upload now").fetchSemanticsNodes().isEmpty())
    }

    /** Regression test for the transient-message auto-clear (see WearCaptureScreen.kt's LaunchedEffect kdoc). */
    @Test
    fun captureScreen_transientSummary_selfClearsAfterFourSeconds() {
        var dismissed = false
        composeTestRule.setContent {
            MaterialTheme {
                WearCaptureScreen(
                    idleState().copy(lastSavedSummary = "Saved — uploading shortly"),
                    amplitude = 0f,
                    onMicTap = {},
                    onUploadPendingNow = {},
                    onDismissMessages = { dismissed = true },
                )
            }
        }

        composeTestRule.waitUntil(timeoutMillis = 10_000) { dismissed }
    }
}
