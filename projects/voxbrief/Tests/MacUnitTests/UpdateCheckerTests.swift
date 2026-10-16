import XCTest
@testable import VoxbriefMac

/// The monorepo publishes releases for several apps, so the update check has to pick Voxbrief's
/// newest `voxbrief-v` release with a DMG, never the repo's "latest" (another app's).
@MainActor
final class UpdateCheckerTests: XCTestCase {
    private func release(_ tag: String, dmg: Bool = true, draft: Bool = false, prerelease: Bool = false) -> GitHubRelease {
        GitHubRelease(
            tagName: tag,
            htmlUrl: "https://github.com/tianhaoz95/hejitech-apps/releases/tag/\(tag)",
            draft: draft,
            prerelease: prerelease,
            assets: dmg ? [GitHubReleaseAsset(name: "Voxbrief-1.0.0-arm64.dmg", browserDownloadUrl: "https://example.com/v.dmg")] : []
        )
    }

    func testPicksNewestVoxbriefReleaseAmongOtherProjects() {
        let releases = [
            release("waypack-v1.9.0"),
            release("voxbrief-v1.26.4"),
            release("feedbackkit-beta-portal-mac", prerelease: true),
            release("voxbrief-v1.27.0"),
            release("voxbrief-v1.26.10"),
        ]
        XCTAssertEqual(UpdateChecker.newestMacRelease(in: releases)?.tagName, "voxbrief-v1.27.0")
    }

    func testSkipsDraftsPrereleasesAndReleasesWithoutDMG() {
        let releases = [
            release("voxbrief-v1.30.0", draft: true),
            release("voxbrief-v1.29.0", prerelease: true),
            release("voxbrief-v1.28.0", dmg: false),
            release("voxbrief-v1.26.4"),
        ]
        XCTAssertEqual(UpdateChecker.newestMacRelease(in: releases)?.tagName, "voxbrief-v1.26.4")
        XCTAssertNil(UpdateChecker.newestMacRelease(in: [release("waypack-v1.9.0")]))
    }

    func testVersionParsingAcceptsBothTagStyles() {
        XCTAssertEqual(UpdateChecker.stripTagPrefix("voxbrief-v1.26.4"), "1.26.4")
        XCTAssertEqual(UpdateChecker.stripTagPrefix("v1.26.3"), "1.26.3")
        XCTAssertTrue(UpdateChecker.isVersion("voxbrief-v1.26.4", newerThan: "1.26.3"))
        XCTAssertFalse(UpdateChecker.isVersion("voxbrief-v1.26.3", newerThan: "1.26.3"))
        XCTAssertTrue(UpdateChecker.isVersion("1.26.10", newerThan: "1.26.9"))
    }
}
