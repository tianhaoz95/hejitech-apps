package com.hejitech.contempo

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hejitech.contempo.agent.EntryDraft
import com.hejitech.contempo.agent.OnDeviceModelUiStatus
import com.hejitech.contempo.agent.ParseOutcome
import com.hejitech.contempo.data.ServiceLocator
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import org.junit.Test
import org.junit.runner.RunWith
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * End-to-end verification of the on-device tool-calling entry-extraction
 * pipeline (AgentClient.parseEntry -> LiteRtLlm.extractEntryDraft -> the
 * real Gemma 4 E2B model via LiteRT-LM's tool-calling — see EntryTools.kt)
 * against a real device, not a mock. Calls ServiceLocator.agentClient
 * directly rather than driving Capture's UI — same "bypass the UI, test the
 * real pipeline" precedent as PhotoCaptureTest, and it sidesteps any drift
 * between this test and Capture's actual current layout. Neither test here
 * touches Firestore/Auth (knownProperties is passed in directly), so unlike
 * PhotoCaptureTest's attachPhoto test there's no emulator setup needed.
 *
 * Assertions are intentionally loose on anything the model itself decides —
 * real on-device tool-call choices are not deterministic between runs (e.g.
 * exactly how many hours "a while ago" resolves to). What this actually
 * proves: the tool loop terminates with a real record_entry call (not a
 * crash, not a timeout, not a silently-swallowed exception), duration
 * extraction works, and resolved_activity_date_iso is populated if and only
 * if the utterance actually referenced a time — the two things this
 * pipeline is specifically responsible for getting right regardless of the
 * model's own reasoning quality.
 *
 * Same "two honest outcomes" shape as OnDeviceModelStatusTest: on-device
 * support isn't something this test controls, so a device that can't run
 * the model at all is a skip, not a failure.
 */
@RunWith(AndroidJUnit4::class)
class EntryToolCallingTest {

    @Test
    fun onDeviceOnly_relativeTimeUtterance_producesResolvedTimestampInThePast() {
        val draft = onDeviceParseOrNull("I worked for 30 minutes 4 hours ago") ?: return

        check(draft.durationMinutes == 30) { "Expected durationMinutes=30, got ${draft.durationMinutes}" }
        val resolvedIso = checkNotNull(draft.resolvedActivityDateIso) {
            "Utterance clearly referenced a relative time (\"4 hours ago\") but resolvedActivityDateIso was null"
        }
        val resolvedInstant = Instant.parse(resolvedIso)
        check(resolvedInstant.isBefore(Instant.now())) {
            "Resolved time $resolvedInstant should be in the past, not the future"
        }
    }

    @Test
    fun onDeviceOnly_noTimeReference_leavesResolvedTimestampUnsetOrCloseToNow() {
        val draft = onDeviceParseOrNull("cleaned unit 4 for an hour") ?: return

        check(draft.durationMinutes == 60) { "Expected durationMinutes=60, got ${draft.durationMinutes}" }
        // The model may still (wastefully) query get_current_time for an
        // utterance with no real time reference — observed live during
        // development — but the final record_entry call must not end up
        // attaching a resolved value that's meaningfully far from now.
        draft.resolvedActivityDateIso?.let { iso ->
            val resolvedInstant = Instant.parse(iso)
            check(resolvedInstant.isAfter(Instant.now().minus(5, ChronoUnit.MINUTES))) {
                "No time reference was mentioned, but resolvedActivityDateIso ($resolvedInstant) is far from now"
            }
        }
    }

    /**
     * Returns the draft parsed by the large (opt-in, downloaded) model, or null
     * if it isn't downloaded or this device's hardware/storage genuinely can't
     * run it — matching
     * OnDeviceModelStatusTest's precedent of asserting whichever outcome is
     * honestly true rather than failing on something hardware support isn't
     * in control of. A real failure once the model is confirmed ready (a
     * ParseOutcome.Failure, an exception, or a hang) is NOT swallowed here.
     */
    private fun onDeviceParseOrNull(rawText: String): EntryDraft? = runBlocking {
        // 300s, not 180s: observed live that a cold Engine load (mmap + XNNPack
        // weight-cache rebuild for a ~2.6GB model) can take meaningfully longer
        // than 180s under real device load/thermal variance — same "genuinely
        // generous window, not a tighter bound that papers over device variance"
        // reasoning as OnDeviceModelStatusTest's own download/inference waits.
        val status = withTimeoutOrNull(300_000) {
            ServiceLocator.onDeviceLlm.status.first {
                it is OnDeviceModelUiStatus.Available ||
                    it is OnDeviceModelUiStatus.NotDownloaded ||
                    it is OnDeviceModelUiStatus.Unavailable ||
                    it is OnDeviceModelUiStatus.Failed
            }
        }
        checkNotNull(status) {
            "On-device model status never resolved to Available/NotDownloaded/Unavailable/Failed within the timeout " +
                "(stuck Checking/Downloading) — that's a real bug, not a hardware limitation."
        }
        if (status !is OnDeviceModelUiStatus.Available) return@runBlocking null

        // Generous timeout: a cold Engine load (first inference since process
        // start — see LiteRtLlm.ensureEngine) plus a multi-turn tool loop
        // (get_current_time -> compute_time_before/after -> record_entry)
        // can genuinely take a while on real hardware — same reasoning as
        // OnDeviceModelStatusTest's 90s inference window, with extra slack
        // for the additional tool-call round trips this path adds.
        val outcome = withTimeout(120_000) {
            ServiceLocator.agentClient.parseEntry(rawText, knownProperties = emptyList())
        }
        when (outcome) {
            is ParseOutcome.Success -> outcome.result.draft
            is ParseOutcome.Failure -> error(
                "parseEntry failed even though the model reported Available: ${outcome.message}"
            )
        }
    }
}
