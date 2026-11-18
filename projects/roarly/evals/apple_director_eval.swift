// Scores the app's director prompt with Apple's on-device model (FoundationModels) on this Mac.
// swift evals/apple_director_eval.swift
import Foundation
import FoundationModels

struct Case: Decodable { let story: [String]; let line: String; let cue: String; let play: Bool }
struct Suite: Decodable { let cases: [Case] }

let instructions = """
You add sound effects while a parent tells a children's story out loud. For the sound named, decide whether it should play right now. Answer yes if the thing is here now: arriving, appearing, chasing, acting or making its noise. Answer no if it is leaving, running away, gone, asleep, quiet, far away, only imagined, negated, or just being talked about. Reply with one word: yes or no.
"""

let url = URL(fileURLWithPath: "evals/director_cases.json")
let suite = try JSONDecoder().decode(Suite.self, from: Data(contentsOf: url))
print("available:", SystemLanguageModel.default.isAvailable, SystemLanguageModel.default.availability)
guard SystemLanguageModel.default.isAvailable else { exit(2) }
var right = 0
var times: [Double] = []
for c in suite.cases {
    var q = ""
    if !c.story.isEmpty { q += "Story so far: " + c.story.joined(separator: " ") + "\n" }
    q += "Just said: \"\(c.line)\"\nSound: the \(c.cue)\nPlay it now? yes or no"
    let t0 = Date()
    let s = LanguageModelSession(instructions: instructions)
    let r = try await s.respond(to: q, options: GenerationOptions(temperature: 0, maximumResponseTokens: 4))
    times.append(Date().timeIntervalSince(t0))
    let yes = r.content.lowercased().contains("yes")
    if yes == c.play { right += 1 }
    print(String(format: "%@ want %@  %.2fs  %@", yes ? "yes" : "no ", c.play ? "yes" : "no ", times.last!, c.line))
}
print("apple: \(right)/\(suite.cases.count), median \(times.sorted()[times.count / 2]) s")
