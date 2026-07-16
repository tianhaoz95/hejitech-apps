package com.hejitech.contempo.agent

import android.content.Context
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * On-device speech-to-text via sherpa-onnx (k2-fsa/sherpa-onnx) + a bundled
 * Whisper tiny.en model (assets/sherpa-onnx-whisper-tiny.en, int8-quantized,
 * ~99MB) — replaces the legacy RecognizerIntent voice input, which routes
 * through a separate system dialog on a lower-quality recognizer.
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

    private val recognizer: OfflineRecognizer by lazy {
        val modelDir = "sherpa-onnx-whisper-tiny.en"
        OfflineRecognizer(
            assetManager = appContext.assets,
            config = OfflineRecognizerConfig(
                modelConfig = OfflineModelConfig(
                    whisper = OfflineWhisperModelConfig(
                        encoder = "$modelDir/tiny.en-encoder.int8.onnx",
                        decoder = "$modelDir/tiny.en-decoder.int8.onnx",
                    ),
                    tokens = "$modelDir/tiny.en-tokens.txt",
                    modelType = "whisper",
                    numThreads = 2,
                ),
            ),
        )
    }

    /**
     * [samples] must be 16kHz mono, normalized to [-1, 1] — see
     * AudioRecorder. Loading the recognizer (first call only) and decoding
     * both do real CPU work, hence Dispatchers.Default rather than the
     * calling coroutine's own dispatcher.
     */
    suspend fun transcribe(samples: FloatArray): String = withContext(Dispatchers.Default) {
        if (samples.isEmpty()) return@withContext ""
        val stream = recognizer.createStream()
        try {
            stream.acceptWaveform(samples, sampleRate = SAMPLE_RATE_HZ)
            recognizer.decode(stream)
            recognizer.getResult(stream).text.trim()
        } finally {
            stream.release()
        }
    }

    companion object {
        const val SAMPLE_RATE_HZ = 16_000
    }
}
