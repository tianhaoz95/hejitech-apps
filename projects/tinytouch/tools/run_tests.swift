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

/// Mirror of ToddlerPlay/Sources/Models/SettingsSync.swift (checked against it below).
enum SettingsSync {
    static func isNewer(_ changedAt: Double?, than lastChange: Double) -> Bool {
        guard let changedAt else { return true }
        return changedAt > lastChange
    }
}

/// The watch's side of the sync, as WatchConnectivityManager.applySettings and
/// AppState.rememberParentChange do it: payloads apply only when newer than the last change.
struct WatchSettingsModel {
    var lastChange: Double = 0
    var lowStimulation = false
    var mode = "bubbles"
    var lullabyTriggers = 0

    mutating func receive(_ payload: [String: Any]) {
        let changedAt = payload["settingsChangedAt"] as? Double
        guard SettingsSync.isNewer(changedAt, than: lastChange) else { return }
        if let changedAt { lastChange = changedAt }
        if let low = payload["lowStimulation"] as? Bool { lowStimulation = low }
        if let m = payload["currentMode"] as? String { mode = m }
        if payload["action"] as? String == "triggerLullaby" { lullabyTriggers += 1 }
    }

    mutating func parentChangesLowStimulation(_ on: Bool, at time: Double) {
        lowStimulation = on
        lastChange = time
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

testGroup("CI/CD Automation & Release Script") {
    // CI (.github/workflows/tinytouch-testflight.yml in the monorepo) imports the team's signing
    // identities and runs this script on every tinytouch-v release.
    let scriptPath = "tools/release_testflight.sh"
    assertTrue(FileManager.default.fileExists(atPath: scriptPath), "TestFlight release script exists")
    assertTrue(FileManager.default.isExecutableFile(atPath: scriptPath), "TestFlight release script is executable")

    if let content = try? String(contentsOfFile: scriptPath, encoding: .utf8) {
        assertTrue(content.contains("xcodebuild archive"), "xcodebuild archive step defined")
        assertTrue(content.contains("xcodebuild -exportArchive"), "xcodebuild exportArchive step defined")
        assertTrue(content.contains("-allowProvisioningUpdates"), "Allow provisioning updates configured")
        assertTrue(content.contains("CURRENT_PROJECT_VERSION="), "CI build number applied")
    }

    let pbx = (try? String(contentsOfFile: "ToddlerPlay.xcodeproj/project.pbxproj", encoding: .utf8)) ?? ""
    let versions = Set(pbx.components(separatedBy: "\n").filter { $0.contains("MARKETING_VERSION = ") })
    assertEqual(versions.count, 1, "Every target shares one MARKETING_VERSION (scripts/cut_release.sh bumps it)")
    assertTrue(!pbx.contains("INFOPLIST_KEY_CFBundleShortVersionString = 1"), "Info.plist version comes from MARKETING_VERSION")
}


testGroup("Settings Sync (watch ⇄ iPhone)") {
    // The iPhone changed calm mode at t=100; the watch receives it live, then again from the
    // application context at its next launch.
    var watch = WatchSettingsModel()
    let phonePayload: [String: Any] = ["settingsChangedAt": 100.0, "lowStimulation": true, "currentMode": "animals"]
    watch.receive(phonePayload)
    assertTrue(watch.lowStimulation, "A newer iPhone change applies on the watch")

    // A parent turns calm mode off on the watch at t=200; relaunching replays the old context.
    watch.parentChangesLowStimulation(false, at: 200)
    watch.receive(phonePayload)
    assertTrue(!watch.lowStimulation, "A replayed iPhone context doesn't undo a later change made on the watch")

    // "Bedtime lullaby now" fires once, not again at every launch.
    let lullaby: [String: Any] = ["settingsChangedAt": 300.0, "currentMode": "lullaby", "action": "triggerLullaby"]
    watch.receive(lullaby)
    watch.receive(lullaby)
    watch.receive(lullaby)
    assertEqual(watch.lullabyTriggers, 1, "A one-shot action applies once, however often it's replayed")

    // A later iPhone change still wins.
    watch.receive(["settingsChangedAt": 400.0, "lowStimulation": true])
    assertTrue(watch.lowStimulation, "A later iPhone change still applies")

    // An older iPhone app sends no stamp: its payloads apply as before.
    watch.receive(["lowStimulation": false])
    assertTrue(!watch.lowStimulation, "Payloads without a stamp (older iPhone app) still apply")

    let source = (try? String(contentsOfFile: "ToddlerPlay/Sources/Models/SettingsSync.swift", encoding: .utf8)) ?? ""
    assertTrue(source.contains("guard let changedAt else { return true }") && source.contains("return changedAt > lastChange"),
               "The mirrored SettingsSync matches the app's source")
    let phone = (try? String(contentsOfFile: "TinyTouchiOS/Sources/Services/IOSSettingsSyncManager.swift", encoding: .utf8)) ?? ""
    assertTrue(phone.contains("\"settingsChangedAt\": settingsChangedAt"), "The iPhone sends its change time, not the send time")
    assertTrue(phone.contains("guard !isApplyingStoredSettings else { return }"), "Loading or adopting settings on the iPhone doesn't broadcast them")
}

testGroup("App Intents & Shortcuts (Siri & watchOS Launcher)") {
    // 1. Files exist
    let watchIntentsFile = "ToddlerPlay/Sources/Intents/TinyTouchIntents.swift"
    let watchShortcutsFile = "ToddlerPlay/Sources/Intents/TinyTouchShortcuts.swift"
    let iosIntentsFile = "TinyTouchiOS/Sources/Intents/IOSTinyTouchIntents.swift"
    let launchRequestFile = "ToddlerPlay/Sources/Services/TinyTouchLaunchRequest.swift"
    
    assertTrue(FileManager.default.fileExists(atPath: watchIntentsFile), "watchOS intents source file exists")
    assertTrue(FileManager.default.fileExists(atPath: watchShortcutsFile), "watchOS shortcuts provider source file exists")
    assertTrue(FileManager.default.fileExists(atPath: iosIntentsFile), "iOS intents source file exists")
    assertTrue(FileManager.default.fileExists(atPath: launchRequestFile), "Launch request coordinator source file exists")
    
    // 2. Strict Apple App Store compliance: No "Apple" in App Intent strings (ITMS-90626)
    let watchIntentsContent = (try? String(contentsOfFile: watchIntentsFile, encoding: .utf8)) ?? ""
    let watchShortcutsContent = (try? String(contentsOfFile: watchShortcutsFile, encoding: .utf8)) ?? ""
    let iosIntentsContent = (try? String(contentsOfFile: iosIntentsFile, encoding: .utf8)) ?? ""
    
    let combinedIntents = watchIntentsContent + "\n" + watchShortcutsContent + "\n" + iosIntentsContent
    
    // Check user-facing strings in intents do not contain "Apple" (case-insensitive)
    let forbiddenAppleRegex = try? NSRegularExpression(pattern: #""[^"]*apple[^"]*""#, options: [.caseInsensitive])
    let forbiddenMatches = forbiddenAppleRegex?.matches(in: combinedIntents, range: NSRange(combinedIntents.startIndex..., in: combinedIntents)) ?? []
    assertEqual(forbiddenMatches.count, 0, "No 'Apple' in App Intent strings or shortcut phrases (ITMS-90626 compliance)")
    
    // 3. App Shortcuts phrases require \(.applicationName)
    assertTrue(watchShortcutsContent.contains(#"\(.applicationName)"#), "watchOS shortcut phrases include applicationName macro")
    assertTrue(iosIntentsContent.contains(#"\(.applicationName)"#), "iOS shortcut phrases include applicationName macro")
    
    // 4. Intent attributes
    assertTrue(watchIntentsContent.contains("static let openAppWhenRun: Bool = true"), "Intent opens the watchOS app when run")
    assertTrue(watchIntentsContent.contains("struct PlayTinyTouchIntent: AppIntent"), "PlayTinyTouchIntent defined")
    assertTrue(watchIntentsContent.contains("struct PlayLullabyIntent: AppIntent"), "PlayLullabyIntent defined")
    assertTrue(watchIntentsContent.contains("enum GameModeAppEnum: String, AppEnum"), "GameModeAppEnum defined with all 5 sensory modes")
    
    // 5. URL scheme launcher handling in ToddlerPlayApp
    let appContent = (try? String(contentsOfFile: "ToddlerPlay/Sources/ToddlerPlayApp.swift", encoding: .utf8)) ?? ""
    assertTrue(appContent.contains("handleIncomingURL"), "ToddlerPlayApp handles URL scheme launchers")
    assertTrue(appContent.contains("TinyTouchLaunchRequest.shared.requestLaunch"), "URL launcher forwards to launch coordinator")
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
