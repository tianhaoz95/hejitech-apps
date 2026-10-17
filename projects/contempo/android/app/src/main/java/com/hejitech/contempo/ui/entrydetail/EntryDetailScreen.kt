package com.hejitech.contempo.ui.entrydetail

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.location.Geocoder
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
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
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
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SmallFloatingActionButton
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
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.contempo.ui.capture.DictationButton
import com.hejitech.contempo.ui.components.ActivityDateTimeField
import com.hejitech.contempo.ui.export.openFileExternally
import com.hejitech.contempo.ui.export.shareFile
import com.hejitech.contempo.ui.theme.BulletAwareText
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.core.model.Attachment
import com.hejitech.core.model.CaptureLanguage
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.model.EntryFieldValidation
import com.hejitech.core.model.EntryStatus
import com.hejitech.core.model.Timestamp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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

    Scaffold(
        // Was a full-width Button/OutlinedButton pinned inline at the end of
        // the scrollable content — took up a full row's worth of horizontal
        // space and required scrolling past everything else to reach. A
        // small FAB instead stays fixed in the corner regardless of scroll
        // position and takes up far less room (see EntryDetailFab below).
        floatingActionButton = {
            uiState.entry?.let { entry -> EntryDetailFab(entry = entry, onEditEntry = onEditEntry) }
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
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
                else -> EntryDetailContent(entry, uiState, viewModel)
            }
            // Room for the FAB so it never overlaps the last field/section.
            Spacer(Modifier.height(72.dp))
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
        DetailRow(stringResource(R.string.entry_detail_activity_date_label), dateFormatter.format(entry.activityDate.toDate()))
        if (canEditFieldsInline && entry.missingFields.isNotEmpty()) {
            MissingFieldsText(entry.missingFields)
        }
    }
    DetailRow(stringResource(R.string.confirm_role_label), entry.roleName.ifEmpty { stringResource(R.string.confirm_role_me) })
    DetailRow(stringResource(R.string.confirm_category_label), EntryCategory.displayName(entry.category))
    DetailRow(stringResource(R.string.entry_detail_logged_date_label), dateFormatter.format(entry.loggedAt.toDate()))
    entry.confirmedAt?.let {
        DetailRow(stringResource(R.string.entry_detail_confirmed_date_label), dateFormatter.format(it.toDate()))
    }
    EntryLocationMap(entry)
    val captureLat = entry.captureLat
    val captureLng = entry.captureLng
    if (captureLat != null && captureLng != null) {
        DetailRow(stringResource(R.string.entry_detail_location_label)) {
            LocationText(captureLat, captureLng)
        }
    }
    val stopLat = entry.stopLat
    val stopLng = entry.stopLng
    if (stopLat != null && stopLng != null && (stopLat != captureLat || stopLng != captureLng)) {
        DetailRow(stringResource(R.string.entry_detail_stop_location_label)) {
            LocationText(stopLat, stopLng)
        }
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

}

/**
 * The "Stop timer" / "Complete" / "Edit" action, now a small floating action
 * button (see EntryDetailScreen's Scaffold) instead of a full-width Button
 * pinned inline at the end of the scrollable content — same three nav
 * targets and same [onEditEntry] contract as before, just relocated and
 * icon-only to reclaim the screen space a full-width button/text label used
 * to take.
 */
@Composable
private fun EntryDetailFab(entry: Entry, onEditEntry: (Entry) -> Unit) {
    val isPending = entry.statusEnum == EntryStatus.PENDING_REVIEW
    // Elapsed-so-far for an open timer — see EntryDetailContent's identical
    // calculation for why this is display/prefill only, not a real field.
    val elapsedMinutes = ((Timestamp.now().seconds - entry.activityDate.seconds) / 60).toInt().coerceAtLeast(0)

    when {
        entry.inProgress -> {
            // Manual fallback for when voice-based "finished" detection
            // misses — prefills Confirm's duration with elapsed-so-far
            // (editable), same nav path as completing any other pending
            // entry (see ContempoNavHost's onEditEntry).
            SmallFloatingActionButton(onClick = { onEditEntry(entry.copy(durationMinutes = elapsedMinutes)) }) {
                Icon(Icons.Filled.Check, contentDescription = stringResource(R.string.entry_detail_stop_timer_button))
            }
        }
        isPending -> {
            SmallFloatingActionButton(onClick = { onEditEntry(entry) }) {
                Icon(Icons.Filled.Check, contentDescription = stringResource(R.string.entry_detail_complete_button))
            }
        }
        else -> {
            // Already confirmed — the one status with no action today.
            // Reuses the exact same Confirm-screen edit path as the
            // pending/in-progress cases above (entryId set →
            // ConfirmViewModel.save() updates this same document instead of
            // creating a new one).
            SmallFloatingActionButton(onClick = { onEditEntry(entry) }) {
                Icon(Icons.Filled.Edit, contentDescription = stringResource(R.string.entry_detail_edit_button))
            }
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
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InlineFieldEditor(uiState: EntryDetailUiState, viewModel: EntryDetailViewModel) {
    var categoryMenuExpanded by remember { mutableStateOf(false) }
    // Same app-level preference Capture's typing hero reads — see
    // DictationButton's kdoc for why property/task get a dictate shortcut
    // here too, not just on Capture.
    val captureLanguage by ServiceLocator.captureLanguageStore.selected.collectAsState()

    Column {
        OutlinedTextField(
            value = uiState.editProperty,
            onValueChange = viewModel::onEditPropertyChanged,
            label = { Text(stringResource(R.string.confirm_property_label)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            trailingIcon = {
                DictationButton(
                    currentText = uiState.editProperty,
                    onTextChanged = viewModel::onEditPropertyChanged,
                    language = captureLanguage,
                )
            },
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = uiState.editTask,
            onValueChange = viewModel::onEditTaskChanged,
            label = { Text(stringResource(R.string.confirm_task_label)) },
            modifier = Modifier.fillMaxWidth(),
            trailingIcon = {
                DictationButton(
                    currentText = uiState.editTask,
                    onTextChanged = viewModel::onEditTaskChanged,
                    language = captureLanguage,
                )
            },
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = uiState.editDurationMinutes,
            onValueChange = viewModel::onEditDurationChanged,
            label = { Text(stringResource(R.string.confirm_duration_label)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
        )
        Spacer(Modifier.height(12.dp))
        ActivityDateTimeField(millis = uiState.editActivityDateMillis, onChanged = viewModel::onEditActivityDateTimeChanged)
        Spacer(Modifier.height(12.dp))

        // Category dropdown + on-device auto-detect button side by side — the
        // button is a correctable suggestion, not a silent commit: it just
        // fills the dropdown, which stays fully editable afterward (see
        // EntryDetailViewModel.detectCategory's kdoc). "Add new category"
        // swaps this whole row for an inline text field — see
        // ConfirmScreen.kt's identical block for the reference pattern.
        if (uiState.isAddingNewCategory) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = uiState.newCategoryName,
                    onValueChange = viewModel::onNewCategoryNameChanged,
                    label = { Text(stringResource(R.string.confirm_new_category_label)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                )
                TextButton(onClick = viewModel::onConfirmNewCategory) {
                    Text(stringResource(R.string.confirm_add_category_button))
                }
                TextButton(onClick = viewModel::onCancelAddNewCategory) {
                    Text(stringResource(R.string.confirm_cancel_button))
                }
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ExposedDropdownMenuBox(
                    expanded = categoryMenuExpanded,
                    onExpandedChange = { categoryMenuExpanded = it },
                    modifier = Modifier.weight(1f),
                ) {
                    OutlinedTextField(
                        value = EntryCategory.displayName(uiState.editCategory),
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.confirm_category_label)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryMenuExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                    )
                    ExposedDropdownMenu(
                        expanded = categoryMenuExpanded,
                        onDismissRequest = { categoryMenuExpanded = false },
                    ) {
                        EntryCategory.entries.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option.name.lowercase().replace('_', ' ')) },
                                onClick = {
                                    viewModel.onEditCategoryChanged(option.firestoreValue)
                                    categoryMenuExpanded = false
                                },
                            )
                        }
                        uiState.categories.forEach { category ->
                            DropdownMenuItem(
                                text = { Text(category.name) },
                                onClick = {
                                    viewModel.onEditCategoryChanged(category.name)
                                    categoryMenuExpanded = false
                                },
                            )
                        }
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.confirm_add_new_category_item)) },
                            leadingIcon = { Icon(Icons.Filled.Add, contentDescription = null) },
                            onClick = {
                                categoryMenuExpanded = false
                                viewModel.onAddNewCategoryClicked()
                            },
                        )
                    }
                }
                if (uiState.isDetectingCategory) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                } else {
                    IconButton(onClick = viewModel::detectCategory) {
                        Icon(
                            Icons.Filled.AutoAwesome,
                            contentDescription = stringResource(R.string.entry_detail_detect_category_content_description),
                        )
                    }
                }
            }
            uiState.categoryDetectError?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }

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

/**
 * Reverse-geocodes a captured lat/lng into a short "City, State"-style
 * string — raw coordinates don't actually help a host remember where a
 * work session happened, which is the entire point of capturing location
 * in the first place (see CaptureViewModel.captureLocation). Falls back to
 * the raw coordinates if geocoding fails (no network, no geocoder service
 * on this device, etc.) rather than hiding the data entirely.
 */
@Composable
private fun LocationText(lat: Double, lng: Double) {
    val context = LocalContext.current
    var address by remember(lat, lng) { mutableStateOf<String?>(null) }
    var geocodeFailed by remember(lat, lng) { mutableStateOf(false) }
    LaunchedEffect(lat, lng) {
        val result = withContext(Dispatchers.IO) { reverseGeocode(context, lat, lng) }
        if (result != null) address = result else geocodeFailed = true
    }
    when {
        address != null -> Text(address!!, style = MaterialTheme.typography.bodyLarge)
        geocodeFailed -> Text(
            String.format(Locale.getDefault(), "%.4f, %.4f", lat, lng),
            style = MaterialTheme.typography.bodyLarge,
        )
        else -> Text(
            stringResource(R.string.entry_detail_location_loading),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Suppress("DEPRECATION") // The synchronous overload is still the simplest cross-version option at minSdk 26; the API 33+ async callback overload isn't worth the extra branching for a best-effort display string.
private fun reverseGeocode(context: Context, lat: Double, lng: Double): String? = try {
    Geocoder(context, Locale.getDefault()).getFromLocation(lat, lng, 1)
        ?.firstOrNull()
        ?.let { address -> listOfNotNull(address.locality, address.adminArea).joinToString(", ").ifBlank { null } }
} catch (e: Exception) {
    null
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
    val captureLanguage by ServiceLocator.captureLanguageStore.selected.collectAsState()
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
                    trailingIcon = {
                        DictationButton(
                            currentText = noteText,
                            onTextChanged = { noteText = it },
                            language = captureLanguage,
                        )
                    },
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
