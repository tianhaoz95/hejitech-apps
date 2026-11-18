import Foundation
import RoarlyKit
import WatchConnectivity

/// The iPhone's end of the watch link: sends the story state and "play this" when sounds are on
/// the watch; receives taps and start/stop from the wrist.
@MainActor
final class PhoneWatchBridge: NSObject, ObservableObject {
    static let shared = PhoneWatchBridge()

    @Published private(set) var isPaired = false
    @Published private(set) var isWatchAppInstalled = false
    @Published private(set) var isReachable = false

    var onTap: ((String) -> Void)?
    var onToggleListening: (() -> Void)?
    var currentState: (() -> WatchLink.State)?

    private var session: WCSession? { WCSession.isSupported() ? WCSession.default : nil }

    func activate() {
        guard let session else { return }
        session.delegate = self
        session.activate()
    }

    func push(_ state: WatchLink.State) {
        guard let session, session.activationState == .activated, session.isWatchAppInstalled else { return }
        let message = WatchLink.encode(state)
        try? session.updateApplicationContext(message)
        if session.isReachable { session.sendMessage(message, replyHandler: nil) }
    }

    /// Sends a sound to the watch speaker; `false` when the watch can't take it right now.
    @discardableResult
    func send(_ kind: WatchLink.Kind, _ fields: [String: Any] = [:]) -> Bool {
        guard let session, session.activationState == .activated, session.isReachable else { return false }
        session.sendMessage(WatchLink.message(kind, fields), replyHandler: nil) { error in
            log("watch send failed: \(error.localizedDescription)")
        }
        return true
    }

    private func refresh(_ session: WCSession) {
        isPaired = session.isPaired
        isWatchAppInstalled = session.isWatchAppInstalled
        isReachable = session.isReachable
    }

    private func handle(_ message: [String: Any]) {
        switch WatchLink.kind(of: message) {
        case .tap:
            if let id = message["cue"] as? String { onTap?(id) }
        case .toggleListening:
            onToggleListening?()
        case .hello:
            if let state = currentState?() { push(state) }
        default:
            break
        }
    }
}

extension PhoneWatchBridge: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in self.refresh(session) }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
        Task { @MainActor in self.refresh(session) }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.refresh(session)
            if session.isReachable, let state = self.currentState?() { self.push(state) }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        let copy = WatchMessage(message)
        Task { @MainActor in self.handle(copy.value) }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        let copy = WatchMessage(message)
        Task { @MainActor in self.handle(copy.value) }
        replyHandler([:])
    }
}

/// WatchConnectivity dictionaries hold only plist types; safe to hand across actors.
struct WatchMessage: @unchecked Sendable {
    let value: [String: Any]
    init(_ value: [String: Any]) { self.value = value }
}
