import Foundation
import LogCore

/// What another caregiver is doing right now, heard over Supabase Realtime broadcast. Nothing is
/// stored: it's a heads-up ("Alex is making a bottle") that expires on its own.
struct PartnerActivity: Identifiable, Equatable, Codable {
    var id: String { "\(caregiver)-\(kind)" }
    let caregiver: UUID
    /// `prepping_bottle` (said so from the Start bottle tile); more kinds can follow.
    let kind: String
    let babies: [UUID]
    let at: Date
    let until: Date
}

/// A household-wide Realtime channel (broadcast only, `self: false`) used for two things:
/// short-lived heads-ups between caregivers, and a "changed" ping after every write so the other
/// phones sync within a second instead of on their next refresh. It's best effort: offline, or if
/// Realtime refuses the channel, the outbox and the normal sync carry on exactly as before.
@MainActor
final class PresenceChannel {
    private var task: URLSessionWebSocketTask?
    private var heartbeat: Task<Void, Never>?
    private var retry: Task<Void, Never>?
    private var ref = 0
    private var topic = ""
    private var wanted = false
    private var failures = 0
    private var config: (url: URL, anonKey: String, token: String?)?

    var onActivity: ((PartnerActivity) -> Void)?
    /// Another phone wrote something (the caregiver who did): sync now.
    var onChanged: ((UUID?) -> Void)?

    /// Joins `weehours:<household>`. Safe to call repeatedly.
    func connect(household: UUID, url: URL, anonKey: String, token: String?) {
        let topic = "realtime:weehours:\(household.uuidString.lowercased())"
        if wanted, topic == self.topic, task != nil { return }
        disconnect()
        wanted = true
        self.topic = topic
        config = (url, anonKey, token)
        open()
    }

    func disconnect() {
        wanted = false
        retry?.cancel()
        heartbeat?.cancel()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }

    func send(_ event: String, _ payload: [String: Any]) {
        guard task != nil else { return }
        push(event: "broadcast", payload: ["type": "broadcast", "event": event, "payload": payload])
    }

    private func open() {
        guard let config, var c = URLComponents(url: config.url.appendingPathComponent("realtime/v1/websocket"), resolvingAgainstBaseURL: false) else { return }
        c.scheme = c.scheme == "http" ? "ws" : "wss"
        c.queryItems = [URLQueryItem(name: "apikey", value: config.anonKey), URLQueryItem(name: "vsn", value: "1.0.0")]
        guard let url = c.url else { return }
        let task = URLSession.shared.webSocketTask(with: url)
        self.task = task
        task.resume()
        var join: [String: Any] = ["config": ["broadcast": ["self": false, "ack": false], "presence": ["key": ""], "private": false]]
        if let token = config.token { join["access_token"] = token }
        push(event: "phx_join", payload: join)
        receive(task)
        heartbeat?.cancel()
        heartbeat = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(25))
                guard let self, !Task.isCancelled else { return }
                self.push(topic: "phoenix", event: "heartbeat", payload: [:])
            }
        }
    }

    private func push(topic: String? = nil, event: String, payload: [String: Any]) {
        ref += 1
        let msg: [String: Any] = ["topic": topic ?? self.topic, "event": event, "payload": payload, "ref": "\(ref)"]
        guard let data = try? JSONSerialization.data(withJSONObject: msg), let text = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(text)) { _ in }
    }

    private func receive(_ task: URLSessionWebSocketTask) {
        task.receive { [weak self] result in
            Task { @MainActor in
                guard let self, self.task === task else { return }
                switch result {
                case .success(let message):
                    self.failures = 0
                    if case .string(let text) = message { self.handle(text) }
                    self.receive(task)
                case .failure:
                    self.reconnectLater()
                }
            }
        }
    }

    private func reconnectLater() {
        task = nil
        heartbeat?.cancel()
        guard wanted else { return }
        failures += 1
        let delay = min(60, 2 * failures)
        retry?.cancel()
        retry = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard let self, self.wanted, !Task.isCancelled else { return }
            self.open()
        }
    }

    private func handle(_ text: String) {
        guard let obj = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String: Any],
              obj["event"] as? String == "broadcast",
              let outer = obj["payload"] as? [String: Any], let event = outer["event"] as? String,
              let p = outer["payload"] as? [String: Any] else { return }
        switch event {
        case "changed": onChanged?((p["caregiver"] as? String).flatMap(UUID.init(uuidString:)))
        case "activity":
            guard let who = (p["caregiver"] as? String).flatMap(UUID.init(uuidString:)), let kind = p["kind"] as? String,
                  let at = p["at"] as? Double, let until = p["until"] as? Double else { return }
            let babies = (p["babies"] as? [String] ?? []).compactMap(UUID.init(uuidString:))
            onActivity?(PartnerActivity(caregiver: who, kind: kind, babies: babies,
                                        at: Date(timeIntervalSince1970: at), until: Date(timeIntervalSince1970: until)))
        default: break
        }
    }
}
