import Foundation
import RoarlyKit

/// Launch arguments for testing on a device and taking screenshots without taps:
/// `-skipOnboarding`, `-autoListen` (start listening at launch), `-demoStory` (a scripted story
/// through the real decision path, no microphone), `-selfTest` (asks the small model the eval
/// questions and logs answers and latency), `-mode play|bedtime`, `-automation auto|balanced|ask`,
/// `-showPaywall`, `-proUnlocked` (Debug builds).
enum DebugFlags {
    static let args = ProcessInfo.processInfo.arguments

    static func value(_ flag: String) -> String? {
        guard let i = args.firstIndex(of: flag), i + 1 < args.count else { return nil }
        return args[i + 1]
    }

    static var skipOnboarding: Bool { args.contains("-skipOnboarding") }

    /// Called before the first view reads settings.
    static func applyEarly() {
        if args.contains("-resetOnboarding") {
            UserDefaults.standard.removeObject(forKey: "onboarded")
        }
    }

    @MainActor
    static func runLaunchActions(_ model: AppModel) async {
        if let m = value("-mode").flatMap(StoryMode.init(rawValue:)) { model.mode = m }
        if let a = value("-automation").flatMap(Automation.init(rawValue:)) { model.automation = a }
        if args.contains("-showPaywall") { model.showPaywall = true }
        if args.contains("-selfTest") { await SelfTest.run(model) }
        if args.contains("-demoStory") { await DemoStory.run(model) }
        if args.contains("-autoListen") { await model.start() }
    }
}

/// A story told through the same path as the microphone: partial text word by word, then the
/// final sentence. Proves decisions, playback, suggestions and the screen on a device.
@MainActor
enum DemoStory {
    static let lines = [
        "Once upon a time, a little kitten went for a walk in the forest.",
        "Suddenly, a big lion jumped out from behind a tree!",
        "He opened his mouth and roared.",
        "Then the lion was quiet, and the tiger was running away.",
        "And then it started to rain.",
        "Knock knock! Who's there? It was a sleepy owl.",
        "All the animals were quiet, even the bear.",
        "The rain stopped and the sun came out.",
        "The end. Good night!",
    ]

    static func run(_ model: AppModel) async {
        try? AudioHub.shared.startPlayback()
        model.beginDemo()
        try? await Task.sleep(for: .seconds(1.5))
        for line in lines {
            let words = line.split(separator: " ")
            for n in stride(from: 2, through: words.count, by: 2) {
                model.heard(words.prefix(n).joined(separator: " "), isFinal: false)
                try? await Task.sleep(for: .milliseconds(320))
            }
            model.heard(line, isFinal: true)
            try? await Task.sleep(for: .seconds(3.2))
        }
        log("demo story finished")
    }
}

/// Asks the small model the story eval's unsure questions on this device and logs each answer
/// and how long it took.
@MainActor
enum SelfTest {
    static let cases: [(story: [String], line: String, cue: String, expect: Bool)] = [
        ([], "Look, the tiger is running away.", "tiger", false),
        ([], "Oh no, a tiger is chasing you!", "tiger", true),
        ([], "All the animals were quiet, even the lion.", "lion", false),
        (["The farmer opened the barn."], "There stood the cow.", "cow", true),
        ([], "The bear was fast asleep in his cave.", "bear", false),
        ([], "Suddenly a bear came out of the woods.", "bear", true),
        ([], "Remember the horse we saw at the farm?", "horse", false),
        ([], "And here comes the elephant!", "elephant", true),
        ([], "The wolf went home to sleep.", "wolf", false),
        (["It was a dark night."], "The owl looked down from the tree.", "owl", true),
    ]

    static func run(_ model: AppModel) async {
        let director = model.director
        if director.engine == .none { director.choose(useBuiltIn: true) }
        log("self-test: engine \(director.engine.rawValue)")
        director.warmUp()
        try? await Task.sleep(for: .seconds(4))
        var right = 0
        var latencies: [Int] = []
        for c in cases {
            let review = StoryEngine.Review(id: UUID(), cueID: c.cue, utterance: c.line, story: c.story, score: 0.5)
            let verdict = await director.decide(review)
            let ms = SmallModelDirector.milliseconds(director.lastLatency)
            latencies.append(ms)
            if verdict == c.expect { right += 1 }
            log("self-test: \(c.cue) \"\(c.line)\" → \(verdict.map { $0 ? "yes" : "no" } ?? "none") (want \(c.expect ? "yes" : "no")) \(ms) ms")
        }
        let sorted = latencies.sorted()
        log("self-test done: \(right)/\(cases.count) right, median \(sorted[sorted.count / 2]) ms, max \(sorted.last ?? 0) ms")
    }
}
