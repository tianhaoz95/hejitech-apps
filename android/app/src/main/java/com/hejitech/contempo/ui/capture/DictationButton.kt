package com.hejitech.contempo.ui.capture

import android.Manifest
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.hejitech.contempo.R
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.CaptureLanguage
import kotlinx.coroutines.launch

/**
 * A small, self-contained "dictate into this field" mic button — reused
 * anywhere plain typed text needs a voice shortcut ([TypedCaptureHero] here,
 * and EntryDetailScreen's property/task fields), distinct from the main
 * VoiceButton's full record -> transcribe -> LLM-parse-into-entry flow: this
 * only ever produces raw transcript text, appended into whatever's already
 * typed, and never touches CaptureViewModel's parse pipeline. Owns its own
 * recording lifecycle locally (via [ServiceLocator]'s shared
 * AudioRecorder/WhisperTranscriber singletons) rather than routing through a
 * ViewModel, since it needs to work identically from two unrelated
 * ViewModels (CaptureViewModel, EntryDetailViewModel) — see
 * CaptureViewModel.stopRecordingAndProcess for the equivalent record/
 * transcribe call sequence this mirrors, minus the parse step.
 */
@Composable
fun DictationButton(
    currentText: String,
    onTextChanged: (String) -> Unit,
    language: CaptureLanguage,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val audioRecorder = ServiceLocator.audioRecorder
    val whisperTranscriber = ServiceLocator.whisperTranscriber

    var isRecording by remember { mutableStateOf(false) }
    var isTranscribing by remember { mutableStateOf(false) }
    var pendingAfterPermission by remember { mutableStateOf(false) }

    val emptyTranscriptMessage = stringResource(R.string.dictation_empty_transcript)
    val permissionDeniedMessage = stringResource(R.string.dictation_permission_denied)

    fun beginRecording() {
        isRecording = true
        audioRecorder.start(scope)
    }

    fun finishRecording() {
        isRecording = false
        isTranscribing = true
        scope.launch {
            val samples = audioRecorder.stop()
            val transcript = runCatching { whisperTranscriber.transcribe(samples, language) }.getOrDefault("")
            isTranscribing = false
            if (transcript.isBlank()) {
                Toast.makeText(context, emptyTranscriptMessage, Toast.LENGTH_SHORT).show()
                return@launch
            }
            val separator = if (currentText.isEmpty() || currentText.last().isWhitespace()) "" else " "
            onTextChanged(currentText + separator + transcript)
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted && pendingAfterPermission) {
            beginRecording()
        } else if (!granted) {
            Toast.makeText(context, permissionDeniedMessage, Toast.LENGTH_SHORT).show()
        }
        pendingAfterPermission = false
    }

    IconButton(
        modifier = modifier,
        enabled = enabled && !isTranscribing,
        onClick = {
            when {
                isRecording -> finishRecording()
                audioRecorder.hasPermission() -> beginRecording()
                else -> {
                    pendingAfterPermission = true
                    permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
            }
        },
    ) {
        if (isTranscribing) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
        } else {
            Icon(
                Icons.Filled.Mic,
                contentDescription = stringResource(
                    if (isRecording) R.string.dictation_stop_content_description
                    else R.string.dictation_start_content_description,
                ),
                tint = if (isRecording) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
