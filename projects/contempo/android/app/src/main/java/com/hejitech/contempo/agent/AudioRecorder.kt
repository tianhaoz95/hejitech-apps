package com.hejitech.contempo.agent

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import androidx.core.content.ContextCompat
import kotlin.math.abs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Raw 16kHz mono PCM16 capture for WhisperTranscriber. Record-then-transcribe,
 * not streaming — this just accumulates samples in memory (a synchronized
 * list, since the recording coroutine writes to it while stop() reads it)
 * until stop() is called, matching WhisperTranscriber's non-streaming
 * Whisper model.
 *
 * [amplitude] is exposed live purely for CaptureScreen's listening
 * animation — a crude per-chunk peak level, not used for silence detection
 * or auto-stop. Start/stop is always the user's explicit action here.
 */
class AudioRecorder(private val context: Context) {
    private var audioRecord: AudioRecord? = null
    private var recordingJob: Job? = null
    private val samplesBuffer = java.util.Collections.synchronizedList(mutableListOf<Float>())

    private val _amplitude = MutableStateFlow(0f)
    val amplitude: StateFlow<Float> = _amplitude.asStateFlow()

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    /** [scope] should be the caller's viewModelScope — the recording loop lives as long as it. */
    fun start(scope: CoroutineScope) {
        check(hasPermission()) { "RECORD_AUDIO permission not granted" }
        samplesBuffer.clear()

        val minBufferSize = AudioRecord.getMinBufferSize(
            WhisperTranscriber.SAMPLE_RATE_HZ,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        val record = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            WhisperTranscriber.SAMPLE_RATE_HZ,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            minBufferSize * 2,
        )
        audioRecord = record
        record.startRecording()

        recordingJob = scope.launch(Dispatchers.IO) {
            val chunk = ShortArray(minBufferSize)
            while (isActive) {
                val read = record.read(chunk, 0, chunk.size)
                if (read <= 0) continue
                var peak = 0f
                val floats = FloatArray(read)
                for (i in 0 until read) {
                    val normalized = chunk[i] / 32768f
                    floats[i] = normalized
                    val magnitude = abs(normalized)
                    if (magnitude > peak) peak = magnitude
                }
                samplesBuffer.addAll(floats.toList())
                _amplitude.value = peak
            }
        }
    }

    /** Stops recording and returns everything captured since start(). */
    suspend fun stop(): FloatArray {
        recordingJob?.cancelAndJoin()
        recordingJob = null
        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null
        _amplitude.value = 0f
        return samplesBuffer.toFloatArray()
    }
}
