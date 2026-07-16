package com.hejitech.contempo.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.hejitech.contempo.util.PhotoUtils
import java.io.File

/** State + trigger for camera capture — see [rememberCameraCapture]. */
class CameraCaptureState internal constructor(
    val permissionDenied: Boolean,
    private val onLaunch: () -> Unit,
) {
    fun launch() = onLaunch()
}

/**
 * Shared camera-capture flow (permission -> system camera -> downsampled
 * Bitmap) — used by both CaptureScreen (photo-drafted entries) and
 * ChatScreen (multimodal questions), which would otherwise each duplicate
 * this exact permission/launcher/FileProvider plumbing.
 *
 * [onPhotoTaken] receives the downsampled Bitmap (capped at [maxDimension]
 * on its longest side, matching what's actually fed to the on-device vision
 * model — no reason to hold a full-resolution copy in memory beyond that)
 * plus the original full-resolution file's content:// Uri, for callers that
 * want to keep/upload the original (CaptureScreen does, for photo
 * evidence).
 */
@Composable
fun rememberCameraCapture(
    maxDimension: Int = 1024,
    onPhotoTaken: (Bitmap, String) -> Unit,
): CameraCaptureState {
    val context = LocalContext.current
    var pendingAfterPermission by remember { mutableStateOf(false) }
    var permissionDenied by remember { mutableStateOf(false) }
    // rememberSaveable, not remember: TakePicture() only reports success/
    // failure, not the Uri — this is the only place that Uri is held, and
    // launching the system camera app commonly gets our process killed
    // under memory pressure while it's in the foreground. A plain remember
    // loses this across that process death, silently dropping the photo on
    // return (Uri survives via Bundle/SavedStateHandle since android.net.Uri
    // is Parcelable).
    var pendingPhotoFileUri by rememberSaveable { mutableStateOf<Uri?>(null) }

    val takePictureLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture(),
    ) { success ->
        val uri = pendingPhotoFileUri
        if (success && uri != null) {
            val bitmap = PhotoUtils.decodeSampledBitmap(context, uri, maxDimension)
            if (bitmap != null) onPhotoTaken(bitmap, uri.toString())
        }
        pendingPhotoFileUri = null
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        permissionDenied = !granted
        if (granted && pendingAfterPermission) {
            val uri = createPhotoUri(context)
            pendingPhotoFileUri = uri
            takePictureLauncher.launch(uri)
        }
        pendingAfterPermission = false
    }

    return CameraCaptureState(
        permissionDenied = permissionDenied,
        onLaunch = {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                val uri = createPhotoUri(context)
                pendingPhotoFileUri = uri
                takePictureLauncher.launch(uri)
            } else {
                pendingAfterPermission = true
                permissionLauncher.launch(Manifest.permission.CAMERA)
            }
        },
    )
}

/** Same FileProvider authority ExportScreen already uses for sharing CSVs. */
private fun createPhotoUri(context: Context): Uri {
    val file = File(context.cacheDir, "camera_capture_${System.currentTimeMillis()}.jpg")
    return FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}
