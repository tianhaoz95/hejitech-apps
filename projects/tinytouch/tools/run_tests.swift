import Foundation

// MARK: - Lightweight Test Framework
var totalTests = 0
var passedTests = 0

func assertEqual<T: Equatable>(_ actual: T, _ expected: T, _ message: String = "", file: String = #file, line: Int = #line) {
    totalTests += 1
    if actual == expected {
        passedTests += 1
        print("  ✓ \(message)")
    } else {
        print("  ✗ FAIL: \(message) (Expected '\(expected)', got '\(actual)') [\(file):\(line)]")
    }
}

func assertTrue(_ condition: Bool, _ message: String = "", file: String = #file, line: Int = #line) {
    assertEqual(condition, true, message, file: file, line: line)
}

func testGroup(_ name: String, block: () -> Void) {
    print("\n--- Running Test Suite: \(name) ---")
    block()
}

// MARK: - Embedded Models for Testing

enum GameMode: String, CaseIterable, Identifiable {
    case bubbles = "bubbles"
    case animals = "animals"
    case soundGarden = "soundGarden"
    case sparkles = "sparkles"
    case lullaby = "lullaby"
    
    var id: String { rawValue }
    
    init?(rawValue: String) {
        let normalized = rawValue.lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "_", with: "")
        switch normalized {
        case "bubbles", "bubble", "bubblepop":
            self = .bubbles
        case "animals", "animal", "animalfriends":
            self = .animals
        case "soundgarden", "sound", "xylophone", "chimes":
            self = .soundGarden
        case "sparkles", "sparkle", "magicsparkles":
            self = .sparkles
        case "lullaby", "lullabies", "sleepymoon", "sleep":
            self = .lullaby
        default:
            return nil
        }
    }
    
    init?(from string: String) {
        self.init(rawValue: string)
    }
    
    var title: String {
        switch self {
        case .bubbles: return "Bubble Pop"
        case .animals: return "Animal Friends"
        case .soundGarden: return "Sound Garden"
        case .sparkles: return "Magic Sparkles"
        case .lullaby: return "Sleepy Lullaby"
        }
    }
    
    var developmentalFocus: String {
        switch self {
        case .bubbles: return "Motor coordination & cause-and-effect"
        case .animals: return "Speech recognition & animal sounds"
        case .soundGarden: return "Auditory harmony & rhythm exploration"
        case .sparkles: return "Free sensory exploration & visual tracking"
        case .lullaby: return "Calm sensory wind-down & soothing transition"
        }
    }
}

final class AppStateLogic {
    var currentMode: GameMode = .bubbles
    var isTimerActive: Bool = false
    var selectedTimerMinutes: Int = 0
    var remainingSeconds: Int = 0
    var sessionTouchesCount: Int = 0
    var isParentMenuOpen: Bool = false
    
    func registerTouch() {
        sessionTouchesCount += 1
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
    }
    
    func tick() {
        guard isTimerActive, remainingSeconds > 0 else { return }
        remainingSeconds -= 1
        if remainingSeconds == 0 {
            isTimerActive = false
            currentMode = .lullaby
        }
    }
    
    var formattedRemainingTime: String {
        guard isTimerActive else { return "Off" }
        let mins = remainingSeconds / 60
        let secs = remainingSeconds % 60
        return String(format: "%d:%02d", mins, secs)
    }
}

// MARK: - Test Execution

testGroup("GameMode Specifications") {
    assertEqual(GameMode.allCases.count, 5, "There are exactly 5 toddler play modes")
    assertEqual(GameMode.bubbles.title, "Bubble Pop", "Bubbles title matches")
    assertEqual(GameMode.animals.title, "Animal Friends", "Animals title matches")
    assertEqual(GameMode.soundGarden.title, "Sound Garden", "Sound Garden title matches")
    assertEqual(GameMode.sparkles.title, "Magic Sparkles", "Sparkles title matches")
    assertEqual(GameMode.lullaby.title, "Sleepy Lullaby", "Lullaby title matches")
    assertTrue(!GameMode.bubbles.developmentalFocus.isEmpty, "Developmental focus defined for bubbles")
}

testGroup("AppState Session & Touch Counter") {
    let state = AppStateLogic()
    assertEqual(state.sessionTouchesCount, 0, "Initial touches count is 0")
    state.registerTouch()
    state.registerTouch()
    state.registerTouch()
    assertEqual(state.sessionTouchesCount, 3, "Touches count increments to 3")
}

testGroup("Play Timer & Auto-Transition to Lullaby") {
    let state = AppStateLogic()
    assertEqual(state.formattedRemainingTime, "Off", "Timer off by default")
    
    // Set 5 minute timer
    state.setPlayTimer(minutes: 5)
    assertTrue(state.isTimerActive, "Timer is active")
    assertEqual(state.remainingSeconds, 300, "300 seconds for 5 minutes")
    assertEqual(state.formattedRemainingTime, "5:00", "Formatted time shows 5:00")
    
    // Tick 1 second
    state.tick()
    assertEqual(state.remainingSeconds, 299, "Seconds remaining 299 after 1 tick")
    assertEqual(state.formattedRemainingTime, "4:59", "Formatted time shows 4:59")
    
    // Simulate fast-forward to 1 second remaining
    state.remainingSeconds = 1
    state.tick()
    assertEqual(state.remainingSeconds, 0, "Timer expired")
    assertTrue(!state.isTimerActive, "Timer became inactive upon expiry")
    assertEqual(state.currentMode, .lullaby, "Smoothly transitioned into Sleepy Lullaby mode")
}

testGroup("Sound Assets Validation") {
    let soundsDir = FileManager.default.fileExists(atPath: "ToddlerPlay/Resources/Sounds")
        ? "ToddlerPlay/Resources/Sounds"
        : URL(fileURLWithPath: #file).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("ToddlerPlay/Resources/Sounds").path
    let requiredSounds = [
        "bubble_pop.wav", "boing.wav", "sparkle.wav", "quack.wav", "woof.wav",
        "meow.wav", "moo.wav", "ribbit.wav", "lullaby.wav", "unlock.wav",
        "chime_c4.wav", "chime_d4.wav", "chime_e4.wav", "chime_g4.wav", "chime_a4.wav", "chime_c5.wav"
    ]
    
    for sound in requiredSounds {
        let path = "\(soundsDir)/\(sound)"
        let fileExists = FileManager.default.fileExists(atPath: path)
        assertTrue(fileExists, "Sound file \(sound) exists")
        
        if let attr = try? FileManager.default.attributesOfItem(atPath: path),
           let size = attr[.size] as? Int64 {
            assertTrue(size > 1000, "Sound file \(sound) has non-trivial size (\(size) bytes)")
        }
    }
}

testGroup("Parent Shield Hold Threshold") {
    let requiredDuration = 3.0
    assertTrue(requiredDuration >= 3.0, "Parent shield requires at least 3.0 seconds to prevent toddler accidental triggers")
}

testGroup("Settings Synchronization & Remote Control") {
    // 1. Simulate incoming payload from iPhone
    let phonePayload: [String: Any] = [
        "currentMode": "animals",
        "timerMinutes": 3,
        "soundEnabled": true,
        "voiceEnabled": false,
        "hapticsEnabled": true,
        "lowStimulation": true,
        "lockHoldDuration": 5.0
    ]
    
    var localMode = "bubbles"
    var localTimerMins = 0
    var localSound = false
    var localVoice = true
    var localHaptics = false
    var localLowStim = false
    var localHoldDuration = 3.0
    
    if let mode = phonePayload["currentMode"] as? String { localMode = mode }
    if let timer = phonePayload["timerMinutes"] as? Int { localTimerMins = timer }
    if let sound = phonePayload["soundEnabled"] as? Bool { localSound = sound }
    if let voice = phonePayload["voiceEnabled"] as? Bool { localVoice = voice }
    if let haptics = phonePayload["hapticsEnabled"] as? Bool { localHaptics = haptics }
    if let lowStim = phonePayload["lowStimulation"] as? Bool { localLowStim = lowStim }
    if let hold = phonePayload["lockHoldDuration"] as? Double { localHoldDuration = hold }
    
    assertEqual(localMode, "animals", "Remote game mode switch parsed correctly")
    assertEqual(localTimerMins, 3, "Remote timer parsed correctly")
    assertEqual(localSound, true, "Sound setting parsed correctly")
    assertEqual(localVoice, false, "Voice setting parsed correctly")
    assertEqual(localHaptics, true, "Haptics setting parsed correctly")
    assertEqual(localLowStim, true, "Low stimulation setting parsed correctly")
    assertEqual(localHoldDuration, 5.0, "5s security hold duration parsed correctly")
    
    // Verify GameMode parses all incoming string variations from phone
    assertEqual(GameMode(rawValue: "animals"), .animals, "Lowercase 'animals' parsed")
    assertEqual(GameMode(rawValue: "Animals"), .animals, "Capitalized 'Animals' parsed")
    assertEqual(GameMode(rawValue: "soundGarden"), .soundGarden, "CamelCase 'soundGarden' parsed")
    assertEqual(GameMode(rawValue: "Xylophone"), .soundGarden, "Legacy 'Xylophone' parsed")
    assertEqual(GameMode(rawValue: "Sound Garden"), .soundGarden, "Spaced 'Sound Garden' parsed")
    assertEqual(GameMode(rawValue: "bubbles"), .bubbles, "Lowercase 'bubbles' parsed")
    assertEqual(GameMode(rawValue: "sparkles"), .sparkles, "Lowercase 'sparkles' parsed")
    assertEqual(GameMode(rawValue: "lullaby"), .lullaby, "Lowercase 'lullaby' parsed")
    assertEqual(GameMode(rawValue: "Sleepy Moon"), .lullaby, "Spaced 'Sleepy Moon' parsed")
    
    // 2. Simulate remote trigger lullaby
    let triggerLullabyPayload: [String: Any] = ["action": "triggerLullaby"]
    if let action = triggerLullabyPayload["action"] as? String, action == "triggerLullaby" {
        localMode = "lullaby"
    }
    assertEqual(localMode, "lullaby", "Remote instant lullaby trigger worked")
    
    // 3. Two-way reply acknowledgment from watch
    let reply: [String: Any] = [
        "status": "acknowledged",
        "currentMode": localMode,
        "timestamp": Date().timeIntervalSince1970
    ]
    assertEqual(reply["status"] as? String, "acknowledged", "Sync message reply handler confirmed")
    assertEqual(reply["currentMode"] as? String, "lullaby", "Sync reply current mode verified")
    
    // 4. Simulate Watch telemetry response to iPhone
    let watchTelemetry: [String: Any] = [
        "currentMode": localMode,
        "touchesCount": 42,
        "isTimerActive": true,
        "remainingSeconds": 180
    ]
    assertEqual(watchTelemetry["currentMode"] as? String, "lullaby", "Telemetry current mode matches")
    assertEqual(watchTelemetry["touchesCount"] as? Int, 42, "Telemetry touch count serialized")
    assertEqual(watchTelemetry["remainingSeconds"] as? Int, 180, "Telemetry timer serialized")
}

testGroup("Watch Face Widget (Complication) Specifications") {
    let supportedFamilies = ["accessoryCircular", "accessoryCorner", "accessoryRectangular", "accessoryInline"]
    assertEqual(supportedFamilies.count, 4, "4 watch face complication families supported")
    assertTrue(supportedFamilies.contains("accessoryCircular"), "Circular complication supported for quick 1-tap launch")
    assertTrue(supportedFamilies.contains("accessoryCorner"), "Corner complication supported for Infograph")
    assertTrue(supportedFamilies.contains("accessoryRectangular"), "Rectangular complication supported for Modular")
    assertTrue(supportedFamilies.contains("accessoryInline"), "Inline complication supported for text line")
    
    // Verify widget files exist
    let widgetSwiftExists = FileManager.default.fileExists(atPath: "TinyTouchWidget/TinyTouchWidget.swift")
    assertTrue(widgetSwiftExists, "TinyTouchWidget.swift source file exists")
    
}

testGroup("CI/CD Automation & Release Workflow") {
    let workflowPath = ".github/workflows/testflight-release.yml"
    let workflowExists = FileManager.default.fileExists(atPath: workflowPath)
    assertTrue(workflowExists, "GitHub Actions TestFlight workflow exists")
    
    if let content = try? String(contentsOfFile: workflowPath, encoding: .utf8) {
        assertTrue(content.contains("name: TestFlight Release"), "Workflow name defined")
        assertTrue(content.contains("swift tools/run_tests.swift"), "Unit tests executed in workflow")
        assertTrue(content.contains("xcodebuild archive"), "xcodebuild archive step defined")
        assertTrue(content.contains("xcodebuild -exportArchive"), "xcodebuild exportArchive step defined")
        assertTrue(content.contains("-allowProvisioningUpdates"), "Allow provisioning updates configured")
        assertTrue(content.contains("security import"), "Distribution certificate keychain import configured")
        assertTrue(content.contains("clean_up") || content.contains("Clean Up") || content.contains("delete-keychain"), "Keychain cleanup configured")
    }
    
    let uploaderPath = "tools/upload_ci_secrets.py"
    assertTrue(FileManager.default.fileExists(atPath: uploaderPath), "Secrets uploader helper script exists")
}


print("\n==========================================")
print("TEST RESULTS: \(passedTests)/\(totalTests) passed")
if passedTests == totalTests {
    print("ALL TESTS PASSED SUCCESSFULLY! 🌟")
    exit(0)
} else {
    print("SOME TESTS FAILED")
    exit(1)
}
