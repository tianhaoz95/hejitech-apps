package com.hejitech.contempo.ui.capture

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
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
import com.hejitech.contempo.agent.ParsingStage
import com.hejitech.contempo.ui.aiAvailabilityMessage
import com.hejitech.contempo.ui.rememberCameraCapture
import com.hejitech.contempo.ui.theme.ContempoCard
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.contempo.ui.theme.RecordingIndicator
import kotlinx.coroutines.delay

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

    val busy = uiState.isRecording || uiState.isTranscribing || uiState.isDraftingFromPhoto ||
        uiState.isParsing || uiState.finalizedTranscript != null

    fun onMicTap() {
        when {
            uiState.isRecording -> viewModel.stopRecordingAndProcess { result -> onDraftReady(result) }
            // ignore taps mid-processing — recording stopped, transcript
            // finalized, or already drafting/parsing
            uiState.isTranscribing || uiState.isDraftingFromPhoto || uiState.isParsing ||
                uiState.finalizedTranscript != null -> Unit
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
                isThinking = uiState.isTranscribing,
                amplitude = recordingAmplitude,
                onClick = ::onMicTap,
            )

            Spacer(Modifier.height(16.dp))

            when {
                uiState.isRecording -> RecordingIndicator(stringResource(R.string.capture_listening))
                uiState.isTranscribing -> ThinkingIndicator(stringResource(R.string.capture_transcribing))
                uiState.isParsing || uiState.finalizedTranscript != null -> Unit // owned by the blocks below
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

            uiState.finalizedTranscript?.let { text ->
                Spacer(Modifier.height(16.dp))
                FinalizedTranscriptCard(text)
            }

            if (uiState.isParsing && !typeExpanded) {
                Spacer(Modifier.height(16.dp))
                ParsingProgress(uiState.parsingStage)
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

                if (uiState.isParsing) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        parsingStageLabel(uiState.parsingStage),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
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
 * recording) to "thinking" (tertiary/brass, once recording stops and
 * transcribing/cleanup is running) with no icon change needed. The tight
 * ring reacts to live mic amplitude (see AudioRecorder.amplitude's kdoc —
 * built for exactly this) so the user gets immediate confirmation the app
 * is hearing them; a second, slower "breathing" ring keeps the button
 * visibly alive during quiet pauses in speech, not just reactive to
 * instantaneous peaks. While thinking, an indeterminate ring communicates
 * "still working" without literal streaming text.
 */
@Composable
private fun VoiceButton(
    isRecording: Boolean,
    isThinking: Boolean,
    amplitude: Float,
    onClick: () -> Unit,
) {
    val animatedAmplitude by animateFloatAsState(
        targetValue = if (isRecording) amplitude else 0f,
        animationSpec = tween(durationMillis = 100),
        label = "mic-amplitude",
    )
    val infiniteTransition = rememberInfiniteTransition(label = "voice-button-loop")
    val breath by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1400, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "breath",
    )
    val containerColor = when {
        isRecording -> MaterialTheme.colorScheme.error
        isThinking -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.primary
    }
    val contentColor = when {
        isRecording -> MaterialTheme.colorScheme.onError
        isThinking -> MaterialTheme.colorScheme.onTertiary
        else -> MaterialTheme.colorScheme.onPrimary
    }
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
            Box(
                modifier = Modifier
                    .size(184.dp + (breath * 64).dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.08f * breath)),
            )
        }
        if (isThinking) {
            CircularProgressIndicator(
                modifier = Modifier.size(212.dp),
                strokeWidth = 3.dp,
                color = MaterialTheme.colorScheme.tertiary,
                trackColor = MaterialTheme.colorScheme.tertiaryContainer,
            )
        }
        Box(
            modifier = Modifier
                .size(184.dp)
                .clip(CircleShape)
                .background(containerColor)
                .clickable(onClick = onClick, enabled = !isThinking)
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

/**
 * The "being finalized" moment right after recording stops — same pill
 * shape as RecordingIndicator but tertiary-toned and softly pulsing rather
 * than a hard blink, so it visually reads as "thinking," distinct from both
 * "listening" (error/red) and a generic spinner.
 */
@Composable
private fun ThinkingIndicator(text: String, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "thinking-pulse")
    val dotAlpha by transition.animateFloat(
        initialValue = 1f,
        targetValue = 0.35f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 700, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "thinking-dot-alpha",
    )

    Row(
        modifier = modifier
            .clip(MaterialTheme.shapes.extraLarge)
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .alpha(dotAlpha)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.tertiary),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = text.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.tertiary,
        )
    }
}

/** The "here's what we heard" beat — shown briefly right before parsing starts. */
@Composable
private fun FinalizedTranscriptCard(text: String) {
    ContempoCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                stringResource(R.string.capture_finalized_heading),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            Text(text, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

/**
 * Staged progress for the voice auto-parse path, which (unlike typed/manual
 * submit) has no button to host a spinner in. After a few seconds, appends
 * a reassurance line so a slow on-device→cloud fallback doesn't read as
 * hung — timed once per parsing session via the Unit key.
 */
@Composable
private fun ParsingProgress(stage: ParsingStage) {
    var showReassurance by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(4000)
        showReassurance = true
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
        Spacer(Modifier.width(8.dp))
        Column {
            Text(
                parsingStageLabel(stage),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (showReassurance) {
                Text(
                    stringResource(R.string.capture_parsing_reassurance),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun parsingStageLabel(stage: ParsingStage): String = stringResource(
    when (stage) {
        ParsingStage.IDLE, ParsingStage.READING -> R.string.capture_stage_reading
        ParsingStage.TRYING_ON_DEVICE -> R.string.capture_stage_trying_on_device
        ParsingStage.FALLING_BACK_TO_CLOUD -> R.string.capture_stage_falling_back_to_cloud
        ParsingStage.STRUCTURING -> R.string.capture_stage_structuring
    }
)

private fun hasPermission(context: android.content.Context, permission: String): Boolean =
    androidx.core.content.ContextCompat.checkSelfPermission(context, permission) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
