@preconcurrency import FirebaseAuth
import Foundation

/// Watch-side counterpart to `ContempoFirestore`'s (SDK-based)
/// `AudioCaptureQueue` — writes the same `users/{uid}/audioCaptures` queue
/// doc shape, but over Firestore's plain REST API instead of the Firestore
/// SDK, since the Firestore SDK doesn't build for watchOS at all (its
/// gRPC/leveldb/abseil native dependencies have no watchOS slice — confirmed
/// against firebase-ios-sdk's own `Package.swift`, which conditions the
/// `FirebaseFirestoreTarget` dependency to iOS/tvOS/macOS/macCatalyst only).
/// `FirebaseAuth` (used here for the uid and ID token) has no such
/// restriction and builds for watchOS fine.
///
/// The phone's existing (SDK-based) queue-drain logic needs zero changes to
/// consume a doc written this way — same collection, same field names/types,
/// same wire encoding Firestore's own SDK would produce.
public final class WatchAudioCaptureQueueWriter: Sendable {
    private let projectId: String
    private let emulatorHost: String?
    private let auth: Auth

    /// - Parameters:
    ///   - projectId: `FirebaseApp.app()?.options.projectID` — passed in
    ///     rather than read here so this type has no `FirebaseCore` import.
    ///   - emulatorHost: non-nil (typically `"localhost"`) when
    ///     `USE_FIREBASE_EMULATOR` is set, matching `FirebaseBootstrap`'s own
    ///     dual-path convention. The Firestore emulator serves the identical
    ///     REST surface on its Firestore port, over plain HTTP.
    public init(projectId: String, emulatorHost: String?, auth: Auth = Auth.auth()) {
        self.projectId = projectId
        self.emulatorHost = emulatorHost
        self.auth = auth
    }

    private var uid: String {
        get throws {
            guard let uid = auth.currentUser?.uid else {
                throw WatchAudioCaptureQueueWriterError.notSignedIn
            }
            return uid
        }
    }

    private var documentsBaseURL: String {
        if let emulatorHost {
            return "http://\(emulatorHost):8080/v1/projects/\(projectId)/databases/(default)/documents"
        }
        return "https://firestore.googleapis.com/v1/projects/\(projectId)/databases/(default)/documents"
    }

    @discardableResult
    public func enqueue(storagePath: String, capturedAt: Date, lat: Double?, lng: Double?, language: CaptureLanguage = .auto) async throws -> String {
        let uid = try uid
        let idToken = try await auth.currentUser?.getIDToken()
        guard let idToken else { throw WatchAudioCaptureQueueWriterError.notSignedIn }

        let url = URL(string: "\(documentsBaseURL)/users/\(uid)/audioCaptures")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var fields: [String: Any] = [
            "storagePath": ["stringValue": storagePath],
            "capturedAt": ["timestampValue": ISO8601DateFormatter().string(from: capturedAt)],
            "language": ["stringValue": language.firestoreValue],
        ]
        fields["lat"] = lat.map { ["doubleValue": $0] } ?? ["nullValue": NSNull()]
        fields["lng"] = lng.map { ["doubleValue": $0] } ?? ["nullValue": NSNull()]
        request.httpBody = try JSONSerialization.data(withJSONObject: ["fields": fields])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw WatchAudioCaptureQueueWriterError.requestFailed(body)
        }
        guard
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let name = json["name"] as? String,
            let documentId = name.split(separator: "/").last
        else {
            throw WatchAudioCaptureQueueWriterError.malformedResponse
        }
        return String(documentId)
    }
}

public enum WatchAudioCaptureQueueWriterError: Error, Sendable {
    case notSignedIn
    case requestFailed(String)
    case malformedResponse
}
