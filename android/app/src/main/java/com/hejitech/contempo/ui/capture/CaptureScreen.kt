package com.hejitech.contempo.ui.capture

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.agent.AiAvailability
import com.hejitech.contempo.agent.CaptureResult
import com.hejitech.contempo.ui.aiAvailabilityMessage
import com.hejitech.contempo.ui.rememberCameraCapture
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.contempo.ui.theme.RecordingIndicator

/**
 * Voice and photo are the product's actual differentiators (hands-free,
 * contemporaneous capture) and the target user is a real-estate host, not a
 * technical one — so this screen leads with one big, unmistakable mic button
 * (the primary action), a large secondary camera button below it, and typing
 * demoted behind a "Type instead" link rather than a competing text field up
 * front. See the AskUserQuestion decision in conversation history for the
 * layout options considered.
 */
@Composable
fun CaptureScreen(
    onDraftReady: (CaptureResult) -> Unit,
    viewModel: CaptureViewModel = viewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val recordingAmplitude by viewModel.recordingAmplitude.collectAsState()
    val context = LocalContext.current

    var pendingRecordAfterPermission by remember { mutableStateOf(false) }
    var micPermissionDenied by remember { mutableStateOf(false) }
    var typeExpanded by rememberSaveable { mutableStateOf(false) }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted && pendingRecordAfterPermission) {
            viewModel.startRecording()
        }
        micPermissionDenied = !granted
        pendingRecordAfterPermission = false
    }

    val cameraCapture = rememberCameraCapture { bitmap, photoUri ->
        viewModel.processPhoto(bitmap, photoUri) { result -> onDraftReady(result) }
    }

    val busy = uiState.isRecording || uiState.isTranscribing || uiState.isDraftingFromPhoto

    fun onMicTap() {
        when {
            uiState.isRecording -> viewModel.stopRecordingAndProcess { result -> onDraftReady(result) }
            uiState.isTranscribing || uiState.isDraftingFromPhoto -> Unit // ignore taps mid-processing
            hasPermission(context, Manifest.permission.RECORD_AUDIO) -> viewModel.startRecording()
            else -> {
                pendingRecordAfterPermission = true
                micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }

    // verticalScroll matters here specifically: the big mic button makes
    // this screen's content noticeably taller than the old text-field-first
    // layout, and once the keyboard is up (after "Type instead") plus
    // imePadding's reservation, a plain non-scrolling Column can run out of
    // vertical room and push the Send/manual-entry row past the visible
    // area with no way to reach it — verified live on-device. Center still
    // reads as centered when everything fits; it only starts scrolling once
    // it doesn't.
    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Eyebrow(stringResource(R.string.capture_eyebrow))

        Spacer(Modifier.height(40.dp))

        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            VoiceButton(
                isRecording = uiState.isRecording,
                amplitude = recordingAmplitude,
                onClick = ::onMicTap,
            )

            Spacer(Modifier.height(16.dp))

            when {
                uiState.isRecording -> RecordingIndicator(stringResource(R.string.capture_listening))
                uiState.isTranscribing -> BusyLabel(stringResource(R.string.capture_transcribing))
                micPermissionDenied -> Text(
                    stringResource(R.string.capture_mic_permission_needed),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                else -> Text(
                    stringResource(R.string.capture_voice_button_label),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(32.dp))

            OutlinedButton(
                onClick = cameraCapture::launch,
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().heightIn(min = 64.dp),
                shape = MaterialTheme.shapes.large,
                contentPadding = PaddingValues(vertical = 16.dp),
            ) {
                Icon(Icons.Filled.PhotoCamera, contentDescription = null, modifier = Modifier.size(28.dp))
                Spacer(Modifier.width(12.dp))
                Text(stringResource(R.string.capture_photo_button), style = MaterialTheme.typography.titleMedium)
            }

            if (uiState.isDraftingFromPhoto) {
                Spacer(Modifier.height(8.dp))
                BusyLabel(stringResource(R.string.capture_drafting_from_photo))
            } else if (cameraCapture.permissionDenied) {
                Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(R.string.capture_camera_permission_needed),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(24.dp))

            if (!typeExpanded) {
                TextButton(onClick = { typeExpanded = true }, enabled = !busy) {
                    Text(stringResource(R.string.capture_type_instead))
                }
            } else {
                OutlinedTextField(
                    value = uiState.inputText,
                    onValueChange = viewModel::onInputChanged,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !busy,
                    placeholder = { Text(stringResource(R.string.capture_hint)) },
                )

                Spacer(Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(
                        onClick = { viewModel.manualEntry { result -> onDraftReady(result) } },
                        enabled = !busy,
                    ) {
                        Text(stringResource(R.string.capture_manual_button))
                    }

                    Button(
                        onClick = { viewModel.submit { result -> onDraftReady(result) } },
                        enabled = uiState.inputText.isNotBlank() && !uiState.isParsing && !busy &&
                            uiState.aiAvailability is AiAvailability.Ready,
                        shape = MaterialTheme.shapes.small,
                    ) {
                        if (uiState.isParsing) {
                            CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp), strokeWidth = 2.dp)
                            Text(stringResource(R.string.capture_parsing))
                        } else {
                            Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.padding(end = 8.dp))
                            Text(stringResource(R.string.capture_send_button))
                        }
                    }
                }
            }
        }

        aiAvailabilityMessage(uiState.aiAvailability)?.let { message ->
            Spacer(Modifier.height(16.dp))
            Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        uiState.errorMessage?.let { error ->
            Spacer(Modifier.height(16.dp))
            Text(error, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.error)
        }
    }
}

/**
 * The primary CTA — big enough to be an unmistakable thumb target, colored
 * to flip from "start" (primary) to "stop" (error/red, universally read as
 * recording) with no icon change needed. The outer ring reacts to live mic
 * amplitude (see AudioRecorder.amplitude's kdoc — built for exactly this)
 * so a non-technical user gets constant, obvious confirmation the app is
 * actually hearing them, not just showing a static "recording" state.
 */
@Composable
private fun VoiceButton(
    isRecording: Boolean,
    amplitude: Float,
    onClick: () -> Unit,
) {
    val animatedAmplitude by animateFloatAsState(
        targetValue = if (isRecording) amplitude else 0f,
        animationSpec = tween(durationMillis = 100),
        label = "mic-amplitude",
    )
    val containerColor = if (isRecording) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    val contentColor = if (isRecording) MaterialTheme.colorScheme.onError else MaterialTheme.colorScheme.onPrimary
    val statusLabel = stringResource(
        if (isRecording) R.string.capture_voice_stop else R.string.capture_voice_start
    )

    Box(contentAlignment = Alignment.Center) {
        if (isRecording) {
            Box(
                modifier = Modifier
                    .size(184.dp + (animatedAmplitude * 40).dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.18f)),
            )
        }
        Box(
            modifier = Modifier
                .size(184.dp)
                .clip(CircleShape)
                .background(containerColor)
                .clickable(onClick = onClick)
                .semantics { contentDescription = statusLabel },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Mic,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(72.dp),
            )
        }
    }
}

@Composable
private fun BusyLabel(text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
        Spacer(Modifier.width(8.dp))
        Text(text, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun hasPermission(context: android.content.Context, permission: String): Boolean =
    androidx.core.content.ContextCompat.checkSelfPermission(context, permission) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
