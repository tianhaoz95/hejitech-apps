package com.hejitech.contempo.agent

/**
 * User-controlled choice of how AgentClient splits work between the
 * on-device model (see OnDeviceLlm — free, no network) and the cloud
 * parseEntry/askAgent Genkit flows (costs money, always available).
 */
enum class InferencePreference {
    /** Never calls the cloud — fails loudly if on-device inference doesn't work, so this is a true test of the local model, not silently-billed cloud usage. */
    ON_DEVICE_ONLY,
    /** Default: try on-device first, fall back to cloud silently on any failure. */
    PREFER_ON_DEVICE,
    /** Skip on-device entirely — useful for comparing answer quality or debugging without needing the on-device model downloaded. */
    CLOUD_ONLY,
}
