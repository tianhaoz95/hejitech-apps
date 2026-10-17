package com.hejitech.core.audio

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Minimal WAV (PCM16, mono) encode/decode — the wire format for relaying a
 * watch recording to the phone's on-device Whisper pipeline over the Wear
 * Data Layer (see wear/net/PhoneAudioRelay.kt and
 * app/wear/WearAudioListenerService.kt). Shared here rather than duplicated
 * so both sides can never drift on sample rate/bit depth assumptions.
 *
 * Not a general-purpose WAV library — no compressed formats, no stereo, no
 * chunks beyond fmt/data. That's all either side ever produces or expects.
 */
object WavAudio {
    private const val PCM_FORMAT = 1
    private const val BITS_PER_SAMPLE = 16
    private const val CHANNELS = 1

    /** [samples] normalized to [-1, 1], as produced by AudioRecorder/WearAudioRecorder. */
    fun encode(samples: FloatArray, sampleRateHz: Int): ByteArray {
        val pcm = ByteArrayOutputStream(samples.size * 2)
        val sampleBuffer = ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN)
        for (sample in samples) {
            val clamped = sample.coerceIn(-1f, 1f)
            val intSample = (clamped * Short.MAX_VALUE).toInt().toShort()
            sampleBuffer.clear()
            sampleBuffer.putShort(intSample)
            pcm.write(sampleBuffer.array())
        }
        val pcmBytes = pcm.toByteArray()

        val byteRate = sampleRateHz * CHANNELS * BITS_PER_SAMPLE / 8
        val blockAlign = CHANNELS * BITS_PER_SAMPLE / 8
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray())
        header.putInt(36 + pcmBytes.size)
        header.put("WAVE".toByteArray())
        header.put("fmt ".toByteArray())
        header.putInt(16)
        header.putShort(PCM_FORMAT.toShort())
        header.putShort(CHANNELS.toShort())
        header.putInt(sampleRateHz)
        header.putInt(byteRate)
        header.putShort(blockAlign.toShort())
        header.putShort(BITS_PER_SAMPLE.toShort())
        header.put("data".toByteArray())
        header.putInt(pcmBytes.size)

        return header.array() + pcmBytes
    }

    /** Returns samples normalized to [-1, 1] — the shape WhisperTranscriber.transcribe expects. */
    fun decode(wav: ByteArray): FloatArray {
        require(wav.size > 44) { "WAV payload too short: ${wav.size} bytes" }
        val buffer = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN)

        // Walk chunks rather than assuming a fixed 44-byte header — robust to
        // any extra fmt fields a future encoder might add.
        buffer.position(12)
        var dataOffset = -1
        var dataLength = 0
        while (buffer.remaining() >= 8) {
            val chunkId = ByteArray(4).also { buffer.get(it) }
            val chunkSize = buffer.int
            if (String(chunkId) == "data") {
                dataOffset = buffer.position()
                dataLength = chunkSize
                break
            }
            buffer.position(buffer.position() + chunkSize)
        }
        require(dataOffset >= 0) { "No data chunk found in WAV payload" }

        val sampleCount = dataLength / 2
        val samples = FloatArray(sampleCount)
        buffer.position(dataOffset)
        for (i in 0 until sampleCount) {
            samples[i] = buffer.short / 32768f
        }
        return samples
    }
}
