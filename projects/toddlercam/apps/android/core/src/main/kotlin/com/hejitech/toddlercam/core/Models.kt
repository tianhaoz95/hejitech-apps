package com.hejitech.toddlercam.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
enum class FaceAnchorPosition {
    FOREHEAD,
    EYES,
    HEAD
}

@Serializable
enum class FaceEmojiType(
    val rawValue: String,
    val emoji: String,
    val displayName: String,
    val anchorPosition: FaceAnchorPosition
) {
    CROWN("crown", "👑", "Crown", FaceAnchorPosition.FOREHEAD),
    LION("lion", "🦁", "Lion", FaceAnchorPosition.HEAD),
    SUNGLASSES("sunglasses", "🕶️", "Sunglasses", FaceAnchorPosition.EYES),
    KITTY("kitty", "🐱", "Kitty", FaceAnchorPosition.HEAD),
    PUPPY("puppy", "🐶", "Puppy", FaceAnchorPosition.HEAD),
    UNICORN("unicorn", "🦄", "Unicorn", FaceAnchorPosition.FOREHEAD),
    PANDA("panda", "🐼", "Panda", FaceAnchorPosition.HEAD),
    BUNNY("bunny", "🐰", "Bunny", FaceAnchorPosition.FOREHEAD),
    STAR_EYES("starEyes", "⭐️", "Star Eyes", FaceAnchorPosition.EYES);

    companion object {
        fun fromRaw(raw: String): FaceEmojiType? = entries.firstOrNull { it.rawValue == raw }
    }
}

@Serializable
enum class SoundType(
    val rawValue: String,
    val displayName: String,
    val emoji: String,
    val isAttentionGrabber: Boolean = false
) {
    SHUTTER("shutter", "Camera Click", "📸", isAttentionGrabber = false),
    WOOF("woof", "Puppy Bark", "🐶", isAttentionGrabber = true),
    MEOW("meow", "Kitten Meow", "🐱", isAttentionGrabber = true),
    QUACK("quack", "Duck Quack", "🦆", isAttentionGrabber = true),
    GIGGLE("giggle", "Baby Giggle", "👶", isAttentionGrabber = true),
    HORN("horn", "Party Horn", "🪈", isAttentionGrabber = false),
    BOING("boing", "Spring Boing", "🌀", isAttentionGrabber = false),
    POP("pop", "Bubble Pop", "🫧", isAttentionGrabber = false);

    companion object {
        fun fromRaw(raw: String): SoundType? = entries.firstOrNull { it.rawValue == raw }
    }
}

@Serializable
enum class CameraCaptureMode(val rawValue: String) {
    PHOTO("Photo"),
    VIDEO("Video");

    companion object {
        fun fromRaw(raw: String): CameraCaptureMode = entries.firstOrNull { it.rawValue.equals(raw, ignoreCase = true) } ?: PHOTO
    }
}

@Serializable
enum class CameraPosition(val rawValue: String) {
    BACK("back"),
    FRONT("front");

    companion object {
        fun fromRaw(raw: String): CameraPosition = if (raw.equals("front", ignoreCase = true)) FRONT else BACK
    }
}

@Serializable
data class ToddlerState(
    val isToddlerLocked: Boolean = false,
    val captureMode: String = CameraCaptureMode.PHOTO.rawValue,
    val isRecordingVideo: Boolean = false,
    val videoRecordingDurationSec: Long = 0,
    val primaryPosition: String = CameraPosition.BACK.rawValue,
    val activeFaceEmoji: String = "none",
    val lastPhotoTimestamp: Long = 0,
    val timestamp: Long = System.currentTimeMillis()
) {
    fun toJson(): String = jsonInstance.encodeToString(this)

    companion object {
        private val jsonInstance = Json { ignoreUnknownKeys = true }
        fun fromJson(json: String): ToddlerState? = runCatching { jsonInstance.decodeFromString<ToddlerState>(json) }.getOrNull()
    }
}

object WatchConstants {
    const val PATH_ACTION = "/toddlercam/action"
    const val PATH_STATE = "/toddlercam/state"
    const val PATH_THUMBNAIL = "/toddlercam/thumbnail"

    const val ACTION_SHUTTER = "shutter"
    const val ACTION_PLAY_SOUND = "playSound"
    const val ACTION_SWAP_CAMERAS = "swapCameras"
    const val ACTION_TOGGLE_LOCK = "toggleLock"
    const val ACTION_SET_EMOJI = "setFaceEmoji"
    const val ACTION_TOGGLE_CAPTURE_MODE = "toggleCaptureMode"
    const val ACTION_START_VIDEO = "startVideoRecording"
    const val ACTION_STOP_VIDEO = "stopVideoRecording"
    const val ACTION_REQUEST_STATUS = "requestStatus"

    const val KEY_ACTION = "action"
    const val KEY_SOUND = "sound"
    const val KEY_EMOJI = "emoji"
    const val KEY_MODE = "mode"
}

@Serializable
data class WatchActionMessage(
    val action: String,
    val sound: String? = null,
    val emoji: String? = null,
    val mode: String? = null
) {
    fun toJson(): String = jsonInstance.encodeToString(this)

    companion object {
        private val jsonInstance = Json { ignoreUnknownKeys = true }
        fun fromJson(json: String): WatchActionMessage? = runCatching { jsonInstance.decodeFromString<WatchActionMessage>(json) }.getOrNull()
    }
}
