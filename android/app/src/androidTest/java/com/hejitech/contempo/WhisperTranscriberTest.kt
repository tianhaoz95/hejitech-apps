package com.hejitech.contempo

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.hejitech.contempo.agent.WhisperTranscriber
import com.hejitech.core.model.CaptureLanguage
import com.k2fsa.sherpa.onnx.WaveReader
import kotlinx.coroutines.runBlocking
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Verifies the vendored sherpa-onnx + bundled Whisper models actually
 * produce a correct transcript on real device hardware — not just that the
 * native library loads without crashing. Uses one of sherpa-onnx's own test
 * WAV files (see android/whisper-vendor/ at the repo root for provenance —
 * not shipped in the app) with a known ground-truth transcript, so this is a
 * real correctness check against a known-good expected output, not a smoke
 * test. This is an English clip, exercised against both the ENGLISH
 * (dedicated tiny.en) and AUTO (multilingual, auto-detect) paths — see
 * WhisperTranscriber's kdoc for why those are two separate on-device models.
 * No Firebase/sign-in needed — this only exercises the transcription
 * pipeline, independent of the rest of the app.
 */
@RunWith(AndroidJUnit4::class)
class WhisperTranscriberTest {

    // Ground truth (sherpa-onnx's own test_wavs/trans.txt): "AFTER EARLY
    // NIGHTFALL THE YELLOW LAMPS WOULD LIGHT UP HERE AND THERE THE SQUALID
    // QUARTER OF THE BROTHELS". Checking distinctive content words rather
    // than an exact match — Whisper's punctuation/casing legitimately varies
    // run to run, the words shouldn't.
    private val expectedWords = listOf("nightfall", "yellow", "lamps", "squalid", "brothels")

    @Test
    fun transcribe_english_knownTestClip_producesExpectedWords() = assertKnownClipTranscribes(CaptureLanguage.ENGLISH)

    @Test
    fun transcribe_auto_knownTestClip_producesExpectedWords() = assertKnownClipTranscribes(CaptureLanguage.AUTO)

    private fun assertKnownClipTranscribes(language: CaptureLanguage) {
        val testContext = InstrumentationRegistry.getInstrumentation().context
        val targetContext = InstrumentationRegistry.getInstrumentation().targetContext

        // The WAV lives in this test APK's own assets; the model lives in
        // the app-under-test's assets — WaveReader and WhisperTranscriber
        // each need the AssetManager that actually has what they're looking for.
        val wave = WaveReader.readWave(testContext.assets, "whisper-test-sample.wav")
        val transcriber = WhisperTranscriber(targetContext)

        val text = runBlocking { transcriber.transcribe(wave.samples, language) }.lowercase()

        val missing = expectedWords.filter { it !in text }
        check(missing.isEmpty()) {
            "[$language] Transcript missing expected words $missing. Got: \"$text\""
        }
    }
}
