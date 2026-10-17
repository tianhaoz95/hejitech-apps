import ContempoCore
import Foundation
import Observation

public struct PendingCapture: Sendable, Identifiable, Equatable {
    public let id: String
    public let fileURL: URL
    public let capturedAt: Date
    public let lat: Double?
    public let lng: Double?
    public let language: CaptureLanguage

    public init(id: String, fileURL: URL, capturedAt: Date, lat: Double? = nil, lng: Double? = nil, language: CaptureLanguage = .auto) {
        self.id = id
        self.fileURL = fileURL
        self.capturedAt = capturedAt
        self.lat = lat
        self.lng = lng
        self.language = language
    }
}

/// Durable local queue of recorded-but-not-yet-uploaded WAV files for iOS
/// Quick Capture mode — mirrors Android's `PendingCaptureStore`.
@Observable
@MainActor
public final class PendingCaptureStore {
    private let directoryURL: URL
    public private(set) var pendingTodayCount: Int = 0

    public init() {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        self.directoryURL = documents.appendingPathComponent("pendingCaptures", isDirectory: true)
        try? FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        self.pendingTodayCount = computePendingTodayCount()
    }

    @discardableResult
    public func save(wavData: Data, lat: Double? = nil, lng: Double? = nil, language: CaptureLanguage = .auto) -> PendingCapture {
        let id = UUID().uuidString
        let fileURL = directoryURL.appendingPathComponent("\(id).wav")
        let metaURL = directoryURL.appendingPathComponent("\(id).meta.json")

        try? wavData.write(to: fileURL)

        var metaDict: [String: Any] = ["language": language.firestoreValue]
        if let lat { metaDict["lat"] = lat }
        if let lng { metaDict["lng"] = lng }

        if let jsonObject = try? JSONSerialization.data(withJSONObject: metaDict) {
            try? jsonObject.write(to: metaURL)
        }

        self.pendingTodayCount = computePendingTodayCount()
        return PendingCapture(id: id, fileURL: fileURL, capturedAt: Date(), lat: lat, lng: lng, language: language)
    }

    public func listPending() -> [PendingCapture] {
        guard let files = try? FileManager.default.contentsOfDirectory(at: directoryURL, includingPropertiesForKeys: [.contentModificationDateKey]) else {
            return []
        }

        let wavFiles = files.filter { $0.pathExtension.lowercased() == "wav" }
        return wavFiles.compactMap { fileURL -> PendingCapture? in
            let id = fileURL.deletingPathExtension().lastPathComponent
            let metaURL = directoryURL.appendingPathComponent("\(id).meta.json")

            let modDate = (try? fileURL.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? Date()

            var lat: Double?
            var lng: Double?
            var language: CaptureLanguage = .auto

            if let metaData = try? Data(contentsOf: metaURL),
               let json = try? JSONSerialization.jsonObject(with: metaData) as? [String: Any] {
                lat = json["lat"] as? Double
                lng = json["lng"] as? Double
                if let langStr = json["language"] as? String {
                    language = CaptureLanguage(firestoreValue: langStr)
                }
            }

            return PendingCapture(id: id, fileURL: fileURL, capturedAt: modDate, lat: lat, lng: lng, language: language)
        }.sorted { $0.capturedAt < $1.capturedAt }
    }

    public func delete(_ pending: PendingCapture) {
        let metaURL = directoryURL.appendingPathComponent("\(pending.id).meta.json")
        try? FileManager.default.removeItem(at: pending.fileURL)
        try? FileManager.default.removeItem(at: metaURL)
        self.pendingTodayCount = computePendingTodayCount()
    }

    private func computePendingTodayCount() -> Int {
        let calendar = Calendar.current
        return listPending().filter { calendar.isDateInToday($0.capturedAt) }.count
    }
}
