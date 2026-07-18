package com.hejitech.wear.capture

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
 * Raw 16kHz mono PCM16 capture on the watch — deliberately the same shape as
 * app/agent/AudioRecorder.kt (same sample rate, same record-then-return-all
 * approach) so the WAV this produces (see WavAudio in :core) decodes back
 * into exactly what WhisperTranscriber expects on the phone. Not shared code
 * across modules (small enough, and keeps the wear module's dependency
 * surface independent of the phone app's agent package).
 */
class WearAudioRecorder(private val context: Context) {
    private var audioRecord: AudioRecord? = null
    private var recordingJob: Job? = null
    private val samplesBuffer = java.util.Collections.synchronizedList(mutableListOf<Float>())

    private val _amplitude = MutableStateFlow(0f)
    val amplitude: StateFlow<Float> = _amplitude.asStateFlow()

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    fun start(scope: CoroutineScope) {
        check(hasPermission()) { "RECORD_AUDIO permission not granted" }
        samplesBuffer.clear()

        val minBufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE_HZ,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        val record = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            SAMPLE_RATE_HZ,
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

    companion object {
        const val SAMPLE_RATE_HZ = 16_000
    }
}
