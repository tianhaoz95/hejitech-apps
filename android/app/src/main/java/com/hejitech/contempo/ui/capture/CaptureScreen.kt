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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
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
import com.hejitech.contempo.mileage.MileageTrackingService
import com.hejitech.contempo.wear.AudioProcessingStage
import com.hejitech.core.model.CaptureLanguage
import com.hejitech.contempo.ui.aiAvailabilityMessage
import com.hejitech.contempo.ui.rememberCameraCapture
import com.hejitech.contempo.ui.theme.BulletAwareText
import com.hejitech.contempo.ui.theme.ContempoCard
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.contempo.ui.theme.RecordingIndicator
import kotlinx.coroutines.delay

/**
 * Voice is the product's actual differentiator (hands-free, contemporaneous
 * capture) and the target user is a real-estate host, not a technical one —
 * so this screen leads with one big, unmistakable mic button and nothing
 * else competing with it at first glance. Photo/odometer/GPS-trip capture
 * are real but secondary paths, collapsed behind a single "Other" toggle
 * (same expand-in-place pattern as "Type instead" below it) rather than
 * three full-width buttons sitting at equal visual weight right under the
 * mic. See the AskUserQuestion decision in conversation history for the
 * original layout options considered.
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
    var otherMenuExpanded by remember { mutableStateOf(false) }
    var showQuickCaptureExplanation by remember { mutableStateOf(false) }
    var showHelpWalkthrough by remember { mutableStateOf(false) }

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
    val odometerCameraCapture = rememberCameraCapture { bitmap, _ ->
        viewModel.logOdometerPhoto(bitmap)
    }
    val openTripEntry by viewModel.openTripEntry.collectAsState()
    // Only a GPS-started trip toggles off via this button — an odometer-
    // photo trip closes via its own button instead (see openTripEntry's use
    // above), since the two capture methods end a trip differently.
    val gpsTripOpen = openTripEntry?.mileageCaptureMethod == "gps"
    val openTimerEntry by viewModel.openTimerEntry.collectAsState()
    val quickCaptureStatus by viewModel.quickCaptureStatus.collectAsState()

    var locationPermissionDenied by remember { mutableStateOf(false) }
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        locationPermissionDenied = !granted
        if (granted) MileageTrackingService.start(context)
    }

    fun onTripButtonTap() {
        when {
            gpsTripOpen -> MileageTrackingService.stop(context)
            hasPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) -> MileageTrackingService.start(context)
            else -> locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    val busy = uiState.isRecording || uiState.isTranscribing || uiState.isDraftingFromPhoto ||
        uiState.isParsing || uiState.finalizedTranscript != null

    fun onMicTap() {
        when {
            uiState.isRecording && uiState.quickCaptureEnabled -> viewModel.stopQuickCaptureAndSave()
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
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Eyebrow(stringResource(R.string.capture_eyebrow))
            IconButton(onClick = { showHelpWalkthrough = true }) {
                Icon(
                    Icons.Filled.HelpOutline,
                    contentDescription = stringResource(R.string.capture_help_content_description),
                )
            }
        }

        Spacer(Modifier.height(24.dp))

        // Typed mode replaces the entire voice-capture UI (mic button, Quick
        // Capture, ongoing-work banner, "Other" methods) with just the text
        // field and its own actions — triggered by the keyboard icon at the
        // bottom of voice mode, reversed by the back arrow here. Kept as a
        // hard either/or rather than always showing both, per the redesign:
        // typing is an escape hatch from voice, not a permanently-visible
        // second option competing with it.
        if (typeExpanded) {
            IconButton(onClick = { typeExpanded = false }, enabled = !busy) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.capture_back_to_voice_content_description))
            }

            Spacer(Modifier.height(8.dp))

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
                        CircularProgressIndicator(modifier = Modifier.size(16.dp).padding(end = 8.dp), strokeWidth = 2.dp)
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
        } else {
            openTimerEntry?.let { timerEntry ->
                OngoingWorkBanner(
                    entry = timerEntry,
                    enabled = !busy,
                    onTapToComplete = viewModel::completeOpenTimer,
                )
                Spacer(Modifier.height(24.dp))
            }

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
                    FinalizedTranscriptCard(
                        text = text,
                        onClick = { viewModel.confirmTranscript { result -> onDraftReady(result) } },
                    )
                }

                if (uiState.isParsing) {
                    Spacer(Modifier.height(16.dp))
                    ParsingProgress(uiState.parsingStage)
                }

                Spacer(Modifier.height(56.dp))

                val odometerBusy = busy || uiState.isProcessingOdometerPhoto
                val otherContentDescription = if (gpsTripOpen) {
                    stringResource(R.string.capture_other_button_trip_open)
                } else {
                    stringResource(R.string.capture_other_button)
                }
                val quickCaptureToggleDescription = stringResource(R.string.capture_quick_capture_toggle_content_description)
                val typeInsteadDescription = stringResource(R.string.capture_type_instead)

                // Same prominence as the Quick Capture row below (label +
                // control, no card/background) — this is per-capture, not a
                // standing setting like Quick Capture, but it needs to be
                // just as visible since picking wrong is exactly the failure
                // mode it exists to prevent. Persists across app restarts
                // (see CaptureLanguageStore) but is read fresh at the moment
                // each recording stops, not live at background-processing
                // time — see CaptureUiState.captureLanguage's kdoc.
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        stringResource(R.string.capture_language_label),
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Spacer(Modifier.width(8.dp))
                    CaptureLanguageSelector(
                        selected = uiState.captureLanguage,
                        enabled = !busy,
                        onSelect = viewModel::setCaptureLanguage,
                    )
                }

                Spacer(Modifier.height(20.dp))

                // Split by purpose rather than one dense row: Quick Capture
                // is a persistent setting (its own compact, settings-style
                // row — label, switch, and the info button that explains it,
                // all hugging each other rather than spanning the full
                // width), while "Other" and typed mode are momentary actions
                // (a separate icon row below). Both rows are centered to
                // match the mic button above them, instead of one
                // full-width row reading left-aligned against it.
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        stringResource(R.string.capture_quick_capture_label),
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Spacer(Modifier.width(8.dp))
                    Switch(
                        checked = uiState.quickCaptureEnabled,
                        onCheckedChange = viewModel::setQuickCaptureEnabled,
                        enabled = !busy,
                        modifier = Modifier.semantics { contentDescription = quickCaptureToggleDescription },
                    )
                    IconButton(onClick = { showQuickCaptureExplanation = true }) {
                        Icon(
                            Icons.Filled.Info,
                            contentDescription = stringResource(R.string.capture_quick_capture_info_content_description),
                            modifier = Modifier.size(18.dp),
                        )
                    }
                }

                // Visible whenever Quick Capture is on (so it reads as "here's
                // what's happening" even at zero backlog) or whenever there's
                // still a backlog left over from earlier even after the user
                // turned the toggle back off — hidden entirely otherwise so a
                // host who's never touched this feature sees nothing extra.
                if (uiState.quickCaptureEnabled || quickCaptureStatus.hasAnything) {
                    Spacer(Modifier.height(12.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuickCaptureStatusRow(quickCaptureStatus)
                        IconButton(
                            onClick = viewModel::processQuickCaptureBacklogNow,
                            // Nothing to gain from tapping this with an empty
                            // backlog or while the one processing slot is
                            // already busy — WorkManager would just enqueue a
                            // request that finds nothing to do.
                            enabled = quickCaptureStatus.pendingCount > 0 && quickCaptureStatus.processingStage == null,
                            modifier = Modifier.size(32.dp),
                        ) {
                            if (quickCaptureStatus.processingStage != null) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 1.5.dp)
                            } else {
                                Icon(
                                    Icons.Filled.Sync,
                                    contentDescription = stringResource(R.string.capture_quick_capture_process_now_content_description),
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                    }
                }

                Spacer(Modifier.height(20.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box {
                        IconButton(onClick = { otherMenuExpanded = true }, enabled = !busy) {
                            Icon(
                                Icons.Filled.MoreHoriz,
                                contentDescription = otherContentDescription,
                                // A trip left running is worth a glance even
                                // when this icon is the only trace of it on
                                // screen, now that its old full-width label
                                // text is gone.
                                tint = if (gpsTripOpen) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        DropdownMenu(expanded = otherMenuExpanded, onDismissRequest = { otherMenuExpanded = false }) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.capture_start_new_work_button)) },
                                leadingIcon = { Icon(Icons.Filled.Timer, contentDescription = null) },
                                enabled = !busy,
                                onClick = { otherMenuExpanded = false; viewModel.startNewWork() },
                            )
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.capture_photo_button)) },
                                leadingIcon = { Icon(Icons.Filled.PhotoCamera, contentDescription = null) },
                                enabled = !busy,
                                onClick = { otherMenuExpanded = false; cameraCapture.launch() },
                            )
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        stringResource(
                                            if (openTripEntry != null) R.string.capture_odometer_end_button
                                            else R.string.capture_odometer_start_button
                                        )
                                    )
                                },
                                leadingIcon = { Icon(Icons.Filled.PhotoCamera, contentDescription = null) },
                                enabled = !odometerBusy,
                                onClick = { otherMenuExpanded = false; odometerCameraCapture.launch() },
                            )
                            DropdownMenuItem(
                                text = { Text(stringResource(if (gpsTripOpen) R.string.capture_stop_trip_button else R.string.capture_start_trip_button)) },
                                leadingIcon = { Icon(Icons.Filled.LocationOn, contentDescription = null) },
                                enabled = !busy,
                                onClick = { otherMenuExpanded = false; onTripButtonTap() },
                            )
                        }
                    }
                    IconButton(
                        onClick = { typeExpanded = true },
                        enabled = !busy,
                        modifier = Modifier.semantics { contentDescription = typeInsteadDescription },
                    ) {
                        Icon(Icons.Filled.Keyboard, contentDescription = null)
                    }
                }

                // Status/permission text stays anchored here regardless of
                // whether the "Other" menu itself is still open — an
                // in-progress photo read or a denied permission is worth
                // surfacing even after the picker that triggered it has closed.
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

                if (uiState.isProcessingOdometerPhoto) {
                    Spacer(Modifier.height(8.dp))
                    BusyLabel(stringResource(R.string.capture_reading_odometer))
                } else if (odometerCameraCapture.permissionDenied) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.capture_camera_permission_needed),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                if (locationPermissionDenied) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.capture_location_permission_needed),
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

        uiState.timerMessage?.let { message ->
            Spacer(Modifier.height(16.dp))
            Text(message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.primary)
        }

        uiState.tripMessage?.let { message ->
            Spacer(Modifier.height(16.dp))
            Text(message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.primary)
        }
    }

    // Start/stop timer captures write straight to Firestore and never reach
    // Confirm (see CaptureViewModel.handleTimerStart/parseAndProceed) — this
    // transient confirmation is the only feedback the user gets, so it
    // self-clears rather than lingering until the next capture.
    LaunchedEffect(uiState.timerMessage) {
        if (uiState.timerMessage != null) {
            delay(TIMER_MESSAGE_HOLD_MS)
            viewModel.dismissTimerMessage()
        }
    }

    // Odometer-photo start/end also writes straight to Firestore (see
    // CaptureViewModel.logOdometerPhoto) — same transient-confirmation
    // pattern as the timer message above.
    LaunchedEffect(uiState.tripMessage) {
        if (uiState.tripMessage != null) {
            delay(TIMER_MESSAGE_HOLD_MS)
            viewModel.dismissTripMessage()
        }
    }

    if (showQuickCaptureExplanation) {
        AlertDialog(
            onDismissRequest = { showQuickCaptureExplanation = false },
            title = { Text(stringResource(R.string.capture_quick_capture_label)) },
            text = { Text(stringResource(R.string.capture_quick_capture_caption)) },
            confirmButton = {
                TextButton(onClick = { showQuickCaptureExplanation = false }) {
                    Text(stringResource(android.R.string.ok))
                }
            },
        )
    }

    if (showHelpWalkthrough) {
        HelpWalkthroughDialog(onDismiss = { showHelpWalkthrough = false })
    }
}

private const val TIMER_MESSAGE_HOLD_MS = 3000L

/**
 * The primary CTA — big enough to be an unmistakable thumb target, colored
 * to flip from "start" (primary) to "stop" (error/red, universally read as
 * recording) to "thinking" (tertiary/brass, once recording stops and
 * transcribing/cleanup is running) with no icon change needed. The button
 * itself is a fixed size at all times — it used to grow/shrink with mic
 * amplitude and a "breathing" idle pulse, which read as the whole control
 * jittering around rather than a deliberate signal. Instead, while recording
 * the static mic icon swaps for a small live equalizer (see VolumeBars)
 * anchored inside the same fixed footprint: the button sits still, the bars
 * move. While thinking, an indeterminate ring communicates "still working"
 * without literal streaming text.
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
            if (isRecording) {
                VolumeBars(amplitude = animatedAmplitude, color = contentColor)
            } else {
                Icon(
                    imageVector = Icons.Filled.Mic,
                    contentDescription = null,
                    tint = contentColor,
                    modifier = Modifier.size(72.dp),
                )
            }
        }
    }
}

private const val VOLUME_BAR_COUNT = 5
private val VOLUME_BAR_MAX_HEIGHT = 56.dp

/**
 * A small live equalizer standing in for the mic icon while recording — each
 * bar free-runs its own infinite loop (staggered duration/delay so they're
 * never in lockstep) and is then scaled by the live mic amplitude, so it
 * reads as "reacting to your voice" rather than a canned decorative loop
 * while still sitting on a fixed footprint (VOLUME_BAR_MAX_HEIGHT never
 * changes — only each bar's height within it does).
 */
@Composable
private fun VolumeBars(amplitude: Float, color: androidx.compose.ui.graphics.Color) {
    Row(
        modifier = Modifier.height(VOLUME_BAR_MAX_HEIGHT),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        repeat(VOLUME_BAR_COUNT) { index -> VolumeBar(amplitude = amplitude, indexInSet = index, color = color) }
    }
}

@Composable
private fun VolumeBar(amplitude: Float, indexInSet: Int, color: androidx.compose.ui.graphics.Color) {
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
            .width(6.dp)
            .height(VOLUME_BAR_MAX_HEIGHT * heightFraction)
            .clip(RoundedCornerShape(3.dp))
            .background(color),
    )
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
 * Today's Quick Capture status: how many recordings are still waiting to
 * become entries, what the one currently mid-pipeline is up to (if any —
 * see AudioCaptureProcessor, which drains strictly one at a time), and how
 * many finished today. All three numbers reset at midnight (see
 * QuickCaptureStatusUiState/CaptureViewModel.quickCaptureStatus) — this is
 * about today's backlog, not an all-time total.
 */
@Composable
private fun QuickCaptureStatusRow(status: QuickCaptureStatusUiState) {
    Column(
        modifier = Modifier
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(
            stringResource(R.string.capture_quick_capture_status_today),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(2.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                stringResource(R.string.capture_quick_capture_status_pending, status.pendingCount),
                style = MaterialTheme.typography.labelMedium,
            )
            status.processingStage?.let { stage ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(12.dp), strokeWidth = 1.5.dp, color = MaterialTheme.colorScheme.tertiary)
                    Spacer(Modifier.width(4.dp))
                    Text(
                        quickCaptureStageLabel(stage),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.tertiary,
                    )
                }
            }
            Text(
                stringResource(R.string.capture_quick_capture_status_completed, status.completedTodayCount),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun quickCaptureStageLabel(stage: AudioProcessingStage): String = stringResource(
    when (stage) {
        AudioProcessingStage.DOWNLOADING -> R.string.capture_quick_capture_stage_downloading
        AudioProcessingStage.TRANSCRIBING -> R.string.capture_quick_capture_stage_transcribing
        AudioProcessingStage.PARSING -> R.string.capture_quick_capture_stage_parsing
        AudioProcessingStage.SAVING -> R.string.capture_quick_capture_stage_saving
    }
)

/**
 * Three FilterChips rather than a segmented button — visually lighter/more
 * compact, and this app has no other segmented-button usage to stay
 * consistent with, whereas FilterChip's selected/unselected look is already
 * a familiar Material3 pattern. ENGLISH picks the dedicated tiny.en model,
 * CHINESE forces the multilingual model's language to "zh", AUTO leaves
 * Whisper's own (less reliable, but only real option for anything else)
 * per-utterance detection on — see WhisperTranscriber's kdoc.
 */
@Composable
private fun CaptureLanguageSelector(
    selected: CaptureLanguage,
    enabled: Boolean,
    onSelect: (CaptureLanguage) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        CaptureLanguageChip(
            label = stringResource(R.string.capture_language_english),
            selected = selected == CaptureLanguage.ENGLISH,
            enabled = enabled,
            onClick = { onSelect(CaptureLanguage.ENGLISH) },
        )
        CaptureLanguageChip(
            label = stringResource(R.string.capture_language_chinese),
            selected = selected == CaptureLanguage.CHINESE,
            enabled = enabled,
            onClick = { onSelect(CaptureLanguage.CHINESE) },
        )
        CaptureLanguageChip(
            label = stringResource(R.string.capture_language_auto),
            selected = selected == CaptureLanguage.AUTO,
            enabled = enabled,
            onClick = { onSelect(CaptureLanguage.AUTO) },
        )
    }
}

@Composable
private fun CaptureLanguageChip(label: String, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        enabled = enabled,
        label = { Text(label, style = MaterialTheme.typography.labelMedium) },
    )
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
/**
 * Surfaces a work timer left open by an earlier "start work" voice utterance
 * (see CaptureViewModel.openTimerEntry/TimerEntryCoordinator) — without
 * this, the only way to close it was another voice utterance ("finished"),
 * so a user who forgot the phrasing (or just prefers a tap) had no visible
 * way back into a capture already in progress. Tapping completes it the
 * same way a voice "stop" would, including recording the completion time/
 * location (see CaptureViewModel.completeOpenTimer).
 */
@Composable
private fun OngoingWorkBanner(
    entry: com.hejitech.core.model.Entry,
    enabled: Boolean,
    onTapToComplete: () -> Unit,
) {
    // Ticks once a second so the banner itself reads as a live running clock —
    // this is now the only "tracking" feedback in Capture (see
    // CaptureViewModel.handleTimerStart/startNewWork, which no longer set a
    // separate bottom confirmation message).
    var nowSeconds by remember(entry.activityDate) { mutableStateOf(System.currentTimeMillis() / 1000) }
    LaunchedEffect(entry.activityDate) {
        while (true) {
            nowSeconds = System.currentTimeMillis() / 1000
            delay(1000)
        }
    }
    val elapsedSeconds = (nowSeconds - entry.activityDate.seconds).coerceAtLeast(0)

    ContempoCard(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onTapToComplete),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Filled.Mic,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    stringResource(
                        R.string.capture_ongoing_work_title,
                        entry.propertyName.ifBlank { entry.task.ifBlank { stringResource(R.string.capture_ongoing_work_untitled) } },
                    ),
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    formatElapsedDuration(elapsedSeconds),
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    stringResource(R.string.capture_ongoing_work_tap_hint),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun formatElapsedDuration(totalSeconds: Long): String {
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        "%d:%02d:%02d".format(hours, minutes, seconds)
    } else {
        "%d:%02d".format(minutes, seconds)
    }
}

@Composable
private fun FinalizedTranscriptCard(text: String, onClick: () -> Unit) {
    ContempoCard(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                stringResource(R.string.capture_finalized_heading),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            BulletAwareText(text, style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.capture_finalized_tap_hint),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
            )
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
