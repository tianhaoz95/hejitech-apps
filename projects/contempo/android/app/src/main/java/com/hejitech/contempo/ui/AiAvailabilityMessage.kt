package com.hejitech.contempo.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.hejitech.contempo.R
import com.hejitech.contempo.agent.AiAvailability

/** Null when AI is Ready — callers show nothing in that case. Shared by CaptureScreen and ChatScreen. */
@Composable
fun aiAvailabilityMessage(availability: AiAvailability): String? = when (availability) {
    is AiAvailability.Ready -> null
    is AiAvailability.Checking -> stringResource(R.string.ai_blocked_checking)
    is AiAvailability.Downloading -> stringResource(R.string.ai_blocked_downloading)
    is AiAvailability.Unavailable -> stringResource(R.string.ai_blocked_unavailable)
    is AiAvailability.Failed -> stringResource(R.string.ai_blocked_failed, availability.message)
}
