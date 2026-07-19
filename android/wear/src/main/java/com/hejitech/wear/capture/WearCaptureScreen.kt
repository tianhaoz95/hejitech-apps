package com.hejitech.wear.capture

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text

@Composable
fun WearSignInScreen(isSigningIn: Boolean, errorMessage: String?, onSignIn: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().padding(16.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                "Contempo",
                style = MaterialTheme.typography.title3,
                color = MaterialTheme.colors.onBackground,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(12.dp))
            Chip(
                onClick = onSignIn,
                enabled = !isSigningIn,
                label = {
                    if (isSigningIn) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Sign in")
                    }
                },
                colors = ChipDefaults.primaryChipColors(),
            )
            errorMessage?.let {
                Spacer(Modifier.height(8.dp))
                Text(
                    it,
                    style = MaterialTheme.typography.caption2,
                    color = MaterialTheme.colors.onBackground,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
fun WearCaptureScreen(
    uiState: WearUiState,
    amplitude: Float,
    onMicTap: () -> Unit,
    onUploadPendingNow: () -> Unit,
    onDismissMessages: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().padding(PaddingValues(horizontal = 16.dp, vertical = 8.dp)), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "%.0f / %d hrs".format(uiState.confirmedHours, 100),
                style = MaterialTheme.typography.caption1,
                color = MaterialTheme.colors.onBackground,
            )
            Spacer(Modifier.height(12.dp))

            MicButton(
                isRecording = uiState.isRecording,
                amplitude = amplitude,
                onClick = onMicTap,
            )

            Spacer(Modifier.height(12.dp))

            val messageColor = MaterialTheme.colors.onBackground
            when {
                uiState.isRecording -> Text("Listening…", style = MaterialTheme.typography.caption2, color = messageColor)
                uiState.lastSavedSummary != null -> Text(
                    uiState.lastSavedSummary,
                    style = MaterialTheme.typography.caption2,
                    color = messageColor,
                    textAlign = TextAlign.Center,
                )
                uiState.errorMessage != null -> Text(
                    uiState.errorMessage,
                    style = MaterialTheme.typography.caption2,
                    color = messageColor,
                    textAlign = TextAlign.Center,
                )
                else -> Text("Tap to speak", style = MaterialTheme.typography.caption2, color = messageColor)
            }

            if (uiState.pendingCount > 0 || uiState.uploadedTodayCount > 0) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "${uiState.pendingCount} pending · ${uiState.uploadedTodayCount} today",
                    style = MaterialTheme.typography.caption2,
                    color = MaterialTheme.colors.onBackground.copy(alpha = 0.6f),
                )
            }

            if (uiState.pendingCount > 0 && !uiState.isRecording) {
                Spacer(Modifier.height(8.dp))
                Chip(
                    onClick = onUploadPendingNow,
                    enabled = !uiState.isUploadingPending,
                    label = {
                        if (uiState.isUploadingPending) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Upload now", style = MaterialTheme.typography.caption2)
                        }
                    },
                    colors = ChipDefaults.secondaryChipColors(),
                )
            }
        }
    }

    // Transient confirmation/error messages self-clear so the watch face
    // returns to a plain "tap to speak" idle state without another input.
    LaunchedEffect(uiState.lastSavedSummary, uiState.errorMessage) {
        if (uiState.lastSavedSummary != null || uiState.errorMessage != null) {
            kotlinx.coroutines.delay(4000)
            onDismissMessages()
        }
    }
}

/**
 * Fixed-size button at all times (see the phone's CaptureScreen.kt for the
 * same "button sits still, bars move" fix) — while recording, the mic icon
 * swaps for a small live equalizer driven by [amplitude] instead of the
 * button itself growing/pulsing.
 */
@Composable
private fun MicButton(isRecording: Boolean, amplitude: Float, onClick: () -> Unit) {
    Box(contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .testTag("mic_button")
                .size(76.dp)
                .clip(CircleShape)
                .background(if (isRecording) MaterialTheme.colors.error else MaterialTheme.colors.primary)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            if (isRecording) {
                VolumeBars(amplitude = amplitude, color = MaterialTheme.colors.onError)
            } else {
                Icon(
                    imageVector = Icons.Filled.Mic,
                    contentDescription = "Tap to speak",
                    tint = MaterialTheme.colors.onPrimary,
                    modifier = Modifier.size(32.dp),
                )
            }
        }
    }
}

private const val VOLUME_BAR_COUNT = 5
private val VOLUME_BAR_MAX_HEIGHT = 28.dp

@Composable
private fun VolumeBars(amplitude: Float, color: Color) {
    Row(
        modifier = Modifier.height(VOLUME_BAR_MAX_HEIGHT),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        repeat(VOLUME_BAR_COUNT) { index -> VolumeBar(amplitude = amplitude, indexInSet = index, color = color) }
    }
}

@Composable
private fun VolumeBar(amplitude: Float, indexInSet: Int, color: Color) {
    val infiniteTransition = rememberInfiniteTransition(label = "volume-bar-$indexInSet")
    val phase by infiniteTransition.animateFloat(
        initialValue = 0.25f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 420 + indexInSet * 90,
                delayMillis = indexInSet * 70,
                easing = LinearEasing,
            ),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "volume-bar-phase-$indexInSet",
    )
    val heightFraction = (phase * (0.45f + amplitude * 0.75f)).coerceIn(0.15f, 1f)
    Box(
        modifier = Modifier
            .width(4.dp)
            .height(VOLUME_BAR_MAX_HEIGHT * heightFraction)
            .clip(RoundedCornerShape(2.dp))
            .background(color),
    )
}
