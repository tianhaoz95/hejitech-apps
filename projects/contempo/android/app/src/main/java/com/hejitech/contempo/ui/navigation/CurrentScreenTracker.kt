package com.hejitech.contempo.ui.navigation

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Tracks the current top-level/route name, updated from ContempoNavHost —
 * the only consumer today is shake-to-report's environment snapshot (see
 * FeedbackViewModel.submit), which needs to know what screen was on screen
 * when the shake happened.
 */
object CurrentScreenTracker {
    private val _currentScreen = MutableStateFlow("capture")
    val currentScreen: StateFlow<String> = _currentScreen.asStateFlow()

    fun update(routeName: String) {
        _currentScreen.value = routeName
    }
}
