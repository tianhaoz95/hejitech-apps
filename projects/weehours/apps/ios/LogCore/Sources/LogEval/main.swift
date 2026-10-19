import Foundation
import LogCore

// Eval harness for the decision layer. It runs the production `VoiceInterpreter` over the seed
// utterances and reports type accuracy, auto-commit rate and wrong auto-commits, and can fit
// per-question temperatures (written to spec/calibration.json).
//
//   swift run logeval --model http://127.0.0.1:8089 --design hierarchical --fit --out ../../../eval/results
//   swift run logeval --model keywords            (deterministic, no model needed; used in CI)
//   swift run logeval --export /tmp/laya.json     (the questions as the app asks them and each
//                                                  row's gold labels, for ml/; runs no model)

struct Row: Decodable {
    let text: String
    let open: [String]
    let expect: [String: String]
}

struct Args {
    var model = "keywords"
    var design = VoiceInterpreter.Design.hierarchical
    var data = "../../../spec/utterances.jsonl"   // run from apps/ios/LogCore
    var calibration: String?
    var fit = false
    var out: String?
    var label: String?
    var export: String?

    init() {
        var it = CommandLine.arguments.dropFirst().makeIterator()
        while let a = it.next() {
            switch a {
            case "--model": model = it.next() ?? model
            case "--design": design = VoiceInterpreter.Design(rawValue: it.next() ?? "") ?? design
            case "--data": data = it.next() ?? data
            case "--calibration": calibration = it.next()
            case "--fit": fit = true
            case "--out": out = it.next()
            case "--label": label = it.next()
            case "--export": export = it.next()
            default: FileHandle.standardError.write(Data("unknown argument \(a)\n".utf8))
            }
        }
    }
}

let args = Args()
let registry = EventRegistry.shared
let rows: [Row] = try String(contentsOfFile: args.data, encoding: .utf8)
    .split(separator: "\n").map { try JSONDecoder().decode(Row.self, from: Data($0.utf8)) }

let model: DecisionModel = args.model == "keywords" ? KeywordDecisionModel() : SystemOneHTTPModel(endpoint: URL(string: args.model)!)
var calibration = Calibration.identity
if let path = args.calibration, let data = FileManager.default.contents(atPath: path) {
    calibration = try JSONDecoder().decode(Calibration.self, from: data)
}
let allCategories = Set(registry.categories.map(\.id))
let household = UUID(), baby = UUID(), parent = UUID()
let reference = Calendar.current.date(bySettingHour: 15, minute: 0, second: 0, of: Date())!

func context(for row: Row) -> InterpretContext {
    var events: [LogEvent] = []
    for kind in row.open {
        let type = kind == "bottle" ? "feed.bottle.start" : kind == "breast" ? "feed.breast.start" : "sleep.start"
        var fields: [String: FieldValue] = [:]
        if kind == "breast" { fields["side"] = .string("left") }
        events.append(LogEvent(householdId: household, babyId: baby, type: type, fields: fields,
                               occurredAt: reference.addingTimeInterval(-600), loggedAt: reference.addingTimeInterval(-600),
                               loggedBy: parent, provenance: Provenance(surface: .phone, input: .tap)))
    }
    return InterpretContext(reference: reference, log: DerivedLog(events: events), enabledCategories: allCategories)
}

/// The gold option for each question asked, derived from the row's expectations.
func gold(_ row: Row, question: String) -> String? {
    let type = row.expect["type"]!
    switch question {
    case "event_type": return type
    case "category":
        if type == "none_of_these" { return "none_of_these" }
        return registry.type(type)?.category
    case "phase":
        guard let t = registry.type(type), registry.types.filter({ $0.category == t.category }).count > 1 else { return nil }
        return type == "feed.bottle.single" ? "single" : t.session?.role
    case "when":
        let w = row.expect["when"]
        return w == "explicit" ? nil : w
    default:
        guard let t = registry.type(type), t.questions.contains(question) else { return nil }
        return row.expect[question]
    }
}

func correct(_ c: Candidate, row: Row) -> Bool {
    guard c.type == row.expect["type"] else { return false }
    for (k, v) in row.expect where k != "type" {
        switch k {
        case "amount":
            let f = registry.questions["amount"]?.options.first { $0.key == v }?.spec.fraction
            if f != c.fields["consumed_fraction"]?.number && c.fields["consumed_ml"] == nil { return false }
        case "side":
            if v != "not_stated" && c.fields["side"]?.string != v { return false }
        case "contents":
            if c.fields["contents"]?.string != (v == "not_stated" ? nil : v) { return false }
        case "diaper_kind":
            if c.fields["kind"]?.string != (v == "not_stated" ? nil : v) { return false }
        case "solids_amount":
            if c.fields["amount"]?.string != v { return false }
        case "when":
            if v == "explicit" { continue }
            let mins = Int((reference.timeIntervalSince(c.occurredAt) / 60).rounded())
            if String(mins) != v && !(v == "now" && mins == 0) { return false }
        default: break
        }
    }
    return true
}

// 0. --export: the hierarchical questions (option order matters to Laya) and the gold answers
// per row, so the fine-tuning pipeline (ml/) trains on exactly what the app asks.
if let path = args.export {
    let ctx = InterpretContext(reference: reference, log: DerivedLog(events: []), enabledCategories: allCategories)
    let questions = VoiceInterpreter(model: KeywordDecisionModel(), registry: registry, design: .hierarchical)
        .questions(for: ctx)
    let exported: [String: Any] = [
        "questions": questions.map { q -> [String: Any] in
            ["id": q.id, "instructions": q.instructions,
             "options": q.options.map { ["key": $0.key, "description": $0.description ?? NSNull()] as [String: Any] }]
        },
        "rows": rows.map { row -> [String: Any] in
            var labels: [String: String] = [:]
            for q in questions { if let g = gold(row, question: q.id) { labels[q.id] = g } }
            return ["text": row.text, "gold": labels]
        },
    ]
    let data = try JSONSerialization.data(withJSONObject: exported, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: URL(fileURLWithPath: path))
    print("exported \(questions.count) questions and \(rows.count) rows to \(path)")
    exit(0)
}

// 1. raw answers for every row (one model pass each)
let interp = VoiceInterpreter(model: model, registry: registry, calibration: .identity, design: args.design)
var raws: [[String: DecisionAnswer]] = []
let started = Date()
for row in rows {
    raws.append(try await interp.rawAnswers(row.text, context: context(for: row)))
}
let msPerRow = Date().timeIntervalSince(started) * 1000 / Double(rows.count)

// 2. optional temperature fit on even rows; scores are then reported on odd rows only
var evalIdx = Array(rows.indices)
if args.fit {
    let trainIdx = rows.indices.filter { $0 % 2 == 0 }
    evalIdx = rows.indices.filter { $0 % 2 == 1 }
    var temps: [String: Double] = [:]
    let qids = Set(raws.flatMap(\.keys))
    for q in qids.sorted() {
        let samples = trainIdx.compactMap { i -> (DecisionAnswer, String)? in
            guard let a = raws[i][q], let g = gold(rows[i], question: q), a.options.contains(g) else { return nil }
            return (a, g)
        }
        guard samples.count >= 8 else { continue }
        var best = (t: 1.0, nll: Double.infinity)
        for t in stride(from: 0.05, through: 4.0, by: 0.05) {
            let c = Calibration(temperatures: [q: t])
            let nll = samples.map { -log(max(c.apply($0.0, question: q).p($0.1), 1e-9)) }.reduce(0, +)
            if nll < best.nll { best = (t, nll) }
        }
        temps[q] = (best.t * 100).rounded() / 100
    }
    calibration = Calibration(temperatures: temps, modelVersion: model.version)
}

// 3. score
let final = VoiceInterpreter(model: model, registry: registry, calibration: calibration, design: args.design)
var typeOK = 0, fullOK = 0, auto = 0, autoWrong = 0, pick = 0, pickOK = 0, full = 0, fullListOK = 0
var noneRows = 0, noneNoted = 0, entriesNoted = 0   // kept as a note without asking (isNotALog)
var perQuestion: [String: (ok: Int, n: Int)] = [:]
var failures: [[String: String]] = []
for i in evalIdx {
    let row = rows[i]
    let ctx = context(for: row)
    let result = final.interpret(raw: raws[i], transcript: row.text, context: ctx)
    let expected = row.expect["type"]!
    let best = result.best
    let gotType = result.isNote || result.tier == .fullList && expected == "none_of_these" ? (best?.type ?? "none_of_these") : (best?.type ?? "none_of_these")
    let isNone = expected == "none_of_these"
    let typeRight = isNone ? (result.tier == .fullList || best == nil) : gotType == expected
    if typeRight { typeOK += 1 }
    if isNone { noneRows += 1 }
    if result.isNotALog(policy: registry.policy) { if isNone { noneNoted += 1 } else { entriesNoted += 1 } }
    let allRight = isNone ? result.tier != .auto : (best.map { correct($0, row: row) } ?? false)
    if allRight { fullOK += 1 }
    switch result.tier {
    case .auto:
        auto += 1
        if !allRight { autoWrong += 1 }
    case .pick:
        pick += 1
        if isNone || result.candidates.prefix(2).contains(where: { correct($0, row: row) }) { pickOK += 1 }
    case .fullList:
        full += 1
        if isNone || result.candidates.contains(where: { correct($0, row: row) }) { fullListOK += 1 }
    }
    for (q, a) in raws[i] {
        guard let g = gold(row, question: q) else { continue }
        let cal = calibration.apply(a, question: q)
        var s = perQuestion[q] ?? (0, 0)
        s.n += 1
        if cal.top.key == g { s.ok += 1 }
        perQuestion[q] = s
    }
    if !allRight || result.tier != .auto {
        var failure = ["text": row.text, "expected": expected, "got": best?.label ?? "note", "tier": result.tier.rawValue,
                       "deciding": result.decidingQuestion ?? "", "ok": allRight ? "yes" : "no"]
        // the model's own top answer: a full list can mean "none of these" won (the app then lists every type)
        for q in ["category", "event_type"] {
            if let a = raws[i][q] { let t = calibration.apply(a, question: q).top; failure["model_\(q)"] = "\(t.key) \(Int((t.p * 100).rounded()))%" }
        }
        if let p = result.noneConfidence { failure["none_confidence"] = "\(Int((p * 100).rounded()))%" }
        failures.append(failure)
    }
}

let n = Double(evalIdx.count)
func pct(_ x: Int, _ d: Double) -> Double { d == 0 ? 0 : (Double(x) / d * 1000).rounded() / 10 }
let summary: [String: Any] = [
    "label": args.label ?? "\(args.model == "keywords" ? "keywords" : "laya")-\(args.design.rawValue)\(args.fit ? "-calibrated" : "")",
    "model": model.version,
    "design": args.design.rawValue,
    "calibrated": args.fit || args.calibration != nil,
    "rows_evaluated": evalIdx.count,
    "ms_per_utterance": Int(msPerRow),
    "type_accuracy": pct(typeOK, n),
    "full_accuracy": pct(fullOK, n),
    "auto_commit_rate": pct(auto, n),
    "wrong_auto_commit_rate": pct(autoWrong, Double(auto)),
    "pick_rate": pct(pick, n),
    "pick_contains_correct": pct(pickOK, Double(pick)),
    "full_list_rate": pct(full, n),
    // not-a-log sentences kept as a note without asking, and real entries wrongly kept as one (of all rows)
    "none_noted_rate": pct(noneNoted, Double(noneRows)),
    "lost_entry_rate": pct(entriesNoted, n),
    "per_question_accuracy": perQuestion.mapValues { pct($0.ok, Double($0.n)) },
    "temperatures": calibration.temperatures,
]
let json = try JSONSerialization.data(withJSONObject: summary, options: [.prettyPrinted, .sortedKeys])
print(String(decoding: json, as: UTF8.self))

if let out = args.out {
    try FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
    let name = summary["label"] as! String
    try json.write(to: URL(fileURLWithPath: "\(out)/\(name).json"))
    let fj = try JSONSerialization.data(withJSONObject: failures, options: [.prettyPrinted])
    try fj.write(to: URL(fileURLWithPath: "\(out)/\(name).review.json"))
    if args.fit {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        try enc.encode(calibration).write(to: URL(fileURLWithPath: "\(out)/\(name).calibration.json"))
    }
}
