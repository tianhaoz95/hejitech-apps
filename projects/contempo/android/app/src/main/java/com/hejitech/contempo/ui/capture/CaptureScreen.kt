package com.hejitech.contempo.ui.capture

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.agent.AiAvailability
import com.hejitech.contempo.agent.CaptureResult
import com.hejitech.contempo.agent.ParsingStage
import com.hejitech.contempo.mileage.MileageTrackingService
import com.hejitech.contempo.wear.AudioProcessingStage
import com.hejitech.core.model.CaptureLanguage
import com.hejitech.core.model.Entry
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
 * else competing with it at first glance. Photo/GPS-trip/manual-timer
 * capture are real but secondary paths, demoted to a compact quick-action
 * row below the mic rather than full-width buttons at equal visual weight.
 * Photo capture is a single unified action — the vision model classifies
 * odometer-reading vs. work evidence after the photo is taken (see
 * CaptureViewModel.processCapturedPhoto) rather than the host picking
 * between two separate photo buttons up front.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CaptureScreen(
    onDraftReady: (CaptureResult) -> Unit,
    onEntryClick: (String) -> Unit = {},
    viewModel: CaptureViewModel = viewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val recordingAmplitude by viewModel.recordingAmplitude.collectAsState()
    val context = LocalContext.current

    val captureMode by viewModel.captureMode.collectAsState()
    var pendingRecordAfterPermission by remember { mutableStateOf(false) }
    var micPermissionDenied by remember { mutableStateOf(false) }
    var showHelpWalkthrough by remember { mutableStateOf(false) }
    var showCancelWorkDialog by remember { mutableStateOf(false) }
    var showCancelTripDialog by remember { mutableStateOf(false) }
    // Distinguishes a cancel from a real completion for the two
    // LaunchedEffect(openTripEntry/openTimerEntry) blocks below — both
    // transitions clear the open entry the same way, but only a real
    // completion should get the "recently completed, tap to edit" banner
    // treatment; a cancelled entry no longer exists, so there's nothing to
    // edit. Set true right when the cancel dialog is confirmed, consumed
    // (reset to false) by the LaunchedEffect the moment it reacts.
    var tripWasCancelled by remember { mutableStateOf(false) }
    var workWasCancelled by remember { mutableStateOf(false) }

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
        viewModel.processCapturedPhoto(bitmap, photoUri) { result -> onDraftReady(result) }
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

    val busy = uiState.isRecording || uiState.isTranscribing || uiState.isProcessingPhoto ||
        uiState.isParsing || uiState.finalizedTranscript != null

    fun onMicTap() {
        when {
            uiState.isRecording && uiState.quickCaptureEnabled -> viewModel.stopQuickCaptureAndSave()
            uiState.isRecording -> viewModel.stopRecordingAndProcess { result -> onDraftReady(result) }
            // ignore taps mid-processing — recording stopped, transcript
            // finalized, or already drafting/parsing
            uiState.isTranscribing || uiState.isProcessingPhoto || uiState.isParsing ||
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
    // layout, and once the keyboard is up (in Typing mode) plus
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
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Eyebrow(stringResource(R.string.capture_eyebrow))
            Spacer(Modifier.weight(1f))
            // Moved here (was a full-width box below the quick-action row)
            // in response to in-app feedback — a compact badge reads better
            // next to the help button than a large box competing with the
            // hero mic button for attention.
            if (uiState.quickCaptureEnabled || quickCaptureStatus.hasAnything) {
                QuickCaptureBadge(quickCaptureStatus, onProcessNow = viewModel::processQuickCaptureBacklogNow)
                Spacer(Modifier.width(8.dp))
            }
            IconButton(onClick = { showHelpWalkthrough = true }) {
                Icon(
                    Icons.Filled.HelpOutline,
                    contentDescription = stringResource(R.string.capture_help_content_description),
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        val hoursProgress by viewModel.hoursProgress.collectAsState()
        TitleWordmark(hoursProgress = hoursProgress)

        Spacer(Modifier.height(24.dp))

        // Last-known entry is remembered so the exit animation below has
        // something non-null to render while collapsing, even though
        // openTripEntry/openTimerEntry themselves already flipped to
        // null by the time that animation starts. Unconditional regardless
        // of captureMode — see CaptureModeToggle's kdoc.
        var lastTripEntry by remember { mutableStateOf<Entry?>(null) }
        var tripJustCompleted by remember { mutableStateOf(false) }
        LaunchedEffect(openTripEntry) {
            if (openTripEntry != null) {
                lastTripEntry = openTripEntry
                tripJustCompleted = false
            } else if (tripWasCancelled) {
                // Cancelled, not completed — the entry no longer exists, so
                // there's nothing to tap into and edit. Collapse right away
                // instead of running the "just completed" treatment below.
                tripWasCancelled = false
                lastTripEntry = null
            } else if (lastTripEntry != null) {
                // openTripEntry just went from set to null — the trip closed.
                // Keep the card up a few seconds longer in a "completed"
                // state instead of collapsing instantly, so there's a
                // window to tap straight into EntryDetail and fill in
                // anything still missing rather than having to go find it
                // later from Dashboard's pending list. Cancelled/restarted
                // automatically if a new trip starts before this delay
                // elapses, since that changes openTripEntry and this whole
                // LaunchedEffect block reruns.
                // Deliberately not reset to false here before clearing
                // lastTripEntry: with both in the same recomposition pass,
                // there'd otherwise be a frame where the card is still
                // visible but isCompleted has already flipped back to
                // false, flashing the in-progress treatment right before
                // the card disappears. Leaving it true until the card is
                // actually gone avoids that — the next trip start already
                // resets it explicitly (see the branch above).
                tripJustCompleted = true
                delay(RECENTLY_COMPLETED_DISPLAY_MS)
                lastTripEntry = null
            }
        }
        AnimatedVisibility(
            visible = lastTripEntry != null,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut(),
        ) {
            lastTripEntry?.let { tripEntry ->
                Column {
                    OngoingTripBanner(
                        entry = tripEntry,
                        isGps = gpsTripOpen,
                        enabled = !busy,
                        isCompleted = tripJustCompleted,
                        onComplete = {
                            if (gpsTripOpen) MileageTrackingService.stop(context) else cameraCapture.launch()
                        },
                        onPauseToggle = {
                            if (tripEntry.isPaused) viewModel.resumeTrip() else viewModel.pauseTrip()
                        },
                        onCancel = { showCancelTripDialog = true },
                        onTapCompleted = { onEntryClick(tripEntry.id) },
                    )
                    Spacer(Modifier.height(24.dp))
                }
            }
        }

        var lastTimerEntry by remember { mutableStateOf<Entry?>(null) }
        var timerJustCompleted by remember { mutableStateOf(false) }
        LaunchedEffect(openTimerEntry) {
            if (openTimerEntry != null) {
                lastTimerEntry = openTimerEntry
                timerJustCompleted = false
            } else if (workWasCancelled) {
                // See the trip block above for why a cancel skips the
                // "just completed" treatment entirely.
                workWasCancelled = false
                lastTimerEntry = null
            } else if (lastTimerEntry != null) {
                // See the trip block above for why this stays up briefly
                // instead of collapsing the instant openTimerEntry goes null.
                // See the trip block above for why this isn't reset to
                // false before clearing lastTimerEntry.
                timerJustCompleted = true
                delay(RECENTLY_COMPLETED_DISPLAY_MS)
                lastTimerEntry = null
            }
        }
        AnimatedVisibility(
            visible = lastTimerEntry != null,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut(),
        ) {
            lastTimerEntry?.let { timerEntry ->
                Column {
                    OngoingWorkBanner(
                        entry = timerEntry,
                        enabled = !busy,
                        isCompleted = timerJustCompleted,
                        onComplete = viewModel::completeOpenTimer,
                        onPauseToggle = {
                            if (timerEntry.isPaused) viewModel.resumeWork() else viewModel.pauseWork()
                        },
                        onCancel = { showCancelWorkDialog = true },
                        onTapCompleted = { onEntryClick(timerEntry.id) },
                    )
                    Spacer(Modifier.height(24.dp))
                }
            }
        }

        // Same top-of-screen position as the trip/timer banners above, not
        // down by the hero button — the transcript-ready-to-confirm card is
        // the same kind of "something needs your attention" state they are,
        // so it should read consistently rather than appearing wherever it
        // happens to fall in the scroll. Moved here in response to feedback
        // that a bottom-of-screen placement was easy to miss/inconsistent.
        AnimatedVisibility(
            visible = uiState.finalizedTranscript != null,
            enter = expandVertically() + fadeIn(),
            exit = shrinkVertically() + fadeOut(),
        ) {
            uiState.finalizedTranscript?.let { text ->
                Column {
                    FinalizedTranscriptCard(
                        text = text,
                        onClick = { viewModel.confirmTranscript { result -> onDraftReady(result) } },
                    )
                    Spacer(Modifier.height(24.dp))
                }
            }
        }

        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Session-only choice between the two hero widgets below —
            // separate from Settings' persisted default, which only seeds
            // which one a *fresh* Capture visit opens into (see
            // CaptureViewModel.captureMode's kdoc: this toggle never writes
            // the persisted default back). Segmented, matching
            // CaptureLanguageSelector's style further down this screen.
            // Everything below this point other than the hero itself —
            // banners above, quick-action row, photo/transcript feedback,
            // Quick Capture — renders unconditionally regardless of mode.
            val captureModeOrder by viewModel.captureModeOrder.collectAsState()
            CaptureModeToggle(
                selected = captureMode,
                order = captureModeOrder,
                enabled = !busy,
                onSelect = viewModel::setCaptureMode,
            )

            Spacer(Modifier.height(20.dp))

            // Fixed-height, top-aligned box around the hero so the quick-
            // action row below never shifts position when switching modes —
            // sized to comfortably fit both variants' typical (non-parsing)
            // height; only pathological cases (huge accessibility font
            // scale, mid-parse text) push past it, which just grows the box
            // rather than clipping. Also owns the swipe-to-switch gesture:
            // a plain ancestor pointerInput naturally defers to a descendant
            // that already consumed the same drag (e.g. TypedCaptureHero's
            // OutlinedTextField handling its own text-selection drag), so
            // this only fires for drags starting outside that field.
            val swipeThresholdDp = 56.dp
            var dragAccumulatorPx by remember { mutableStateOf(0f) }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 260.dp)
                    .pointerInput(captureMode, busy) {
                        if (busy) return@pointerInput
                        val thresholdPx = swipeThresholdDp.toPx()
                        detectHorizontalDragGestures(
                            onDragStart = { dragAccumulatorPx = 0f },
                            onDragCancel = { dragAccumulatorPx = 0f },
                            onDragEnd = {
                                when {
                                    dragAccumulatorPx <= -thresholdPx && captureMode == CaptureMode.AUDIO_FIRST ->
                                        viewModel.setCaptureMode(CaptureMode.TYPING)
                                    dragAccumulatorPx >= thresholdPx && captureMode == CaptureMode.TYPING ->
                                        viewModel.setCaptureMode(CaptureMode.AUDIO_FIRST)
                                }
                                dragAccumulatorPx = 0f
                            },
                        ) { change, dragAmount ->
                            dragAccumulatorPx += dragAmount
                            change.consume()
                        }
                    },
                contentAlignment = Alignment.TopCenter,
            ) {
                // AnimatedContent (not a bare `when`) so switching modes via
                // CaptureModeToggle or the swipe gesture above cross-fades/
                // slides instead of hard-cutting — direction follows the
                // toggle's left-to-right ordering (AUDIO_FIRST -> TYPING
                // slides leftward, reverse comes back), and SizeTransform
                // animates the height change between the circular
                // VoiceButton and the taller TypedCaptureHero.
                AnimatedContent(
                    targetState = captureMode,
                    modifier = Modifier.fillMaxWidth(),
                    transitionSpec = {
                        val forward = targetState.ordinal > initialState.ordinal
                        (fadeIn(tween(220, delayMillis = 90)) +
                            slideInHorizontally(tween(220, delayMillis = 90)) { width -> if (forward) width / 4 else -width / 4 })
                            .togetherWith(
                                fadeOut(tween(90)) +
                                    slideOutHorizontally(tween(90)) { width -> if (forward) -width / 4 else width / 4 },
                            )
                            .using(SizeTransform(clip = false))
                    },
                    label = "captureModeHero",
                ) { mode ->
                    when (mode) {
                        CaptureMode.AUDIO_FIRST -> {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
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
                            }
                        }
                        CaptureMode.TYPING -> {
                            TypedCaptureHero(
                                inputText = uiState.inputText,
                                onInputChanged = viewModel::onInputChanged,
                                captureLanguage = uiState.captureLanguage,
                                isParsing = uiState.isParsing,
                                parsingStage = uiState.parsingStage,
                                busy = busy,
                                submitEnabled = uiState.inputText.isNotBlank() && !uiState.isParsing && !busy &&
                                    uiState.aiAvailability is AiAvailability.Ready,
                                onManualEntry = { viewModel.manualEntry { result -> onDraftReady(result) } },
                                onSubmit = { viewModel.submit { result -> onDraftReady(result) } },
                            )
                        }
                    }
                }
            }

            // Quick actions for the other primary capture modes —
            // promoted out of the old "Other" overflow menu so they're
            // discoverable without an extra tap, but sized well below
            // the hero VoiceButton so voice stays visually primary. Each
            // hides once its own ongoing-session banner is showing
            // above, since the banner already owns that mode's stop/
            // complete affordance. Photo capture has no such banner (a
            // photo is a one-shot action, not an ongoing session) so it
            // always shows. "Type instead" was removed once CaptureModeToggle
            // above became the only entry point into Typing mode worth
            // keeping — down to 3 buttons max now, spaced out a bit more
            // than before to use the room that freed up.
            //
            // Still FlowRow, not a plain Row — 3 buttons comfortably fit a
            // single line on typical phone widths at this spacing, but
            // FlowRow costs nothing when it doesn't need to wrap and keeps
            // the same overflow safety net (see git history for the bug
            // this originally fixed when there were 4 buttons) for
            // narrower screens or larger accessibility text.
            Spacer(Modifier.height(16.dp))
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (openTimerEntry == null) {
                    QuickActionButton(
                        icon = Icons.Filled.Timer,
                        label = stringResource(R.string.capture_quick_action_work),
                        enabled = !busy,
                        onClick = viewModel::startNewWork,
                    )
                }
                if (openTripEntry == null) {
                    QuickActionButton(
                        icon = Icons.Filled.LocationOn,
                        label = stringResource(R.string.capture_quick_action_trip),
                        enabled = !busy,
                        onClick = ::onTripButtonTap,
                    )
                }

                // The unified photo-capture entry point — the model
                // decides odometer-reading vs. work evidence once the
                // photo is taken (see CaptureViewModel.processCapturedPhoto)
                // rather than the host having to pick the right button
                // first, so there's just one photo action here.
                QuickActionButton(
                    icon = Icons.Filled.PhotoCamera,
                    label = stringResource(R.string.capture_photo_button),
                    enabled = !busy,
                    onClick = { cameraCapture.launch() },
                )
            }

            if (uiState.isProcessingPhoto) {
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

            // Audio-first only — the typed hero above already shows its own
            // inline parsing row next to the text field (see
            // TypedCaptureHero), so this staged, "still working after a
            // while" indicator (see ParsingProgress's kdoc) stays reserved
            // for the voice auto-parse path, which has no button of its own
            // to host a spinner in.
            if (uiState.isParsing && captureMode == CaptureMode.AUDIO_FIRST) {
                Spacer(Modifier.height(16.dp))
                ParsingProgress(uiState.parsingStage)
            }

            Spacer(Modifier.height(32.dp))

            if (locationPermissionDenied) {
                Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(R.string.capture_location_permission_needed),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
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

    // Voice-triggered GPS trip start/stop also writes straight to Firestore
    // (see CaptureViewModel.parseAndProceed's TripIntentClassifier branch) —
    // same transient-confirmation pattern as the timer message above. Photo-
    // based trip capture no longer uses this; it always resolves to Confirm
    // instead (see CaptureViewModel.processCapturedPhoto).
    LaunchedEffect(uiState.tripMessage) {
        if (uiState.tripMessage != null) {
            delay(TIMER_MESSAGE_HOLD_MS)
            viewModel.dismissTripMessage()
        }
    }

    if (showHelpWalkthrough) {
        HelpWalkthroughDialog(onDismiss = { showHelpWalkthrough = false })
    }

    if (showCancelWorkDialog) {
        DiscardInProgressDialog(
            title = stringResource(R.string.capture_cancel_work_dialog_title),
            text = stringResource(R.string.capture_cancel_work_dialog_text),
            onDismiss = { showCancelWorkDialog = false },
            onConfirm = {
                showCancelWorkDialog = false
                workWasCancelled = true
                viewModel.cancelWork()
            },
        )
    }

    if (showCancelTripDialog) {
        DiscardInProgressDialog(
            title = stringResource(R.string.capture_cancel_trip_dialog_title),
            text = stringResource(R.string.capture_cancel_trip_dialog_text),
            onDismiss = { showCancelTripDialog = false },
            onConfirm = {
                showCancelTripDialog = false
                tripWasCancelled = true
                viewModel.cancelTrip()
            },
        )
    }
}

@Composable
private fun DiscardInProgressDialog(
    title: String,
    text: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(stringResource(R.string.capture_cancel_dialog_confirm), color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.capture_cancel_dialog_dismiss))
            }
        },
    )
}

private const val TIMER_MESSAGE_HOLD_MS = 3000L

/** How long the ongoing-work/trip banners linger in their "completed" state — see the two `LaunchedEffect(openXEntry)` blocks in CaptureScreen. */
private const val RECENTLY_COMPLETED_DISPLAY_MS = 5000L

/**
 * The screen's title, doubling as a passive progress visualizer: letters
 * render brand-colored up through [CaptureHoursProgress.fraction] of the
 * word, muted past it — a mercury-thermometer read of how far into
 * [MaterialParticipationTest.THRESHOLD_HOURS] the host is. The "X / 100
 * hrs" caption underneath keeps the exact number visible too — the fill
 * alone reads at a glance but isn't precise, and doesn't duplicate
 * Dashboard's own "X of 100 hrs toward the Y test" callout since this one
 * omits the test name and sits in a much smaller space (see
 * CaptureViewModel.hoursProgress's kdoc for why the underlying figure is
 * recomputed independently here rather than sharing Dashboard's
 * ViewModel). Both the fill and the number animate off one shared
 * Animatable<Float> (in raw hours, not the 0-1 fraction) so they're always
 * in lockstep — eases in from empty on first appearance and eases to a new
 * value whenever [hoursProgress] changes (e.g. right after confirming an
 * entry) instead of snapping, so the sweep and the count-up both read as
 * motion rather than a static gauge. A continuous brass shimmer loops
 * through the filled portion on top of that — the two-tone brush alone
 * reads as static styling once it stops moving, so the shimmer is what
 * actually keeps the letters legible as a *live* indicator rather than a
 * one-time paint job.
 */
@Composable
private fun TitleWordmark(hoursProgress: CaptureHoursProgress) {
    val animatedHours = remember { Animatable(0f) }
    LaunchedEffect(hoursProgress.confirmedHours) {
        animatedHours.animateTo(
            targetValue = hoursProgress.confirmedHours.toFloat().coerceAtLeast(0f),
            animationSpec = tween(durationMillis = 900, easing = FastOutSlowInEasing),
        )
    }
    val filledColor = MaterialTheme.colorScheme.primary
    val mutedColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.35f)
    val p = (animatedHours.value / hoursProgress.thresholdHours).coerceIn(0f, 1f)
    val feather = 0.06f
    val brush = Brush.horizontalGradient(
        colorStops = arrayOf(
            0f to filledColor,
            (p - feather).coerceIn(0f, 1f) to filledColor,
            (p + feather).coerceIn(0f, 1f) to mutedColor,
            1f to mutedColor,
        ),
    )

    // A brass shimmer that sweeps continuously through just the filled
    // (earned-hours) portion of the wordmark — the two-tone brush above
    // communicates *how much* progress there is, but on its own reads as
    // static styling rather than a live indicator; this loop is what
    // actually signals "this number is tracked/alive," same shimmer
    // language as a charging or loading indicator. Composited with
    // BlendMode.SrcAtop so it only tints pixels the Text itself already
    // drew (the glyphs, not the surrounding background), and the draw
    // rect's own width is clamped to the filled fraction so it never
    // sweeps into the still-muted portion.
    val shimmerColor = MaterialTheme.colorScheme.tertiary
    val shimmerTransition = rememberInfiniteTransition(label = "title-shimmer")
    val shimmerT by shimmerTransition.animateFloat(
        initialValue = -0.6f,
        targetValue = 1.6f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 2200, easing = LinearEasing),
        ),
        label = "title-shimmer-t",
    )

    Text(
        text = stringResource(R.string.app_name),
        style = MaterialTheme.typography.headlineMedium.copy(brush = brush, fontWeight = FontWeight.Bold),
        modifier = Modifier
            .graphicsLayer(compositingStrategy = CompositingStrategy.Offscreen)
            .drawWithContent {
                drawContent()
                val filledWidth = size.width * p
                if (filledWidth > 0f) {
                    val bandHalfWidth = filledWidth.coerceAtLeast(1f) * 0.4f
                    val center = filledWidth * shimmerT
                    drawRect(
                        brush = Brush.horizontalGradient(
                            colors = listOf(Color.Transparent, shimmerColor, Color.Transparent),
                            startX = center - bandHalfWidth,
                            endX = center + bandHalfWidth,
                        ),
                        size = Size(filledWidth, size.height),
                        blendMode = BlendMode.SrcAtop,
                    )
                }
            },
    )
    Spacer(Modifier.height(4.dp))
    Text(
        text = stringResource(
            R.string.capture_title_hours_progress,
            animatedHours.value.toInt(),
            hoursProgress.thresholdHours,
        ),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

/**
 * Switches which hero widget CaptureScreen shows below it — the big
 * VoiceButton for AUDIO_FIRST, or [TypedCaptureHero] for TYPING. Segmented
 * (Material3's "pick exactly one of a few options" component), same visual
 * language as the language picker in Settings. Session-only: see
 * CaptureViewModel.captureMode's kdoc for why this never writes back to
 * Settings' persisted default.
 *
 * `fillMaxWidth()` + `Modifier.weight(1f)` on each segment makes the row
 * actually use the screen's full width (it previously wrapped to its
 * unweighted intrinsic content size, which both wasted space on normal
 * phones and meant a narrow device had nowhere to grow into before its
 * labels got clipped). For the cases still too narrow for the full labels
 * even at full width — small/old phones, a large accessibility font scale,
 * or a non-English label that measures wider than English does — this
 * measures each label against the space its segment will actually get and
 * swaps to a mic/keyboard icon instead of silently letting Material3
 * truncate the text.
 *
 * [order] puts the user's chosen default on the left — see
 * CaptureViewModel.captureModeOrder's kdoc for why it's a fixed snapshot,
 * not re-derived from [selected] on every recomposition (that would reorder
 * the control itself every time the user taps the other segment).
 */
@Composable
private fun CaptureModeToggle(selected: CaptureMode, order: List<CaptureMode>, enabled: Boolean, onSelect: (CaptureMode) -> Unit) {
    @Composable
    fun labelFor(mode: CaptureMode) = when (mode) {
        CaptureMode.AUDIO_FIRST -> stringResource(R.string.capture_mode_audio_first)
        CaptureMode.TYPING -> stringResource(R.string.capture_mode_typing)
    }
    fun iconFor(mode: CaptureMode) = when (mode) {
        CaptureMode.AUDIO_FIRST -> Icons.Filled.Mic
        CaptureMode.TYPING -> Icons.Filled.Keyboard
    }
    val options = order.map { mode -> Triple(mode, labelFor(mode), iconFor(mode)) }
    val labelStyle = MaterialTheme.typography.labelMedium
    val textMeasurer = rememberTextMeasurer()
    val density = LocalDensity.current

    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        // Material3 gives each SegmentedButton a fixed chrome (leading
        // icon/checkmark slot + horizontal content padding) on top of the
        // label itself — roughly 64dp regardless of text length — so the
        // per-segment space actually available to the label is the
        // container's width split evenly, minus that chrome.
        val segmentChromePx = with(density) { 64.dp.toPx() }
        val availableLabelPx = with(density) { maxWidth.toPx() } / options.size - segmentChromePx
        val useIconsOnly = options.any { (_, label, _) ->
            textMeasurer.measure(label, labelStyle).size.width > availableLabelPx
        }

        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            options.forEachIndexed { index, (mode, label, icon) ->
                SegmentedButton(
                    selected = selected == mode,
                    onClick = { onSelect(mode) },
                    enabled = enabled,
                    modifier = Modifier.weight(1f),
                    shape = SegmentedButtonDefaults.itemShape(index = index, count = options.size),
                    label = {
                        if (useIconsOnly) {
                            Icon(icon, contentDescription = label, modifier = Modifier.size(18.dp))
                        } else {
                            Text(label, style = labelStyle, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    },
                )
            }
        }
    }
}

/**
 * The Typing hero — same text field/parsing-row/button-row content as the
 * old "Type instead" card, minus its ContempoCard wrapper and back-arrow:
 * typing is a primary capture mode now (see CaptureModeToggle above), not a
 * dismissible overlay on top of voice capture, so there's nothing to "go
 * back" from.
 */
@Composable
private fun TypedCaptureHero(
    inputText: String,
    onInputChanged: (String) -> Unit,
    captureLanguage: CaptureLanguage,
    isParsing: Boolean,
    parsingStage: ParsingStage,
    busy: Boolean,
    submitEnabled: Boolean,
    onManualEntry: () -> Unit,
    onSubmit: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        OutlinedTextField(
            value = inputText,
            onValueChange = onInputChanged,
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy,
            minLines = 5,
            placeholder = { Text(stringResource(R.string.capture_hint)) },
            shape = MaterialTheme.shapes.medium,
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant,
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                focusedContainerColor = MaterialTheme.colorScheme.surface,
            ),
            // Lets a "mostly typing, sometimes voice to save time" host drop
            // into the same field they're already typing in rather than
            // switching back to Audio-first mode — see DictationButton's
            // kdoc for why this is a separate mechanism from the main
            // VoiceButton flow (raw transcript only, no LLM parse).
            trailingIcon = {
                DictationButton(
                    currentText = inputText,
                    onTextChanged = onInputChanged,
                    language = captureLanguage,
                    enabled = !busy,
                )
            },
        )

        if (isParsing) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
                Text(
                    parsingStageLabel(parsingStage),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // Equal-width, icon+text buttons — same "no bare/mismatched buttons"
        // treatment as OngoingActionButtonRow below (see its kdoc): a plain
        // TextButton next to a filled Button reads as mismatched weight
        // (one looks like a link, the other a real CTA) and a
        // SpaceBetween row leaves a huge dead gap on wide phones instead of
        // two clearly bounded tap targets.
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedButton(
                onClick = onManualEntry,
                enabled = !busy,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(vertical = 10.dp),
            ) {
                Icon(Icons.Filled.Edit, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(stringResource(R.string.capture_manual_button), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Button(
                onClick = onSubmit,
                enabled = submitEnabled,
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(vertical = 10.dp),
            ) {
                if (isParsing) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.capture_parsing), maxLines = 1, overflow = TextOverflow.Ellipsis)
                } else {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.capture_send_button), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

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

/**
 * Smaller companion to [VoiceButton] (64dp vs. its 184dp) for the two other
 * primary capture modes — big enough to read as a main action, not a
 * secondary/overflow one, while still keeping voice capture visually
 * dominant.
 */
@Composable
private fun QuickActionButton(
    icon: ImageVector,
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    containerColor: Color = MaterialTheme.colorScheme.primaryContainer,
    contentColor: Color = MaterialTheme.colorScheme.primary,
) {
    // Fixed width (rather than sizing to the label's own text) so all
    // buttons in the row line up as a uniform, centered group regardless of
    // label length, so without this the icon circles read as unevenly
    // placed even though the row's own arrangement is already centered.
    // Sized down from 84/64/24dp (see git history) — at the old size, 3
    // buttons plus FlowRow's spacing landed right at the edge of a typical
    // ~360dp-wide phone's available width, tipping into a wrap on at least
    // one real narrower device (reported via in-app feedback); this leaves
    // real margin instead of relying on the wrap fallback for the common case.
    Column(
        modifier = Modifier.width(76.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(containerColor)
                .clickable(onClick = onClick, enabled = enabled)
                .semantics { contentDescription = label },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(22.dp),
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
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
 * Compact Quick Capture status badge, next to the help button — replaced a
 * full-width box below the quick-action row (see git history) in response
 * to in-app feedback asking for exactly this placement. Shows one thing at
 * a time, by priority: the in-progress stage (if the one-at-a-time pipeline
 * — see AudioCaptureProcessor — is currently working on something), else
 * today's still-waiting count, else today's completed count. Tapping it
 * triggers the same "process now" action the old row's separate sync
 * IconButton did, when there's a backlog and nothing's already mid-pipeline.
 */
@Composable
private fun QuickCaptureBadge(status: QuickCaptureStatusUiState, onProcessNow: () -> Unit) {
    val canProcessNow = status.pendingCount > 0 && status.processingStage == null
    val statusDescription = when {
        status.processingStage != null -> quickCaptureStageLabel(status.processingStage)
        status.pendingCount > 0 -> stringResource(R.string.capture_quick_capture_status_pending, status.pendingCount)
        else -> stringResource(R.string.capture_quick_capture_status_completed, status.completedTodayCount)
    }
    val contentDescription = if (canProcessNow) {
        "$statusDescription. ${stringResource(R.string.capture_quick_capture_process_now_content_description)}"
    } else {
        statusDescription
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .then(if (canProcessNow) Modifier.clickable(onClick = onProcessNow) else Modifier)
            .padding(horizontal = 8.dp, vertical = 4.dp)
            .semantics { this.contentDescription = contentDescription },
    ) {
        when {
            status.processingStage != null -> {
                CircularProgressIndicator(modifier = Modifier.size(10.dp), strokeWidth = 1.5.dp, color = MaterialTheme.colorScheme.tertiary)
            }
            status.pendingCount > 0 -> {
                Icon(Icons.Filled.Schedule, contentDescription = null, modifier = Modifier.size(12.dp))
                Text(status.pendingCount.toString(), style = MaterialTheme.typography.labelSmall)
            }
            else -> {
                Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.primary)
                Text(status.completedTodayCount.toString(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
            }
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
 * way back into a capture already in progress. [onComplete] is a dedicated
 * button now (Pause/Complete/Cancel, left to right) rather than a whole-card
 * tap gesture — the previous "tap the card to finish" affordance had no
 * visible cue and was reported confusing. Once [isCompleted] (see
 * CaptureScreen's `timerJustCompleted` — a brief window right after
 * completing, before this banner is torn down entirely), the controls give
 * way to a single "tap to add details" affordance that opens EntryDetail for
 * the entry that was just closed, since [entry.durationMinutes]/property/
 * task may still need filling in (it's saved as PENDING_REVIEW, not
 * CONFIRMED — see TimerEntryCoordinator.closeEntry).
 */
@Composable
private fun OngoingWorkBanner(
    entry: com.hejitech.core.model.Entry,
    enabled: Boolean,
    isCompleted: Boolean,
    onComplete: () -> Unit,
    onPauseToggle: () -> Unit,
    onCancel: () -> Unit,
    onTapCompleted: () -> Unit,
) {
    // Ticks once a second so the banner itself reads as a live running clock —
    // this is now the only "tracking" feedback in Capture (see
    // CaptureViewModel.handleTimerStart/startNewWork, which no longer set a
    // separate bottom confirmation message). Frozen (uses pausedAt instead of
    // the ticking clock) while paused, so it reads as genuinely stopped
    // rather than still counting. Stops ticking entirely once isCompleted —
    // the entry's own activityDate/pausedDurationSeconds no longer change at
    // that point, so the duration is read directly off the now-final
    // entry.durationMinutes instead.
    var nowSeconds by remember(entry.activityDate) { mutableStateOf(System.currentTimeMillis() / 1000) }
    LaunchedEffect(entry.activityDate, isCompleted) {
        if (isCompleted) return@LaunchedEffect
        while (true) {
            nowSeconds = System.currentTimeMillis() / 1000
            delay(1000)
        }
    }
    val elapsedSeconds = if (isCompleted) {
        entry.durationMinutes * 60L
    } else {
        (
            (if (entry.isPaused) entry.pausedAt?.seconds ?: nowSeconds else nowSeconds) -
                entry.activityDate.seconds - entry.pausedDurationSeconds
            ).coerceAtLeast(0)
    }

    ContempoCard(
        modifier = Modifier
            .fillMaxWidth()
            .let { if (isCompleted) it.clickable(onClick = onTapCompleted) else it },
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (isCompleted) Icons.Filled.Check else Icons.Filled.Mic,
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
                        stringResource(
                            when {
                                isCompleted -> R.string.capture_ongoing_completed_hint
                                entry.isPaused -> R.string.capture_ongoing_paused_label
                                else -> R.string.capture_ongoing_work_tap_hint
                            },
                        ),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (!isCompleted) {
                Spacer(Modifier.height(12.dp))
                OngoingActionButtonRow(
                    isPaused = entry.isPaused,
                    enabled = enabled,
                    onPauseToggle = onPauseToggle,
                    onComplete = onComplete,
                    onCancel = onCancel,
                )
            }
        }
    }
}

/**
 * The Pause/Complete/Cancel row shared by [OngoingWorkBanner] and
 * [OngoingTripBanner] — icon-only now to save on-screen space, but still a
 * real full-width `Row` of bounded, outlined/filled buttons below the info
 * text, not three bare `IconButton`s squeezed into the same row as the
 * title/elapsed-time/status text (that squeeze was reported hard to tap
 * accurately: default `IconButton`s meet Android's 48dp minimum touch
 * target technically, but three of them crammed edge-to-edge with no
 * visible boundary gave no visual confirmation of where one tap target
 * ended and the next began). Each button still gets roughly a third of the
 * card's width as its target, and a visible outlined/filled boundary — only
 * the text label is gone, moved to `contentDescription` for accessibility.
 */
@Composable
private fun OngoingActionButtonRow(
    isPaused: Boolean,
    enabled: Boolean,
    onPauseToggle: () -> Unit,
    onComplete: () -> Unit,
    onCancel: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedButton(
            onClick = onPauseToggle,
            enabled = enabled,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(vertical = 10.dp),
        ) {
            Icon(
                if (isPaused) Icons.Filled.PlayArrow else Icons.Filled.Pause,
                contentDescription = stringResource(if (isPaused) R.string.capture_resume_content_description else R.string.capture_pause_content_description),
                modifier = Modifier.size(20.dp),
            )
        }
        Button(
            onClick = onComplete,
            enabled = enabled,
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(vertical = 10.dp),
        ) {
            Icon(Icons.Filled.Check, contentDescription = stringResource(R.string.capture_complete_label), modifier = Modifier.size(20.dp))
        }
        OutlinedButton(
            onClick = onCancel,
            enabled = enabled,
            modifier = Modifier.weight(1f),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f)),
            contentPadding = PaddingValues(vertical = 10.dp),
        ) {
            Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.capture_cancel_label), modifier = Modifier.size(20.dp))
        }
    }
}

/**
 * Mirrors OngoingWorkBanner above for a running mileage trip — before this,
 * the only sign a trip was still open was the "Other" menu button's label/
 * tint swapping to "Trip in progress" (see otherContentDescription above),
 * easy to miss since it's collapsed behind a menu. [onComplete] is a
 * dedicated button now, same reasoning as OngoingWorkBanner's [isCompleted]
 * kdoc — GPS trips stop tracking immediately; odometer trips instead launch
 * the ending odometer photo capture, since that's how that capture method
 * actually closes a trip (see [isGps]), so tapping Complete there doesn't
 * itself trigger [isCompleted] until that photo flow finishes closing the
 * entry.
 */
@Composable
private fun OngoingTripBanner(
    entry: com.hejitech.core.model.Entry,
    isGps: Boolean,
    enabled: Boolean,
    isCompleted: Boolean,
    onComplete: () -> Unit,
    onPauseToggle: () -> Unit,
    onCancel: () -> Unit,
    onTapCompleted: () -> Unit,
) {
    var nowSeconds by remember(entry.activityDate) { mutableStateOf(System.currentTimeMillis() / 1000) }
    LaunchedEffect(entry.activityDate, isCompleted) {
        if (isCompleted) return@LaunchedEffect
        while (true) {
            nowSeconds = System.currentTimeMillis() / 1000
            delay(1000)
        }
    }
    val elapsedSeconds = if (isCompleted) {
        entry.durationMinutes * 60L
    } else {
        (
            (if (entry.isPaused) entry.pausedAt?.seconds ?: nowSeconds else nowSeconds) -
                entry.activityDate.seconds - entry.pausedDurationSeconds
            ).coerceAtLeast(0)
    }

    ContempoCard(
        modifier = Modifier
            .fillMaxWidth()
            .let { if (isCompleted) it.clickable(onClick = onTapCompleted) else it },
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (isCompleted) Icons.Filled.Check else Icons.Filled.LocationOn,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                )
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        stringResource(R.string.capture_ongoing_trip_title),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text(
                        formatElapsedDuration(elapsedSeconds),
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    // Only GPS trips checkpoint live distance (see
                    // MileageTrackingService.locationCallback); an odometer trip
                    // won't know its distance until the ending photo is logged.
                    if (isGps) {
                        Text(
                            stringResource(R.string.capture_ongoing_trip_distance, "%.2f".format(entry.miles)),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Text(
                        stringResource(
                            when {
                                isCompleted -> R.string.capture_ongoing_completed_hint
                                entry.isPaused -> R.string.capture_ongoing_paused_label
                                isGps -> R.string.capture_ongoing_trip_tap_hint_gps
                                else -> R.string.capture_ongoing_trip_tap_hint_odometer
                            },
                        ),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (!isCompleted) {
                Spacer(Modifier.height(12.dp))
                OngoingActionButtonRow(
                    isPaused = entry.isPaused,
                    enabled = enabled,
                    onPauseToggle = onPauseToggle,
                    onComplete = onComplete,
                    onCancel = onCancel,
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
        ParsingStage.STRUCTURING -> R.string.capture_stage_structuring
    }
)

private fun hasPermission(context: android.content.Context, permission: String): Boolean =
    androidx.core.content.ContextCompat.checkSelfPermission(context, permission) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
