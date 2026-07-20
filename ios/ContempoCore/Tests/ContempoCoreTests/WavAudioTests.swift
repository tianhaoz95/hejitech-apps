import ContempoCore
import XCTest

final class WavAudioTests: XCTestCase {
    func testWavHeaderAndSampleEncoding() {
        let samples: [Float] = [0.0, 0.5, -0.5, 1.0, -1.0]
        let sampleRate = 16000
        let encoded = WavAudio.encode(samples: samples, sampleRateHz: sampleRate)

        // 44 bytes header + (5 samples * 2 bytes/sample) = 54 bytes
        XCTAssertEqual(encoded.count, 54)

        // RIFF header magic
        let riffHeader = String(data: encoded[0..<4], encoding: .utf8)
        XCTAssertEqual(riffHeader, "RIFF")

        // WAVE magic
        let waveHeader = String(data: encoded[8..<12], encoding: .utf8)
        XCTAssertEqual(waveHeader, "WAVE")

        // fmt header magic
        let fmtHeader = String(data: encoded[12..<16], encoding: .utf8)
        XCTAssertEqual(fmtHeader, "fmt ")

        // data header magic
        let dataHeader = String(data: encoded[36..<40], encoding: .utf8)
        XCTAssertEqual(dataHeader, "data")
    }
}
