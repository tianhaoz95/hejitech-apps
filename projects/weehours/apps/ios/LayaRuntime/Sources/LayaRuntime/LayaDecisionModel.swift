import Foundation
import LogCore
import llama

/// Runs the Laya decision model (ModernBERT, GGUF) in-process with llama.cpp. Questions are
/// packed into a multi-sequence batch so the encoder evaluates them together with per-sequence
/// attention isolation; each option is scored at its `[MASK]` marker from the per-token head output.
/// A port of llama.cpp's server-side decision path (see `LayaPrompt` for the pure parts).
public actor LayaDecisionModel: DecisionModel {
    public nonisolated let version: String
    private let modelURL: URL
    private var model: OpaquePointer?
    private var context: OpaquePointer?
    private var maxHeadTokens = 192
    private var temperatures: [String: Double] = [:]
    private var isShaderWarmed = false

    private static let contextTokens: UInt32 = 1024
    private static let maxBatchSequences: Int = 16

    private struct QuestionCacheKey: Hashable {
        let id: String
        let instructions: String
        let optionKeys: [String]
        let optionDescriptions: [String?]
    }

    private struct CachedQuestionHead {
        let prefixTokens: [Int32]
        let markers: [Int]
    }
    private var cachedHeads: [QuestionCacheKey: CachedQuestionHead] = [:]

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
        guard !isShaderWarmed, let model, let context else { return }
        let vocab = llama_model_get_vocab(model)
        let cls = llama_vocab_bos(vocab) >= 0 ? llama_vocab_bos(vocab) : llama_vocab_sep(vocab)
        let sep = llama_vocab_sep(vocab)
        // Run both a non-tile-aligned (3 tokens, bcm=1) and tile-aligned (32 tokens, bcm=0) dummy
        // encode so sched_reserve() and all Metal compute pipelines compile during background
        // warmUp instead of stalling the user's first voice log.
        for count in [3, 32] {
            var batch = llama_batch_init(Int32(count), 0, 1)
            for i in 0..<count {
                batch.token[i] = (i == 0) ? cls : sep
                batch.pos[i] = Int32(i)
                batch.n_seq_id[i] = 1
                batch.seq_id[i]![0] = 0
                batch.logits[i] = 1
            }
            batch.n_tokens = Int32(count)
            _ = llama_encode(context, batch)
            llama_batch_free(batch)
        }
        isShaderWarmed = true
    }

    /// Frees the weights (e.g. on memory pressure); the next call reloads them.
    public func unload() {
        if let context { llama_free(context) }
        if let model { llama_model_free(model) }
        context = nil
        model = nil
        isShaderWarmed = false
        cachedHeads.removeAll()
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
        cp.n_ctx = Self.contextTokens
        cp.n_batch = Self.contextTokens
        cp.n_ubatch = Self.contextTokens
        cp.embeddings = true
        cp.pooling_type = LLAMA_POOLING_TYPE_NONE
        cp.n_outputs_max = Self.contextTokens
        cp.n_outputs_max_per_seq = 1
        cp.n_seq_max = UInt32(Self.maxBatchSequences)
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
        guard let model, let context else { throw DecisionError.unavailable("not loaded") }
        guard !request.questions.isEmpty else { return [:] }
        let vocab = llama_model_get_vocab(model)
        let layouts = try buildLayouts(for: request, vocab: vocab)

        var out: [String: DecisionAnswer] = [:]
        let tokenBudget = Int(Self.contextTokens)
        var start = 0
        while start < request.questions.count {
            var end = start
            var batchTokens = 0
            while end < request.questions.count && (end - start) < Self.maxBatchSequences {
                let nextCount = layouts[end].tokens.count
                if end > start && batchTokens + nextCount > tokenBudget {
                    break
                }
                batchTokens += nextCount
                end += 1
            }
            let qSlice = request.questions[start..<end]
            let lSlice = Array(layouts[start..<end])
            let batchScores = try scoreBatch(lSlice, context: context)
            for (q, scores) in zip(qSlice, batchScores) {
                let key = LayaPrompt.temperatureKey(options: q.options.count)
                let t = temperatures[key] ?? temperatures["choice"] ?? 1
                out[q.id] = DecisionAnswer(options: q.options.map(\.key), probabilities: LayaPrompt.probabilities(scores: scores, temperature: t))
            }
            start = end
        }
        return out
    }

    /// Raw head scores for each option of one question (exposed for parity tests).
    public func score(state: String, question: DecisionQuestion) throws -> [Float] {
        try load()
        guard let model, let context else { throw DecisionError.unavailable("not loaded") }
        let vocab = llama_model_get_vocab(model)
        let layouts = try buildLayouts(for: DecisionRequest(state: state, questions: [question]), vocab: vocab)
        return try scoreBatch(layouts, context: context)[0]
    }

    private func buildLayouts(for request: DecisionRequest, vocab: OpaquePointer?) throws -> [LayaPrompt.Layout] {
        let mask = llama_vocab_mask(vocab)
        let sep = llama_vocab_sep(vocab)
        let cleanState = LayaPrompt.clean(request.state)
        let stateRaw = tokenize("[SEP]\(cleanState)[SEP]", vocab: vocab)
        let stateSuffix = stateRaw.first == sep ? Array(stateRaw.dropFirst()) : stateRaw
        let maxTotal = Int(Self.contextTokens)

        return try request.questions.map { q in
            let cacheKey = QuestionCacheKey(
                id: q.id,
                instructions: q.instructions,
                optionKeys: q.options.map(\.key),
                optionDescriptions: q.options.map(\.description)
            )
            let head: CachedQuestionHead
            if let existing = cachedHeads[cacheKey] {
                head = existing
            } else {
                let dummyPrompt = LayaPrompt.render(state: "x", question: q)
                let raw = tokenize(dummyPrompt, vocab: vocab)
                let dummyLayout = try LayaPrompt.layout(tokens: raw, mask: mask, sep: sep, nOptions: q.options.count, maxHeadTokens: maxHeadTokens)
                guard let lastMarker = dummyLayout.markers.last,
                      let optsEnd = dummyLayout.tokens[lastMarker...].firstIndex(of: sep) else {
                    throw LayaPrompt.LayoutError.unexpected
                }
                let built = CachedQuestionHead(
                    prefixTokens: Array(dummyLayout.tokens.prefix(through: optsEnd)),
                    markers: dummyLayout.markers
                )
                cachedHeads[cacheKey] = built
                head = built
            }

            let budget = max(2, maxTotal - head.prefixTokens.count)
            var tokens = [Int32]()
            tokens.reserveCapacity(min(maxTotal, head.prefixTokens.count + stateSuffix.count))
            tokens.append(contentsOf: head.prefixTokens)
            if stateSuffix.count <= budget {
                tokens.append(contentsOf: stateSuffix)
            } else {
                tokens.append(contentsOf: stateSuffix.prefix(budget - 1))
                tokens.append(sep)
            }
            return LayaPrompt.Layout(tokens: tokens, markers: head.markers)
        }
    }

    private func scoreBatch(_ layouts: [LayaPrompt.Layout], context: OpaquePointer) throws -> [[Float]] {
        let totalTokens = layouts.reduce(0) { $0 + $1.tokens.count }
        var batch = llama_batch_init(Int32(totalTokens), 0, 1)
        defer { llama_batch_free(batch) }

        var offset = 0
        var questionOffsets: [Int] = []
        questionOffsets.reserveCapacity(layouts.count)

        for (seqIdx, layout) in layouts.enumerated() {
            questionOffsets.append(offset)
            let seqId = Int32(seqIdx)
            for (pos, tok) in layout.tokens.enumerated() {
                let idx = offset + pos
                batch.token[idx] = tok
                batch.pos[idx] = Int32(pos)
                batch.n_seq_id[idx] = 1
                batch.seq_id[idx]![0] = seqId
                batch.logits[idx] = 1
            }
            offset += layout.tokens.count
        }
        batch.n_tokens = Int32(totalTokens)
        guard llama_encode(context, batch) == 0 else { throw DecisionError.unavailable("encode failed") }

        var results: [[Float]] = []
        results.reserveCapacity(layouts.count)
        for (qIdx, layout) in layouts.enumerated() {
            let base = questionOffsets[qIdx]
            let scores: [Float] = try layout.markers.map { markerPos in
                guard let embd = llama_get_embeddings_ith(context, Int32(base + markerPos)) else {
                    throw DecisionError.badResponse("no output at marker \(base + markerPos)")
                }
                return embd[LayaPrompt.choiceColumn]
            }
            results.append(scores)
        }
        return results
    }

    private func tokenize(_ text: String, vocab: OpaquePointer?) -> [Int32] {
        text.utf8CString.withUnsafeBufferPointer { buf in
            let len = Int32(max(0, buf.count - 1))
            var tokens = [llama_token](repeating: 0, count: Int(len) + 8)
            var n = llama_tokenize(vocab, buf.baseAddress, len, &tokens, Int32(tokens.count), false, true)
            if n < 0 {
                tokens = [llama_token](repeating: 0, count: Int(-n))
                n = llama_tokenize(vocab, buf.baseAddress, len, &tokens, Int32(tokens.count), false, true)
            }
            return Array(tokens.prefix(Int(max(0, n))))
        }
    }
}
