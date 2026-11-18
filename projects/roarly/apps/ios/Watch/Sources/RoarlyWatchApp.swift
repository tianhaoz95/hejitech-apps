import AVFoundation
import RoarlyKit
import SwiftUI
import WatchConnectivity

@main
struct RoarlyWatchApp: App {
    @StateObject private var model = WatchModel()

    var body: some Scene {
        WindowGroup {
            WatchRootView().environmentObject(model)
        }
    }
}

/// The wrist end: shows the story's suggestions and loops, sends taps to the iPhone, and plays
/// sounds on the watch speaker when the iPhone sends them here.
@MainActor
final class WatchModel: NSObject, ObservableObject {
    @Published private(set) var state = WatchLink.State()
    @Published private(set) var reachable = false
    @Published private(set) var lastPlayed: String?

    private var players: [AVAudioPlayer] = []
    private var loops: [String: AVAudioPlayer] = [:]

    override init() {
        super.init()
        #if DEBUG
        // Screenshots and checks without a phone: a story in progress.
        if ProcessInfo.processInfo.arguments.contains("-demoState") {
            state = WatchLink.State(listening: true, mode: .play, soundsOnWatch: false, ambients: ["rain"], suggestions: ["lion", "owl"], recent: ["tiger", "knock", "dog"], isPro: true)
            reachable = true
        }
        #endif
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    func hello() {
        let s = WCSession.default
        guard s.activationState == .activated else { return }
        if let ctx = WatchLink.decodeState(s.receivedApplicationContext) { state = ctx }
        if s.isReachable { s.sendMessage(WatchLink.message(.hello), replyHandler: nil) }
    }

    func tap(_ id: String) {
        send(.tap, ["cue": id])
        WKInterfaceDevice.current().play(.click)
    }

    func toggleListening() {
        send(.toggleListening)
        WKInterfaceDevice.current().play(.start)
    }

    private func send(_ kind: WatchLink.Kind, _ fields: [String: Any] = [:]) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(WatchLink.message(kind, fields), replyHandler: nil)
    }

    private func activateAudio() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, policy: .default, options: [])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    private func url(_ cue: Cue) -> URL? {
        cue.files.randomElement().flatMap { Bundle.main.url(forResource: $0, withExtension: "m4a", subdirectory: "Sounds") }
    }

    func handle(_ message: [String: Any]) {
        switch WatchLink.kind(of: message) {
        case .state:
            if let s = WatchLink.decodeState(message) { state = s }
        case .play:
            guard let id = message["cue"] as? String, let cue = SoundCatalog.cue(id), let url = url(cue) else { return }
            activateAudio()
            if let p = try? AVAudioPlayer(contentsOf: url) {
                p.volume = Float(message["v"] as? Double ?? 0.8)
                p.play()
                players = players.filter(\.isPlaying) + [p]
            }
            lastPlayed = id
            WKInterfaceDevice.current().play(.notification)
        case .ambient:
            guard let id = message["cue"] as? String, let cue = SoundCatalog.cue(id) else { return }
            if message["on"] as? Bool == true {
                guard loops[id] == nil, let url = url(cue), let p = try? AVAudioPlayer(contentsOf: url) else { return }
                activateAudio()
                p.numberOfLoops = -1
                p.volume = 0
                p.play()
                p.setVolume(Float(message["v"] as? Double ?? 0.5), fadeDuration: 2)
                loops[id] = p
            } else if let p = loops.removeValue(forKey: id) {
                p.setVolume(0, fadeDuration: 2)
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.1) { p.stop() }
            }
        case .stopAll:
            for p in players { p.stop() }
            for p in loops.values { p.setVolume(0, fadeDuration: 3) }
            let old = loops
            loops = [:]
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.1) { old.values.forEach { $0.stop() } }
        default:
            break
        }
    }
}

extension WatchModel: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        Task { @MainActor in
            self.reachable = session.isReachable
            self.hello()
        }
    }

    nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
        Task { @MainActor in
            self.reachable = session.isReachable
            if session.isReachable { self.hello() }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        let box = Box(message)
        Task { @MainActor in self.handle(box.value) }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        let box = Box(applicationContext)
        Task { @MainActor in self.handle(box.value) }
    }
}

private struct Box: @unchecked Sendable {
    let value: [String: Any]
    init(_ value: [String: Any]) { self.value = value }
}
