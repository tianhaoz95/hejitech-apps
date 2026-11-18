// Trains Roarly's on-device director: a Create ML text classifier ("play" / "skip") over story
// sentences with the sound's name masked as THING. Data: ml/generate.swift. Evaluates on things it
// never saw (held out) and on evals/director_cases.json, then writes the .mlmodel.
// swift ml/train.swift <data.jsonl> <out.mlmodel> [maxent|bert]
import CreateML
import Foundation
import NaturalLanguage

func mask(_ text: String, _ thing: String) -> String {
    var t = " " + text + " "
    for form in [thing + "ies", thing + "es", thing + "s", thing].sorted(by: { $0.count > $1.count }) {
        t = t.replacingOccurrences(of: "\\b\(form)\\b", with: "THING", options: [.regularExpression, .caseInsensitive])
    }
    return t.trimmingCharacters(in: .whitespaces)
}

let args = CommandLine.arguments
let rows = try String(contentsOfFile: args[1], encoding: .utf8).split(separator: "\n").compactMap {
    try? JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: Any]
}
let heldOut: Set<String> = ["wolf", "kitten", "boat", "owl", "dragon", "bell"]
var trainText: [String] = [], trainLabel: [String] = [], testText: [String] = [], testLabel: [String] = []
for r in rows {
    guard let text = r["text"] as? String, let thing = r["thing"] as? String, let play = r["play"] as? Bool else { continue }
    let x = mask(text, thing), y = play ? "play" : "skip"
    if heldOut.contains(thing) { testText.append(x); testLabel.append(y) } else { trainText.append(x); trainLabel.append(y) }
}
print("train \(trainText.count), held-out \(testText.count)")
let algo: MLTextClassifier.ModelAlgorithmType = (args.count > 3 && args[3] == "bert")
    ? .transferLearning(.bertEmbedding, revision: 1) : .maxEnt(revision: 1)
let df = try DataFrameHelper.make(trainText, trainLabel)
let model = try MLTextClassifier(trainingData: df, textColumn: "text", labelColumn: "label", parameters: .init(algorithm: algo))
var right = 0
for (x, y) in zip(testText, testLabel) where (try? model.prediction(from: x)) == y { right += 1 }
print(String(format: "held-out things: %d/%d (%.1f%%)", right, testText.count, 100.0 * Double(right) / Double(testText.count)))

struct Case: Decodable { let story: [String]; let line: String; let cue: String; let play: Bool }
struct Suite: Decodable { let cases: [Case] }
let suite = try JSONDecoder().decode(Suite.self, from: Data(contentsOf: URL(fileURLWithPath: "evals/director_cases.json")))
var r2 = 0
for c in suite.cases {
    let p = try model.prediction(from: mask(c.line, c.cue))
    if (p == "play") == c.play { r2 += 1 } else { print("  miss: \(c.line) → \(p)") }
}
print("director_cases: \(r2)/\(suite.cases.count)")
try model.write(to: URL(fileURLWithPath: args[2]), metadata: .init(author: "HEJI TECHNOLOGY LLC", shortDescription: "Roarly director: should the sound of THING play now? play/skip", version: "1"))

enum DataFrameHelper {
    static func make(_ text: [String], _ label: [String]) throws -> MLDataTable {
        try MLDataTable(dictionary: ["text": text, "label": label])
    }
}
