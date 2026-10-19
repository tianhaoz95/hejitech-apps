import Foundation
import WatchConnectivity
import UIKit
import Combine

public final class WatchConnectivityManager: NSObject, ObservableObject {
    public static let shared = WatchConnectivityManager()

    @Published public var isWatchAppInstalled: Bool = false
    @Published public var isReachable: Bool = false
    @Published public var lastCommandReceived: String = "None"

    private var cancellables = Set<AnyCancellable>()

    public override init() {
        super.init()
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }

        // Observe latest photo from DualCameraManager to broadcast to watch
        DualCameraManager.shared.$latestPhoto
            .compactMap { $0 }
            .sink { [weak self] photo in
                self?.sendLatestPhotoThumbnailToWatch(photo: photo)
            }
            .store(in: &cancellables)

        // Observe lock status to sync to watch
        DualCameraManager.shared.$isToddlerLocked
            .sink { [weak self] _ in
                self?.syncStateToWatch()
            }
            .store(in: &cancellables)

        // Observe active face emoji mask to sync to watch
        FaceTrackingManager.shared.$activeFilter
            .sink { [weak self] _ in
                self?.syncStateToWatch()
            }
            .store(in: &cancellables)
    }

    public func syncStateToWatch() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }

        let context: [String: Any] = [
            "isToddlerLocked": DualCameraManager.shared.isToddlerLocked,
            "captureMode": DualCameraManager.shared.captureMode.rawValue,
            "isRecordingVideo": DualCameraManager.shared.isRecordingVideo,
            "videoRecordingDuration": DualCameraManager.shared.videoRecordingDuration,
            "primaryPosition": (DualCameraManager.shared.primaryPosition == .back) ? "back" : "front",
            "activeFaceEmoji": FaceTrackingManager.shared.activeFilter?.rawValue ?? "none",
            "timestamp": Date().timeIntervalSince1970
        ]
        try? session.updateApplicationContext(context)
    }

    public func sendLatestPhotoThumbnailToWatch(photo: CapturedDualPhoto) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated && session.isReachable else { return }

        DispatchQueue.global(qos: .userInitiated).async {
            // Create a small watch-sized thumbnail (200x260 px)
            let thumbSize = CGSize(width: 200, height: 260)
            let renderer = UIGraphicsImageRenderer(size: thumbSize)
            let thumb = renderer.image { _ in
                photo.compositeImage.draw(in: CGRect(origin: .zero, size: thumbSize))
            }

            if let jpegData = thumb.jpegData(compressionQuality: 0.6) {
                let base64 = jpegData.base64EncodedString()
                let message: [String: Any] = [
                    "type": "photoThumbnail",
                    "base64": base64,
                    "timestamp": photo.timestamp.timeIntervalSince1970
                ]
                session.sendMessage(message, replyHandler: nil, errorHandler: { error in
                    print("[WatchConnectivityManager] Error sending thumbnail: \(error)")
                })
            }
        }
    }
}

// MARK: - WCSessionDelegate
extension WatchConnectivityManager: WCSessionDelegate {
    public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isWatchAppInstalled = session.isWatchAppInstalled
            self.isReachable = session.isReachable
        }
    }

    public func sessionDidBecomeInactive(_ session: WCSession) {}

    public func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    public func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    public func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        DispatchQueue.main.async {
            guard let action = message["action"] as? String else {
                replyHandler(["status": "error", "message": "Unknown action"])
                return
            }

            self.lastCommandReceived = action

            switch action {
            case "shutter":
                DualCameraManager.shared.capturePhoto()
                replyHandler(["status": "ok", "action": "shutter_fired"])

            case "startVideoRecording":
                DualCameraManager.shared.startVideoRecording()
                replyHandler(["status": "ok", "isRecording": true])

            case "stopVideoRecording":
                DualCameraManager.shared.stopVideoRecording()
                replyHandler(["status": "ok", "isRecording": false])

            case "toggleVideoRecording":
                DualCameraManager.shared.toggleVideoRecording()
                replyHandler(["status": "ok", "isRecording": DualCameraManager.shared.isRecordingVideo])

            case "setCaptureMode":
                if let modeRaw = message["mode"] as? String, let mode = CameraCaptureMode(rawValue: modeRaw) {
                    DualCameraManager.shared.setCaptureMode(mode)
                    replyHandler(["status": "ok", "mode": mode.rawValue])
                } else {
                    replyHandler(["status": "error", "message": "Invalid capture mode"])
                }

            case "toggleCaptureMode":
                DualCameraManager.shared.toggleCaptureMode()
                replyHandler(["status": "ok", "mode": DualCameraManager.shared.captureMode.rawValue])

            case "playSound":
                if let soundName = message["sound"] as? String,
                   let soundType = SoundType(rawValue: soundName) {
                    SoundEffectManager.shared.play(soundType)
                    replyHandler(["status": "ok", "played": soundName])
                } else {
                    SoundEffectManager.shared.play(.quack)
                    replyHandler(["status": "ok", "played": "quack"])
                }

            case "swapCameras":
                DualCameraManager.shared.swapCameras()
                replyHandler(["status": "ok", "primary": (DualCameraManager.shared.primaryPosition == .back) ? "back" : "front"])

            case "toggleLock":
                DualCameraManager.shared.toggleToddlerLock()
                replyHandler(["status": "ok", "isLocked": DualCameraManager.shared.isToddlerLocked])

            case "setFaceEmoji":
                if let emojiRaw = message["emoji"] as? String, let filter = FaceEmojiType(rawValue: emojiRaw) {
                    FaceTrackingManager.shared.setActiveFilter(filter)
                    replyHandler(["status": "ok", "activeEmoji": filter.rawValue])
                } else {
                    FaceTrackingManager.shared.clearFilter()
                    replyHandler(["status": "ok", "activeEmoji": "none"])
                }

            case "requestStatus":
                replyHandler([
                    "status": "ok",
                    "isToddlerLocked": DualCameraManager.shared.isToddlerLocked,
                    "captureMode": DualCameraManager.shared.captureMode.rawValue,
                    "isRecordingVideo": DualCameraManager.shared.isRecordingVideo,
                    "videoRecordingDuration": DualCameraManager.shared.videoRecordingDuration,
                    "isMultiCamSupported": DualCameraManager.shared.isMultiCamSupported,
                    "activeFaceEmoji": FaceTrackingManager.shared.activeFilter?.rawValue ?? "none"
                ])

            default:
                replyHandler(["status": "unknown_action"])
            }
        }
    }
}
