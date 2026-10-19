import SwiftUI
import Combine

/// Central observable state manager for TinyTouch
final class AppState: ObservableObject {
    @Published var currentMode: GameMode = .bubbles {
        didSet {
            if currentMode == .lullaby {
                SoundManager.shared.startLullaby()
            } else if oldValue == .lullaby {
                SoundManager.shared.stopLullaby()
            }
            WatchConnectivityManager.shared.sendStatusUpdate()
        }
    }
    
    // Parent Preferences
    @Published var soundEnabled: Bool = true {
        didSet { SoundManager.shared.isSoundEnabled = soundEnabled }
    }
    @Published var voiceEnabled: Bool = true {
        didSet { SoundManager.shared.isVoiceEnabled = voiceEnabled }
    }
    @Published var hapticsEnabled: Bool = true {
        didSet { HapticsManager.shared.isEnabled = hapticsEnabled }
    }
    @Published var lowStimulation: Bool = false
    @Published var lockHoldDuration: Double = 3.0 // 3.0 or 5.0 seconds
    
    // Session Timer
    @Published var selectedTimerMinutes: Int = 0 // 0 = unlimited
    @Published var remainingSeconds: Int = 0
    @Published var isTimerActive: Bool = false
    
    // Modals & Navigation
    @Published var isParentMenuOpen: Bool = false
    @Published var isParentGuideOpen: Bool = false
    @Published var showCoPlayBanner: Bool = true
    
    // Play Metrics
    @Published var sessionTouchesCount: Int = 0
    @Published var sessionStartTime: Date = Date()
    
    private var timerCancellable: AnyCancellable?
    
    init() {
        let defaults = UserDefaults.standard
        if let savedMode = defaults.string(forKey: "tinyTouch_mode"), let mode = GameMode(rawValue: savedMode) {
            currentMode = mode
        }
        if defaults.object(forKey: "tinyTouch_sound") != nil {
            soundEnabled = defaults.bool(forKey: "tinyTouch_sound")
        }
        if defaults.object(forKey: "tinyTouch_voice") != nil {
            voiceEnabled = defaults.bool(forKey: "tinyTouch_voice")
        }
        if defaults.object(forKey: "tinyTouch_haptics") != nil {
            hapticsEnabled = defaults.bool(forKey: "tinyTouch_haptics")
        }
        if defaults.object(forKey: "tinyTouch_lowStim") != nil {
            lowStimulation = defaults.bool(forKey: "tinyTouch_lowStim")
        }
        if defaults.object(forKey: "tinyTouch_holdDuration") != nil {
            let dur = defaults.double(forKey: "tinyTouch_holdDuration")
            if dur > 0 { lockHoldDuration = dur }
        }
        
        // Support command-line flags for UI testing & screenshots
        if CommandLine.arguments.contains("--mode-animals") {
            currentMode = .animals
        } else if CommandLine.arguments.contains("--mode-soundgarden") {
            currentMode = .soundGarden
        } else if CommandLine.arguments.contains("--mode-sparkles") {
            currentMode = .sparkles
        } else if CommandLine.arguments.contains("--mode-lullaby") {
            currentMode = .lullaby
        }
        
        if CommandLine.arguments.contains("--parent-menu") {
            isParentMenuOpen = true
        }
        if CommandLine.arguments.contains("--parent-guide") {
            isParentMenuOpen = true
            isParentGuideOpen = true
        }
        if CommandLine.arguments.contains("--with-timer") {
            setPlayTimer(minutes: 5)
        }
        
        startSession()
        WatchConnectivityManager.shared.attachAppState(self)
    }
    
    func startSession() {
        SessionKeeper.shared.startSession()
        sessionStartTime = Date()
        sessionTouchesCount = 0
        
        // Start background second ticker for timer
        timerCancellable = Timer.publish(every: 1.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.onTimerTick()
            }
    }
    
    func registerTouch() {
        sessionTouchesCount += 1
        if sessionTouchesCount % 3 == 0 {
            WatchConnectivityManager.shared.sendStatusUpdate()
        }
    }
    
    func setPlayTimer(minutes: Int) {
        selectedTimerMinutes = minutes
        if minutes > 0 {
            remainingSeconds = minutes * 60
            isTimerActive = true
        } else {
            remainingSeconds = 0
            isTimerActive = false
        }
        WatchConnectivityManager.shared.sendStatusUpdate()
    }
    
    private func onTimerTick() {
        guard isTimerActive, remainingSeconds > 0 else { return }
        
        remainingSeconds -= 1
        
        if remainingSeconds == 0 {
            // Timer expired! Smoothly transition into calming Lullaby mode
            isTimerActive = false
            withAnimation(.easeInOut(duration: 1.5)) {
                self.currentMode = .lullaby
            }
            HapticsManager.shared.playGentlePulse()
        }
    }
    
    func onParentUnlocked() {
        HapticsManager.shared.playSuccess()
        SoundManager.shared.playUnlockChime()
        withAnimation(.spring()) {
            isParentMenuOpen = true
        }
    }
    
    var formattedRemainingTime: String {
        guard isTimerActive else { return "Off" }
        let mins = remainingSeconds / 60
        let secs = remainingSeconds % 60
        return String(format: "%d:%02d", mins, secs)
    }
}
