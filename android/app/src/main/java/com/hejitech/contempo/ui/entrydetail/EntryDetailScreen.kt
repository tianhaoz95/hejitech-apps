package com.hejitech.contempo.ui.entrydetail

import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.media.MediaPlayer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.text.format.Formatter
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Article
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil3.compose.AsyncImage
import com.hejitech.contempo.R
import com.hejitech.contempo.ui.export.openFileExternally
import com.hejitech.contempo.ui.export.shareFile
import com.hejitech.contempo.ui.theme.BulletAwareText
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.core.model.Attachment
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryFieldValidation
import com.hejitech.core.model.EntryStatus
import com.google.firebase.Timestamp
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale

private val dateFormatter = SimpleDateFormat("EEE MMM d, yyyy 'at' HH:mm", Locale.getDefault())

@Composable
fun EntryDetailScreen(
    entryId: String,
    onBack: () -> Unit,
    onEditEntry: (Entry) -> Unit,
    viewModel: EntryDetailViewModel = viewModel(factory = EntryDetailViewModel.Factory(entryId)),
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDeleteDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.nav_back))
            }
            if (uiState.entry != null) {
                IconButton(onClick = { showDeleteDialog = true }) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = stringResource(R.string.entry_detail_delete_content_description),
                        tint = MaterialTheme.colorScheme.error,
                    )
                }
            }
        }
        Spacer(Modifier.height(4.dp))
        Eyebrow(stringResource(R.string.entry_detail_eyebrow))
        Spacer(Modifier.height(20.dp))

        val entry = uiState.entry
        when {
            uiState.isLoading -> CircularProgressIndicator()
            entry == null -> Text(stringResource(R.string.entry_detail_not_found))
            else -> EntryDetailContent(entry, onEditEntry, uiState, viewModel)
        }
    }

    if (showDeleteDialog) {
        DeleteEntryDialog(
            isDeleting = uiState.isDeleting,
            errorMessage = uiState.deleteError,
            onDismiss = { showDeleteDialog = false; viewModel.dismissDeleteError() },
            onConfirm = { viewModel.delete(onDeleted = onBack) },
        )
    }
}

@Composable
private fun DeleteEntryDialog(
    isDeleting: Boolean,
    errorMessage: String?,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = { if (!isDeleting) onDismiss() },
        title = { Text(stringResource(R.string.entry_detail_delete_dialog_title)) },
        text = {
            Column {
                Text(stringResource(R.string.entry_detail_delete_dialog_text))
                errorMessage?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !isDeleting) {
                if (isDeleting) {
                    CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp), strokeWidth = 2.dp)
                }
                Text(stringResource(R.string.entry_detail_delete_dialog_confirm), color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isDeleting) {
                Text(stringResource(R.string.entry_detail_delete_dialog_cancel))
            }
        },
    )
}

@Composable
private fun EntryDetailContent(
    entry: Entry,
    onEditEntry: (Entry) -> Unit,
    uiState: EntryDetailUiState,
    viewModel: EntryDetailViewModel,
) {
    val isPending = entry.statusEnum == EntryStatus.PENDING_REVIEW
    // Elapsed-so-far for an open timer, computed locally — durationMinutes
    // itself stays 0 in Firestore until the timer actually closes (see
    // TimerEntryCoordinator), so this is display/prefill only.
    val elapsedMinutes = ((Timestamp.now().seconds - entry.activityDate.seconds) / 60).toInt().coerceAtLeast(0)
    // Inline quick-edit (property/task/duration, without leaving this
    // screen) only makes sense for a not-yet-confirmed, not-currently-timing
    // entry — a confirmed entry keeps using the full Confirm-screen "Edit"
    // path below, and an open timer's duration isn't a real field yet.
    val canEditFieldsInline = isPending && !entry.inProgress

    if (!uiState.isEditingFields) {
        Text(entry.propertyName.ifBlank { "—" }, style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        StatusBadge(isPending)
        if (canEditFieldsInline && !uiState.isEditingFields) {
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = viewModel::startEditingFields, modifier = Modifier.size(28.dp)) {
                Icon(
                    Icons.Filled.EditNote,
                    contentDescription = stringResource(R.string.entry_detail_edit_fields_content_description),
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
    Spacer(Modifier.height(20.dp))

    if (uiState.isEditingFields) {
        InlineFieldEditor(uiState = uiState, viewModel = viewModel)
        Spacer(Modifier.height(20.dp))
    } else {
        DetailRow(stringResource(R.string.confirm_task_label)) { BulletAwareText(entry.task.ifBlank { "—" }) }
        DetailRow(
            stringResource(R.string.confirm_duration_label),
            if (entry.inProgress) "$elapsedMinutes min so far" else "${entry.durationMinutes} min",
        )
        if (canEditFieldsInline && entry.missingFields.isNotEmpty()) {
            MissingFieldsText(entry.missingFields)
        }
    }
    DetailRow(stringResource(R.string.confirm_role_label), entry.roleName.ifEmpty { stringResource(R.string.confirm_role_me) })
    DetailRow(stringResource(R.string.confirm_category_label), entry.categoryEnum.name.lowercase().replace('_', ' '))
    DetailRow(stringResource(R.string.entry_detail_activity_date_label), dateFormatter.format(entry.activityDate.toDate()))
    DetailRow(stringResource(R.string.entry_detail_logged_date_label), dateFormatter.format(entry.loggedAt.toDate()))
    entry.confirmedAt?.let {
        DetailRow(stringResource(R.string.entry_detail_confirmed_date_label), dateFormatter.format(it.toDate()))
    }
    if (entry.photoUrls.isNotEmpty()) {
        DetailRow(
            stringResource(R.string.entry_detail_photos_label),
            stringResource(R.string.entry_detail_photos_count, entry.photoUrls.size),
        )
    }
    AttachmentsSection(uiState = uiState, viewModel = viewModel)
    if (entry.audioUrl.isNotBlank()) {
        DetailRow(stringResource(R.string.entry_detail_audio_label)) {
            AudioPlayerRow(entry.audioUrl, entry.rawTranscript)
        }
    }

    if (entry.riskFlags.hasWarning) {
        Spacer(Modifier.height(8.dp))
        entry.riskFlags.reasons.forEach { reason ->
            Text(reason, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.error)
        }
    }

    if (entry.inProgress) {
        Spacer(Modifier.height(24.dp))
        Button(
            // Manual fallback for when voice-based "finished" detection
            // misses — prefills Confirm's duration with elapsed-so-far
            // (editable), same nav path as completing any other pending
            // entry (see ContempoNavHost's onEditEntry).
            onClick = { onEditEntry(entry.copy(durationMinutes = elapsedMinutes)) },
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.small,
        ) {
            Text(stringResource(R.string.entry_detail_stop_timer_button))
        }
    } else if (isPending) {
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = { onEditEntry(entry) },
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.small,
        ) {
            Text(stringResource(R.string.entry_detail_complete_button))
        }
    } else {
        // Already confirmed — the one status with no action today. Reuses
        // the exact same Confirm-screen edit path as the pending/in-progress
        // buttons above (entryId set → ConfirmViewModel.save() updates this
        // same document instead of creating a new one).
        Spacer(Modifier.height(24.dp))
        OutlinedButton(
            onClick = { onEditEntry(entry) },
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.small,
        ) {
            Text(stringResource(R.string.entry_detail_edit_button))
        }
    }
}

/**
 * Quick partial edit of property/task/duration directly on this screen — no
 * navigation to Confirm, no validation, saved via
 * [EntryDetailViewModel.saveFields]. A still-blank field just leaves the
 * entry's (computed) missingFields non-empty; finishing the entry for real
 * stays a separate, explicit action via the "Complete this entry" button.
 */
@Composable
private fun InlineFieldEditor(uiState: EntryDetailUiState, viewModel: EntryDetailViewModel) {
    Column {
        OutlinedTextField(
            value = uiState.editProperty,
            onValueChange = viewModel::onEditPropertyChanged,
            label = { Text(stringResource(R.string.confirm_property_label)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = uiState.editTask,
            onValueChange = viewModel::onEditTaskChanged,
            label = { Text(stringResource(R.string.confirm_task_label)) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = uiState.editDurationMinutes,
            onValueChange = viewModel::onEditDurationChanged,
            label = { Text(stringResource(R.string.confirm_duration_label)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        uiState.fieldSaveError?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = viewModel::saveFields,
                enabled = !uiState.isSavingFields,
                shape = MaterialTheme.shapes.small,
            ) {
                if (uiState.isSavingFields) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    Text(stringResource(R.string.entry_detail_save_fields_button))
                }
            }
            OutlinedButton(
                onClick = viewModel::cancelEditingFields,
                enabled = !uiState.isSavingFields,
                shape = MaterialTheme.shapes.small,
            ) {
                Text(stringResource(R.string.entry_detail_cancel_edit_fields_button))
            }
        }
    }
}

@Composable
private fun MissingFieldsText(missingFields: List<String>) {
    val propertyLabel = stringResource(R.string.entry_detail_missing_field_property)
    val taskLabel = stringResource(R.string.entry_detail_missing_field_task)
    val durationLabel = stringResource(R.string.entry_detail_missing_field_duration)
    val labels = missingFields.joinToString(", ") { field ->
        when (field) {
            EntryFieldValidation.FIELD_PROPERTY -> propertyLabel
            EntryFieldValidation.FIELD_TASK -> taskLabel
            else -> durationLabel
        }
    }
    Spacer(Modifier.height(8.dp))
    Text(
        stringResource(R.string.entry_detail_missing_fields_label, labels),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.error,
    )
}

@Composable
private fun StatusBadge(isPending: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = stringResource(
                if (isPending) R.string.entry_detail_status_pending else R.string.entry_detail_status_confirmed
            ),
            style = MaterialTheme.typography.labelSmall,
            color = if (isPending) {
                MaterialTheme.colorScheme.onTertiaryContainer
            } else {
                MaterialTheme.colorScheme.onPrimaryContainer
            },
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(
                    if (isPending) {
                        MaterialTheme.colorScheme.tertiaryContainer
                    } else {
                        MaterialTheme.colorScheme.primaryContainer
                    }
                )
                .padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

private enum class AudioPlaybackState { IDLE, LOADING, PLAYING, PAUSED, ERROR }

/**
 * Plain android.media.MediaPlayer, not Media3/ExoPlayer — nothing else in
 * this app plays audio, and a single play/pause button on a remote HTTPS URL
 * (Entry.audioUrl, a Firebase Storage download URL) doesn't need a whole
 * player framework. One MediaPlayer instance lives for exactly as long as
 * this composable does (released in onDispose), matching how briefly a host
 * is likely to sit on an entry's detail screen.
 */
@Composable
private fun AudioPlayerRow(audioUrl: String, rawTranscript: String) {
    var playbackState by remember { mutableStateOf(AudioPlaybackState.IDLE) }
    var showTranscript by remember { mutableStateOf(false) }
    val mediaPlayer = remember { MediaPlayer() }

    DisposableEffect(audioUrl) {
        onDispose { mediaPlayer.release() }
    }

    fun play() {
        when (playbackState) {
            AudioPlaybackState.PAUSED -> {
                mediaPlayer.start()
                playbackState = AudioPlaybackState.PLAYING
            }
            AudioPlaybackState.IDLE, AudioPlaybackState.ERROR -> {
                playbackState = AudioPlaybackState.LOADING
                runCatching {
                    mediaPlayer.reset()
                    mediaPlayer.setDataSource(audioUrl)
                    mediaPlayer.setOnPreparedListener {
                        it.start()
                        playbackState = AudioPlaybackState.PLAYING
                    }
                    mediaPlayer.setOnCompletionListener { playbackState = AudioPlaybackState.IDLE }
                    mediaPlayer.setOnErrorListener { _, _, _ -> playbackState = AudioPlaybackState.ERROR; true }
                    mediaPlayer.prepareAsync()
                }.onFailure { playbackState = AudioPlaybackState.ERROR }
            }
            AudioPlaybackState.LOADING, AudioPlaybackState.PLAYING -> Unit
        }
    }

    fun pause() {
        if (playbackState == AudioPlaybackState.PLAYING) {
            mediaPlayer.pause()
            playbackState = AudioPlaybackState.PAUSED
        }
    }

    Column {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { if (playbackState == AudioPlaybackState.PLAYING) pause() else play() },
                enabled = playbackState != AudioPlaybackState.LOADING,
            ) {
                when (playbackState) {
                    AudioPlaybackState.LOADING -> CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    AudioPlaybackState.PLAYING -> Icon(
                        Icons.Filled.Pause,
                        contentDescription = stringResource(R.string.entry_detail_audio_pause_content_description),
                    )
                    else -> Icon(
                        Icons.Filled.PlayArrow,
                        contentDescription = stringResource(R.string.entry_detail_audio_play_content_description),
                    )
                }
            }
            Spacer(Modifier.width(4.dp))
            val statusText = when (playbackState) {
                AudioPlaybackState.LOADING -> stringResource(R.string.entry_detail_audio_loading)
                AudioPlaybackState.PLAYING -> stringResource(R.string.entry_detail_audio_playing)
                AudioPlaybackState.PAUSED -> stringResource(R.string.entry_detail_audio_paused)
                AudioPlaybackState.ERROR -> stringResource(R.string.entry_detail_audio_error)
                AudioPlaybackState.IDLE -> stringResource(R.string.entry_detail_audio_recording)
            }
            Text(
                statusText,
                style = MaterialTheme.typography.bodyMedium,
                color = if (playbackState == AudioPlaybackState.ERROR) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
                modifier = Modifier.weight(1f),
            )
            // Only entries voice-captured via the watch have this (see
            // AudioCaptureProcessor) — a phone-recorded entry's audioUrl
            // (if that path ever uploads its own audio) would show the
            // player above with no transcript button, which is correct:
            // there's genuinely nothing to show.
            if (rawTranscript.isNotBlank()) {
                IconButton(onClick = { showTranscript = !showTranscript }) {
                    Icon(
                        Icons.AutoMirrored.Filled.Article,
                        contentDescription = stringResource(
                            if (showTranscript) {
                                R.string.entry_detail_transcript_hide_content_description
                            } else {
                                R.string.entry_detail_transcript_show_content_description
                            }
                        ),
                    )
                }
            }
        }
        if (showTranscript && rawTranscript.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.entry_detail_transcript_label),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                rawTranscript,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                    .padding(12.dp),
            )
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    DetailRow(label) { Text(value, style = MaterialTheme.typography.bodyLarge) }
}

@Composable
private fun DetailRow(label: String, content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(2.dp))
        content()
    }
}

/**
 * Generic-attachment section — parallel to, and independent from, the
 * entry.photoUrls DetailRow above (bare image-URL array, uploaded via
 * EntryRepository.attachPhoto). This covers arbitrary file types recorded in
 * the users/{uid}/entries/{entryId}/attachments subcollection.
 */
@Composable
private fun AttachmentsSection(uiState: EntryDetailUiState, viewModel: EntryDetailViewModel) {
    val context = LocalContext.current
    var previewTarget by remember { mutableStateOf<Pair<Attachment, File>?>(null) }
    var noteEditingTarget by remember { mutableStateOf<Attachment?>(null) }
    // At most one attachment downloads at a time from this screen — good
    // enough for audit-evidence file counts, and keeps the progress-UI state
    // simple (one id, one float) rather than a map.
    var downloadingId by remember { mutableStateOf<String?>(null) }
    var downloadProgress by remember { mutableStateOf(0f) }

    val pickerLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris -> uris.forEach { uri -> viewModel.addAttachment(context, uri) } }

    Spacer(Modifier.height(8.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            stringResource(R.string.entry_detail_attachments_label),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        IconButton(onClick = { pickerLauncher.launch(arrayOf("*/*")) }) {
            Icon(
                Icons.Filled.Add,
                contentDescription = stringResource(R.string.entry_detail_attachments_add_content_description),
            )
        }
    }

    uiState.uploadingItems.forEach { item ->
        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
            Text(item.fileName, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(4.dp))
            LinearProgressIndicator(progress = { item.progress }, modifier = Modifier.fillMaxWidth())
        }
    }

    uiState.attachments.forEach { attachment ->
        AttachmentRow(
            attachment = attachment,
            isDownloading = downloadingId == attachment.id,
            downloadProgress = downloadProgress,
            onClick = {
                if (downloadingId != null) return@AttachmentRow
                downloadingId = attachment.id
                downloadProgress = 0f
                viewModel.downloadForPreview(
                    destinationDir = File(context.cacheDir, "attachments"),
                    attachment = attachment,
                    onProgress = { progress -> downloadProgress = progress },
                    onResult = { result ->
                        downloadingId = null
                        result.onSuccess { file ->
                            val isInAppViewable = attachment.contentType.startsWith("image/") ||
                                attachment.contentType.startsWith("video/") ||
                                attachment.contentType == "application/pdf"
                            if (isInAppViewable) {
                                previewTarget = attachment to file
                            } else {
                                // Uncommon types: no in-app renderer, so
                                // "open" here just means hand it straight to
                                // whatever external viewer/share target the
                                // system offers.
                                openFileExternally(context, file, attachment.contentType)
                            }
                        }
                    },
                )
            },
            onDelete = { viewModel.deleteAttachment(attachment) },
            onEditNote = { noteEditingTarget = attachment },
        )
    }

    previewTarget?.let { (attachment, file) ->
        AttachmentPreviewDialog(attachment = attachment, file = file, onDismiss = { previewTarget = null })
    }

    noteEditingTarget?.let { attachment ->
        AttachmentNoteDialog(
            attachment = attachment,
            onDismiss = { noteEditingTarget = null },
            onSave = { note ->
                viewModel.updateAttachmentNote(attachment, note)
                noteEditingTarget = null
            },
        )
    }

    uiState.attachmentError?.let { error ->
        AlertDialog(
            onDismissRequest = { viewModel.dismissAttachmentError() },
            title = { Text(stringResource(R.string.entry_detail_attachment_error_dialog_title)) },
            text = { Text(error) },
            confirmButton = {
                TextButton(onClick = { viewModel.dismissAttachmentError() }) {
                    Text(stringResource(R.string.entry_detail_attachment_error_dialog_dismiss))
                }
            },
        )
    }
}

@Composable
private fun AttachmentRow(
    attachment: Attachment,
    isDownloading: Boolean,
    downloadProgress: Float,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onEditNote: () -> Unit,
) {
    val context = LocalContext.current
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(enabled = !isDownloading, onClick = onClick),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(attachmentIcon(attachment.contentType), contentDescription = null)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(attachment.fileName, style = MaterialTheme.typography.bodyMedium)
                Text(
                    "${Formatter.formatShortFileSize(context, attachment.fileSize)} · " +
                        dateFormatter.format(attachment.uploadedAt.toDate()),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (attachment.note.isNotEmpty()) {
                    Text(
                        attachment.note,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                    )
                }
            }
            if (isDownloading) {
                CircularProgressIndicator(
                    progress = { downloadProgress },
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                )
                Spacer(Modifier.width(8.dp))
            }
            IconButton(onClick = onEditNote) {
                Icon(
                    Icons.Filled.EditNote,
                    contentDescription = stringResource(R.string.entry_detail_attachment_edit_note_content_description),
                )
            }
            IconButton(onClick = onDelete) {
                Icon(
                    Icons.Filled.Delete,
                    contentDescription = stringResource(R.string.entry_detail_attachment_delete_content_description),
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun AttachmentNoteDialog(attachment: Attachment, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var noteText by remember(attachment.id) { mutableStateOf(attachment.note) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.entry_detail_attachment_note_dialog_title)) },
        text = {
            Column {
                Text(
                    attachment.fileName,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    placeholder = { Text(stringResource(R.string.entry_detail_attachment_note_placeholder)) },
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(noteText.trim()) }) {
                Text(stringResource(R.string.entry_detail_attachment_note_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.entry_detail_attachment_note_cancel))
            }
        },
    )
}

private fun attachmentIcon(contentType: String) = when {
    contentType.startsWith("image/") -> Icons.Filled.Image
    contentType.startsWith("video/") -> Icons.Filled.Movie
    contentType == "application/pdf" -> Icons.Filled.PictureAsPdf
    else -> Icons.AutoMirrored.Filled.Article
}

/**
 * Full-screen preview for the three in-app-viewable attachment types
 * (image/video/PDF) — anything else never reaches this Dialog (see
 * AttachmentsSection's onClick, which opens externally instead). Shares the
 * same close+share top bar regardless of content type.
 */
@Composable
private fun AttachmentPreviewDialog(attachment: Attachment, file: File, onDismiss: () -> Unit) {
    val context = LocalContext.current
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onDismiss) {
                    Icon(
                        Icons.Filled.Close,
                        contentDescription = stringResource(R.string.entry_detail_attachment_preview_close_content_description),
                    )
                }
                Text(
                    attachment.fileName,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                )
                IconButton(onClick = { shareFile(context, file, attachment.contentType) }) {
                    Icon(
                        Icons.Filled.Share,
                        contentDescription = stringResource(R.string.entry_detail_attachment_preview_share_content_description),
                    )
                }
            }
            Box(modifier = Modifier.fillMaxSize()) {
                when {
                    attachment.contentType.startsWith("image/") -> AsyncImage(
                        model = file,
                        contentDescription = stringResource(R.string.entry_detail_attachment_image_content_description),
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize(),
                    )
                    attachment.contentType.startsWith("video/") -> VideoAttachmentPreview(file)
                    attachment.contentType == "application/pdf" -> PdfAttachmentPreview(file)
                }
            }
        }
    }
}

/**
 * ExoPlayer + PlayerView for video attachments — mirrors AudioPlayerRow's
 * lifecycle discipline above (one player instance per composition, released
 * in onDispose), just for video instead of a remote-URL audio track.
 */
@Composable
private fun VideoAttachmentPreview(file: File) {
    val context = LocalContext.current
    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
            prepare()
            playWhenReady = true
        }
    }
    DisposableEffect(file) {
        onDispose { exoPlayer.release() }
    }
    AndroidView(
        factory = { PlayerView(it).apply { player = exoPlayer } },
        modifier = Modifier.fillMaxSize(),
    )
}

/**
 * Renders every page of a PDF attachment to a Bitmap up front via
 * android.graphics.pdf.PdfRenderer and lays them out in a scrollable column
 * — these are audit-evidence documents (receipts, invoices), not expected to
 * be long enough to need page-by-page lazy rendering.
 */
@Composable
private fun PdfAttachmentPreview(file: File) {
    var pages by remember(file) { mutableStateOf<List<Bitmap>>(emptyList()) }

    LaunchedEffect(file) {
        val rendered = runCatching {
            ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
                PdfRenderer(descriptor).use { renderer ->
                    (0 until renderer.pageCount).map { index ->
                        renderer.openPage(index).use { page ->
                            Bitmap.createBitmap(page.width, page.height, Bitmap.Config.ARGB_8888).also { bitmap ->
                                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                            }
                        }
                    }
                }
            }
        }.getOrDefault(emptyList())
        pages = rendered
    }

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        items(pages) { pageBitmap ->
            Image(
                bitmap = pageBitmap.asImageBitmap(),
                contentDescription = null,
                modifier = Modifier.fillMaxWidth(),
                contentScale = ContentScale.FillWidth,
            )
        }
    }
}
