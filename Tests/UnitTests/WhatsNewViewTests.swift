import XCTest
import SwiftUI
@testable import Voxbrief

@MainActor
final class WhatsNewViewTests: XCTestCase {

    func testCurrentVersionMatchesReleases() {
        XCTAssertEqual(WhatsNewView.currentVersion, "1.22.0")
        let latest = WhatsNewView.releases.first
        XCTAssertNotNil(latest)
        XCTAssertEqual(latest?.version, WhatsNewView.currentVersion)
    }

    func testReleaseSeparatesFeaturesFromImprovements() {
        guard let current = WhatsNewView.releases.first(where: { $0.version == "1.22.0" }) else {
            XCTFail("Missing v1.22.0 release")
            return
        }

        // New features are shown up front
        XCTAssertFalse(current.features.isEmpty)
        XCTAssertGreaterThanOrEqual(current.features.count, 4)

        // Bug fixes & improvements are stored separately for secondary UI
        XCTAssertFalse(current.improvementsAndFixes.isEmpty)
        XCTAssertGreaterThanOrEqual(current.improvementsAndFixes.count, 3)

        // items property aggregates both for backward compatibility
        XCTAssertEqual(current.items.count, current.features.count + current.improvementsAndFixes.count)
    }

    func testHistoricalVersionsContainBothFeaturesAndImprovements() {
        let expectedVersions = ["1.22.0", "1.21.0", "1.20.0", "1.19.0", "1.18.0", "1.17.0", "1.16.0"]
        for version in expectedVersions {
            guard let release = WhatsNewView.releases.first(where: { $0.version == version }) else {
                XCTFail("Missing historical version \(version)")
                continue
            }
            XCTAssertFalse(release.features.isEmpty, "Features should not be empty for \(version)")
            XCTAssertFalse(release.improvementsAndFixes.isEmpty, "Improvements should not be empty for \(version)")
            XCTAssertFalse(release.tagline.isEmpty)
            XCTAssertFalse(release.date.isEmpty)
        }
    }

    func testWhatsNewItemKindClassification() {
        let featureItem = WhatsNewItem(
            icon: "star",
            tint: .blue,
            title: "New Feature",
            description: "Feature details",
            kind: .feature
        )
        let fixItem = WhatsNewItem(
            icon: "bandage",
            tint: .red,
            title: "Crash Fix",
            description: "Fix details",
            kind: .fix
        )
        let improvementItem = WhatsNewItem(
            icon: "speedometer",
            tint: .green,
            title: "Performance",
            description: "Faster loads",
            kind: .improvement
        )

        XCTAssertEqual(featureItem.kind, .feature)
        XCTAssertEqual(fixItem.kind, .fix)
        XCTAssertEqual(improvementItem.kind, .improvement)
        XCTAssertEqual(featureItem.kind.rawValue, "Feature")
        XCTAssertEqual(fixItem.kind.rawValue, "Bug Fix")
        XCTAssertEqual(improvementItem.kind.rawValue, "Improvement")
    }

    func testBackwardCompatibleReleaseHistoryItemInit() {
        let legacyItems = [
            WhatsNewItem(icon: "star", tint: .yellow, title: "Feature 1", description: "Desc 1"),
            WhatsNewItem(icon: "bolt", tint: .orange, title: "Feature 2", description: "Desc 2")
        ]
        let legacyRelease = ReleaseHistoryItem(
            version: "1.0.0",
            date: "Jan 2026",
            tagline: "Initial Release",
            items: legacyItems
        )

        XCTAssertEqual(legacyRelease.features.count, 2)
        XCTAssertEqual(legacyRelease.improvementsAndFixes.count, 0)
        XCTAssertEqual(legacyRelease.items.count, 2)
    }

    func testShouldShowAutomaticallyLogic() {
        let defaults = UserDefaults.standard
        let original = defaults.string(forKey: WhatsNewView.lastSeenVersionKey)
        defer {
            if let original = original {
                defaults.set(original, forKey: WhatsNewView.lastSeenVersionKey)
            } else {
                defaults.removeObject(forKey: WhatsNewView.lastSeenVersionKey)
            }
        }

        // When version is different, should show automatically
        defaults.set("1.19.0", forKey: WhatsNewView.lastSeenVersionKey)
        XCTAssertTrue(WhatsNewView.shouldShowAutomatically)

        // When version matches current, should not show automatically
        defaults.set(WhatsNewView.currentVersion, forKey: WhatsNewView.lastSeenVersionKey)
        XCTAssertFalse(WhatsNewView.shouldShowAutomatically)
    }
}
