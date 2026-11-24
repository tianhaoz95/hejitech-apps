import Foundation
import G2DigestKit
import WidgetKit

/// Persists recent editions and their audio files locally so the iPhone reader and player work offline.
public actor OfflineStore {
    public static let shared = OfflineStore()
    private let maxCachedEditions = 5
    private let rootDir: URL

    public init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first ?? URL(fileURLWithPath: NSTemporaryDirectory())
        self.rootDir = caches.appendingPathComponent("G2DigestOffline", isDirectory: true)
        try? FileManager.default.createDirectory(at: rootDir, withIntermediateDirectories: true)
    }

    private func editionFile(for date: String) -> URL {
        rootDir.appendingPathComponent("edition-\(date).json")
    }

    private func audioFile(for audioPath: String) -> URL {
        let safe = audioPath.replacingOccurrences(of: "/", with: "__")
        return rootDir.appendingPathComponent("audio-\(safe)")
    }

    public func save(bundle: BundleData, audioURLs: [String: String]) async {
        if let data = try? JSONEncoder().encode(bundle) {
            try? data.write(to: editionFile(for: bundle.date), options: .atomic)
        }
        // Save lightweight widget snapshot for Home Screen / Lock Screen widgets & Siri intents.
        let snap = WidgetEditionSnapshot.from(bundle: bundle)
        if let snapData = try? JSONEncoder().encode(snap) {
            UserDefaults.standard.set(snapData, forKey: WidgetEditionSnapshot.storageKey)
            WidgetCenter.shared.reloadAllTimelines()
        }
        // Pre-download audio files in the background (best effort).
        for (path, urlString) in audioURLs {
            let dest = audioFile(for: path)
            if FileManager.default.fileExists(atPath: dest.path) { continue }
            guard let url = URL(string: urlString) else { continue }
            if let (tmp, resp) = try? await URLSession.shared.download(from: url),
               let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                try? FileManager.default.removeItem(at: dest)
                try? FileManager.default.moveItem(at: tmp, to: dest)
            }
        }
        pruneOldEditions()
    }

    public func loadEdition(date: String) -> BundleData? {
        guard let data = try? Data(contentsOf: editionFile(for: date)) else { return nil }
        return try? JSONDecoder().decode(BundleData.self, from: data)
    }

    public func loadLatestEdition() -> BundleData? {
        loadAllCachedEditions().first
    }

    public func loadAllCachedEditions() -> [BundleData] {
        let files = (try? FileManager.default.contentsOfDirectory(at: rootDir, includingPropertiesForKeys: nil)) ?? []
        let editions = files
            .filter { $0.lastPathComponent.hasPrefix("edition-") && $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent > $1.lastPathComponent }
        return editions.compactMap { url in
            guard let data = try? Data(contentsOf: url) else { return nil }
            return try? JSONDecoder().decode(BundleData.self, from: data)
        }
    }

    public nonisolated func localAudioURL(for audioPath: String) -> URL? {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let safe = audioPath.replacingOccurrences(of: "/", with: "__")
        let dest = caches.appendingPathComponent("G2DigestOffline", isDirectory: true).appendingPathComponent("audio-\(safe)")
        return FileManager.default.fileExists(atPath: dest.path) ? dest : nil
    }

    public func clearAll() {
        try? FileManager.default.removeItem(at: rootDir)
        try? FileManager.default.createDirectory(at: rootDir, withIntermediateDirectories: true)
        UserDefaults.standard.removeObject(forKey: WidgetEditionSnapshot.storageKey)
        WidgetCenter.shared.reloadAllTimelines()
    }

    private func pruneOldEditions() {
        let files = (try? FileManager.default.contentsOfDirectory(at: rootDir, includingPropertiesForKeys: nil)) ?? []
        let editions = files
            .filter { $0.lastPathComponent.hasPrefix("edition-") && $0.pathExtension == "json" }
            .sorted { $0.lastPathComponent > $1.lastPathComponent }
        guard editions.count > maxCachedEditions else { return }
        for old in editions.dropFirst(maxCachedEditions) {
            try? FileManager.default.removeItem(at: old)
        }
    }
}
