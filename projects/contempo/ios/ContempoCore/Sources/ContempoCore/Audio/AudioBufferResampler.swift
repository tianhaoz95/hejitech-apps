import AVFoundation

/// Converts one `AVAudioPCMBuffer` to `targetFormat` via `converter`, used by
/// both the phone's `AudioRecorder` and the watch's `WatchAudioRecorder` —
/// extracted here (rather than duplicated in each, as it originally was) so
/// this exact logic is unit-testable and shared.
///
/// This exists specifically because of a real, hard-to-notice bug: naively
/// sizing the output buffer's capacity off the *input* buffer's frame count
/// (rather than the actual resample ratio) requests far more output than one
/// input buffer can produce whenever downsampling (e.g. 48kHz hardware input
/// down to this app's 16kHz Whisper target — a ~3x ratio). `AVAudioConverter`'s
/// pull-based `convert(to:error:withInputFrom:)` API then calls the input
/// block AGAIN to try to satisfy that oversized request; a block that
/// unconditionally hands back the same buffer every time it's asked (instead
/// of signaling "no more data available right now" after the first hand-off)
/// makes the converter re-pull and re-consume that same buffer — corrupting/
/// duplicating audio roughly every tap-callback interval. Both problems have
/// to be fixed together: correct capacity sizing, and a pull block that only
/// ever answers once per call.
public enum AudioBufferResampler {
    public static func convert(_ buffer: AVAudioPCMBuffer, using converter: AVAudioConverter, to targetFormat: AVAudioFormat) -> [Float]? {
        let resampleRatio = targetFormat.sampleRate / buffer.format.sampleRate
        let outputCapacity = AVAudioFrameCount((Double(buffer.frameLength) * resampleRatio).rounded(.up)) + 4
        guard let converted = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: outputCapacity) else { return nil }

        var error: NSError?
        var inputConsumed = false
        converter.convert(to: converted, error: &error) { _, outStatus in
            guard !inputConsumed else {
                outStatus.pointee = .noDataNow
                return nil
            }
            inputConsumed = true
            outStatus.pointee = .haveData
            return buffer
        }
        guard error == nil, let channelData = converted.floatChannelData else { return nil }

        let frameCount = Int(converted.frameLength)
        return Array(UnsafeBufferPointer(start: channelData[0], count: frameCount))
    }
}
