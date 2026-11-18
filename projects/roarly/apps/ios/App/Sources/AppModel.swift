import Combine
import Foundation
import RoarlyKit
import SwiftUI
import UIKit

/// Where sounds play.
enum SoundOutput: String, CaseIterable, Codable {
    case phone, watch

    var title: String { self == .phone ? "iPhone" : "Apple Watch" }
}

/// One story session's state and the decisions in it. The views read it; every sound decision
/// goes through `StoryEngine` (RoarlyKit) and comes back here as actions.
@MainActor
final class AppModel: ObservableObject {
    // Settings (UserDefaults).
    @AppStorage("mode") var mode: StoryMode = .bedtime { didSet { syncEngineSettings() } }
    @AppStorage("automation") var automation: Automation = .balanced { didSet { syncEngineSettings() } }
    @AppStorage("output") var output: SoundOutput = .phone { didSet { pushWatchState() } }
    @AppStorage("showWords") var showWords = true
    @AppStorage("smartListening") var smartListening = true { didSet { director.choose(useBuiltIn: preferBuiltIn); if smartListening, isListening { director.warmUp() } } }
    @AppStorage("useBuiltInModel") var preferBuiltIn = false { didSet { director.choose(useBuiltIn: preferBuiltIn) } }
    @AppStorage("onboarded") var onboarded = false
    @AppStorage("customWords") private var customWordsData = Data()

    // Story state.
    @Published private(set) var isListening = false
    @Published private(set) var isStarting = false
    @Published private(set) var status: String = ""
    @Published private(set) var errorMessage: String?
    @Published private(set) var finishedLines: [String] = []
    @Published private(set) var liveLine = ""
    @Published private(set) var suggestions: [Suggestion] = []
    @Published private(set) var ambients: [String] = []
    @Published private(set) var recent: [String] = []
    /// The sound that just played, for the big emoji on the story screen.
    @Published private(set) var lastPlayed: (id: String, at: Date)?
    @Published private(set) var level: Float = 0
    /// Why the Pro screen is open (nil = closed). It opens only from something the user tapped that
    /// is marked as Pro, never by itself.
    enum PaywallReason: Equatable { case browse, sound(String), customWords, watch, pocket }
    @Published var paywallReason: PaywallReason?
    var showPaywall: Bool {
        get { paywallReason != nil }
        set { paywallReason = newValue ? (paywallReason ?? .browse) : nil }
    }
    /// Pocket mode (Pro): black, touch-locked screen while listening (`PocketView`).
    @Published var pocketMode = false
    func enterPocket() {
        guard isPro else { openPaywall(.pocket); return }
        guard isListening else { return }
        pocketMode = true
    }
    func exitPocket() {
        guard pocketMode else { return }
        pocketMode = false
        log("pocket mode off")
    }

    func openPaywall(_ reason: PaywallReason) {
        log("pro screen opened: \(reason)")
        paywallReason = reason
    }

    let engine = StoryEngine()
    let listener = SpeechListener()
    let director = SmallModelDirector()
    let hub = AudioHub.shared
    let store = ProStore.shared
    let watch = PhoneWatchBridge.shared

    private var ticker: Task<Void, Never>?
    private var reviewing: Set<UUID> = []
    private var restarts: [Date] = []
    private var cancellables = Set<AnyCancellable>()

    init() {
        director.choose(useBuiltIn: preferBuiltIn)
        listener.onText = { [weak self] text, isFinal in self?.heard(text, isFinal: isFinal) }
        listener.onPhase = { [weak self] phase in self?.listenerPhase(phase) }
        hub.onRestartNeeded = { [weak self] in
            Task { @MainActor in
                guard let self, self.isListening, !self.isStarting else { return }
                // At most 3 full restarts a minute: a loop shows one clear message instead of flicker.
                let now = Date()
                self.restarts = self.restarts.filter { now.timeIntervalSince($0) < 60 } + [now]
                await self.stop(keepSounds: true)
                if self.restarts.count > 3 {
                    log("too many audio restarts; stopped")
                    self.errorMessage = "The microphone keeps getting interrupted. Tap the lantern to start again."
                    return
                }
                await self.start()
            }
        }
        watch.onTap = { [weak self] id in self?.tap(id, fromWatch: true) }
        watch.onToggleListening = { [weak self] in Task { await self?.toggle() } }
        watch.currentState = { [weak self] in self?.watchState ?? WatchLink.State() }
        watch.activate()
        syncEngineSettings()
        store.$isPro.receive(on: RunLoop.main).sink { [weak self] _ in
            Task { @MainActor in
                self?.syncEngineSettings()
                self?.pushWatchState()
                self?.objectWillChange.send()
            }
        }.store(in: &cancellables)
    }

    // MARK: - Settings

    var isPro: Bool { store.isPro }

    var customWords: [String: [String]] {
        get { (try? JSONDecoder().decode([String: [String]].self, from: customWordsData)) ?? [:] }
        set {
            customWordsData = (try? JSONEncoder().encode(newValue)) ?? Data()
            syncEngineSettings()
            objectWillChange.send()
        }
    }

    func isUnlocked(_ cue: Cue) -> Bool { cue.isFree || isPro }

    private func syncEngineSettings() {
        director.customWords = isPro ? customWords : [:]
        let allowed = SoundCatalog.all.filter { isUnlocked($0) }.map(\.id)
        engine.update(settings: .init(mode: mode, automation: automation, allowedCueIDs: Set(allowed), customTriggers: isPro ? customWords : [:]))
    }

    /// Words the speech model should expect.
    private var vocabulary: [String] {
        var words: [String] = []
        for cue in SoundCatalog.all {
            words += cue.triggers + cue.soundWords
            words += customWords[cue.id] ?? []
        }
        return Array(Set(words)).sorted()
    }

    // MARK: - Listening

    func toggle() async {
        if isListening || isStarting { await stop() } else { await start() }
    }

    func start() async {
        guard !isListening, !isStarting else { return }
        errorMessage = nil
        isStarting = true
        status = "Getting ready…"
        defer { isStarting = false }
        let permitted = SpeechListener.testAudioFile != nil ? true : await SpeechListener.requestPermissions()
        guard permitted else {
            errorMessage = "Roarly needs the microphone to hear your story. Turn it on in Settings › Roarly."
            status = ""
            return
        }
        if smartListening { director.warmUp() }
        do {
            try await listener.start(hub: hub, vocabulary: vocabulary)
            isListening = true
            status = "Listening"
            UIApplication.shared.isIdleTimerDisabled = true
            startTicker()
            pushWatchState()
            log("listening (smart: \(smartListening ? director.engine.rawValue : "off"), mode \(mode.rawValue), \(automation.rawValue))")
        } catch {
            log("start failed: \(error)")
            errorMessage = "Couldn't start listening: \(error.localizedDescription)"
            status = ""
            await listener.stop()
            hub.stopListening()
        }
    }

    /// The demo story: the story screen as if listening, sounds through the engine, no mic.
    func beginDemo() {
        isListening = true
        status = "Listening"
        startTicker()
    }

    func stop(keepSounds: Bool = false) async {
        ticker?.cancel()
        ticker = nil
        await listener.stop()
        if !keepSounds { hub.stopAll() }
        hub.stopListening()
        handle(engine.reset())
        isListening = false
        status = ""
        liveLine = ""
        level = 0
        UIApplication.shared.isIdleTimerDisabled = false
        if output == .watch { watch.send(.stopAll) }
        director.unload()
        pushWatchState()
    }

    private func listenerPhase(_ phase: SpeechListener.Phase) {
        switch phase {
        case .downloading(let p): status = "Getting the speech model ready… \(Int(p * 100))%"
        case .failed(let message):
            errorMessage = "Listening stopped: \(message)"
            Task { await stop() }
        default: break
        }
    }

    private func startTicker() {
        ticker = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(250))
                guard let self else { return }
                self.level = self.hub.inputLevel
                if Int(Date().timeIntervalSince1970 * 4) % 4 == 0 { self.handle(self.engine.tick()) }
            }
        }
    }

    // MARK: - Transcript in, sounds out

    /// One transcription update (also fed by the demo story).
    func heard(_ text: String, isFinal: Bool) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let actions = engine.ingest(trimmed, isFinal: isFinal)
        if isFinal {
            finishedLines = Array((finishedLines + [trimmed]).suffix(12))
            liveLine = ""
            log("heard: \(trimmed)")
        } else {
            liveLine = trimmed
        }
        handle(actions)
        if isFinal { reviewPending() }
    }

    func tap(_ cueID: String, fromWatch: Bool = false) {
        guard let cue = SoundCatalog.cue(cueID) else { return }
        guard isUnlocked(cue) else {
            // A tap on the wrist must not pop a purchase screen on the phone across the room.
            if !fromWatch { openPaywall(.sound(cue.id)) }
            return
        }
        if !isListening {
            hub.preview(cue, volume: engine.volume(for: cue))
            bump(cueID)
            return
        }
        handle(engine.tap(cueID: cueID))
    }

    func stopAmbient(_ id: String) { handle(engine.stopAmbient(id)) }

    private func reviewPending() {
        guard smartListening, director.engine != .none else { return }
        for review in engine.reviews where !reviewing.contains(review.id) {
            reviewing.insert(review.id)
            Task { @MainActor [weak self] in
                guard let self else { return }
                let verdict = await self.director.decide(review)
                self.reviewing.remove(review.id)
                if let verdict {
                    self.handle(self.engine.resolve(reviewID: review.id, play: verdict))
                } else {
                    self.engine.abandonReview(review.id)
                }
            }
        }
    }

    func handle(_ actions: [StoryAction]) {
        guard !actions.isEmpty else { return }
        for action in actions {
            switch action {
            case .prepare(let id):
                if let cue = SoundCatalog.cue(id) { hub.preload(cue) }
            case .play(let id, let volume):
                guard let cue = SoundCatalog.cue(id) else { continue }
                if output == .watch, watch.send(.play, ["cue": id, "v": volume]) {
                } else {
                    hub.play(cue, volume: volume)
                }
                bump(id)
                log("▶︎ \(id) (vol \(String(format: "%.2f", volume)))")
            case .startAmbient(let id, let volume):
                guard let cue = SoundCatalog.cue(id) else { continue }
                if !(output == .watch && watch.send(.ambient, ["cue": id, "on": true, "v": volume])) {
                    hub.startAmbient(cue, volume: volume)
                }
                bump(id)
                log("∿ start \(id)")
            case .stopAmbient(let id):
                hub.stopAmbient(id)
                if output == .watch { watch.send(.ambient, ["cue": id, "on": false]) }
                log("∿ stop \(id)")
            case .fadeAll:
                hub.fadeAll()
                if output == .watch { watch.send(.stopAll) }
                log("fade all")
            case .suggest(let s):
                log("? suggest \(s.cueID) (\(String(format: "%.2f", s.score)))")
            case .withdraw:
                break
            }
        }
        suggestions = engine.suggestions
        ambients = engine.activeAmbients.sorted()
        pushWatchState()
    }

    private func bump(_ id: String) {
        lastPlayed = (id, Date())
        recent.removeAll { $0 == id }
        recent.insert(id, at: 0)
        recent = Array(recent.prefix(8))
    }

    // MARK: - Watch

    var watchState: WatchLink.State {
        WatchLink.State(listening: isListening, mode: mode, soundsOnWatch: output == .watch, ambients: ambients, suggestions: suggestions.map(\.cueID), recent: recent, isPro: isPro)
    }

    func pushWatchState() { watch.push(watchState) }
}
