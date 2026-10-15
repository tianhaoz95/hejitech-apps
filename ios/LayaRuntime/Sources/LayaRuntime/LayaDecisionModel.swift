import Foundation
import LogCore
import llama

/// Runs the Laya decision model (ModernBERT, GGUF) in-process with llama.cpp. One forward pass per
/// question; each option is scored at its `[MASK]` marker from the per-token head output.
/// A port of llama.cpp's server-side decision path (see `LayaPrompt` for the pure parts).
public actor LayaDecisionModel: DecisionModel {
    public nonisolated let version: String
    private let modelURL: URL
    private var model: OpaquePointer?
    private var context: OpaquePointer?
    private var maxHeadTokens = 192
    private var temperatures: [String: Double] = [:]

    public init(modelURL: URL, version: String = "laya-q8_0") {
        self.modelURL = modelURL
        self.version = version
    }

    deinit {
        if let context { llama_free(context) }
        if let model { llama_model_free(model) }
    }

    public func warmUp() async {
        try? load()
    }

    /// Frees the weights (e.g. on memory pressure); the next call reloads them.
    public func unload() {
        if let context { llama_free(context) }
        if let model { llama_model_free(model) }
        context = nil
        model = nil
    }

    public var isLoaded: Bool { context != nil }

    private func load() throws {
        if context != nil { return }
        llama_backend_init()
        var mp = llama_model_default_params()
        #if targetEnvironment(simulator)
        mp.n_gpu_layers = 0
        #endif
        guard let m = llama_model_load_from_file(modelURL.path, mp) else {
            throw DecisionError.unavailable("could not load \(modelURL.lastPathComponent)")
        }
        var cp = llama_context_default_params()
        cp.n_ctx = 2048
        cp.n_batch = 2048
        cp.n_ubatch = 2048
        cp.embeddings = true
        cp.pooling_type = LLAMA_POOLING_TYPE_NONE
        cp.n_outputs_max = 2048
        cp.n_outputs_max_per_seq = 1
        let threads = Int32(max(1, min(4, ProcessInfo.processInfo.activeProcessorCount - 1)))
        cp.n_threads = threads
        cp.n_threads_batch = threads
        guard let c = llama_init_from_model(m, cp) else {
            llama_model_free(m)
            throw DecisionError.unavailable("could not create a llama context")
        }
        model = m
        context = c
        maxHeadTokens = Int(meta("modern-bert.decision.max_head_tokens") ?? "") ?? 192
        for key in ["choice", "choice.2", "choice.3_5", "choice.6_10", "choice.11"] {
            if let v = meta("modern-bert.decision.temperature.\(key)").flatMap(Double.init) { temperatures[key] = v }
        }
    }

    private func meta(_ key: String) -> String? {
        guard let model else { return nil }
        var buf = [CChar](repeating: 0, count: 256)
        let n = llama_model_meta_val_str(model, key, &buf, buf.count)
        return n < 0 ? nil : String(cString: buf)
    }

    public func decide(_ request: DecisionRequest) async throws -> [String: DecisionAnswer] {
        try load()
        var out: [String: DecisionAnswer] = [:]
        for q in request.questions {
            let scores = try score(state: request.state, question: q)
            let key = LayaPrompt.temperatureKey(options: q.options.count)
            let t = temperatures[key] ?? temperatures["choice"] ?? 1
            out[q.id] = DecisionAnswer(options: q.options.map(\.key), probabilities: LayaPrompt.probabilities(scores: scores, temperature: t))
        }
        return out
    }

    /// Raw head scores for each option of one question (exposed for parity tests).
    public func score(state: String, question: DecisionQuestion) throws -> [Float] {
        try load()
        guard let model, let context else { throw DecisionError.unavailable("not loaded") }
        let vocab = llama_model_get_vocab(model)
        let prompt = LayaPrompt.render(state: state, question: question)
        let raw = tokenize(prompt, vocab: vocab)
        let layout = try LayaPrompt.layout(tokens: raw, mask: llama_vocab_mask(vocab), sep: llama_vocab_sep(vocab),
                                           nOptions: question.options.count, maxHeadTokens: maxHeadTokens)

        llama_memory_clear(llama_get_memory(context), true)
        let n = Int32(layout.tokens.count)
        var batch = llama_batch_init(n, 0, 1)
        defer { llama_batch_free(batch) }
        let markerSet = Set(layout.markers)
        for (i, tok) in layout.tokens.enumerated() {
            batch.token[i] = tok
            batch.pos[i] = Int32(i)
            batch.n_seq_id[i] = 1
            batch.seq_id[i]![0] = 0
            batch.logits[i] = markerSet.contains(i) ? 1 : 0
        }
        batch.n_tokens = n
        if llama_decode(context, batch) != 0 {
            guard llama_encode(context, batch) == 0 else { throw DecisionError.unavailable("decode failed") }
        }
        return try layout.markers.map { pos in
            guard let embd = llama_get_embeddings_ith(context, Int32(pos)) else {
                throw DecisionError.badResponse("no output at marker \(pos)")
            }
            return embd[LayaPrompt.choiceColumn]
        }
    }

    private func tokenize(_ text: String, vocab: OpaquePointer?) -> [Int32] {
        let utf8 = Array(text.utf8CString)
        let len = Int32(utf8.count - 1)
        var tokens = [llama_token](repeating: 0, count: Int(len) + 8)
        var n = llama_tokenize(vocab, text, len, &tokens, Int32(tokens.count), false, true)
        if n < 0 {
            tokens = [llama_token](repeating: 0, count: Int(-n))
            n = llama_tokenize(vocab, text, len, &tokens, Int32(tokens.count), false, true)
        }
        return Array(tokens.prefix(Int(max(0, n))))
    }
}
