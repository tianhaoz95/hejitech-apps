// Writes labeled story sentences for Roarly's on-device director classifier, with Apple's
// on-device model (FoundationModels) as the writer. Each sentence mentions a thing in one
// situation; the situation gives the label (play now: yes/no). Output: JSON lines.
// swift ml/generate.swift <out.jsonl> [per-situation count]
import Foundation
import FoundationModels

let things = ["lion", "tiger", "bear", "wolf", "elephant", "monkey", "dinosaur", "dragon", "snake", "whale",
              "dog", "puppy", "cat", "kitten", "cow", "horse", "sheep", "owl", "frog", "bee", "bird", "seagull",
              "train", "car", "boat", "airplane", "rocket", "clock", "bell", "doorbell", "fairy", "wizard"]
let situations: [(String, Bool, String)] = [
    ("arrives", true, "the THING suddenly appears, arrives, jumps out or comes closer right now"),
    ("acts", true, "the THING is doing something lively right now in the scene (chasing, running toward someone, looking at someone, jumping, waking up)"),
    ("sound", true, "the THING makes its noise right now (roars, barks, hoots, honks, rings, and so on)"),
    ("intro", true, "the THING is introduced as being right there in the story (there was a THING, here comes the THING)"),
    ("question", true, "the storyteller asks the child what the THING says or what sound it makes"),
    ("leaves", false, "the THING is leaving, running away, going home or disappearing"),
    ("sleeps", false, "the THING is asleep, resting, quiet or silent"),
    ("absent", false, "there is no THING, nobody saw a THING, or the THING is not there (negated)"),
    ("remembers", false, "someone remembers, misses, dreams of or imagines the THING; it is not in the scene"),
    ("far", false, "the THING is far away, on the other side of the world, or only talked about as a fact"),
]
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "data.jsonl"
let per = CommandLine.arguments.count > 2 ? Int(CommandLine.arguments[2])! : 5
FileManager.default.createFile(atPath: out, contents: nil)
let handle = try FileHandle(forWritingTo: URL(fileURLWithPath: out))
var written = 0
for thing in things {
    for (name, play, desc) in situations {
        let session = LanguageModelSession(instructions: "You write single sentences from children's stories told out loud by a parent. Plain, varied, natural spoken English. One sentence per line, no numbering, no quotes.")
        let prompt = "Write \(per) different sentences where \(desc.replacingOccurrences(of: "THING", with: thing)). Each sentence must contain the word \"\(thing)\". Vary the wording and length."
        do {
            let r = try await session.respond(to: prompt, options: GenerationOptions(temperature: 0.9, maximumResponseTokens: 300))
            for line in r.content.split(separator: "\n") {
                var s = line.trimmingCharacters(in: .whitespaces)
                while let f = s.first, "-•*0123456789.) ".contains(f) { s.removeFirst() }
                s = s.trimmingCharacters(in: CharacterSet(charactersIn: "\"“” "))
                guard s.lowercased().contains(thing), s.count > 8 else { continue }
                let row: [String: Any] = ["text": s, "thing": thing, "situation": name, "play": play]
                handle.write(try JSONSerialization.data(withJSONObject: row) + Data("\n".utf8))
                written += 1
            }
        } catch {
            print("skip \(thing)/\(name): \(error)")
        }
    }
    print("\(thing): \(written) so far")
}
print("done: \(written)")
