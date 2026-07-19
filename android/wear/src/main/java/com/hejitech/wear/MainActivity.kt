package com.hejitech.wear

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.wear.compose.material.MaterialTheme
import com.hejitech.wear.capture.WearCaptureScreen
import com.hejitech.wear.capture.WearCaptureViewModel
import com.hejitech.wear.capture.WearSignInScreen

/**
 * Real Wear OS capture (see reports/mvp-scope-v0.html Section 5.1's
 * fast-follow plan, now built): sign in -> tap the mic, tap again to stop ->
 * the recording is relayed to the paired phone over the Wear Data Layer,
 * which runs it through the exact same on-device Whisper + parse pipeline
 * the phone app itself uses (see net/PhoneAudioRelay.kt) -> saved straight
 * to `users/{uid}/entries`, confirmed outright when the parse came back
 * complete, pending_review (finish on the phone) otherwise.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { WearRootScreen() }
    }
}

// Deliberately not named "WearApp" — that name collides with the
// Application subclass in WearApp.kt in this same package, and a bare
// `WearApp()` call resolves to THAT class's constructor (a harmless no-op
// object construction, not a composable invocation) rather than this
// function, silently rendering nothing with no error anywhere. Reproduced
// live: renamed this and the screen appeared immediately.
@Composable
private fun WearRootScreen(viewModel: WearCaptureViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val amplitude by viewModel.recordingAmplitude.collectAsState()
    // rememberSaveable, not remember: on at least one real Wear OS system
    // image, the full-screen RECORD_AUDIO permission dialog was observed to
    // trigger a genuine Activity recreation (not just pause/resume — seen
    // live via instance-identity logging). A plain remember would silently
    // reset this to false across that recreation, so the permission-result
    // launcher's callback below would see pendingRecordAfterPermission =
    // false even though the user just granted it, and never call
    // startRecording() at all.
    var pendingRecordAfterPermission by rememberSaveable { mutableStateOf(false) }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted && pendingRecordAfterPermission) viewModel.startRecording()
        pendingRecordAfterPermission = false
    }

    fun onMicTap() {
        if (uiState.isRecording) {
            viewModel.stopRecordingAndSend()
        } else if (viewModel.hasRecordAudioPermission()) {
            viewModel.startRecording()
        } else {
            pendingRecordAfterPermission = true
            micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    MaterialTheme {
        if (!uiState.isSignedIn) {
            WearSignInScreen(
                isSigningIn = uiState.isSigningIn,
                errorMessage = uiState.errorMessage,
                onSignIn = viewModel::signIn,
            )
        } else {
            WearCaptureScreen(
                uiState = uiState,
                amplitude = amplitude,
                onMicTap = ::onMicTap,
                onUploadPendingNow = viewModel::uploadPendingNow,
                onDismissMessages = viewModel::dismissMessages,
            )
        }
    }
}
