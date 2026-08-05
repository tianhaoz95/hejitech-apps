package com.hejitech.contempo.agent

/**
 * User-controlled choice of how AgentClient splits work between the
 * on-device model (see OnDeviceLlm — free, no network) and the cloud
 * parseEntry/askAgent Genkit flows (costs money, always available).
 */
enum class InferencePreference {
    /** Default for Free accounts (see reports/pricing-proposal-v0.html §3.2) — never calls the cloud, fails loudly if on-device inference doesn't work, so this is a true test of the local model, not silently-billed cloud usage. */
    ON_DEVICE_ONLY,
    /** Try on-device first, fall back to cloud silently on any failure — gated behind Contempo Pro (SettingsViewModel.hasProEntitlement), since the fallback has real recurring cloud cost. */
    PREFER_ON_DEVICE,
    /** Skip on-device entirely — gated behind Contempo Pro, same reasoning as PREFER_ON_DEVICE. */
    CLOUD_ONLY,
}
