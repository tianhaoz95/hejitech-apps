package com.hejitech.contempo.agent

/**
 * Coarse progress signal for AgentClient.parseEntry — surfaced by
 * CaptureScreen while parsing a voice/text draft so a slow on-device→cloud
 * fallback reads as "working through steps," not hung. Real signal (tied to
 * which branch parseEntry is actually taking), not a synthetic timer.
 */
enum class ParsingStage {
    IDLE,
    READING,
    TRYING_ON_DEVICE,
    FALLING_BACK_TO_CLOUD,
    STRUCTURING,
}
