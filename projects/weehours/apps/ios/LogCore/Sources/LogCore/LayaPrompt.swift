import Foundation

/// The pure parts of running Laya on-device, ported from llama.cpp `tools/server/server-decision.cpp`
/// (`render`, `fill_task_laya`, `format_answer`). The llama.cpp calls live in the app's `LayaRuntime`.
public enum LayaPrompt {
    /// Column of the per-token head output used for each question type (choice, score, noul).
    public static let choiceColumn = 0

    /// The GGUF `tokenizer.chat_template.systemone` template for a `choice` question:
    /// `[CLS]choice question: {instructions}[SEP]([MASK] key: description)*[SEP]{state}[SEP]`
    public static func render(state: String, question: DecisionQuestion) -> String {
        func clean(_ s: String) -> String { s.replacingOccurrences(of: "[MASK]", with: " ") }
        var out = "[CLS]choice question: \(clean(question.instructions))[SEP]"
        for o in question.options {
            out += "[MASK] \(clean(o.key))"
            if let d = o.description, !d.isEmpty { out += ": \(clean(d))" }
        }
        out += "[SEP]\(clean(state))[SEP]"
        return out
    }

    public struct Layout: Equatable {
        public let tokens: [Int32]
        public let markers: [Int]
    }

    public enum LayoutError: Error { case unexpected }

    /// Cuts options and question to the head budget the model was trained with, and returns the
    /// marker positions whose outputs score each option.
    public static func layout(tokens: [Int32], mask: Int32, sep: Int32, nOptions: Int,
                              maxHeadTokens: Int, maxOptionTokens: Int = 48) throws -> Layout {
        let markers = tokens.indices.filter { tokens[$0] == mask }
        guard markers.count == nOptions, markers[0] >= 2, tokens[markers[0] - 1] == sep, tokens.last == sep else {
            throw LayoutError.unexpected
        }
        let headEnd = markers[0] - 1
        guard let optsEnd = tokens[markers.last!...].firstIndex(of: sep), optsEnd + 1 < tokens.count else {
            throw LayoutError.unexpected
        }
        var options: [[Int32]] = []
        for i in 0..<nOptions {
            let end = i + 1 < nOptions ? markers[i + 1] : optsEnd
            options.append(Array(tokens[markers[i]..<end]))
        }
        func setMax(_ n: Int) -> Int {
            var total = 0
            for i in options.indices {
                if options[i].count > n { options[i] = Array(options[i].prefix(n)) }
                total += options[i].count
            }
            return total
        }
        var nOptionTokens = setMax(maxOptionTokens + 1)
        if nOptionTokens + 16 > maxHeadTokens {
            nOptionTokens = setMax(max(4, (maxHeadTokens - min(maxHeadTokens, 16)) / nOptions))
        }
        let nQuestionMax = max(8, maxHeadTokens - min(maxHeadTokens, nOptionTokens))

        var out: [Int32] = [tokens[0]]
        out.append(contentsOf: tokens[1..<min(headEnd, 1 + nQuestionMax)])
        out.append(sep)
        var outMarkers: [Int] = []
        for o in options {
            outMarkers.append(out.count)
            out.append(contentsOf: o)
        }
        out.append(contentsOf: tokens[optsEnd...])
        return Layout(tokens: out, markers: outMarkers)
    }

    /// The temperature bucket used by llama.cpp for a choice question with `n` options.
    public static func temperatureKey(options n: Int) -> String {
        let bucket = n <= 2 ? "2" : n <= 5 ? "3_5" : n <= 10 ? "6_10" : "11"
        return "choice.\(bucket)"
    }

    public static func probabilities(scores: [Float], temperature: Double) -> [Double] {
        let logits = scores.map(Double.init)
        let m = logits.max() ?? 0
        let ex = logits.map { exp(($0 - m) / temperature) }
        let s = ex.reduce(0, +)
        return ex.map { $0 / s }
    }
}
