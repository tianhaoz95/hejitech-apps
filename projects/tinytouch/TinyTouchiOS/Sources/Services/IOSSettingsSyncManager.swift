import Foundation
import WatchConnectivity
import Combine

/// Manages live settings synchronization and remote control from the iPhone companion app
/// to the Apple Watch app via WatchConnectivity.
final class IOSSettingsSyncManager: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = IOSSettingsSyncManager()
    
    // Connectivity Status
    @Published var isSupported: Bool = false
    @Published var isWatchAppInstalled: Bool = false
    @Published var isReachable: Bool = false
    @Published var lastSyncTime: Date? = nil
    @Published var lastSyncConfirmed: Bool = false
    @Published var syncStatusText: String = "Ready"
    @Published var isSyncing: Bool = false
    
    // Remote Settings State (Persisted on iPhone)
    @Published var selectedMode: String = "bubbles" {
        didSet { saveAndBroadcast() }
    }
    @Published var timerMinutes: Int = 0 {
        didSet { saveAndBroadcast() }
    }
    @Published var soundEnabled: Bool = true {
        didSet { saveAndBroadcast() }
    }
    @Published var voiceEnabled: Bool = true {
        didSet { saveAndBroadcast() }
    }
    @Published var hapticsEnabled: Bool = true {
        didSet { saveAndBroadcast() }
    }
    @Published var lowStimulation: Bool = false {
        didSet { saveAndBroadcast() }
    }
    @Published var lockHoldDuration: Double = 3.0 {
        didSet { saveAndBroadcast() }
    }
    
    // Live Watch Telemetry
    @Published var watchCurrentMode: String = "bubbles"
    @Published var watchTouchCount: Int = 0
    @Published var watchRemainingSeconds: Int = 0
    @Published var watchIsTimerActive: Bool = false
    @Published var watchLastHeard: Date? = nil
    
    private var isBroadcasting = false
    
    private override init() {
        super.init()
        loadLocalSettings()
        activateSession()
    }
    
    private func loadLocalSettings() {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: "selectedMode") != nil {
            selectedMode = defaults.string(forKey: "selectedMode") ?? "bubbles"
            timerMinutes = defaults.integer(forKey: "timerMinutes")
            soundEnabled = defaults.bool(forKey: "soundEnabled")
            voiceEnabled = defaults.bool(forKey: "voiceEnabled")
            hapticsEnabled = defaults.bool(forKey: "hapticsEnabled")
            lowStimulation = defaults.bool(forKey: "lowStimulation")
            lockHoldDuration = defaults.double(forKey: "lockHoldDuration")
            if lockHoldDuration == 0 { lockHoldDuration = 3.0 }
        }
    }
    
    private func saveLocalSettings() {
        let defaults = UserDefaults.standard
        defaults.set(selectedMode, forKey: "selectedMode")
        defaults.set(timerMinutes, forKey: "timerMinutes")
        defaults.set(soundEnabled, forKey: "soundEnabled")
        defaults.set(voiceEnabled, forKey: "voiceEnabled")
        defaults.set(hapticsEnabled, forKey: "hapticsEnabled")
        defaults.set(lowStimulation, forKey: "lowStimulation")
        defaults.set(lockHoldDuration, forKey: "lockHoldDuration")
    }
    
    func activateSession() {
        guard WCSession.isSupported() else {
            isSupported = false
            return
        }
        isSupported = true
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }
    
    // MARK: - WCSessionDelegate (iOS)
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isWatchAppInstalled = session.isWatchAppInstalled
            self.isReachable = session.isReachable
            if activationState == .activated {
                self.sendSettingsToWatch()
            }
        }
    }
    
    func sessionDidBecomeInactive(_ session: WCSession) {}
    
    func sessionDidDeactivate(_ session: WCSession) {
        // Re-activate if switching Apple Watches
        session.activate()
    }
    
    func sessionWatchStateDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isWatchAppInstalled = session.isWatchAppInstalled
            self.isReachable = session.isReachable
        }
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
            if session.isReachable {
                self.sendSettingsToWatch()
            }
        }
    }
    
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            self.processWatchTelemetry(applicationContext)
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async {
            self.processWatchTelemetry(message)
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        DispatchQueue.main.async {
            self.processWatchTelemetry(message)
            replyHandler(["status": "acknowledged"])
        }
    }
    
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        DispatchQueue.main.async {
            self.processWatchTelemetry(userInfo)
        }
    }
    
    private func processWatchTelemetry(_ dict: [String: Any]) {
        if let mode = dict["currentMode"] as? String {
            self.watchCurrentMode = mode
        }
        if let touches = dict["touchesCount"] as? Int {
            self.watchTouchCount = touches
        }
        if let remaining = dict["remainingSeconds"] as? Int {
            self.watchRemainingSeconds = remaining
        }
        if let timerActive = dict["isTimerActive"] as? Bool {
            self.watchIsTimerActive = timerActive
        }
        self.watchLastHeard = Date()
    }
    
    // MARK: - Actions
    
    private func saveAndBroadcast() {
        saveLocalSettings()
        sendSettingsToWatch()
    }
    
    func sendSettingsToWatch(extraPayload: [String: Any]? = nil, completion: ((Bool, String) -> Void)? = nil) {
        guard WCSession.isSupported() else {
            completion?(false, "WatchConnectivity is not supported on this device.")
            return
        }
        let session = WCSession.default
        
        if session.activationState != .activated {
            session.activate()
        }
        
        var payload: [String: Any] = [
            "currentMode": selectedMode,
            "timerMinutes": timerMinutes,
            "soundEnabled": soundEnabled,
            "voiceEnabled": voiceEnabled,
            "hapticsEnabled": hapticsEnabled,
            "lowStimulation": lowStimulation,
            "lockHoldDuration": lockHoldDuration,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        if let extra = extraPayload {
            for (k, v) in extra {
                payload[k] = v
            }
        }
        
        // 1. Keep application context updated so watch immediately reflects settings when launched
        do {
            try session.updateApplicationContext(payload)
        } catch {
            print("Notice: application context update queued/ignored: \(error.localizedDescription)")
        }
        
        // 2. Immediate interactive message if watch app is currently reachable
        if session.isReachable {
            session.sendMessage(payload, replyHandler: { [weak self] reply in
                DispatchQueue.main.async {
                    self?.lastSyncTime = Date()
                    self?.lastSyncConfirmed = true
                    self?.syncStatusText = "Live Synced"
                    if let mode = reply["currentMode"] as? String {
                        self?.watchCurrentMode = mode
                    }
                    completion?(true, "Settings applied instantly to active Apple Watch!")
                }
            }, errorHandler: { [weak self] error in
                // If interactive message failed, queue user info for guaranteed delivery
                session.transferUserInfo(payload)
                DispatchQueue.main.async {
                    self?.lastSyncTime = Date()
                    self?.lastSyncConfirmed = false
                    self?.syncStatusText = "Queued in Background"
                    completion?(true, "Saved! Will apply automatically when TinyTouch is opened on your watch.")
                }
            })
        } else {
            // Watch is not active/reachable right now; queue for delivery
            session.transferUserInfo(payload)
            DispatchQueue.main.async {
                self.lastSyncTime = Date()
                self.lastSyncConfirmed = false
                self.syncStatusText = "Queued in Background"
                completion?(true, "Settings saved! Apple Watch will sync automatically when TinyTouch is opened on wrist.")
            }
        }
    }
    
    func manualSync(completion: @escaping (Bool, String) -> Void) {
        isSyncing = true
        sendSettingsToWatch { [weak self] success, message in
            self?.isSyncing = false
            completion(success, message)
        }
    }
    
    func switchWatchMode(to mode: String) {
        selectedMode = mode
    }
    
    func triggerLullabyNow() {
        selectedMode = "lullaby"
        sendSettingsToWatch(extraPayload: [
            "action": "triggerLullaby"
        ])
    }
    
    func setWatchTimer(minutes: Int) {
        timerMinutes = minutes
    }
    
    var formattedWatchRemainingTime: String {
        guard watchIsTimerActive else { return "Off" }
        let mins = watchRemainingSeconds / 60
        let secs = watchRemainingSeconds % 60
        return String(format: "%d:%02d", mins, secs)
    }
}
