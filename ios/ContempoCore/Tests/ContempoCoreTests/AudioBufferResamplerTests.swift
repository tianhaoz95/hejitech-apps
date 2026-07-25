import AVFoundation
@testable import ContempoCore
import XCTest

/// Regression coverage for this session's most severe bug: recorded voice
/// audio was corrupted/duplicated roughly every 0.1s, making transcription
/// quality extremely poor. Root cause was in the pull-based
/// `AVAudioConverter` usage `AudioBufferResampler.convert` now centralizes
/// (see its doc comment) — an oversized output buffer capacity combined
/// with a pull block that unconditionally re-handed back the same input
/// buffer caused the converter to re-pull and re-consume that one buffer
/// multiple times per tap callback.
final class AudioBufferResamplerTests: XCTestCase {
    private let inputSampleRate: Double = 48_000
    private let targetSampleRate: Double = 16_000

    private func makeFormats() -> (input: AVAudioFormat, target: AVAudioFormat) {
        let input = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: inputSampleRate, channels: 1, interleaved: false)!
        let target = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: targetSampleRate, channels: 1, interleaved: false)!
        return (input, target)
    }

    /// A constant-value buffer (rather than e.g. a sine wave) keeps the
    /// resampled output's expected value simple to assert on even across a
    /// low-pass/anti-aliasing filter, since a DC signal passes through
    /// resampling largely unchanged.
    private func makeBuffer(value: Float, frameCount: AVAudioFrameCount, format: AVAudioFormat) -> AVAudioPCMBuffer {
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount)!
        buffer.frameLength = frameCount
        let channel = buffer.floatChannelData![0]
        for i in 0..<Int(frameCount) {
            channel[i] = value
        }
        return buffer
    }

    func testOutputFrameCountReflectsTheResampleRatioNotTheInputFrameCount() throws {
        let (inputFormat, targetFormat) = makeFormats()
        let converter = try XCTUnwrap(AVAudioConverter(from: inputFormat, to: targetFormat))
        let inputFrames: AVAudioFrameCount = 4096
        let buffer = makeBuffer(value: 0.5, frameCount: inputFrames, format: inputFormat)

        let output = try XCTUnwrap(AudioBufferResampler.convert(buffer, using: converter, to: targetFormat))

        // Expected ~1/3 of the input frame count (16kHz target / 48kHz
        // input) — the exact bug this guards against requested/produced
        // something wildly different (an oversized capacity fed back into
        // the same stale buffer repeatedly).
        let expectedFrames = Double(inputFrames) * (targetSampleRate / inputSampleRate)
        XCTAssertEqual(Double(output.count), expectedFrames, accuracy: 8)
    }

    /// The core regression: converting two sequential, distinctly-different
    /// buffers through the SAME converter instance (matching real usage,
    /// where one converter persists across every tap callback) must not
    /// leak or duplicate content between them. Under the original bug, a
    /// buffer could be re-pulled multiple times within its own conversion,
    /// corrupting that callback's output — this asserts each call's output
    /// reflects only its own input.
    func testSequentialDistinctBuffersDoNotLeakIntoEachOther() throws {
        let (inputFormat, targetFormat) = makeFormats()
        let converter = try XCTUnwrap(AVAudioConverter(from: inputFormat, to: targetFormat))
        let inputFrames: AVAudioFrameCount = 4096

        let bufferA = makeBuffer(value: 0.8, frameCount: inputFrames, format: inputFormat)
        let bufferB = makeBuffer(value: -0.8, frameCount: inputFrames, format: inputFormat)

        let outputA = try XCTUnwrap(AudioBufferResampler.convert(bufferA, using: converter, to: targetFormat))
        let outputB = try XCTUnwrap(AudioBufferResampler.convert(bufferB, using: converter, to: targetFormat))

        XCTAssertFalse(outputA.isEmpty)
        XCTAssertFalse(outputB.isEmpty)

        // A DC signal resamples to (approximately) the same constant value —
        // ignoring a handful of filter-transient samples at the very start,
        // which is why this checks the tail of each buffer, not the mean of
        // the whole thing.
        let tailA = outputA.suffix(outputA.count / 2)
        let tailB = outputB.suffix(outputB.count / 2)
        XCTAssertTrue(tailA.allSatisfy { $0 > 0 }, "Buffer A's output should stay positive (input was +0.8)")
        XCTAssertTrue(tailB.allSatisfy { $0 < 0 }, "Buffer B's output should stay negative (input was -0.8) — a positive value here would mean buffer A's content leaked into buffer B's conversion")
    }

    func testConvertingManySequentialBuffersNeverThrowsOrHangs() throws {
        let (inputFormat, targetFormat) = makeFormats()
        let converter = try XCTUnwrap(AVAudioConverter(from: inputFormat, to: targetFormat))

        for i in 0..<200 {
            let value = Float(i % 2 == 0 ? 0.3 : -0.3)
            let buffer = makeBuffer(value: value, frameCount: 4096, format: inputFormat)
            XCTAssertNotNil(AudioBufferResampler.convert(buffer, using: converter, to: targetFormat), "call \(i) unexpectedly produced nil output")
        }
    }
}
