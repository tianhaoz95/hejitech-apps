import FirebaseAuth
import FirebaseStorage
import Foundation

/// Uploads every recording still waiting in `PendingCaptureStore` to
/// Firebase Storage, then enqueues an `audioCaptures` queue doc pointing at
/// it — the watch-side port of Android Wear's `PendingCaptureSyncer`.
/// Deliberately does not transcribe/parse/build an Entry here — only the
/// phone can do that (on-device Whisper + Gemma), and there's no back-
/// channel to return a result to the watch, so that whole pipeline runs
/// entirely phone-side (see `AudioCaptureProcessor.kt`'s Android analogue;
/// the iOS phone app's equivalent drain logic already consumes this exact
/// same queue-doc contract with zero changes needed, regardless of which
/// platform's watch wrote it).
@MainActor
enum PendingCaptureSyncer {
    static func syncAll() async {
        for pending in WatchServiceLocator.pendingCaptureStore.listPending() {
            _ = await syncOne(pending)
        }
    }

    @discardableResult
    static func syncOne(_ pending: PendingCapture) async -> Bool {
        guard let uid = Auth.auth().currentUser?.uid else { return false }
        guard let wavData = try? Data(contentsOf: pending.fileURL) else { return false }

        let storagePath = "users/\(uid)/audioCaptures/\(pending.id).wav"
        let metadata = StorageMetadata()
        metadata.contentType = "audio/wav"

        do {
            _ = try await Storage.storage().reference(withPath: storagePath).putDataAsync(wavData, metadata: metadata)
        } catch {
            return false
        }

        do {
            try await WatchServiceLocator.audioCaptureQueueWriter.enqueue(
                storagePath: storagePath, capturedAt: pending.capturedAt, lat: pending.lat, lng: pending.lng
            )
        } catch {
            return false
        }

        WatchServiceLocator.pendingCaptureStore.delete(pending)
        WatchServiceLocator.uploadStatsStore.recordUpload()
        return true
    }
}
