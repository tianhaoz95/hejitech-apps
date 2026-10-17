package com.hejitech.contempo.agent

/**
 * Whether AI-dependent actions (parse, chat) should be enabled right now.
 * Deliberately plain data, no string resources — resolved to copy at the
 * Composable layer (see CaptureScreen/ChatScreen), keeping this reachable
 * from ViewModels without an Android Context.
 *
 * Only ON_DEVICE_ONLY ever blocks: PREFER_ON_DEVICE already has a cloud
 * fallback built into AgentClient, so there's nothing to gate there — the
 * call just quietly uses cloud until the on-device model catches up.
 */
sealed interface AiAvailability {
    data object Ready : AiAvailability
    data object Checking : AiAvailability
    data object Downloading : AiAvailability
    data object Unavailable : AiAvailability
    data class Failed(val message: String) : AiAvailability
}

fun aiAvailability(preference: InferencePreference, onDeviceStatus: OnDeviceModelUiStatus): AiAvailability {
    if (preference != InferencePreference.ON_DEVICE_ONLY) return AiAvailability.Ready
    return when (onDeviceStatus) {
        is OnDeviceModelUiStatus.Available -> AiAvailability.Ready
        is OnDeviceModelUiStatus.Checking, is OnDeviceModelUiStatus.NotDownloaded -> AiAvailability.Checking
        is OnDeviceModelUiStatus.Downloading -> AiAvailability.Downloading
        is OnDeviceModelUiStatus.Unavailable -> AiAvailability.Unavailable
        is OnDeviceModelUiStatus.Failed -> AiAvailability.Failed(onDeviceStatus.message)
    }
}
