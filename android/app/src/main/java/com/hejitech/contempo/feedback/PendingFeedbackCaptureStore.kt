package com.hejitech.contempo.feedback

import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Holds the most recent shake-captured screenshot, if any is awaiting
 * annotation — MainActivity renders FeedbackAnnotationScreen as a full-screen
 * overlay whenever this is non-null, regardless of which bottom-nav tab is
 * showing underneath. Plain in-memory singleton, not persisted — a pending
 * capture that never gets submitted before the process dies is simply lost,
 * same as an unsent Quick Capture recording would be.
 */
object PendingFeedbackCaptureStore {
    private val _pendingCapture = MutableStateFlow<File?>(null)
    val pendingCapture: StateFlow<File?> = _pendingCapture.asStateFlow()

    fun setCapture(file: File) {
        _pendingCapture.value = file
    }

    fun clear() {
        _pendingCapture.value = null
    }
}
