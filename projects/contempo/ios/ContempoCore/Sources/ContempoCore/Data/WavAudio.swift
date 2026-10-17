import Foundation

/// Minimal WAV (PCM16, mono) encode — the wire format the watch durably
/// saves a recording as before uploading to Storage. Ports
/// `android/core/src/main/java/com/hejitech/core/audio/WavAudio.kt`'s
/// `encode` verbatim (same header layout/byte order), so a `.wav` file
/// produced by either platform is byte-for-byte equivalent given the same
/// samples. Decode isn't needed on iOS — `WhisperTranscriber` (phone-only)
/// consumes raw `[Float]` samples directly, never a `.wav` file.
public enum WavAudio {
    private static let pcmFormat: Int16 = 1
    private static let bitsPerSample: Int16 = 16
    private static let channels: Int16 = 1

    /// `samples` normalized to [-1, 1], as produced by `AudioRecorder`.
    public static func encode(samples: [Float], sampleRateHz: Int) -> Data {
        var pcm = Data(capacity: samples.count * 2)
        for sample in samples {
            let clamped = max(-1, min(1, sample))
            let intSample = Int16(clamped * Float(Int16.max))
            withUnsafeBytes(of: intSample.littleEndian) { pcm.append(contentsOf: $0) }
        }

        let byteRate = Int32(sampleRateHz) * Int32(channels) * Int32(bitsPerSample) / 8
        let blockAlign = channels * bitsPerSample / 8

        var header = Data(capacity: 44)
        header.append(contentsOf: Array("RIFF".utf8))
        header.append(littleEndian: Int32(36 + pcm.count))
        header.append(contentsOf: Array("WAVE".utf8))
        header.append(contentsOf: Array("fmt ".utf8))
        header.append(littleEndian: Int32(16))
        header.append(littleEndian: pcmFormat)
        header.append(littleEndian: channels)
        header.append(littleEndian: Int32(sampleRateHz))
        header.append(littleEndian: byteRate)
        header.append(littleEndian: blockAlign)
        header.append(littleEndian: bitsPerSample)
        header.append(contentsOf: Array("data".utf8))
        header.append(littleEndian: Int32(pcm.count))

        return header + pcm
    }

    /// Decodes a 44-byte header PCM16 mono WAV Data into `[Float]` samples normalized to [-1, 1].
    public static func decode(_ wavData: Data) -> [Float] {
        guard wavData.count >= 44 else { return [] }
        let pcmBytes = wavData.dropFirst(44)
        var samples = [Float]()
        samples.reserveCapacity(pcmBytes.count / 2)
        pcmBytes.withUnsafeBytes { buffer in
            guard let p16 = buffer.bindMemory(to: Int16.self).baseAddress else { return }
            for i in 0..<(pcmBytes.count / 2) {
                let intSample = Int16(littleEndian: p16[i])
                samples.append(Float(intSample) / Float(Int16.max))
            }
        }
        return samples
    }
}

private extension Data {
    mutating func append(littleEndian value: Int32) {
        Swift.withUnsafeBytes(of: value.littleEndian) { append(contentsOf: $0) }
    }

    mutating func append(littleEndian value: Int16) {
        Swift.withUnsafeBytes(of: value.littleEndian) { append(contentsOf: $0) }
    }
}
