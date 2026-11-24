import XCTest
@testable import VoxbriefMac

final class MacMeetingAndParityTests: XCTestCase {
    func testMeetingAudioMixerCombinesAndSoftLimitsPeaks() {
        let mic: [Float] = [0.4, 0.8, 0.2]
        let system: [Float] = [0.3, 0.7]

        let mixed = MeetingAudioMixer.mix(mic: mic, system: system)
        XCTAssertEqual(mixed.count, 3)
        XCTAssertEqual(mixed[0], 0.7, accuracy: 1e-5)
        // 0.8 + 0.7 = 1.5 -> soft-limited via tanh(1.5) < 1.0
        XCTAssertLessThan(mixed[1], 1.0)
        XCTAssertGreaterThan(mixed[1], 0.85)
        XCTAssertEqual(mixed[2], 0.2, accuracy: 1e-5)
    }

    func testMeetingAudioMixerDownmixesAndResamplesTo16k() {
        // 48 kHz stereo interleaved (3x target rate): 480 frames -> ~160 mono frames.
        let frames = 480
        var stereo = [Float](repeating: 0, count: frames * 2)
        for i in 0..<frames {
            stereo[i * 2] = 0.6
            stereo[i * 2 + 1] = 0.2
        }

        let mono16k = MeetingAudioMixer.toMono16k(samples: stereo, channels: 2, sampleRate: 48_000, interleaved: true)
        XCTAssertEqual(mono16k.count, 160)
        XCTAssertEqual(mono16k[0], 0.4, accuracy: 1e-4)
        XCTAssertEqual(mono16k[159], 0.4, accuracy: 1e-4)
    }

    func testNormalizedLevelBounds() {
        XCTAssertEqual(MeetingAudioMixer.normalizedLevel(for: []), 0)
        XCTAssertEqual(MeetingAudioMixer.normalizedLevel(for: [0, 0, 0, 0]), 0, accuracy: 1e-3)
        XCTAssertEqual(MeetingAudioMixer.normalizedLevel(for: [1, -1, 1, -1]), 1, accuracy: 1e-3)
    }

    func testNoteSearchIndexWorksOnMac() {
        let note = VoiceNote(
            title: "Architecture Review",
            summary: "Moved meeting capture to ScreenCaptureKit.",
            rawTranscript: "ScreenCaptureKit captures system audio without a bot.",
            cleanedNote: "ScreenCaptureKit captures system audio without a bot.",
            status: .ready,
            source: .macMeeting
        )
        let index = NoteSearchIndex(notes: [note])
        let hits = index.search(["ScreenCaptureKit"])
        XCTAssertFalse(hits.isEmpty)
        XCTAssertEqual(hits.first?.passage.noteId, note.id)
    }
}
