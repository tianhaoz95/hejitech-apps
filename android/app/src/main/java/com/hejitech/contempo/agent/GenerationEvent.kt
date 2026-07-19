package com.hejitech.contempo.agent

/**
 * Live progress during on-device text generation — see
 * OnDeviceLlm.generateTextStream. Confirmed empirically on-device (see
 * LiteRtLlm's kdoc) that the underlying SDK callback delivers genuinely
 * incremental chunks, not one final blob, so this can drive a real live
 * indicator rather than just a spinner.
 */
sealed interface GenerationEvent {
    /** Sent, waiting for the first chunk — this window is the model's prefill phase. */
    data object Prefilling : GenerationEvent

    /**
     * [textSoFar] is the full accumulated answer so far (not just the latest
     * chunk). [chunkCount] counts callbacks received — a close proxy for
     * tokens generated, not an exact BPE token count (the SDK doesn't expose
     * that), but the best live signal actually available.
     */
    data class Streaming(val textSoFar: String, val chunkCount: Int) : GenerationEvent
}
