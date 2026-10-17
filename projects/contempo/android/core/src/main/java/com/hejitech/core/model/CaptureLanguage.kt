package com.hejitech.core.model

/**
 * Which Whisper checkpoint/config a capture should be (or was) transcribed
 * with — see WhisperTranscriber's kdoc (android/app) for why ENGLISH and
 * CHINESE each need a dedicated on-device model rather than a single
 * multilingual one. Lives in core (not app) because it has to travel with a
 * capture through AudioCaptureQueue's Firestore doc, same reason
 * CaptureSource/EntryCategory live here too.
 */
enum class CaptureLanguage(val firestoreValue: String) {
    ENGLISH("en"),
    CHINESE("zh"),
    AUTO("auto");

    companion object {
        fun fromFirestoreValue(value: String): CaptureLanguage =
            entries.find { it.firestoreValue == value } ?: AUTO
    }
}
