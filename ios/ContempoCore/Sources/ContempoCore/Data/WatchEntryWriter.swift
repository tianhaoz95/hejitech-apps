@preconcurrency import FirebaseAuth
import Foundation

public enum WatchEntryWriterError: Error, Sendable {
    case notSignedIn
    case requestFailed(String)
    case malformedResponse
}

/// Watch-side write counterpart to `WatchEntryStatsReader` — writes completed
/// work and trip entries to `users/{uid}/entries` over Firestore's plain REST API.
public final class WatchEntryWriter: Sendable {
    private let projectId: String
    private let emulatorHost: String?
    private let customAuth: Auth?

    public init(projectId: String, emulatorHost: String?, auth: Auth? = nil) {
        self.projectId = projectId
        self.emulatorHost = emulatorHost
        self.customAuth = auth
    }

    private var auth: Auth {
        customAuth ?? Auth.auth()
    }

    private var activeProjectId: String {
        if !projectId.isEmpty { return projectId }
        return "contempo-str"
    }

    private var documentsBaseURL: String {
        if let emulatorHost {
            return "http://\(emulatorHost):8080/v1/projects/\(activeProjectId)/databases/(default)/documents"
        }
        return "https://firestore.googleapis.com/v1/projects/\(activeProjectId)/databases/(default)/documents"
    }

    @discardableResult
    public func saveConfirmedEntry(
        task: String,
        durationMinutes: Int,
        category: String = EntryCategory.admin.firestoreValue,
        isTrip: Bool = false,
        source: String = CaptureSource.manual.firestoreValue,
        startedAt: Date,
        stoppedAt: Date = Date()
    ) async throws -> String {
        guard let uid = auth.currentUser?.uid, let idToken = try? await auth.currentUser?.getIDToken() else {
            throw WatchEntryWriterError.notSignedIn
        }

        let url = URL(string: "\(documentsBaseURL)/users/\(uid)/entries")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let isoFormatter = ISO8601DateFormatter()
        let fields: [String: Any] = [
            "propertyId": ["stringValue": ""],
            "propertyName": ["stringValue": ""],
            "task": ["stringValue": task],
            "durationMinutes": ["integerValue": "\(durationMinutes)"],
            "category": ["stringValue": category],
            "status": ["stringValue": EntryStatus.confirmed.firestoreValue],
            "source": ["stringValue": source],
            "activityDate": ["timestampValue": isoFormatter.string(from: startedAt)],
            "loggedAt": ["timestampValue": isoFormatter.string(from: stoppedAt)],
            "confirmedAt": ["timestampValue": isoFormatter.string(from: stoppedAt)],
            "isVague": ["booleanValue": false],
            "isBackfilled": ["booleanValue": false],
            "daysLate": ["integerValue": "0"],
            "riskReasons": ["arrayValue": ["values": [] as [Any]]],
            "photoUrls": ["arrayValue": ["values": [] as [Any]]],
            "inProgress": ["booleanValue": false],
            "isTrip": ["booleanValue": isTrip],
            "mileageCaptureMethod": ["stringValue": isTrip ? "gps" : ""],
            "miles": ["doubleValue": 0.0],
            "audioUrl": ["stringValue": ""],
            "rawTranscript": ["stringValue": ""],
            "stoppedAt": ["timestampValue": isoFormatter.string(from: stoppedAt)]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: ["fields": fields])

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw WatchEntryWriterError.requestFailed(body)
        }
        guard
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let name = json["name"] as? String,
            let documentId = name.split(separator: "/").last
        else {
            throw WatchEntryWriterError.malformedResponse
        }
        return String(documentId)
    }
}
