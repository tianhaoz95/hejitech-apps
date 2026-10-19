import Foundation
import UIKit
import WatchConnectivity

public enum WatchComplicationStyle: String, CaseIterable, Identifiable {
    case quickShutter = "Quick Shutter"
    case animalSound = "Silly Sound"
    case cameraRemote = "Camera Remote"
    case liveStatus = "Status"

    public var id: String { rawValue }

    public var iconName: String {
        switch self {
        case .quickShutter: return "camera.circle.fill"
        case .animalSound: return "speaker.wave.3.fill"
        case .cameraRemote: return "applewatch.radiowaves.left.and.right"
        case .liveStatus: return "checkmark.circle.fill"
        }
    }
}

public final class WatchFaceManager: ObservableObject {
    public static let shared = WatchFaceManager()

    @Published public var selectedComplication: WatchComplicationStyle = .quickShutter
    @Published public var selectedComplicationColor: UIColor = .white

    public init() {}

    public func openAppleWatchApp() {
        let watchURLs = [
            "itms-watch://",
            "watch://",
            "App-prefs:root=WATCH",
            "prefs:root=WATCH"
        ]
        for urlStr in watchURLs {
            if let url = URL(string: urlStr), UIApplication.shared.canOpenURL(url) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                return
            }
        }
        if let fallback = URL(string: "itms-watch://") {
            UIApplication.shared.open(fallback, options: [:], completionHandler: nil)
        }
    }

    public func syncComplicationSettingsToWatch() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        if session.activationState == .activated {
            let info: [String: Any] = [
                "complicationStyle": selectedComplication.rawValue,
                "timestamp": Date().timeIntervalSince1970
            ]
            if session.isComplicationEnabled {
                session.transferCurrentComplicationUserInfo(info)
            }
            try? session.updateApplicationContext(info)
        }
    }
}
