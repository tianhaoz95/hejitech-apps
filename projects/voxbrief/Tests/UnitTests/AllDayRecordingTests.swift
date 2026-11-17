import XCTest
import AVFoundation
@testable import Voxbrief

final class AllDayRecordingTests: XCTestCase {

    private func session(_ readings: [(minutes: Double, percent: Int?, charging: Bool)]) -> BatterySession {
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        var session = BatterySession(startedAt: start, config: .default)
        session.samples = readings.map {
            BatterySample(date: start.addingTimeInterval($0.minutes * 60), percent: $0.percent, charging: $0.charging, event: "tick")
        }
        return session
    }

    func testDrainRateAndProjection() {
        let s = session([(0, 90, false), (60, 85, false), (120, 80, false)])
        XCTAssertEqual(s.percentUsed, 10)
        XCTAssertEqual(s.hours, 2, accuracy: 0.001)
        XCTAssertEqual(s.percentPerHour ?? 0, 5, accuracy: 0.001)
        XCTAssertEqual(s.projectedHoursOnFullCharge ?? 0, 20, accuracy: 0.001)
    }

    func testShortSessionsGiveNoRate() {
        let s = session([(0, 90, false), (5, 89, false)])
        XCTAssertNil(s.percentPerHour)
        XCTAssertNil(s.projectedHoursOnFullCharge)
    }

    func testChargingAndMissingReadingsAreLeftOut() {
        let s = session([(0, 50, true), (10, 60, false), (40, nil, false), (70, 55, false)])
        XCTAssertEqual(s.startPercent, 60)
        XCTAssertEqual(s.endPercent, 55)
        XCTAssertEqual(s.percentPerHour ?? 0, 5, accuracy: 0.001)
        XCTAssertTrue(s.wasCharging)
    }

    func testNoDropGivesNoProjection() {
        let s = session([(0, 70, false), (30, 70, false)])
        XCTAssertEqual(s.percentPerHour, 0)
        XCTAssertNil(s.projectedHoursOnFullCharge)
    }

    func testQualitySettings() {
        XCTAssertEqual(WatchRecordingQuality.saver.megabytesPerHour, 10.8, accuracy: 0.001)
        XCTAssertEqual(WatchRecordingQuality.standard.megabytesPerHour, 28.8, accuracy: 0.001)
        let settings = WatchRecordingQuality.saver.recorderSettings
        XCTAssertEqual(settings[AVSampleRateKey] as? Double, 16_000)
        XCTAssertEqual(settings[AVNumberOfChannelsKey] as? Int, 1)
        XCTAssertEqual(settings[AVEncoderBitRateKey] as? Int, 24_000)
    }

    func testConfigRoundTripsThroughDefaults() {
        let defaults = UserDefaults(suiteName: "AllDayRecordingTests")!
        defaults.removePersistentDomain(forName: "AllDayRecordingTests")
        XCTAssertEqual(WatchRecordingConfig.load(from: defaults), .default)
        XCTAssertEqual(WatchRecordingConfig.default.segmentLength, 900)

        let changed = WatchRecordingConfig(quality: .standard, segmentMinutes: 30, transferPolicy: .rightAway)
        changed.save(to: defaults)
        XCTAssertEqual(WatchRecordingConfig.load(from: defaults), changed)
    }

    /// The saver settings must be ones the system's AAC encoder accepts, or every piece would
    /// fall back to the encoder's default bit rate.
    func testSaverSettingsAreAcceptedByTheEncoder() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("saver-\(UUID().uuidString).m4a")
        defer { try? FileManager.default.removeItem(at: url) }
        let format = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: 16_000, channels: 1))
        let file = try AVAudioFile(forWriting: url, settings: WatchRecordingQuality.saver.recorderSettings)
        let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 16_000))
        buffer.frameLength = 16_000
        try file.write(from: buffer)
    }
}
