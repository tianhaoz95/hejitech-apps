// Trains Roarly's on-device director: a Create ML text classifier ("play" / "skip") over story
// sentences with the sound's name masked as THING / COSA / 东西. Data: ml/generate.swift.
// Evaluates on things it never saw (held out) and (for English) evals/director_cases.json, then
// writes the .mlmodel.
// swift ml/train.swift <data.jsonl> <out.mlmodel> [maxent|bert] [en|es|zh]
import CreateML
import Foundation
import NaturalLanguage

let args = CommandLine.arguments
let lang = args.count > 4 ? args[4] : "en"

func mask(_ text: String, _ thing: String, lang: String) -> String {
    switch lang {
    case "zh":
        return text.replacingOccurrences(of: thing, with: "东西")
    case "es":
        var t = " " + text + " "
        var forms = [thing + "es", thing + "s", thing]
        if thing.hasSuffix("z") { forms.append(String(thing.dropLast()) + "ces") }
        let folded = thing.folding(options: .diacriticInsensitive, locale: .current)
        if folded != thing { forms += [folded + "es", folded + "s", folded] }
        for form in Array(Set(forms)).sorted(by: { $0.count > $1.count }) {
            let esc = NSRegularExpression.escapedPattern(for: form)
            t = t.replacingOccurrences(of: "(?i)\\b\(esc)\\b", with: "COSA", options: [.regularExpression])
        }
        return t.trimmingCharacters(in: .whitespaces)
    default:
        var t = " " + text + " "
        for form in [thing + "ies", thing + "es", thing + "s", thing].sorted(by: { $0.count > $1.count }) {
            t = t.replacingOccurrences(of: "\\b\(form)\\b", with: "THING", options: [.regularExpression, .caseInsensitive])
        }
        return t.trimmingCharacters(in: .whitespaces)
    }
}

let rows = try String(contentsOfFile: args[1], encoding: .utf8).split(separator: "\n").compactMap {
    try? JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: Any]
}

let heldOut: Set<String>
let nlLanguage: NLLanguage
switch lang {
case "es":
    heldOut = ["lobo", "gato", "barco", "búho", "dragón", "campana"]
    nlLanguage = .spanish
case "zh":
    heldOut = ["大灰狼", "小猫", "轮船", "猫头鹰", "巨龙", "门铃"]
    nlLanguage = .simplifiedChinese
default:
    heldOut = ["wolf", "kitten", "boat", "owl", "dragon", "bell"]
    nlLanguage = .english
}

var trainText: [String] = [], trainLabel: [String] = [], testText: [String] = [], testLabel: [String] = []
for r in rows {
    guard let text = r["text"] as? String, let thing = r["thing"] as? String, let play = r["play"] as? Bool else { continue }
    let x = mask(text, thing, lang: lang), y = play ? "play" : "skip"
    if heldOut.contains(thing) { testText.append(x); testLabel.append(y) } else { trainText.append(x); trainLabel.append(y) }
}
print("[\(lang)] train \(trainText.count), held-out \(testText.count)")
let algo: MLTextClassifier.ModelAlgorithmType = (args.count > 3 && args[3] == "bert")
    ? .transferLearning(.bertEmbedding, revision: 1) : .maxEnt(revision: 1)
let df = try DataFrameHelper.make(trainText, trainLabel)
let model = try MLTextClassifier(trainingData: df, textColumn: "text", labelColumn: "label", parameters: .init(algorithm: algo, language: nlLanguage))
var right = 0
for (x, y) in zip(testText, testLabel) where (try? model.prediction(from: x)) == y { right += 1 }
print(String(format: "[\(lang)] held-out things: %d/%d (%.1f%%)", right, testText.count, 100.0 * Double(right) / Double(max(1, testText.count))))

if lang == "en" {
    struct Case: Decodable { let story: [String]; let line: String; let cue: String; let play: Bool }
    struct Suite: Decodable { let cases: [Case] }
    let suite = try JSONDecoder().decode(Suite.self, from: Data(contentsOf: URL(fileURLWithPath: "evals/director_cases.json")))
    var r2 = 0
    for c in suite.cases {
        let p = try model.prediction(from: mask(c.line, c.cue, lang: "en"))
        if (p == "play") == c.play { r2 += 1 } else { print("  miss: \(c.line) → \(p)") }
    }
    print("director_cases: \(r2)/\(suite.cases.count)")
}

try model.write(
    to: URL(fileURLWithPath: args[2]),
    metadata: .init(author: "HEJI TECHNOLOGY LLC", shortDescription: "Roarly director (\(lang)): should the sound play now? play/skip", version: "1")
)

enum DataFrameHelper {
    static func make(_ text: [String], _ label: [String]) throws -> MLDataTable {
        try MLDataTable(dictionary: ["text": text, "label": label])
    }
}
