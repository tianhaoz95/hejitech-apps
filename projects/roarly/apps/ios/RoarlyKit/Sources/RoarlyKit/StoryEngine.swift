import Foundation

public enum StoryMode: String, Codable, CaseIterable, Sendable {
    /// Softer sounds, quieter big ones, everything fades at "good night".
    case bedtime
    /// Full volume.
    case play

    public var title: String { self == .bedtime ? "Bedtime" : "Playtime" }
}

/// How much the listener does by itself versus offering a tap.
public enum Automation: String, Codable, CaseIterable, Sendable {
    case auto, balanced, ask

    public var title: String {
        switch self {
        case .auto: return "Mostly automatic"
        case .balanced: return "Balanced"
        case .ask: return "Mostly ask me"
        }
    }

    /// At or above: plays by itself. Between `suggest` and `play`: offered as a tap.
    public var thresholds: (play: Double, suggest: Double) {
        switch self {
        case .auto: return (0.6, 0.3)
        case .balanced: return (0.75, 0.4)
        case .ask: return (0.94, 0.3)
        }
    }
}

public struct Suggestion: Identifiable, Equatable, Sendable {
    public let id: UUID
    public let cueID: String
    public let createdAt: Date
    public let score: Double
}

/// What the app should do next.
public enum StoryAction: Equatable, Sendable {
    /// Load this sound now; it is likely to be needed in a moment.
    case prepare(cueID: String)
    case play(cueID: String, volume: Double)
    case startAmbient(cueID: String, volume: Double)
    case stopAmbient(cueID: String)
    /// Everything fades out (the story ended, "good night").
    case fadeAll
    case suggest(Suggestion)
    case withdraw(suggestionID: UUID)
}

/// Turns a live transcript into sound decisions.
///
/// Feed it every transcription update (`ingest`): partial ("volatile") results while the speaker
/// talks and the final text of each utterance when they pause. Partial text can make a sure call
/// at once ("…and the lion ROARED") or offer a suggestion; the final text settles the rest. Final
/// mentions the judge is unsure about are listed in `reviews` for a language model to settle
/// (`resolve`); they stay suggestions until then.
public final class StoryEngine {
    public struct Settings: Equatable, Sendable {
        public var mode: StoryMode
        public var automation: Automation
        /// Cues the user may hear (the free set without Pro). Others are never matched.
        public var allowedCueIDs: Set<String>
        public var customTriggers: [String: [String]]
        public var suggestionLifetime: TimeInterval
        public var cooldown: TimeInterval

        public init(
            mode: StoryMode = .bedtime, automation: Automation = .balanced,
            allowedCueIDs: Set<String> = Set(SoundCatalog.all.map(\.id)), customTriggers: [String: [String]] = [:],
            suggestionLifetime: TimeInterval = 9, cooldown: TimeInterval = 6
        ) {
            self.mode = mode
            self.automation = automation
            self.allowedCueIDs = allowedCueIDs
            self.customTriggers = customTriggers
            self.suggestionLifetime = suggestionLifetime
            self.cooldown = cooldown
        }
    }

    /// A final mention the judge was unsure about.
    public struct Review: Identifiable, Equatable, Sendable {
        public let id: UUID
        public let cueID: String
        /// The finished utterance.
        public let utterance: String
        /// Up to three earlier utterances, oldest first.
        public let story: [String]
        public let score: Double

        public init(id: UUID, cueID: String, utterance: String, story: [String], score: Double) {
            self.id = id
            self.cueID = cueID
            self.utterance = utterance
            self.story = story
            self.score = score
        }
    }

    public private(set) var settings: Settings
    public private(set) var activeAmbients: Set<String> = []
    public private(set) var suggestions: [Suggestion] = []
    public private(set) var reviews: [Review] = []
    /// Final utterances so far, oldest first (the last few are kept).
    public private(set) var history: [String] = []
    /// Newest last: what the story is about, for sound words like "roared".
    public private(set) var recentCueIDs: [String] = []

    private var matcher: CueMatcher
    private var cues: [String: Cue]
    /// Per utterance: cues already handled (played, or decided against on the final text).
    private var settledInUtterance: Set<String> = []
    private var lastPlayed: [String: Date] = [:]

    public init(settings: Settings = Settings()) {
        self.settings = settings
        let allowed = SoundCatalog.all.filter { settings.allowedCueIDs.contains($0.id) }
        self.cues = Dictionary(uniqueKeysWithValues: allowed.map { ($0.id, $0) })
        self.matcher = CueMatcher(cues: allowed, customTriggers: settings.customTriggers)
    }

    public func update(settings new: Settings) {
        guard new != settings else { return }
        settings = new
        let allowed = SoundCatalog.all.filter { new.allowedCueIDs.contains($0.id) }
        cues = Dictionary(uniqueKeysWithValues: allowed.map { ($0.id, $0) })
        matcher = CueMatcher(cues: allowed, customTriggers: new.customTriggers)
    }

    var thresholds: (play: Double, suggest: Double) {
        let t = settings.automation.thresholds
        return settings.mode == .bedtime ? (min(t.play + 0.05, 0.94), t.suggest) : t
    }

    public func volume(for cue: Cue) -> Double {
        switch (settings.mode, cue.kind) {
        case (.bedtime, .ambient): return 0.35
        case (.play, .ambient): return 0.55
        case (.bedtime, .oneShot): return max(0.3, 0.75 - 0.4 * cue.loudness)
        case (.play, .oneShot): return 0.9
        }
    }

    /// One transcription update. `isFinal` ends the utterance.
    public func ingest(_ text: String, isFinal: Bool, at now: Date = Date()) -> [StoryAction] {
        var actions = expire(at: now)
        let tokens = TextNormalizer.tokens(text)
        let mentions = matcher.mentions(in: tokens, recentCueIDs: recentCueIDs)

        // The strongest judgement per cue in this utterance.
        var best: [String: Judgement] = [:]
        var order: [String] = []
        for m in mentions {
            guard let cue = cues[m.cueID] else { continue }
            let j = ContextJudge.judge(m, in: tokens, isFinal: isFinal, soundWords: cue.soundWords)
            if best[m.cueID] == nil { order.append(m.cueID) }
            if (best[m.cueID]?.score ?? -1) < j.score { best[m.cueID] = j }
        }

        let (playAt, suggestAt) = thresholds
        for id in order {
            guard let cue = cues[id], let j = best[id], !settledInUtterance.contains(id) else { continue }
            let existing = suggestions.first { $0.cueID == id }
            if j.score >= playAt && !j.isProvisional {
                if let s = existing { actions += withdraw(s.id) }
                // "…and he roared" right after the lion appeared: the sound itself may repeat sooner.
                actions += fire(cue, at: now, minGap: j.score >= 0.95 ? 2.5 : nil)
                settledInUtterance.insert(id)
            } else if isFinal {
                if j.score < suggestAt {
                    if let s = existing { actions += withdraw(s.id) }
                } else {
                    var sid = existing?.id
                    if existing == nil, !isPlayingOrCooling(cue, at: now) {
                        let s = Suggestion(id: UUID(), cueID: id, createdAt: now, score: j.score)
                        suggestions.append(s)
                        actions += [.prepare(cueID: id), .suggest(s)]
                        sid = s.id
                    }
                    if let sid {
                        reviews.append(Review(id: sid, cueID: id, utterance: text, story: Array(history.suffix(3)), score: j.score))
                    }
                }
                settledInUtterance.insert(id)
            } else if let s = existing, j.score < suggestAt, !j.isProvisional {
                // "the tiger…" then "…is running away": take the offer back.
                actions += withdraw(s.id)
            } else if j.score >= suggestAt, existing == nil, !isPlayingOrCooling(cue, at: now) {
                let s = Suggestion(id: UUID(), cueID: id, createdAt: now, score: j.score)
                suggestions.append(s)
                actions += [.prepare(cueID: id), .suggest(s)]
            }
        }

        if isFinal {
            actions += endings(in: tokens)
            for id in order where !recentCueIDs.contains(id) || recentCueIDs.last != id {
                recentCueIDs.removeAll { $0 == id }
                recentCueIDs.append(id)
            }
            recentCueIDs = Array(recentCueIDs.suffix(6))
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { history = Array((history + [trimmed]).suffix(8)) }
            settledInUtterance = []
        }
        return actions
    }

    /// The parent tapped a suggestion (or a sound in the strip): play it now.
    public func tap(cueID: String, at now: Date = Date()) -> [StoryAction] {
        var actions: [StoryAction] = []
        for s in suggestions where s.cueID == cueID { actions += withdraw(s.id) }
        guard let cue = SoundCatalog.cue(cueID) else { return actions }
        if cue.kind == .ambient, activeAmbients.contains(cueID) {
            activeAmbients.remove(cueID)
            return actions + [.stopAmbient(cueID: cueID)]
        }
        lastPlayed[cueID] = nil
        return actions + fire(cue, at: now)
    }

    /// The language model's answer for a review: play it, or let the suggestion go.
    public func resolve(reviewID: UUID, play: Bool, at now: Date = Date()) -> [StoryAction] {
        guard let review = reviews.first(where: { $0.id == reviewID }) else { return [] }
        reviews.removeAll { $0.id == reviewID }
        guard let suggestion = suggestions.first(where: { $0.id == reviewID }) else { return [] }
        var actions = withdraw(suggestion.id)
        if play, let cue = cues[review.cueID] { actions += fire(cue, at: now) }
        return actions
    }

    /// Drops reviews nobody answered (the model was busy or slow); their suggestions stay up.
    public func abandonReview(_ id: UUID) { reviews.removeAll { $0.id == id } }

    public func stopAmbient(_ cueID: String) -> [StoryAction] {
        guard activeAmbients.remove(cueID) != nil else { return [] }
        return [.stopAmbient(cueID: cueID)]
    }

    /// Called about once a second: lets old suggestions go.
    public func tick(at now: Date = Date()) -> [StoryAction] { expire(at: now) }

    public func reset() -> [StoryAction] {
        var actions = suggestions.map { StoryAction.withdraw(suggestionID: $0.id) }
        if !activeAmbients.isEmpty { actions.append(.fadeAll) }
        suggestions = []
        reviews = []
        activeAmbients = []
        history = []
        recentCueIDs = []
        settledInUtterance = []
        lastPlayed = [:]
        return actions
    }

    // MARK: - Internals

    private func fire(_ cue: Cue, at now: Date, minGap: TimeInterval? = nil) -> [StoryAction] {
        switch cue.kind {
        case .ambient:
            guard !activeAmbients.contains(cue.id) else { return [] }
            activeAmbients.insert(cue.id)
            return [.startAmbient(cueID: cue.id, volume: volume(for: cue))]
        case .oneShot:
            if let last = lastPlayed[cue.id], now.timeIntervalSince(last) < (minGap ?? settings.cooldown) { return [] }
            lastPlayed[cue.id] = now
            return [.play(cueID: cue.id, volume: volume(for: cue))]
        }
    }

    private func isPlayingOrCooling(_ cue: Cue, at now: Date) -> Bool {
        if cue.kind == .ambient { return activeAmbients.contains(cue.id) }
        if let last = lastPlayed[cue.id] { return now.timeIntervalSince(last) < settings.cooldown }
        return false
    }

    private func withdraw(_ id: UUID) -> [StoryAction] {
        guard suggestions.contains(where: { $0.id == id }) else { return [] }
        suggestions.removeAll { $0.id == id }
        return [.withdraw(suggestionID: id)]
    }

    private func expire(at now: Date) -> [StoryAction] {
        let old = suggestions.filter { now.timeIntervalSince($0.createdAt) > settings.suggestionLifetime }
        return old.flatMap { s -> [StoryAction] in
            reviews.removeAll { $0.id == s.id }
            return withdraw(s.id)
        }
    }

    static let stopWords: [[String]] = [["stopped"], ["stops"], ["ended"], ["is", "over"], ["was", "over"], ["no", "more"], ["went", "away"], ["cleared"], ["calmed", "down"], ["died", "down"], ["passed"]]
    static let clearSkies: [[String]] = [["sun", "came", "out"], ["sun", "come", "out"], ["sunny"], ["rainbow"], ["sky", "cleared"]]
    static let goodnight: [[String]] = [["the", "end"], ["good", "night"], ["goodnight"], ["sweet", "dreams"], ["fell", "fast", "asleep"], ["fast", "asleep"]]

    /// "The rain stopped", "the sun came out", "the end": ambient beds end with the story.
    private func endings(in tokens: [Token]) -> [StoryAction] {
        let words = tokens.map(\.text)
        if !activeAmbients.isEmpty, Self.goodnight.contains(where: { ContextJudge.contains(words, $0) }) {
            activeAmbients = []
            return [.fadeAll]
        }
        var actions: [StoryAction] = []
        let weather: Set<String> = ["rain", "wind", "thunder"]
        if Self.clearSkies.contains(where: { ContextJudge.contains(words, $0) }) {
            for id in activeAmbients.intersection(weather) {
                activeAmbients.remove(id)
                actions.append(.stopAmbient(cueID: id))
            }
        }
        for id in activeAmbients {
            guard let cue = cues[id] else { continue }
            let triggers = cue.triggers.map(TextNormalizer.words)
            // "the rain stopped", "it stopped raining".
            let mentioned = triggers.contains { ContextJudge.contains(words, $0) }
            if mentioned, Self.stopWords.contains(where: { ContextJudge.contains(words, $0) }) {
                activeAmbients.remove(id)
                actions.append(.stopAmbient(cueID: id))
            }
        }
        return actions
    }
}
