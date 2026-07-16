package com.hejitech.contempo.ui.chat

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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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

    // .imePadding() needs android:windowSoftInputMode="adjustResize" (see
    // AndroidManifest.xml) to receive correct, live WindowInsets.ime values.
    // Scaffold's own default contentWindowInsets does NOT include ime
    // (confirmed via decompiling the real Material3 AAR — it's
    // systemBarsForVisualComponents, not safeDrawing), so this screen-level
    // modifier is the one thing actually reserving keyboard space here.
    Column(modifier = Modifier.fillMaxSize().imePadding().padding(16.dp)) {
        Eyebrow(stringResource(R.string.chat_eyebrow), modifier = Modifier.padding(bottom = 12.dp, start = 8.dp))
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
            IconButton(onClick = cameraCapture::launch) {
                Icon(
                    Icons.Filled.PhotoCamera,
                    contentDescription = stringResource(R.string.chat_attach_photo_button),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            OutlinedTextField(
                value = uiState.inputText,
                onValueChange = viewModel::onInputChanged,
                modifier = Modifier.weight(1f),
                placeholder = { Text(stringResource(R.string.chat_input_hint)) },
            )
            IconButton(
                onClick = viewModel::send,
                enabled = (uiState.inputText.isNotBlank() || uiState.pendingImage != null) &&
                    !uiState.isSending && uiState.aiAvailability is AiAvailability.Ready,
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = stringResource(R.string.capture_send_button))
            }
        }
    }
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
