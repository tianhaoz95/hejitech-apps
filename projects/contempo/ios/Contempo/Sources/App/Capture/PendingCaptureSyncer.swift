import ContempoCore
import ContempoFirestore
import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage
import Foundation

/// Uploads every recording waiting in `PendingCaptureStore` to Firebase Storage,
/// then enqueues an `audioCaptures` Firestore document pointing to it.
@MainActor
public enum PendingCaptureSyncer {
    public static func syncAll() async {
        let pending = ServiceLocator.pendingCaptureStore.listPending()
        for capture in pending {
            _ = await syncOne(capture)
        }
    }

    @discardableResult
    public static func syncOne(_ pending: PendingCapture) async -> Bool {
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
            let timestamp = Timestamp(date: pending.capturedAt)
            try await ServiceLocator.audioCaptureQueue.enqueue(
                storagePath: storagePath,
                capturedAt: timestamp,
                lat: pending.lat,
                lng: pending.lng,
                language: pending.language
            )
        } catch {
            return false
        }

        ServiceLocator.pendingCaptureStore.delete(pending)
        return true
    }
}
