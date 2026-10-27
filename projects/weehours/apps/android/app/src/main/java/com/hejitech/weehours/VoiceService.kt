package com.hejitech.weehours

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.MediaRecorder
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.util.Locale
import java.util.UUID

class VoiceService(
    private val context: Context,
    private val onTranscriptReady: (transcript: String, audioPath: String?, captureId: UUID) -> Unit
) {
    enum class State {
        IDLE,
        LISTENING,
        PROCESSING,
        ERROR
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var mediaRecorder: MediaRecorder? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    private val _state = MutableStateFlow(State.IDLE)
    val state: StateFlow<State> = _state.asStateFlow()

    private val _liveTranscript = MutableStateFlow("")
    val liveTranscript: StateFlow<String> = _liveTranscript.asStateFlow()

    private val _rmsLevel = MutableStateFlow(0f)
    val rmsLevel: StateFlow<Float> = _rmsLevel.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var currentCaptureId: UUID = UUID.randomUUID()
    private var currentAudioPath: String? = null
    var preferredLocale: String = "auto"

    init {
        mainHandler.post {
            try {
                tts = TextToSpeech(context.applicationContext) { status ->
                    ttsReady = (status == TextToSpeech.SUCCESS)
                }
            } catch (_: Exception) {
            }
        }
    }

    fun startListening() {
        mainHandler.post {
            stopInternal(deliver = false)
            currentCaptureId = UUID.randomUUID()
            _liveTranscript.value = ""
            _errorMessage.value = null
            _rmsLevel.value = 0f

            hapticTick()
            beep(ToneGenerator.TONE_PROP_BEEP, 80)

            val capturesDir = File(context.filesDir, "captures").apply { mkdirs() }
            val audioFile = File(capturesDir, "$currentCaptureId.m4a")
            currentAudioPath = "captures/${audioFile.name}"

            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                // Fall back to audio recorder + manual/quick transcript entry
                startFallbackRecorder(audioFile)
                _state.value = State.LISTENING
                return@post
            }

            try {
                val sr = SpeechRecognizer.createSpeechRecognizer(context)
                recognizer = sr
                sr.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {
                        _state.value = State.LISTENING
                    }

                    override fun onBeginningOfSpeech() {}

                    override fun onRmsChanged(rmsdB: Float) {
                        _rmsLevel.value = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
                    }

                    override fun onBufferReceived(buffer: ByteArray?) {}

                    override fun onEndOfSpeech() {
                        _state.value = State.PROCESSING
                    }

                    override fun onError(error: Int) {
                        val partial = _liveTranscript.value.trim()
                        if (partial.isNotEmpty()) {
                            finishWithTranscript(partial)
                        } else {
                            _state.value = State.ERROR
                            _errorMessage.value = when (error) {
                                SpeechRecognizer.ERROR_NO_MATCH,
                                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Didn't catch that — type below or tap mic to try again."
                                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is required for voice capture."
                                else -> "Voice recognition unavailable (code $error) — type below."
                            }
                        }
                    }

                    override fun onResults(results: Bundle?) {
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val best = matches?.firstOrNull()?.trim().orEmpty().ifEmpty { _liveTranscript.value.trim() }
                        if (best.isNotEmpty()) {
                            finishWithTranscript(best)
                        } else {
                            _state.value = State.IDLE
                        }
                    }

                    override fun onPartialResults(partialResults: Bundle?) {
                        val partial = partialResults
                            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull()
                            ?.trim()
                            .orEmpty()
                        if (partial.isNotEmpty()) {
                            _liveTranscript.value = partial
                        }
                    }

                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                    val lang = when (preferredLocale) {
                        "en" -> "en-US"
                        "zh-Hans" -> "zh-CN"
                        "zh-Hant" -> "zh-TW"
                        else -> Locale.getDefault().toLanguageTag()
                    }
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                }
                _state.value = State.LISTENING
                sr.startListening(intent)
            } catch (e: Exception) {
                _state.value = State.ERROR
                _errorMessage.value = e.localizedMessage ?: "Could not start speech recognizer."
            }
        }
    }

    fun stopListeningAndCommit() {
        mainHandler.post {
            val currentText = _liveTranscript.value.trim()
            stopInternal(deliver = false)
            if (currentText.isNotEmpty()) {
                finishWithTranscript(currentText)
            } else {
                _state.value = State.IDLE
            }
        }
    }

    fun submitTypedTranscript(text: String) {
        mainHandler.post {
            stopInternal(deliver = false)
            val trimmed = text.trim()
            if (trimmed.isNotEmpty()) {
                currentCaptureId = UUID.randomUUID()
                currentAudioPath = null
                finishWithTranscript(trimmed)
            }
        }
    }

    fun cancelListening() {
        mainHandler.post {
            stopInternal(deliver = false)
            _liveTranscript.value = ""
            _errorMessage.value = null
            _state.value = State.IDLE
        }
    }

    private fun finishWithTranscript(transcript: String) {
        _liveTranscript.value = transcript
        _state.value = State.IDLE
        hapticConfirm()
        beep(ToneGenerator.TONE_PROP_ACK, 100)
        onTranscriptReady(transcript, currentAudioPath, currentCaptureId)
    }

    private fun startFallbackRecorder(outputFile: File) {
        try {
            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            recorder.setAudioSamplingRate(16000)
            recorder.setAudioEncodingBitRate(32000)
            recorder.setOutputFile(outputFile.absolutePath)
            recorder.prepare()
            recorder.start()
            mediaRecorder = recorder
        } catch (_: Exception) {
            mediaRecorder = null
        }
    }

    private fun stopInternal(deliver: Boolean) {
        try {
            recognizer?.stopListening()
            recognizer?.cancel()
            recognizer?.destroy()
        } catch (_: Exception) {
        }
        recognizer = null

        try {
            mediaRecorder?.stop()
        } catch (_: Exception) {
        }
        try {
            mediaRecorder?.release()
        } catch (_: Exception) {
        }
        mediaRecorder = null
    }

    fun speak(text: String) {
        if (!ttsReady) return
        val containsHan = text.any { Character.UnicodeScript.of(it.code) == Character.UnicodeScript.HAN }
        tts?.language = if (containsHan) Locale.SIMPLIFIED_CHINESE else Locale.US
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString())
    }

    fun hapticTick() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            vibrator?.vibrate(VibrationEffect.createOneShot(25, VibrationEffect.DEFAULT_AMPLITUDE))
        } catch (_: Exception) {
        }
    }

    fun hapticConfirm() {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 30, 50, 45), -1))
        } catch (_: Exception) {
        }
    }

    private fun beep(tone: Int, durationMs: Int) {
        try {
            val tg = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 45)
            tg.startTone(tone, durationMs)
            mainHandler.postDelayed({ tg.release() }, (durationMs + 50).toLong())
        } catch (_: Exception) {
        }
    }

    fun shutdown() {
        stopInternal(deliver = false)
        try {
            tts?.shutdown()
        } catch (_: Exception) {
        }
    }
}
