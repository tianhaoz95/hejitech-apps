import Foundation
import WatchConnectivity
import WatchKit
import UIKit
import Combine

public final class WatchSessionManager: NSObject, ObservableObject {
    public static let shared = WatchSessionManager()

    @Published public var isReachable: Bool = false
    @Published public var isToddlerLocked: Bool = false
    @Published public var captureMode: String = "Photo"
    @Published public var isRecordingVideo: Bool = false
    @Published public var videoDuration: TimeInterval = 0
    @Published public var activeFaceEmoji: String = "none"
    @Published public var lastPhotoThumbnail: UIImage?
    @Published public var lastPhotoTimestamp: Date?
    @Published public var isTriggeringShutter: Bool = false

    public override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    public func setFaceEmojiFilter(_ filter: FaceEmojiType?) {
        WKInterfaceDevice.current().play(.click)
        let raw = filter?.rawValue ?? "none"
        self.activeFaceEmoji = raw
        sendMessage(["action": "setFaceEmoji", "emoji": raw]) { [weak self] reply in
            if let active = reply["activeEmoji"] as? String {
                DispatchQueue.main.async {
                    self?.activeFaceEmoji = active
                }
            }
        }
    }

    public func sendShutterCommand() {
        isTriggeringShutter = true
        WKInterfaceDevice.current().play(.click)

        sendMessage(["action": "shutter"]) { [weak self] reply in
            DispatchQueue.main.async {
                self?.isTriggeringShutter = false
                WKInterfaceDevice.current().play(.success)
            }
        } errorHandler: { [weak self] error in
            DispatchQueue.main.async {
                self?.isTriggeringShutter = false
                WKInterfaceDevice.current().play(.failure)
            }
        }
    }

    public func playAnimalSound(_ soundName: String) {
        WKInterfaceDevice.current().play(.directionUp)
        sendMessage(["action": "playSound", "sound": soundName]) { _ in
            WKInterfaceDevice.current().play(.click)
        } errorHandler: { error in
            print("[WatchSessionManager] Failed to trigger sound: \(error)")
        }
    }

    public func toggleLock() {
        WKInterfaceDevice.current().play(.click)
        sendMessage(["action": "toggleLock"]) { [weak self] reply in
            if let locked = reply["isLocked"] as? Bool {
                DispatchQueue.main.async {
                    self?.isToddlerLocked = locked
                }
            }
        }
    }

    public func swapCameras() {
        WKInterfaceDevice.current().play(.click)
        sendMessage(["action": "swapCameras"])
    }

    public func setCaptureMode(_ mode: String) {
        WKInterfaceDevice.current().play(.click)
        self.captureMode = mode
        sendMessage(["action": "setCaptureMode", "mode": mode]) { [weak self] reply in
            if let newMode = reply["mode"] as? String {
                DispatchQueue.main.async {
                    self?.captureMode = newMode
                }
            }
        }
    }

    public func toggleCaptureMode() {
        WKInterfaceDevice.current().play(.click)
        let next = (captureMode == "Photo") ? "Video" : "Photo"
        self.captureMode = next
        sendMessage(["action": "toggleCaptureMode"]) { [weak self] reply in
            if let newMode = reply["mode"] as? String {
                DispatchQueue.main.async {
                    self?.captureMode = newMode
                }
            }
        }
    }

    public func startVideoRecording() {
        WKInterfaceDevice.current().play(.start)
        self.isRecordingVideo = true
        sendMessage(["action": "startVideoRecording"]) { [weak self] reply in
            if let recording = reply["isRecording"] as? Bool {
                DispatchQueue.main.async {
                    self?.isRecordingVideo = recording
                    if recording {
                        WKInterfaceDevice.current().play(.notification)
                    }
                }
            }
        }
    }

    public func stopVideoRecording() {
        WKInterfaceDevice.current().play(.stop)
        self.isRecordingVideo = false
        sendMessage(["action": "stopVideoRecording"]) { [weak self] reply in
            if let recording = reply["isRecording"] as? Bool {
                DispatchQueue.main.async {
                    self?.isRecordingVideo = recording
                    WKInterfaceDevice.current().play(.success)
                }
            }
        }
    }

    public func toggleVideoRecording() {
        if isRecordingVideo {
            stopVideoRecording()
        } else {
            startVideoRecording()
        }
    }

    private func sendMessage(_ message: [String: Any], reply: (([String: Any]) -> Void)? = nil, errorHandler: ((Error) -> Void)? = nil) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        if session.activationState == .activated && session.isReachable {
            session.sendMessage(message, replyHandler: reply, errorHandler: errorHandler)
        } else {
            errorHandler?(NSError(domain: "KidsCamWatch", code: -1, userInfo: [NSLocalizedDescriptionKey: "Phone unreachable"]))
        }
    }
}

// MARK: - WCSessionDelegate
extension WatchSessionManager: WCSessionDelegate {
    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    public func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    public func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async {
            if let type = message["type"] as? String, type == "photoThumbnail",
               let base64 = message["base64"] as? String,
               let data = Data(base64Encoded: base64),
               let image = UIImage(data: data) {
                self.lastPhotoThumbnail = image
                self.lastPhotoTimestamp = Date()
                WKInterfaceDevice.current().play(.notification)
            }
        }
    }

    public func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            if let locked = applicationContext["isToddlerLocked"] as? Bool {
                self.isToddlerLocked = locked
            }
            if let mode = applicationContext["captureMode"] as? String {
                self.captureMode = mode
            }
            if let isRec = applicationContext["isRecordingVideo"] as? Bool {
                self.isRecordingVideo = isRec
            }
            if let duration = applicationContext["videoRecordingDuration"] as? TimeInterval {
                self.videoDuration = duration
            }
            if let emoji = applicationContext["activeFaceEmoji"] as? String {
                self.activeFaceEmoji = emoji
            }
        }
    }
}
