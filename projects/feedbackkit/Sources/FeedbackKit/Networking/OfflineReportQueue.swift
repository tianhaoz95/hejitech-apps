import Foundation
import Network

/// Representation of a pending feedback report spooled to disk while offline.
public struct QueuedReportItem: Codable, Identifiable, Sendable {
    public let id: UUID
    public let queuedAt: Date
    public let report: FeedbackReport
    public let configuration: FeedbackKitConfiguration

    public init(id: UUID = UUID(), queuedAt: Date = Date(), report: FeedbackReport, configuration: FeedbackKitConfiguration) {
        self.id = id
        self.queuedAt = queuedAt
        self.report = report
        self.configuration = configuration
    }
}

/// Disk-backed queue and network monitor that spools failed submissions during connectivity drops
/// and flushes them automatically when the network path is satisfied.
public final class OfflineReportQueue: @unchecked Sendable {
    public static let shared = OfflineReportQueue()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.feedbackkit.offline-queue", qos: .utility)
    private var isMonitoring = false
    public var maxPendingReports = 20

    public var storageDirectory: URL {
        let fileManager = FileManager.default
        let baseDir = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let dir = baseDir.appendingPathComponent("FeedbackKit/PendingReports", isDirectory: true)
        try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    public init() {}

    public func startMonitoring() {
        queue.async { [weak self] in
            guard let self, !self.isMonitoring else { return }
            self.isMonitoring = true
            self.monitor.pathUpdateHandler = { [weak self] path in
                if path.status == .satisfied {
                    self?.flush()
                }
            }
            self.monitor.start(queue: self.queue)
        }
    }

    public func enqueue(report: FeedbackReport, configuration: FeedbackKitConfiguration) {
        queue.async { [weak self] in
            guard let self else { return }
            let item = QueuedReportItem(report: report, configuration: configuration)
            self.saveItem(item)
            self.enforceLimit()
        }
    }

    public func saveItem(_ item: QueuedReportItem) {
        let fileURL = storageDirectory.appendingPathComponent("\(item.id.uuidString).json")
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(item)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            // failed to write
        }
    }

    private func enforceLimit() {
        let items = loadAllItems()
        if items.count > maxPendingReports {
            let toRemove = items.sorted(by: { $0.queuedAt < $1.queuedAt }).prefix(items.count - maxPendingReports)
            for item in toRemove {
                deleteItem(id: item.id)
            }
        }
    }

    public func pendingCount() -> Int {
        var count = 0
        queue.sync {
            count = (try? FileManager.default.contentsOfDirectory(atPath: storageDirectory.path).filter { $0.hasSuffix(".json") }.count) ?? 0
        }
        return count
    }

    public func loadAllItems() -> [QueuedReportItem] {
        let fileManager = FileManager.default
        guard let files = try? fileManager.contentsOfDirectory(at: storageDirectory, includingPropertiesForKeys: nil) else {
            return []
        }
        var items: [QueuedReportItem] = []
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        for file in files where file.pathExtension == "json" {
            if let data = try? Data(contentsOf: file),
               let item = try? decoder.decode(QueuedReportItem.self, from: data) {
                items.append(item)
            }
        }
        return items
    }

    public func deleteItem(id: UUID) {
        let fileURL = storageDirectory.appendingPathComponent("\(id.uuidString).json")
        try? FileManager.default.removeItem(at: fileURL)
    }

    public func clearAll() {
        queue.sync {
            let items = loadAllItems()
            for item in items {
                deleteItem(id: item.id)
            }
        }
    }

    public func flush() {
        queue.async { [weak self] in
            guard let self else { return }
            let items = self.loadAllItems().sorted(by: { $0.queuedAt < $1.queuedAt })
            for item in items {
                let semaphore = DispatchSemaphore(value: 0)
                FeedbackSubmitter.submitDirect(item.report, configuration: item.configuration) { [weak self] result in
                    switch result {
                    case .success:
                        self?.deleteItem(id: item.id)
                    case .failure(let error):
                        switch error {
                        case .network:
                            // Connectivity still down; stop iterating this cycle
                            break
                        case .server(let statusCode) where statusCode >= 400 && statusCode < 500 && statusCode != 429:
                            // Client rejected (bad key, invalid body), discard
                            self?.deleteItem(id: item.id)
                        default:
                            break
                        }
                    }
                    semaphore.signal()
                }
                _ = semaphore.wait(timeout: .now() + 15)
            }
        }
    }
}
