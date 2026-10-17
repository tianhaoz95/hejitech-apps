package com.hejitech.contempo

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hejitech.contempo.data.ServiceLocator
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Runs the bundled on-device model (Qwen3-0.6B via LiteRT-LM) for real, on a physical device —
 * the Android twin of iOS's BundledModelTests. A Gradle-installed test APK has no Play asset
 * packs, so the model is copied in first (`files/models/Qwen3-0.6B.litertlm`, e.g. with
 * `adb shell run-as`); without it the tests are skipped.
 */
@RunWith(AndroidJUnit4::class)
class BundledModelTest {

    private fun requireBundledModel() = runBlocking {
        val ready = withTimeoutOrNull(60_000) { ServiceLocator.onDeviceLlm.bundledModelReady.first { it } } ?: false
        assumeTrue("no bundled model on this install", ready)
    }

    @Test
    fun bundledModelParsesASpokenEntry() {
        requireBundledModel()
        val draft = runBlocking {
            withTimeout(120_000) {
                ServiceLocator.onDeviceLlm.extractEntryDraft(
                    "uh spent like two hours fixing the dishwasher at the lake house this morning",
                    listOf("Lake House", "Downtown Loft"),
                )
            }
        }
        checkNotNull(draft) { "the bundled model returned no draft" }
        println("bundled draft: $draft")
        check(draft.durationMinutes == 120) { "durationMinutes=${draft.durationMinutes}" }
        check(draft.property == "Lake House") { "property=${draft.property}" }
        check((draft.task ?: "").contains("dishwasher", ignoreCase = true)) { "task=${draft.task}" }
        check(draft.eventType == null) { "no timer phrasing, got eventType=${draft.eventType}" }
        check(draft.miles == null) { "no distance mentioned, got miles=${draft.miles}" }
    }

    @Test
    fun bundledModelAnswersAQuestion() {
        requireBundledModel()
        val answer = runBlocking {
            withTimeout(120_000) {
                ServiceLocator.onDeviceLlm.generateText("In one sentence: what does the IRS 100-hour test for short-term rentals measure?")
            }
        }
        checkNotNull(answer)
        println("bundled answer: $answer")
        check("<think>" !in answer) { "thinking leaked: $answer" }
        check(answer.length > 10) { "answer too short: $answer" }
    }
}
