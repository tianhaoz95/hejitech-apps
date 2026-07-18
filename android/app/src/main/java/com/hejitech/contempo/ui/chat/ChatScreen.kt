package com.hejitech.contempo.ui.chat

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.agent.AiAvailability
import com.hejitech.contempo.agent.ChatMessage
import com.hejitech.contempo.agent.ChatRole
import com.hejitech.contempo.ui.aiAvailabilityMessage
import com.hejitech.contempo.ui.rememberCameraCapture
import com.hejitech.contempo.ui.theme.Eyebrow

@Composable
fun ChatScreen(viewModel: ChatViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()

    LaunchedEffect(uiState.messages.size) {
        if (uiState.messages.isNotEmpty()) listState.animateScrollToItem(uiState.messages.size - 1)
    }

    val cameraCapture = rememberCameraCapture { bitmap, _ -> viewModel.attachImage(bitmap) }

    var pendingRecordAfterPermission by remember { mutableStateOf(false) }
    var micPermissionDenied by remember { mutableStateOf(false) }
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

    Column(modifier = Modifier.fillMaxSize().imePadding().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Eyebrow(stringResource(R.string.chat_eyebrow), modifier = Modifier.padding(start = 8.dp))
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
        Spacer(Modifier.height(4.dp))
        if (uiState.messages.isEmpty()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                Text(
                    stringResource(R.string.chat_empty_hint),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            LazyColumn(modifier = Modifier.weight(1f), state = listState, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(uiState.messages) { message -> ChatBubble(message) }
                if (uiState.isSending) {
                    item { CircularProgressIndicator(modifier = Modifier.padding(8.dp), strokeWidth = 2.dp) }
                }
            }
        }

        uiState.errorMessage?.let { error ->
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(4.dp))
        }

        aiAvailabilityMessage(uiState.aiAvailability)?.let { message ->
            Text(message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
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

        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            if (uiState.isRecording) {
                // Recording is already underway — skip the menu and show the
                // stop affordance directly, same as before this collapsed
                // into a "+" (a menu tap-through would just add friction to
                // ending a recording that's already running).
                IconButton(onClick = ::onMicTap, enabled = !uiState.isTranscribing) {
                    Icon(
                        Icons.Filled.Mic,
                        contentDescription = stringResource(R.string.capture_voice_stop),
                        tint = MaterialTheme.colorScheme.error,
                    )
                }
            } else {
                var attachMenuExpanded by remember { mutableStateOf(false) }
                Box {
                    IconButton(onClick = { attachMenuExpanded = true }, enabled = !uiState.isTranscribing) {
                        Icon(
                            Icons.Filled.Add,
                            contentDescription = stringResource(R.string.chat_attach_button),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    DropdownMenu(expanded = attachMenuExpanded, onDismissRequest = { attachMenuExpanded = false }) {
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
                placeholder = { Text(stringResource(if (uiState.isRecording) R.string.capture_listening else R.string.chat_input_hint)) },
            )
            IconButton(
                onClick = viewModel::send,
                enabled = (uiState.inputText.isNotBlank() || uiState.pendingImage != null) &&
                    !uiState.isSending && !uiState.isRecording && !uiState.isTranscribing &&
                    uiState.aiAvailability is AiAvailability.Ready,
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = stringResource(R.string.capture_send_button))
            }
        }
    }

    if (showClearHistoryDialog) {
        ClearHistoryDialog(
            onDismiss = { showClearHistoryDialog = false },
            onConfirm = { showClearHistoryDialog = false; viewModel.clearHistory() },
        )
    }
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

@Composable
private fun ChatBubble(message: ChatMessage) {
    val isUser = message.role == ChatRole.USER
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start) {
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
                Text(message.text, style = MaterialTheme.typography.bodyLarge)
            }
        }
    }
}
