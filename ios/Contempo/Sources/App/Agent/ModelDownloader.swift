import Foundation

/// Downloads the Gemma 4 E2B `.litertlm` model file (~2.6GB, hosted publicly
/// on Hugging Face — no self-hosting needed, Apache 2.0 licensed) via a
/// background `URLSession`, which handles HTTP range-request resume, retry,
/// and survival across app suspension at the OS level — same reasoning
/// Android's `ModelDownloader` gives for using `DownloadManager` rather than
/// hand-rolling a multi-GB transfer.
///
/// Wi-Fi-only by default (`allowsCellularAccess = false`): a multi-GB
/// download silently starting over cellular on first launch is the kind of
/// thing that should not be the default without the user having said so.
@Observable
@MainActor
final class ModelDownloader: NSObject {
    // Generic (non-chip-specific) build — broadest device compatibility.
    // Size confirmed directly via Hugging Face's x-linked-size response
    // header, not estimated.
    static let modelURL = URL(string: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm")!
    static let modelSizeBytes: Int64 = 2_588_147_712
    private static let freeSpaceBufferBytes: Int64 = 500 * 1024 * 1024

    enum State: Equatable {
        case notStarted
        case downloading(bytesDownloaded: Int64, totalBytes: Int64)
        case completed
        case failed(String)
    }

    private(set) var state: State = .notStarted

    @ObservationIgnored
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: "com.hejitech.contempo.model-download")
        config.allowsCellularAccess = false
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private var continuation: CheckedContinuation<Void, Error>?

    var modelFile: URL { Self.resolveModelFile() }

    /// Not actor-isolated so `urlSession(_:downloadTask:didFinishDownloadingTo:)`
    /// can call it synchronously — that delegate callback must move the temp
    /// file to its destination before returning, since the system deletes
    /// the temp file immediately afterward; hopping to the main actor first
    /// would lose the race.
    nonisolated static func resolveModelFile() -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("models", isDirectory: true)
            .appendingPathComponent("gemma-4-E2B-it.litertlm")
    }

    func isDownloaded() -> Bool {
        guard let size = try? FileManager.default.attributesOfItem(atPath: modelFile.path)[.size] as? Int64 else {
            return false
        }
        return size >= Self.modelSizeBytes
    }

    func hasEnoughFreeSpace() -> Bool {
        let dir = modelFile.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        guard let free = try? dir.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
            .volumeAvailableCapacityForImportantUsage else {
            return true
        }
        return free > Self.modelSizeBytes + Self.freeSpaceBufferBytes
    }

    func start() async {
        if isDownloaded() {
            state = .completed
            return
        }
        guard hasEnoughFreeSpace() else {
            state = .failed("Not enough free storage for the on-device model — needs about 2.6GB free.")
            return
        }
        state = .downloading(bytesDownloaded: 0, totalBytes: Self.modelSizeBytes)
        do {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                self.continuation = continuation
                let task = session.downloadTask(with: Self.modelURL)
                task.resume()
            }
            state = .completed
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

extension ModelDownloader: URLSessionDownloadDelegate {
    nonisolated func urlSession(
        _ session: URLSession,
        downloadTask: URLSessionDownloadTask,
        didWriteData bytesWritten: Int64,
        totalBytesWritten: Int64,
        totalBytesExpectedToWrite: Int64
    ) {
        Task { @MainActor in
            let total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : Self.modelSizeBytes
            state = .downloading(bytesDownloaded: totalBytesWritten, totalBytes: total)
        }
    }

    nonisolated func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        // Must move the temp file synchronously, before returning — the
        // system deletes it immediately after this callback (see
        // `resolveModelFile()`'s doc comment).
        let destination = Self.resolveModelFile()
        let moveError: Error?
        do {
            try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.moveItem(at: location, to: destination)
            moveError = nil
        } catch {
            moveError = error
        }
        Task { @MainActor in
            if let moveError {
                continuation?.resume(throwing: moveError)
            } else {
                continuation?.resume()
            }
            continuation = nil
        }
    }

    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let error else { return }
        Task { @MainActor in
            continuation?.resume(throwing: error)
            continuation = nil
        }
    }
}
