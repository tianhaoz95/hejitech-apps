package com.hejitech.contempo.agent

import android.content.Context
import com.hejitech.contempo.data.traced
import com.hejitech.core.model.CaptureLanguage
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * On-device speech-to-text via sherpa-onnx (k2-fsa/sherpa-onnx). Three
 * bundled Whisper checkpoints, one per [CaptureLanguage]:
 *  - ENGLISH: the dedicated tiny.en checkpoint (assets/sherpa-onnx-whisper-tiny.en,
 *    int8-quantized, ~103MB) — measurably more accurate on English than the
 *    multilingual model forced to English would be (this is exactly what
 *    this app used before Chinese support was added — see CHINESE/AUTO below
 *    — and OpenAI's own published benchmarks show the same gap).
 *  - CHINESE: the multilingual tiny checkpoint (assets/sherpa-onnx-whisper-tiny,
 *    ~99MB), with `language = "zh"` forced — skips Whisper's own per-utterance
 *    language-ID step entirely, which is the actual unreliable part at this
 *    model size (confirmed live: Chinese captures were sometimes getting
 *    silently mis-detected as English), not the decoder itself.
 *  - AUTO: the same multilingual checkpoint, `language = ""` (Whisper's own
 *    auto-detection) — for anything else, or before the user has picked.
 *
 * Whisper's forced/detected language is baked into OfflineRecognizerConfig at
 * construction time (see sherpa-onnx's offline-whisper-greedy-search-decoder.cc:
 * `config_` is a fixed copy taken once, not a per-stream/decode-time option),
 * so CHINESE and AUTO need two separate OfflineRecognizer instances even
 * though they load the same underlying model files — there's no cheaper way
 * to change the forced language on an already-built recognizer. Each of the
 * three is built lazily on first use and cached for the process's lifetime,
 * so a user who only ever picks one or two languages only pays the memory
 * cost for those, not all three at once.
 *
 * Replaces the legacy RecognizerIntent voice input, which routes through a
 * separate system dialog on a lower-quality recognizer.
 *
 * sherpa-onnx has no Maven artifact as of this writing — the
 * com.k2fsa.sherpa.onnx.* Kotlin API files under
 * android/app/src/main/java/com/k2fsa/sherpa/onnx/ were hand-copied
 * unmodified from the sherpa-onnx repo's sherpa-onnx/kotlin-api/ (package
 * name preserved deliberately: JNI native method names are tied to it), and
 * the native libraries under jniLibs/arm64-v8a came from a GitHub release
 * tarball (v1.13.4-android). See android/whisper-vendor/ at the repo root for the
 * exact source URLs — not shipped in the app, just where these came from.
 *
 * Record-then-transcribe, not streaming: this is a non-streaming
 * ("Offline" in sherpa-onnx's naming) Whisper model — the whole utterance
 * is decoded at once after AudioRecorder.stop(), not word-by-word live.
 */
class WhisperTranscriber(context: Context) {
    private val appContext = context.applicationContext

    val isAvailable: Boolean
        get() = try {
            appContext.assets.open("sherpa-onnx-whisper-tiny.en/tiny.en-encoder.int8.onnx").close()
            true
        } catch (_: Exception) {
            try {
                appContext.assets.open("sherpa-onnx-whisper-tiny/tiny-encoder.int8.onnx").close()
                true
            } catch (_: Exception) {
                false
            }
        }

    private val englishRecognizer: OfflineRecognizer by lazy {
        buildRecognizer(modelDir = "sherpa-onnx-whisper-tiny.en", filePrefix = "tiny.en", language = "en")
    }
    private val chineseRecognizer: OfflineRecognizer by lazy {
        buildRecognizer(modelDir = "sherpa-onnx-whisper-tiny", filePrefix = "tiny", language = "zh")
    }
    private val autoRecognizer: OfflineRecognizer by lazy {
        buildRecognizer(modelDir = "sherpa-onnx-whisper-tiny", filePrefix = "tiny", language = "")
    }

    private fun buildRecognizer(modelDir: String, filePrefix: String, language: String): OfflineRecognizer =
        OfflineRecognizer(
            assetManager = appContext.assets,
            config = OfflineRecognizerConfig(
                modelConfig = OfflineModelConfig(
                    whisper = OfflineWhisperModelConfig(
                        encoder = "$modelDir/$filePrefix-encoder.int8.onnx",
                        decoder = "$modelDir/$filePrefix-decoder.int8.onnx",
                        language = language,
                    ),
                    tokens = "$modelDir/$filePrefix-tokens.txt",
                    modelType = "whisper",
                    numThreads = 2,
                ),
            ),
        )

    private fun recognizerFor(language: CaptureLanguage): OfflineRecognizer = when (language) {
        CaptureLanguage.ENGLISH -> englishRecognizer
        CaptureLanguage.CHINESE -> chineseRecognizer
        CaptureLanguage.AUTO -> autoRecognizer
    }

    /**
     * [samples] must be 16kHz mono, normalized to [-1, 1] — see
     * AudioRecorder. Loading a recognizer (first use of that particular
     * [language] only) and decoding both do real CPU work, hence
     * Dispatchers.Default rather than the calling coroutine's own dispatcher.
     */
    suspend fun transcribe(samples: FloatArray, language: CaptureLanguage): String =
        traced("whisper_transcribe", mapOf("language" to language.name)) {
            withContext(Dispatchers.Default) {
                if (samples.isEmpty()) return@withContext ""
                val recognizer = recognizerFor(language)
                val stream = recognizer.createStream()
                try {
                    stream.acceptWaveform(samples, sampleRate = SAMPLE_RATE_HZ)
                    recognizer.decode(stream)
                    collapseRepeatedWords(recognizer.getResult(stream).text.trim())
                } finally {
                    stream.release()
                }
            }
        }

    companion object {
        const val SAMPLE_RATE_HZ = 16_000

        /**
         * Confirmed live: greedy-search decoding on this model size can loop
         * on trailing silence after a short utterance and repeat the last
         * word dozens of times ("test test" transcribing as 20+ "test"s) —
         * this sherpa-onnx binding exposes no repetition-penalty/no-repeat
         * decoding option to prevent it at the source (see
         * OfflineRecognizerConfig in com/k2fsa/sherpa/onnx/OfflineRecognizer.kt),
         * so it's collapsed here instead. Caps any run of the same
         * consecutive word at 2 — enough to leave real doubled words alone
         * ("very very tired", a stutter like "the the sink") while still
         * killing a genuine hallucination loop, which runs far longer than
         * any natural repetition would.
         */
        private const val MAX_CONSECUTIVE_REPEATS = 2

        internal fun collapseRepeatedWords(text: String): String {
            val words = text.split(Regex("\\s+")).filter { it.isNotEmpty() }
            if (words.size <= MAX_CONSECUTIVE_REPEATS) return text
            val result = mutableListOf<String>()
            var i = 0
            while (i < words.size) {
                val current = words[i]
                var runEnd = i + 1
                while (runEnd < words.size && words[runEnd].equals(current, ignoreCase = true)) {
                    runEnd++
                }
                repeat(minOf(runEnd - i, MAX_CONSECUTIVE_REPEATS)) { result.add(current) }
                i = runEnd
            }
            return result.joinToString(" ")
        }
    }
}
