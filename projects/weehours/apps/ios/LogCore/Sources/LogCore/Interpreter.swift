import Foundation

/// A fully specified log entry the parent could mean, with its probability.
public struct Candidate: Codable, Hashable, Sendable {
    public var type: String
    public var fields: [String: FieldValue]
    public var occurredAt: Date
    public var probability: Double
    public var label: String

    enum CodingKeys: String, CodingKey {
        case type, fields, probability, label
        case occurredAt = "occurred_at"
    }
}

/// The result of running the decision layer on one utterance. Stored on the capture, so a pick can
/// be answered later on any household phone.
public struct Interpretation: Codable, Hashable, Sendable {
    public var transcript: String
    public var modelVersion: String
    public var tier: ConfidenceTier
    /// Ranked: [0] is what auto-commit would log. Pick shows the first two, full list shows all.
    public var candidates: [Candidate]
    /// Calibrated probability of the chosen option, per relevant question.
    public var confidence: [String: Double]
    /// The question that decided the tier (the least confident relevant one).
    public var decidingQuestion: String?
    public var reference: Date

    enum CodingKeys: String, CodingKey {
        case transcript, tier, candidates, confidence, reference
        case modelVersion = "model_version"
        case decidingQuestion = "deciding_question"
    }

    public var best: Candidate? { candidates.first }
    public var isNote: Bool { candidates.isEmpty }
}

public struct InterpretContext: Sendable {
    public var reference: Date          // capture time; relative times resolve against it
    public var log: DerivedLog          // the log as of `reference`
    public var enabledCategories: Set<String>
    public var bottleMl: Double
    public var useContextPrior: Bool

    public init(reference: Date, log: DerivedLog, enabledCategories: Set<String>, bottleMl: Double = 120, useContextPrior: Bool = true) {
        self.reference = reference
        self.log = log
        self.enabledCategories = enabledCategories
        self.bottleMl = bottleMl
        self.useContextPrior = useContextPrior
    }
}

/// Turns a transcript into typed candidates with calibrated confidence, then applies the
/// confidence policy (auto / pick / full list). The model only classifies; arithmetic, clock
/// times and numbers are handled here deterministically.
public struct VoiceInterpreter: Sendable {
    /// How the event type is asked. `hierarchical` asks a short category question and a phase
    /// question (start / switch / finish / single) and combines them, which keeps each question
    /// to few options; `flat` asks one question over every enabled type.
    public enum Design: String, Sendable, CaseIterable { case flat, hierarchical }

    public let model: DecisionModel
    public let registry: EventRegistry
    public let calibration: Calibration
    public let design: Design

    public static let noneKey = "none_of_these"
    static let noneDescription = "something else, not a feed, diaper, sleep, pumping or growth (weight, height, head size) entry"

    public init(model: DecisionModel, registry: EventRegistry = .shared, calibration: Calibration = .identity, design: Design = .hierarchical) {
        self.model = model
        self.registry = registry
        self.calibration = calibration
        self.design = design
    }

    public func questions(for context: InterpretContext) -> [DecisionQuestion] {
        let types = registry.types(enabled: context.enabledCategories)
        var qs: [DecisionQuestion] = []
        switch design {
        case .flat:
            var typeOptions = types.map { DecisionQuestion.Option(key: $0.id, description: $0.voice) }
            typeOptions.append(.init(key: Self.noneKey, description: Self.noneDescription))
            qs.append(DecisionQuestion(id: "event_type", instructions: registry.questions["event_type"]?.instructions ?? "Which entry?", options: typeOptions))
        case .hierarchical:
            var catOptions = registry.categories.filter { context.enabledCategories.contains($0.id) }
                .map { DecisionQuestion.Option(key: $0.id, description: $0.voice ?? $0.label) }
            catOptions.append(.init(key: Self.noneKey, description: Self.noneDescription))
            qs.append(DecisionQuestion(id: "category", instructions: registry.questions["category"]?.instructions ?? "What is it about?", options: catOptions))
            let roles = Set(types.compactMap { Self.role(of: $0) })
            if let phase = registry.questions["phase"] {
                let opts = phase.options.filter { roles.contains($0.key) }.map { DecisionQuestion.Option(key: $0.key, description: $0.spec.description) }
                if opts.count > 1 { qs.append(DecisionQuestion(id: "phase", instructions: phase.instructions, options: opts)) }
            }
        }
        let needed = Set(types.flatMap(\.questions))
        // "when" is resolved deterministically (clock times and relative phrases), not by the model
        for qid in ["amount", "side", "contents", "diaper_kind", "solids_amount"] where needed.contains(qid) {
            guard let spec = registry.questions[qid] else { continue }
            qs.append(DecisionQuestion(id: qid, instructions: spec.instructions,
                                       options: spec.options.map { .init(key: $0.key, description: $0.spec.description) }))
        }
        return qs
    }

    public func interpret(_ transcript: String, context: InterpretContext) async throws -> Interpretation {
        let raw = try await rawAnswers(transcript, context: context)
        return interpret(raw: raw, transcript: transcript, context: context)
    }

    /// The model's answers before calibration (used by the eval harness to fit temperatures).
    public func rawAnswers(_ transcript: String, context: InterpretContext) async throws -> [String: DecisionAnswer] {
        try await model.decide(DecisionRequest(state: transcript, questions: questions(for: context)))
    }

    public func interpret(raw: [String: DecisionAnswer], transcript: String, context: InterpretContext) -> Interpretation {
        var answers: [String: DecisionAnswer] = [:]
        for (k, v) in raw { answers[k] = calibration.apply(v, question: k) }
        if design == .hierarchical { answers["event_type"] = combine(answers, context: context, transcript: transcript) }
        if context.useContextPrior, let a = answers["event_type"] {
            answers["event_type"] = ContextPrior.apply(a, log: context.log)
        }
        return build(transcript: transcript, answers: answers, context: context)
    }

    static func role(of type: EventRegistry.EventType) -> String? {
        if type.id == "feed.bottle.single" { return "single" }
        return type.session?.role
    }

    /// P(type) = P(category) × P(phase | the phases valid in that category). Growth measurements have
    /// no phase: the units and words pick weight, height or head size deterministically.
    func combine(_ answers: [String: DecisionAnswer], context: InterpretContext, transcript: String = "") -> DecisionAnswer {
        let measure = Parsers.growthMeasure(in: transcript)
        let types = registry.types(enabled: context.enabledCategories)
        guard let cat = answers["category"] else { return DecisionAnswer(options: [Self.noneKey], probabilities: [1]) }
        let phase = answers["phase"]
        var keys: [String] = []
        var probs: [Double] = []
        for c in cat.options where c != Self.noneKey {
            let inCat = types.filter { $0.category == c }
            let weights = inCat.map { t -> Double in
                guard inCat.count > 1 else { return 1 }
                if c == "growth" { return measure.map { $0 == t.id ? 1 : 1e-6 } ?? 1 }
                guard let r = Self.role(of: t), let phase else { return 1 }
                return max(phase.p(r), 1e-6)
            }
            let total = weights.reduce(0, +)
            for (t, w) in zip(inCat, weights) {
                keys.append(t.id)
                probs.append(cat.p(c) * w / total)
            }
        }
        keys.append(Self.noneKey)
        probs.append(cat.p(Self.noneKey))
        let s = probs.reduce(0, +)
        return DecisionAnswer(options: keys, probabilities: probs.map { $0 / max(s, 1e-12) })
    }

    func build(transcript: String, answers: [String: DecisionAnswer], context: InterpretContext) -> Interpretation {
        let version = model.version
        guard let typeAnswer = answers["event_type"] else {
            return Interpretation(transcript: transcript, modelVersion: version, tier: .fullList, candidates: [], confidence: [:], decidingQuestion: "event_type", reference: context.reference)
        }
        let rankedTypes = typeAnswer.ranked()
        let explicitTime = Parsers.explicitTime(in: transcript, reference: context.reference)

        func candidate(type: String, typeP: Double, override: (String, String)? = nil) -> (Candidate, [String: Double])? {
            guard let spec = registry.type(type) else { return nil }
            var fields: [String: FieldValue] = [:]
            var conf: [String: Double] = ["event_type": typeP]
            var occurred = context.reference
            var ok = true
            if spec.questions.contains("when") {
                if let t = explicitTime {
                    occurred = t
                    conf["when"] = 1
                } else if let m = Parsers.minutesAgo(in: transcript) {
                    occurred = context.reference.addingTimeInterval(TimeInterval(-60 * m))
                    conf["when"] = 1
                } else {
                    conf["when"] = Parsers.mentionsVagueTime(transcript) ? 0.6 : 1
                }
            }
            for qid in spec.questions where qid != "when" {
                guard let a = answers[qid] else { continue }
                let choice: (key: String, p: Double) = override?.0 == qid ? (override!.1, a.p(override!.1)) : a.top
                switch qid {
                case "amount":
                    conf["amount"] = choice.p
                    if let f = registry.questions["amount"]?.options.first(where: { $0.key == choice.key })?.spec.fraction {
                        fields["consumed_fraction"] = .number(f)
                    }
                case "side":
                    conf["side"] = choice.p
                    if choice.key == "not_stated" {
                        if type.hasPrefix("feed.breast"), let next = StatusSnapshot(log: context.log, now: context.reference).nextSide {
                            fields["side"] = .string(next)
                        }
                    } else if choice.key == "both" && type.hasPrefix("feed.breast") {
                        conf["side"] = min(choice.p, 0.5)
                    } else {
                        fields["side"] = .string(choice.key)
                    }
                case "contents":
                    conf["contents"] = choice.p
                    if choice.key != "not_stated" { fields["contents"] = .string(choice.key) }
                case "diaper_kind":
                    if choice.key == "not_stated" {
                        conf["diaper_kind"] = min(choice.p, 0.49)   // the kind is required: always ask
                    } else {
                        conf["diaper_kind"] = choice.p
                        fields["kind"] = .string(choice.key)
                    }
                case "solids_amount":
                    conf["solids_amount"] = choice.p
                    if choice.key != "not_stated" { fields["amount"] = .string(choice.key) }
                default:
                    break
                }
            }
            for n in spec.numbers ?? [] {
                switch n {
                case "ml":
                    if let ml = Parsers.milliliters(in: transcript) { fields["amount_ml"] = .number(ml) }
                case "grams":
                    if let g = Parsers.grams(in: transcript) { fields["grams"] = .number(g) } else { ok = false }
                case "height_cm", "head_cm":
                    if let cm = Parsers.centimeters(in: transcript) { fields[n] = .number(cm) } else { ok = false }
                default: break
                }
            }
            if type == "feed.bottle.finish" || type == "feed.bottle.single", let ml = Parsers.milliliters(in: transcript) {
                fields["consumed_ml"] = .number(ml)
                fields["consumed_fraction"] = nil
                conf["amount"] = 1
            }
            if !ok { conf["numbers"] = 0 }
            let label = Self.label(type: type, fields: fields, registry: registry)
            let p = conf.values.reduce(1, *)
            return (Candidate(type: type, fields: fields, occurredAt: occurred, probability: p, label: label), conf)
        }

        let top = rankedTypes[0]
        guard top.key != Self.noneKey, let (best, conf) = candidate(type: top.key, typeP: top.p) else {
            let all = rankedTypes.filter { $0.key != Self.noneKey }.compactMap { candidate(type: $0.key, typeP: $0.p)?.0 }
            return Interpretation(transcript: transcript, modelVersion: version, tier: .fullList, candidates: all,
                                  confidence: ["event_type": top.p], decidingQuestion: "event_type", reference: context.reference)
        }

        let weakest = conf.min { $0.value < $1.value }!
        let tier: ConfidenceTier = weakest.value >= registry.policy.auto ? .auto : weakest.value >= registry.policy.pick ? .pick : .fullList

        var candidates = [best]
        if tier != .auto {
            if weakest.key == "event_type" {
                let others = rankedTypes.dropFirst().filter { $0.key != Self.noneKey }
                for t in (tier == .pick ? Array(others.prefix(1)) : Array(others)) {
                    if let c = candidate(type: t.key, typeP: t.p)?.0 { candidates.append(c) }
                }
            } else if let a = answers[weakest.key] {
                let alts = a.ranked().dropFirst().filter { $0.key != "not_stated" || weakest.key == "when" }
                for alt in (tier == .pick ? Array(alts.prefix(1)) : Array(alts)) {
                    if let c = candidate(type: top.key, typeP: top.p, override: (weakest.key, alt.key))?.0, !candidates.contains(where: { $0.fields == c.fields && $0.occurredAt == c.occurredAt }) {
                        candidates.append(c)
                    }
                }
            }
        }
        return Interpretation(transcript: transcript, modelVersion: version, tier: tier, candidates: candidates,
                              confidence: conf, decidingQuestion: weakest.key, reference: context.reference)
    }

    public static func label(type: String, fields: [String: FieldValue], registry: EventRegistry = .shared) -> String {
        var label = registry.type(type)?.label ?? type
        var details: [String] = []
        if let f = fields["consumed_fraction"]?.number { details.append(fractionText(f)) }
        if let ml = fields["consumed_ml"]?.number ?? fields["amount_ml"]?.number { details.append("\(Int(ml)) ml") }
        if let s = fields["side"]?.string { details.append(s) }
        if let k = fields["kind"]?.string { details.append(k) }
        if let c = fields["contents"]?.string { details.append(c.replacingOccurrences(of: "_", with: " ")) }
        if let a = fields["amount"]?.string { details.append(a) }
        if let g = fields["grams"]?.number { details.append(String(format: "%.2f kg", g / 1000)) }
        if let cm = fields["height_cm"]?.number ?? fields["head_cm"]?.number { details.append(String(format: "%.1f cm", cm)) }
        if !details.isEmpty { label += " · " + details.joined(separator: ", ") }
        return label
    }

    public static func fractionText(_ f: Double) -> String {
        switch f {
        case 0.25: return "drank ¼"
        case 0.5: return "drank ½"
        case 0.75: return "drank ¾"
        case 1: return "drank all"
        default: return "drank \(Int(f * 100))%"
        }
    }
}

/// A light, documented prior from the open sessions: finishing is more likely than starting
/// while a session of that kind is open, and vice versa. It reweights; it never overrides.
public enum ContextPrior {
    public static func apply(_ a: DecisionAnswer, log: DerivedLog) -> DecisionAnswer {
        let bottleOpen = log.openSession(.bottle) != nil
        let breastOpen = log.openSession(.breast) != nil
        let sleeping = log.openSession(.sleep) != nil
        var w: [String: Double] = [:]
        w["feed.bottle.start"] = bottleOpen ? 0.5 : 1.2
        w["feed.bottle.finish"] = bottleOpen ? 1.6 : 0.9
        w["feed.breast.start"] = breastOpen ? 0.6 : 1.2
        w["feed.breast.switch"] = breastOpen ? 1.4 : 0.6
        w["feed.breast.finish"] = breastOpen ? 1.6 : 0.8
        w["sleep.start"] = sleeping ? 0.5 : 1.1
        w["sleep.end"] = sleeping ? 1.6 : 0.6
        let raw = zip(a.options, a.probabilities).map { $0.1 * (w[$0.0] ?? 1) }
        let s = raw.reduce(0, +)
        guard s > 0 else { return a }
        return DecisionAnswer(options: a.options, probabilities: raw.map { $0 / s })
    }
}
