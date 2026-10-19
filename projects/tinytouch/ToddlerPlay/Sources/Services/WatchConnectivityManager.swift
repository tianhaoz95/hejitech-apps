import Foundation
import SwiftUI
import WatchConnectivity

/// Manages bidirectional synchronization between the Apple Watch app and the iPhone companion app.
final class WatchConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchConnectivityManager()
    
    weak var appState: AppState?
    
    @Published var isReachable: Bool = false
    @Published var lastSyncReceivedAt: Date? = nil
    
    private var pendingSettings: [String: Any]? = nil
    
    private override init() {
        super.init()
        activateSession()
    }
    
    func activateSession() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }
    
    /// Called when AppState initializes to link the view model with connectivity
    func attachAppState(_ state: AppState) {
        self.appState = state
        
        // 1. Check if we received settings before AppState was attached
        if let pending = pendingSettings {
            applySettings(pending)
            pendingSettings = nil
        } else {
            // 2. Check receivedApplicationContext from WCSession
            let context = WCSession.default.receivedApplicationContext
            if !context.isEmpty {
                applySettings(context)
            }
        }
        
        // 3. Immediately report initial watch state to companion app
        sendStatusUpdate()
    }
    
    // MARK: - WCSessionDelegate (watchOS)
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if activationState == .activated {
                let context = session.receivedApplicationContext
                if !context.isEmpty {
                    self.applySettings(context)
                }
            }
        }
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if session.isReachable {
                self.sendStatusUpdate()
            }
        }
    }
    
    // Handler 1: Standard message WITHOUT reply handler
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async {
            self.applySettings(message)
            self.sendStatusUpdate()
        }
    }
    
    // Handler 2: Message WITH reply handler
    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        DispatchQueue.main.async {
            self.applySettings(message)
            self.sendStatusUpdate()
            replyHandler([
                "status": "acknowledged",
                "currentMode": self.appState?.currentMode.rawValue ?? "bubbles",
                "timestamp": Date().timeIntervalSince1970
            ])
        }
    }
    
    // Handler 3: Background Application Context
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            self.applySettings(applicationContext)
            self.sendStatusUpdate()
        }
    }
    
    // Handler 4: Queued User Info (guaranteed delivery)
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        DispatchQueue.main.async {
            self.applySettings(userInfo)
            self.sendStatusUpdate()
        }
    }
    
    // MARK: - Applying incoming settings from iPhone
    
    func applySettings(_ dict: [String: Any]) {
        self.lastSyncReceivedAt = Date()
        
        // Persist to UserDefaults so watch remembers even across app restarts
        let defaults = UserDefaults.standard
        if let modeRaw = dict["currentMode"] as? String {
            defaults.set(modeRaw, forKey: "tinyTouch_mode")
        }
        if let sound = dict["soundEnabled"] as? Bool {
            defaults.set(sound, forKey: "tinyTouch_sound")
        }
        if let voice = dict["voiceEnabled"] as? Bool {
            defaults.set(voice, forKey: "tinyTouch_voice")
        }
        if let haptics = dict["hapticsEnabled"] as? Bool {
            defaults.set(haptics, forKey: "tinyTouch_haptics")
        }
        if let lowStim = dict["lowStimulation"] as? Bool {
            defaults.set(lowStim, forKey: "tinyTouch_lowStim")
        }
        if let holdDuration = dict["lockHoldDuration"] as? Double {
            defaults.set(holdDuration, forKey: "tinyTouch_holdDuration")
        }
        if let timerMinutes = dict["timerMinutes"] as? Int {
            defaults.set(timerMinutes, forKey: "tinyTouch_timerMinutes")
        }
        
        guard let appState = self.appState else {
            // AppState not yet initialized; queue settings for when it attaches
            self.pendingSettings = dict
            return
        }
        
        DispatchQueue.main.async {
            // 1. Remote action triggers (e.g. Bedtime Lullaby)
            if let action = dict["action"] as? String, action == "triggerLullaby" {
                withAnimation(.easeInOut(duration: 1.0)) {
                    appState.currentMode = .lullaby
                }
                if appState.isParentMenuOpen {
                    appState.isParentMenuOpen = false
                }
                HapticsManager.shared.playGentlePulse()
            }
            
            // 2. Game mode switch
            if let modeRaw = dict["currentMode"] as? String, let mode = GameMode(rawValue: modeRaw) {
                if appState.currentMode != mode {
                    withAnimation(.easeInOut(duration: 0.6)) {
                        appState.currentMode = mode
                    }
                    HapticsManager.shared.playGentlePulse()
                }
                if appState.isParentMenuOpen {
                    appState.isParentMenuOpen = false
                }
            }
            
            // 3. Sensory toggles
            if let sound = dict["soundEnabled"] as? Bool {
                appState.soundEnabled = sound
            }
            if let voice = dict["voiceEnabled"] as? Bool {
                appState.voiceEnabled = voice
            }
            if let haptics = dict["hapticsEnabled"] as? Bool {
                appState.hapticsEnabled = haptics
            }
            if let lowStim = dict["lowStimulation"] as? Bool {
                appState.lowStimulation = lowStim
            }
            
            // 4. Timer change
            if let timerMinutes = dict["timerMinutes"] as? Int {
                appState.setPlayTimer(minutes: timerMinutes)
            }
            
            // 5. Lock hold duration
            if let holdDuration = dict["lockHoldDuration"] as? Double {
                appState.lockHoldDuration = holdDuration
            }
        }
    }
    
    // MARK: - Sending live telemetry to iPhone
    
    func sendStatusUpdate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated else { return }
        guard let appState = self.appState else { return }
        
        let telemetry: [String: Any] = [
            "currentMode": appState.currentMode.rawValue,
            "touchesCount": appState.sessionTouchesCount,
            "isTimerActive": appState.isTimerActive,
            "remainingSeconds": appState.remainingSeconds,
            "soundEnabled": appState.soundEnabled,
            "voiceEnabled": appState.voiceEnabled,
            "hapticsEnabled": appState.hapticsEnabled,
            "lowStimulation": appState.lowStimulation,
            "lockHoldDuration": appState.lockHoldDuration,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        // 1. Immediate message if reachable
        if session.isReachable {
            session.sendMessage(telemetry, replyHandler: nil) { [weak self] _ in
                // On failure, update application context
                try? WCSession.default.updateApplicationContext(telemetry)
            }
        } else {
            // 2. Otherwise update application context for guaranteed delivery
            try? session.updateApplicationContext(telemetry)
        }
    }
}
