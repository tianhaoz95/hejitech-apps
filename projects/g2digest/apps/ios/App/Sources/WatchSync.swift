import Foundation
import G2DigestKit
import WatchConnectivity

/// Syncs the latest edition's TL;DR, alert cards, and cards to the watchOS companion app,
/// and receives remote playback commands from the watch to drive AudioPlayerService on iPhone.
@MainActor
public final class WatchSync: NSObject, WCSessionDelegate {
    public static let shared = WatchSync()

    public var onCommand: ((String) -> Void)?

    private override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    public func pushEdition(_ bundle: BundleData?, isPlaying: Bool, playingTitle: String?) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        var ctx: [String: Any] = [
            "isPlaying": isPlaying,
            "playingTitle": playingTitle ?? "",
            "updatedAt": Date().timeIntervalSince1970,
        ]
        if let bundle {
            ctx["date"] = bundle.date
            ctx["title"] = bundle.edition.title
            let cards: [[String: Any]] = bundle.cards.map { c in
                [
                    "slug": c.slug,
                    "kind": c.kind.rawValue,
                    "title": c.title,
                    "body": c.body,
                    "alert": c.alert == true,
                    "hasGlance": c.glance != nil,
                    "hasDeepDive": c.deepDive != nil,
                ]
            }
            ctx["cards"] = cards
        }
        try? session.updateApplicationContext(ctx)
    }

    nonisolated public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    nonisolated public func sessionDidBecomeInactive(_ session: WCSession) {}
    nonisolated public func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    nonisolated public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let cmd = message["command"] as? String else { return }
        Task { @MainActor in
            self.onCommand?(cmd)
        }
    }
}
