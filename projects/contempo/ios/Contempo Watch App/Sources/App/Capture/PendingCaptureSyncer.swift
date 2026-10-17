import ContempoCore
import Foundation

public enum SyncResult: Sendable {
    case success
    case notSignedIn
    case fileReadFailed
    case storageError(String)
    case queueWriterError(String)

    public var isSuccess: Bool {
        if case .success = self { return true }
        return false
    }

    public var errorMessage: String {
        switch self {
        case .success: return ""
        case .notSignedIn: return "Watch not signed in — open phone app to pair"
        case .fileReadFailed: return "Could not read audio file"
        case .storageError(let msg): return "Storage upload error: \(msg)"
        case .queueWriterError(let msg): return "Queue writer error: \(msg)"
        }
    }
}

/// Uploads every recording still waiting in `PendingCaptureStore` to
/// Firebase Storage, then enqueues an `audioCaptures` queue doc pointing at
/// it — the watch-side port of Android Wear's `PendingCaptureSyncer`.
/// Deliberately does not transcribe/parse/build an Entry here — only the
/// phone can do that (on-device Whisper + Gemma), and there's no back-
/// channel to return a result to the watch, so that whole pipeline runs
/// entirely phone-side.
@MainActor
public enum PendingCaptureSyncer {
    @discardableResult
    public static func syncAll() async -> SyncResult {
        var lastResult: SyncResult = .success
        for pending in WatchServiceLocator.pendingCaptureStore.listPending() {
            let result = await syncOne(pending)
            if !result.isSuccess {
                lastResult = result
            }
        }
        return lastResult
    }

    @discardableResult
    public static func syncOne(_ pending: PendingCapture) async -> SyncResult {
        guard let uid = ContempoBackend.uid else {
            #if DEBUG
            print("[PendingCaptureSyncer] Sync failed: User not signed in")
            #endif
            return .notSignedIn
        }

        guard let wavData = try? Data(contentsOf: pending.fileURL) else {
            #if DEBUG
            print("[PendingCaptureSyncer] Sync failed: Could not read WAV file at \(pending.fileURL.path)")
            #endif
            return .fileReadFailed
        }

        let storagePath = "\(uid)/audio/\(pending.id).wav"

        do {
            _ = try await ContempoBackend.uploadFile(path: storagePath, data: wavData, contentType: "audio/wav")
        } catch {
            #if DEBUG
            print("[PendingCaptureSyncer] Storage upload error for \(pending.id): \(error)")
            #endif
            return .storageError(error.localizedDescription)
        }

        do {
            try await WatchServiceLocator.audioCaptureQueueWriter.enqueue(
                storagePath: storagePath, capturedAt: pending.capturedAt, lat: pending.lat, lng: pending.lng
            )
        } catch {
            #if DEBUG
            print("[PendingCaptureSyncer] Queue writer enqueue error for \(pending.id): \(error)")
            #endif
            return .queueWriterError(error.localizedDescription)
        }

        WatchServiceLocator.pendingCaptureStore.delete(pending)
        WatchServiceLocator.uploadStatsStore.recordUpload()
        #if DEBUG
        print("[PendingCaptureSyncer] Successfully uploaded pending capture \(pending.id)")
        #endif
        return .success
    }
}
