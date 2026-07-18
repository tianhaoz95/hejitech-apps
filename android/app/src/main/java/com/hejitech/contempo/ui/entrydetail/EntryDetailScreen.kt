package com.hejitech.contempo.ui.entrydetail

import android.media.MediaPlayer
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.ui.theme.BulletAwareText
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import com.google.firebase.Timestamp
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
            else -> EntryDetailContent(entry, onEditEntry)
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
private fun EntryDetailContent(entry: Entry, onEditEntry: (Entry) -> Unit) {
    val isPending = entry.statusEnum == EntryStatus.PENDING_REVIEW
    // Elapsed-so-far for an open timer, computed locally — durationMinutes
    // itself stays 0 in Firestore until the timer actually closes (see
    // TimerEntryCoordinator), so this is display/prefill only.
    val elapsedMinutes = ((Timestamp.now().seconds - entry.activityDate.seconds) / 60).toInt().coerceAtLeast(0)

    Text(entry.propertyName.ifBlank { "—" }, style = MaterialTheme.typography.headlineMedium)
    Spacer(Modifier.height(8.dp))
    StatusBadge(isPending)
    Spacer(Modifier.height(20.dp))

    DetailRow(stringResource(R.string.confirm_task_label)) { BulletAwareText(entry.task.ifBlank { "—" }) }
    DetailRow(
        stringResource(R.string.confirm_duration_label),
        if (entry.inProgress) "$elapsedMinutes min so far" else "${entry.durationMinutes} min",
    )
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
    if (entry.audioUrl.isNotBlank()) {
        DetailRow(stringResource(R.string.entry_detail_audio_label)) {
            AudioPlayerRow(entry.audioUrl)
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
private fun AudioPlayerRow(audioUrl: String) {
    var playbackState by remember { mutableStateOf(AudioPlaybackState.IDLE) }
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

    Row(verticalAlignment = Alignment.CenterVertically) {
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
        )
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
