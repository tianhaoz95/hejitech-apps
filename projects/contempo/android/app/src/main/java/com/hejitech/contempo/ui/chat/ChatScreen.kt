package com.hejitech.contempo.ui.chat

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AlternateEmail
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.agent.AiAvailability
import com.hejitech.contempo.agent.ChatMessage
import com.hejitech.contempo.agent.ChatRole
import com.hejitech.contempo.agent.GenerationEvent
import com.hejitech.contempo.ui.rememberCameraCapture
import com.hejitech.contempo.ui.theme.BulletAwareText
import com.hejitech.contempo.ui.theme.ContempoCard
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.core.model.Entry

@Composable
fun ChatScreen(viewModel: ChatViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()

    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) listState.animateScrollToItem(uiState.messages.size - 1)
    }
    // Follow the growing answer during streaming — messages.size alone doesn't
    // change while a chunk-by-chunk answer is still in progress, so without this
    // the list stays pinned at the user's own message and the reply appears
    // "frozen" even though it's actively generating further down. A plain
    // scrollToItem(index) only brings the item's *top* into view, which still
    // leaves a long answer's growing tail (and the token counter) below the
    // fold — the huge scrollOffset pushes as far into the item as it has
    // content for, i.e. keeps the tail pinned to the bottom of the viewport.
    // No animation, since this fires once per chunk.
    LaunchedEffect(uiState.streamingStatus) {
        if (uiState.isSending) listState.scrollToItem(uiState.messages.size, scrollOffset = 1_000_000)
    }

    val cameraCapture = rememberCameraCapture { bitmap, _ -> viewModel.attachImage(bitmap) }

    var pendingRecordAfterPermission by remember { mutableStateOf(false) }
    var micPermissionDenied by remember { mutableStateOf(false) }
    var attachMenuExpanded by remember { mutableStateOf(false) }
    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted && pendingRecordAfterPermission) viewModel.startRecording()
        micPermissionDenied = !granted
        pendingRecordAfterPermission = false
    }

    fun onMicTap() {
        when {
            uiState.isRecording -> viewModel.stopRecordingAndSend()
            uiState.isTranscribing -> Unit
            viewModel.hasRecordAudioPermission() -> viewModel.startRecording()
            else -> {
                pendingRecordAfterPermission = true
                micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }

    // .imePadding() needs android:windowSoftInputMode="adjustResize" (see
    // AndroidManifest.xml) to receive correct, live WindowInsets.ime values.
    // Scaffold's own default contentWindowInsets does NOT include ime
    // (confirmed via decompiling the real Material3 AAR — it's
    // systemBarsForVisualComponents, not safeDrawing), so this screen-level
    // modifier is the one thing actually reserving keyboard space here.
    var showClearHistoryDialog by remember { mutableStateOf(false) }
    var showDisclaimerDialog by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().imePadding().padding(16.dp)) {
        // Mirrors iOS ChatScreen's top status bar: eyebrow + a live "AI
        // Online"/"Checking AI…" pill, so availability is visible at a
        // glance instead of only surfacing once a send is blocked. The
        // disclaimer question-mark button used to be a permanent Text line
        // pinned under the input bar — moved into a popup here instead so
        // that space goes back to chat content (see DisclaimerDialog below).
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Eyebrow(stringResource(R.string.chat_eyebrow), modifier = Modifier.padding(start = 8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                AiStatusPill(uiState.aiAvailability)
                IconButton(onClick = { showDisclaimerDialog = true }) {
                    Icon(
                        Icons.AutoMirrored.Filled.HelpOutline,
                        contentDescription = stringResource(R.string.chat_disclaimer_button_content_description),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (uiState.messages.isNotEmpty()) {
                    IconButton(onClick = { showClearHistoryDialog = true }) {
                        Icon(
                            Icons.Filled.DeleteOutline,
                            contentDescription = stringResource(R.string.chat_clear_history_button),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        if (uiState.messages.isEmpty()) {
            ChatHeroEmptyState(
                modifier = Modifier.weight(1f),
                onSelectPrompt = viewModel::sendPrompt,
            )
        } else {
            LazyColumn(modifier = Modifier.weight(1f), state = listState, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(uiState.messages) { message -> ChatBubble(message) }
                if (uiState.isSending) {
                    item { SendingIndicator(uiState.streamingStatus) }
                }
            }
        }

        uiState.errorMessage?.let { error ->
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(4.dp))
        }

        if (cameraCapture.permissionDenied) {
            Text(
                stringResource(R.string.chat_camera_permission_needed),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
        }

        if (micPermissionDenied) {
            Text(
                stringResource(R.string.chat_mic_permission_needed),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
        }

        if (uiState.isTranscribing) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.capture_transcribing),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(4.dp))
        }

        uiState.pendingImage?.let { image ->
            Box(modifier = Modifier.padding(bottom = 8.dp)) {
                Image(
                    bitmap = image.asImageBitmap(),
                    contentDescription = stringResource(R.string.chat_pending_photo_description),
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(72.dp)
                        .clip(RoundedCornerShape(12.dp)),
                )
                IconButton(onClick = viewModel::clearPendingImage, modifier = Modifier.align(Alignment.TopEnd).size(24.dp)) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = stringResource(R.string.chat_remove_photo_button),
                        tint = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }

        if (uiState.pendingEntries.isNotEmpty()) {
            LazyRow(
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(uiState.pendingEntries) { entry ->
                    AssistChip(
                        onClick = { viewModel.removeAttachedEntry(entry) },
                        label = {
                            Text(
                                entry.propertyName.ifBlank { entry.task.ifBlank { stringResource(R.string.capture_ongoing_work_untitled) } },
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        },
                        trailingIcon = {
                            Icon(
                                Icons.Filled.Close,
                                contentDescription = stringResource(R.string.chat_remove_attached_entry_button),
                                modifier = Modifier.size(16.dp),
                            )
                        },
                        colors = AssistChipDefaults.assistChipColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                    )
                }
            }
        }

        // Compact 40dp circular toolbar buttons (not the default 48dp
        // IconButton touch target) so up to four of them plus the text
        // field still fit on a narrow phone width — a plain fillMaxWidth
        // Row of full-size IconButtons left almost no room for the field on
        // a ~360dp-wide screen, squeezing it into a multi-line wrap that
        // read as "too tall." Mirrors iOS's ChatScreen input bar, which
        // already solves this with 38dp circular buttons + a line-capped
        // field — same fix, same reasoning, just ported.
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (uiState.isRecording) {
                // Recording is already underway — skip straight to the stop
                // affordance (a menu tap-through would just add friction to
                // ending a recording that's already running).
                ChatToolbarButton(
                    icon = Icons.Filled.Mic,
                    contentDescription = stringResource(R.string.capture_voice_stop),
                    enabled = !uiState.isTranscribing,
                    tint = MaterialTheme.colorScheme.error,
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    onClick = ::onMicTap,
                )
            } else {
                // One grouped button (rather than three always-visible ones)
                // that expands into a popup menu on tap — same reasoning as
                // the compact toolbar sizing above: three separate buttons
                // plus the field plus send left too little room on a narrow
                // screen. "@" typed directly in the field (see
                // ChatViewModel.onInputChanged) is the faster path to the
                // same attach-entry action for anyone who discovers it.
                Box {
                    ChatToolbarButton(
                        icon = Icons.Filled.Add,
                        contentDescription = stringResource(R.string.chat_attach_button),
                        enabled = !uiState.isTranscribing,
                        onClick = { attachMenuExpanded = true },
                    )
                    DropdownMenu(expanded = attachMenuExpanded, onDismissRequest = { attachMenuExpanded = false }) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.chat_attach_entry_button)) },
                            leadingIcon = { Icon(Icons.Filled.AlternateEmail, contentDescription = null) },
                            onClick = { attachMenuExpanded = false; viewModel.openEntryPicker() },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.chat_attach_photo_button)) },
                            leadingIcon = { Icon(Icons.Filled.PhotoCamera, contentDescription = null) },
                            onClick = { attachMenuExpanded = false; cameraCapture.launch() },
                        )
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.capture_voice_start)) },
                            leadingIcon = { Icon(Icons.Filled.Mic, contentDescription = null) },
                            onClick = { attachMenuExpanded = false; onMicTap() },
                        )
                    }
                }
            }
            OutlinedTextField(
                value = uiState.inputText,
                onValueChange = viewModel::onInputChanged,
                modifier = Modifier.weight(1f),
                enabled = !uiState.isRecording && !uiState.isTranscribing,
                placeholder = {
                    Text(
                        stringResource(if (uiState.isRecording) R.string.capture_listening else R.string.chat_input_hint),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                // Capped rather than unbounded — without this, a long
                // message (or a squeezed width forcing early wraps) grew the
                // field indefinitely tall. Beyond 5 lines it scrolls
                // internally instead, same as iOS's lineLimit(1...5).
                maxLines = 5,
            )
            ChatToolbarButton(
                icon = Icons.AutoMirrored.Filled.Send,
                contentDescription = stringResource(R.string.capture_send_button),
                enabled = (uiState.inputText.isNotBlank() || uiState.pendingImage != null || uiState.pendingEntries.isNotEmpty()) &&
                    !uiState.isSending && !uiState.isRecording && !uiState.isTranscribing &&
                    uiState.aiAvailability is AiAvailability.Ready,
                filled = true,
                onClick = viewModel::send,
            )
        }
    }

    if (showClearHistoryDialog) {
        ClearHistoryDialog(
            onDismiss = { showClearHistoryDialog = false },
            onConfirm = { showClearHistoryDialog = false; viewModel.clearHistory() },
        )
    }

    if (showDisclaimerDialog) {
        DisclaimerDialog(onDismiss = { showDisclaimerDialog = false })
    }

    if (uiState.showEntryPicker) {
        EntryPickerDialog(
            entries = uiState.availableEntries,
            onDismiss = viewModel::dismissEntryPicker,
            onSelect = viewModel::attachEntry,
        )
    }
}

/**
 * Lets the host attach one or more specific logged entries as context for
 * an entry-specific question — reachable both from the attach menu's
 * "Attach entry" item and by typing "@" directly in the input (see
 * ChatViewModel.onInputChanged). Selecting an entry closes the dialog
 * (ChatViewModel.attachEntry), same one-tap-and-done feel as picking a
 * role/property elsewhere in the app; open it again to attach another.
 */
@Composable
private fun EntryPickerDialog(entries: List<Entry>, onDismiss: () -> Unit, onSelect: (Entry) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.chat_attach_entry_dialog_title)) },
        text = {
            if (entries.isEmpty()) {
                Text(stringResource(R.string.chat_attach_entry_dialog_empty), color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                LazyColumn(modifier = Modifier.height(360.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(entries) { entry ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelect(entry) }
                                .padding(vertical = 10.dp),
                        ) {
                            Text(
                                entry.propertyName.ifBlank { stringResource(R.string.capture_ongoing_work_untitled) },
                                style = MaterialTheme.typography.labelLarge,
                            )
                            Text(
                                entry.task.ifBlank { "—" },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.confirm_cancel_button)) }
        },
    )
}

/**
 * Compact circular icon button for the chat input bar — deliberately not a
 * default Material `IconButton` (48dp minimum touch target), since up to
 * four of these sit in the same row as the text field on screens as narrow
 * as ~360dp; at the default size there was no room left for the field
 * before it started wrapping. 40dp keeps this comfortably tappable while
 * matching iOS's equivalent 38dp circular toolbar buttons.
 */
@Composable
private fun ChatToolbarButton(
    icon: ImageVector,
    contentDescription: String,
    enabled: Boolean,
    onClick: () -> Unit,
    tint: Color = MaterialTheme.colorScheme.primary,
    containerColor: Color = MaterialTheme.colorScheme.primaryContainer,
    // Send uses a solid-filled circle so the primary action still reads as
    // visually distinct from the three neutral attach/photo/mic actions,
    // same emphasis iOS's arrow.up send button has.
    filled: Boolean = false,
) {
    val background = when {
        filled && enabled -> MaterialTheme.colorScheme.primary
        filled -> MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
        enabled -> containerColor
        else -> containerColor.copy(alpha = 0.5f)
    }
    val iconTint = when {
        filled -> MaterialTheme.colorScheme.onPrimary
        enabled -> tint
        else -> tint.copy(alpha = 0.5f)
    }
    Box(
        modifier = Modifier
            .size(40.dp)
            .clip(CircleShape)
            .background(background)
            .clickable(onClick = onClick, enabled = enabled)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(20.dp))
    }
}

/** Small "AI Online"/"Checking AI…" capsule — mirrors iOS's top-bar status pill so availability is glanceable, not just an error once blocked. */
@Composable
private fun AiStatusPill(availability: AiAvailability) {
    val label = when (availability) {
        is AiAvailability.Ready -> stringResource(R.string.chat_ai_status_ready)
        is AiAvailability.Checking -> stringResource(R.string.chat_ai_status_checking)
        is AiAvailability.Downloading -> stringResource(R.string.chat_ai_status_downloading)
        is AiAvailability.Unavailable -> stringResource(R.string.chat_ai_status_unavailable)
        is AiAvailability.Failed -> stringResource(R.string.chat_ai_status_failed)
    }
    Text(
        label,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .padding(end = 4.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

/**
 * Empty-state hero — mirrors iOS's HeroEmptyStateView: a short pitch card
 * plus tappable starter-question cards that send immediately, rather than
 * just a plain line of hint text. Tapping a starter is the one-tap
 * equivalent of typing the same question and hitting send.
 */
@Composable
private fun ChatHeroEmptyState(modifier: Modifier = Modifier, onSelectPrompt: (String) -> Unit) {
    val starters = listOf(
        Triple(
            R.string.chat_starter_100_hour_title,
            R.string.chat_starter_100_hour_subtitle,
            R.string.chat_starter_100_hour_prompt,
        ),
        Triple(
            R.string.chat_starter_mileage_title,
            R.string.chat_starter_mileage_subtitle,
            R.string.chat_starter_mileage_prompt,
        ),
        Triple(
            R.string.chat_starter_audit_title,
            R.string.chat_starter_audit_subtitle,
            R.string.chat_starter_audit_prompt,
        ),
        Triple(
            R.string.chat_starter_contemporaneous_title,
            R.string.chat_starter_contemporaneous_subtitle,
            R.string.chat_starter_contemporaneous_prompt,
        ),
    )

    Column(modifier = modifier.fillMaxWidth().padding(vertical = 16.dp)) {
        ContempoCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Filled.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(stringResource(R.string.chat_hero_title), style = MaterialTheme.typography.titleMedium)
                        Text(
                            stringResource(R.string.chat_hero_subtitle),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.chat_hero_description), style = MaterialTheme.typography.bodyMedium)
            }
        }
        Spacer(Modifier.height(16.dp))
        Eyebrow(stringResource(R.string.chat_starter_section_label))
        Spacer(Modifier.height(8.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            starters.forEach { (titleRes, subtitleRes, promptRes) ->
                val prompt = stringResource(promptRes)
                ContempoCard(modifier = Modifier.fillMaxWidth().clickable { onSelectPrompt(prompt) }) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(stringResource(titleRes), style = MaterialTheme.typography.labelLarge)
                            Text(
                                stringResource(subtitleRes),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Was a permanent Text line pinned under the input bar — moved into a
 * popup, reachable via the question-mark button next to the AI-status pill,
 * so that vertical space goes back to chat content instead. Single-button
 * (just dismiss, no confirm/cancel pair) since this is informational, not a
 * decision.
 */
@Composable
private fun DisclaimerDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.chat_disclaimer_dialog_title)) },
        text = { Text(stringResource(R.string.chat_disclaimer)) },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.chat_disclaimer_dialog_dismiss))
            }
        },
    )
}

@Composable
private fun ClearHistoryDialog(onDismiss: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.chat_clear_history_dialog_title)) },
        text = { Text(stringResource(R.string.chat_clear_history_dialog_text)) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(stringResource(R.string.chat_clear_history_dialog_confirm), color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.entry_detail_delete_dialog_cancel))
            }
        },
    )
}

/**
 * Live "is this actually doing something" signal for the pending AI answer —
 * a "Thinking…" spinner during prefill (also the fallback for a cloud/image
 * answer, where no events ever fire), then the growing answer itself once
 * chunks start arriving, with a running token count underneath. See
 * GenerationEvent's kdoc for what "tokens" means here (a callback-count
 * proxy, not an exact BPE count).
 */
@Composable
private fun SendingIndicator(status: GenerationEvent?) {
    when (status) {
        is GenerationEvent.Streaming -> Column {
            ChatBubble(ChatMessage(ChatRole.AGENT, status.textSoFar))
            Text(
                stringResource(R.string.chat_tokens_generated, status.chunkCount),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 4.dp, top = 2.dp),
            )
        }
        is GenerationEvent.Prefilling, null -> Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(8.dp))
            Text(
                stringResource(R.string.chat_thinking),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/**
 * Mirrors iOS's ChatBubbleView: a sparkle avatar marks agent replies (user
 * bubbles need no avatar, same as iOS), agent text renders through
 * [BulletAwareText] so a bulleted answer actually shows as a bulleted list
 * instead of literal "- " lines, and a Copy action sits under agent replies
 * only — there's nothing worth copying out of your own question.
 */
@Composable
private fun ChatBubble(message: ChatMessage) {
    val isUser = message.role == ChatRole.USER
    var copied by remember(message) { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start) {
        if (!isUser) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.AutoAwesome,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(16.dp),
                )
            }
            Spacer(Modifier.width(8.dp))
        }
        Card(
            modifier = Modifier.widthIn(max = 280.dp),
            shape = MaterialTheme.shapes.large,
            colors = if (isUser) {
                CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            } else {
                CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
            },
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                message.image?.let { image ->
                    Image(
                        bitmap = image.asImageBitmap(),
                        contentDescription = stringResource(R.string.chat_message_photo_description),
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(160.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .padding(bottom = 8.dp),
                    )
                }
                BulletAwareText(message.text, style = MaterialTheme.typography.bodyLarge)
                if (!isUser && message.text.isNotBlank()) {
                    Row(
                        modifier = Modifier
                            .padding(top = 6.dp)
                            .clickable {
                                clipboard.setText(AnnotatedString(message.text))
                                copied = true
                            },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            if (copied) Icons.Filled.Check else Icons.Filled.ContentCopy,
                            contentDescription = stringResource(R.string.chat_copy_button),
                            tint = if (copied) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(14.dp),
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            stringResource(if (copied) R.string.chat_copied_label else R.string.chat_copy_button),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (copied) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
