import FirebaseAuth
import Foundation

/// Watch-side read counterpart to `WatchAudioCaptureQueueWriter` — the
/// Firestore SDK isn't available on watchOS (see that type's doc comment),
/// so there's no real-time listener available here the way Android Wear's
/// `WearCaptureViewModel.observeProgress()` gets via the full SDK. Instead,
/// this does a one-shot REST "list documents" fetch and sums confirmed hours
/// client-side — good enough for a periodic progress refresh (on launch, and
/// whenever the complication timeline reloads), not a live listener.
public final class WatchEntryStatsReader: Sendable {
    private let projectId: String
    private let emulatorHost: String?
    private let auth: Auth

    public init(projectId: String, emulatorHost: String?, auth: Auth = Auth.auth()) {
        self.projectId = projectId
        self.emulatorHost = emulatorHost
        self.auth = auth
    }

    private var documentsBaseURL: String {
        if let emulatorHost {
            return "http://\(emulatorHost):8080/v1/projects/\(projectId)/databases/(default)/documents"
        }
        return "https://firestore.googleapis.com/v1/projects/\(projectId)/databases/(default)/documents"
    }

    /// Sum of `durationMinutes` across every entry with `status == "confirmed"`, in hours.
    public func confirmedHours() async -> Double {
        guard let uid = auth.currentUser?.uid, let idToken = try? await auth.currentUser?.getIDToken() else { return 0 }

        var totalMinutes = 0
        var pageToken: String?
        repeat {
            var components = URLComponents(string: "\(documentsBaseURL)/users/\(uid)/entries")!
            var queryItems = [URLQueryItem(name: "pageSize", value: "300")]
            if let pageToken { queryItems.append(URLQueryItem(name: "pageToken", value: pageToken)) }
            components.queryItems = queryItems

            var request = URLRequest(url: components.url!)
            request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")

            guard
                let (data, response) = try? await URLSession.shared.data(for: request),
                let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                return Double(totalMinutes) / 60.0
            }

            let documents = json["documents"] as? [[String: Any]] ?? []
            for document in documents {
                guard let fields = document["fields"] as? [String: Any] else { continue }
                let status = (fields["status"] as? [String: Any])?["stringValue"] as? String
                guard status == "confirmed" else { continue }
                let durationString = (fields["durationMinutes"] as? [String: Any])?["integerValue"] as? String
                totalMinutes += durationString.flatMap(Int.init) ?? 0
            }
            pageToken = json["nextPageToken"] as? String
        } while pageToken != nil

        return Double(totalMinutes) / 60.0
    }
}
