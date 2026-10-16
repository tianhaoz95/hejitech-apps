import Foundation

/// Checks GitHub Releases for a newer macOS build than the one currently running.
///
/// Deliberately not Sparkle: at this app's current size, hitting GitHub's public Releases API
/// directly and opening the `.dmg`/release page in the browser is far less to set up and maintain
/// than an appcast feed plus EdDSA signing keys.
///
/// Voxbrief lives in the HEJI monorepo (`tianhaoz95/hejitech-apps`), which publishes releases for
/// several apps: the repo's "latest" release belongs to another app, so this lists recent releases
/// and takes the newest published `voxbrief-v<version>` one with a `.dmg` attached (the root
/// `scripts/cut_release.sh voxbrief` creates it; `voxbrief-mac-release.yml` attaches the DMG).
/// Builds up to 1.26.3 still check the archived `tianhaoz95/voxbrief` repo, which got a final
/// release pointing them here.
@MainActor
public final class UpdateChecker: ObservableObject {
    public static let shared = UpdateChecker()

    public struct AvailableUpdate: Equatable {
        public let version: String
        public let releasePageURL: URL
        public let downloadURL: URL
    }

    public enum CheckState: Equatable {
        case idle
        case checking
        case upToDate
        case updateAvailable(AvailableUpdate)
        case failed(String)
    }

    @Published public private(set) var state: CheckState = .idle
    @Published public private(set) var lastCheckedAt: Date?

    private let repoSlug: String
    private let currentVersion: String
    private let session: URLSession

    public init(
        repoSlug: String = "tianhaoz95/hejitech-apps",
        currentVersion: String = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "0.0.0",
        session: URLSession = .shared
    ) {
        self.repoSlug = repoSlug
        self.currentVersion = currentVersion
        self.session = session
    }

    public func checkNow() async {
        state = .checking
        do {
            let url = URL(string: "https://api.github.com/repos/\(repoSlug)/releases?per_page=100")!
            var request = URLRequest(url: url)
            request.setValue("application/vnd.github+json", forHTTPHeaderField: "Accept")

            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                throw URLError(.badServerResponse)
            }

            let releases = try JSONDecoder().decode([GitHubRelease].self, from: data)
            guard let release = Self.newestMacRelease(in: releases),
                  let dmgAsset = release.assets.first(where: { $0.name.lowercased().hasSuffix(".dmg") }),
                  let downloadURL = URL(string: dmgAsset.browserDownloadUrl),
                  let releasePageURL = URL(string: release.htmlUrl) else {
                // No Voxbrief release with a macOS build attached yet -- nothing to offer.
                state = .upToDate
                lastCheckedAt = Date()
                return
            }
            let latestVersion = Self.stripTagPrefix(release.tagName)

            if Self.isVersion(latestVersion, newerThan: currentVersion) {
                state = .updateAvailable(AvailableUpdate(version: latestVersion, releasePageURL: releasePageURL, downloadURL: downloadURL))
            } else {
                state = .upToDate
            }
            lastCheckedAt = Date()
        } catch {
            state = .failed(error.localizedDescription)
            lastCheckedAt = Date()
        }
    }

    /// Pure, dependency-free SemVer-ish comparison so it's trivially sanity-checkable without a
    /// network call or a Mac test target: true if `candidate` is a strictly newer version than
    /// `current`. Missing/non-numeric components are treated as 0 rather than failing outright, so
    /// an unexpected tag format degrades to "not newer" instead of crashing the check.
    static func isVersion(_ candidate: String, newerThan current: String) -> Bool {
        let candidateParts = versionComponents(candidate)
        let currentParts = versionComponents(current)
        for index in 0..<max(candidateParts.count, currentParts.count) {
            let c = index < candidateParts.count ? candidateParts[index] : 0
            let d = index < currentParts.count ? currentParts[index] : 0
            if c != d { return c > d }
        }
        return false
    }

    static func versionComponents(_ version: String) -> [Int] {
        stripTagPrefix(version).split(separator: ".").map { Int($0) ?? 0 }
    }

    /// Voxbrief's release tags in the monorepo: `voxbrief-v1.26.4`.
    static let tagPrefix = "voxbrief-v"

    /// The newest published (not draft, not prerelease) Voxbrief release that has a `.dmg`.
    static func newestMacRelease(in releases: [GitHubRelease]) -> GitHubRelease? {
        releases
            .filter { $0.tagName.hasPrefix(tagPrefix) && !$0.draft && !$0.prerelease }
            .filter { $0.assets.contains { $0.name.lowercased().hasSuffix(".dmg") } }
            .max { isVersion($1.tagName, newerThan: $0.tagName) }
    }

    /// `voxbrief-v1.2.3` (monorepo tags) or `v1.2.3` (the archived repo's) → `1.2.3`.
    static func stripTagPrefix(_ tag: String) -> String {
        var t = tag
        if t.hasPrefix(tagPrefix) { t = String(t.dropFirst(tagPrefix.count)) }
        return t.hasPrefix("v") ? String(t.dropFirst()) : t
    }
}

struct GitHubRelease: Decodable {
    let tagName: String
    let htmlUrl: String
    let draft: Bool
    let prerelease: Bool
    let assets: [GitHubReleaseAsset]

    enum CodingKeys: String, CodingKey {
        case tagName = "tag_name"
        case htmlUrl = "html_url"
        case draft, prerelease
        case assets
    }
}

struct GitHubReleaseAsset: Decodable {
    let name: String
    let browserDownloadUrl: String

    enum CodingKeys: String, CodingKey {
        case name
        case browserDownloadUrl = "browser_download_url"
    }
}
