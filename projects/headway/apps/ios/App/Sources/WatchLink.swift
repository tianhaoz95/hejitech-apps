import Foundation
import HeadwayKit
import WatchConnectivity

/// Manages the WatchConnectivity session on the iPhone to keep the Apple Watch app in sync.
final class WatchLink: NSObject, WCSessionDelegate, @unchecked Sendable {
    var onTrack: ((String, String, String, String) -> Void)?
    var onUntrack: (() -> Void)?
    var onFlip: (() -> Void)?
    var onRefresh: (() -> Void)?
    var onSelectStations: ((String, String) -> Void)?
    var onFilterExpress: ((ExpressPreference) -> Void)?

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    var isAvailable: Bool {
        WCSession.isSupported() && WCSession.default.isPaired && WCSession.default.isWatchAppInstalled
    }

    /// Pushes the latest state snapshot to the watch.
    func sync(state: WatchSyncState) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
        guard let data = state.encode() else { return }
        let payload: [String: Any] = [WatchMessage.stateData: data]
        try? WCSession.default.updateApplicationContext(payload)
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil)
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        handleIncoming(message: message)
        replyHandler(["ok": true])
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleIncoming(message: message)
    }

    private func handleIncoming(message: [String: Any]) {
        guard let kind = message[WatchMessage.kind] as? String else { return }
        switch kind {
        case WatchMessage.kindTrack:
            if let tripId = message[WatchMessage.tripId] as? String,
               let serviceDate = message[WatchMessage.serviceDate] as? String,
               let from = message[WatchMessage.fromStation] as? String,
               let to = message[WatchMessage.toStation] as? String {
                onTrack?(tripId, serviceDate, from, to)
            }
        case WatchMessage.kindUntrack:
            onUntrack?()
        case WatchMessage.kindFlip:
            onFlip?()
        case WatchMessage.kindRefresh:
            onRefresh?()
        case WatchMessage.kindSelectStations:
            if let from = message[WatchMessage.fromStation] as? String,
               let to = message[WatchMessage.toStation] as? String {
                onSelectStations?(from, to)
            }
        case WatchMessage.kindFilterExpress:
            if let raw = message[WatchMessage.expressPref] as? String,
               let pref = ExpressPreference(rawValue: raw) {
                onFilterExpress?(pref)
            }
        default:
            break
        }
    }
}
