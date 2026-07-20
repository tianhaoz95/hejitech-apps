import Foundation

/// A recording saved locally but not yet durably uploaded. `id` doubles as
/// the eventual Storage object name (`{id}.wav`) so the sync step doesn't
/// need to invent one later.
struct PendingCapture: Sendable {
    let id: String
    let fileURL: URL
    let capturedAt: Date
    let lat: Double?
    let lng: Double?
}

/// watchOS port of Android Wear's `PendingCaptureStore` — durable-before-
/// upload local storage for a just-recorded WAV, so a recording survives a
/// process death or lost connectivity between "stop" and a successful
/// Storage upload. One `.wav` file plus a sidecar `.json` of capture
/// metadata per pending recording, both in the app's Documents directory.
final class PendingCaptureStore {
    private let directory: URL

    init() {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        directory = documents.appendingPathComponent("PendingCaptures", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    @discardableResult
    func save(wav: Data, lat: Double?, lng: Double?) -> PendingCapture {
        let id = UUID().uuidString
        let fileURL = directory.appendingPathComponent("\(id).wav")
        let metadataURL = directory.appendingPathComponent("\(id).json")
        let capturedAt = Date()

        try? wav.write(to: fileURL)
        let metadata = PendingCaptureMetadata(capturedAt: capturedAt, lat: lat, lng: lng)
        if let metadataData = try? JSONEncoder().encode(metadata) {
            try? metadataData.write(to: metadataURL)
        }

        return PendingCapture(id: id, fileURL: fileURL, capturedAt: capturedAt, lat: lat, lng: lng)
    }

    func listPending() -> [PendingCapture] {
        guard let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return [] }
        return files
            .filter { $0.pathExtension == "wav" }
            .compactMap { fileURL in
                let id = fileURL.deletingPathExtension().lastPathComponent
                let metadataURL = directory.appendingPathComponent("\(id).json")
                guard
                    let metadataData = try? Data(contentsOf: metadataURL),
                    let metadata = try? JSONDecoder().decode(PendingCaptureMetadata.self, from: metadataData)
                else {
                    return PendingCapture(id: id, fileURL: fileURL, capturedAt: Date(), lat: nil, lng: nil)
                }
                return PendingCapture(id: id, fileURL: fileURL, capturedAt: metadata.capturedAt, lat: metadata.lat, lng: metadata.lng)
            }
    }

    func delete(_ pending: PendingCapture) {
        try? FileManager.default.removeItem(at: pending.fileURL)
        try? FileManager.default.removeItem(at: directory.appendingPathComponent("\(pending.id).json"))
    }
}

private struct PendingCaptureMetadata: Codable {
    let capturedAt: Date
    let lat: Double?
    let lng: Double?
}
