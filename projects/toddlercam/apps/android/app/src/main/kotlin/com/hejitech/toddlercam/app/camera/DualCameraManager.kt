package com.hejitech.toddlercam.app.camera

import android.content.ContentValues
import android.content.Context
import android.graphics.*
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.hejitech.toddlercam.core.CameraCaptureMode
import com.hejitech.toddlercam.core.CameraPosition
import com.hejitech.toddlercam.core.FaceEmojiType
import com.hejitech.toddlercam.core.ToddlerState
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.ByteArrayOutputStream
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

data class CapturedKeepsakePhoto(
    val uri: Uri?,
    val bitmap: Bitmap,
    val thumbnailBytes: ByteArray,
    val timestamp: Long = System.currentTimeMillis()
)

class DualCameraManager(private val context: Context) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    private val _state = MutableStateFlow(ToddlerState())
    val state: StateFlow<ToddlerState> = _state.asStateFlow()

    private val _latestPhoto = MutableStateFlow<CapturedKeepsakePhoto?>(null)
    val latestPhoto: StateFlow<CapturedKeepsakePhoto?> = _latestPhoto.asStateFlow()

    private val _isFlashActive = MutableStateFlow(false)
    val isFlashActive: StateFlow<Boolean> = _isFlashActive.asStateFlow()

    private var cameraProvider: ProcessCameraProvider? = null
    private var imageCapture: ImageCapture? = null

    var isDemoMode: Boolean = false
        private set

    // The PreviewView is usually created before ProcessCameraProvider is ready; remember it and
    // bind once the provider arrives (otherwise the preview stayed black until a camera swap).
    private var pendingBind: Pair<LifecycleOwner, androidx.camera.view.PreviewView>? = null

    init {
        initCameraProvider()
    }

    private fun initCameraProvider() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()
                val hasBack = cameraProvider?.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA) == true
                val hasFront = cameraProvider?.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA) == true
                isDemoMode = !(hasBack || hasFront)
            } catch (_: Exception) {
                isDemoMode = true
            }
            pendingBind?.let { (owner, view) ->
                pendingBind = null
                bindCamera(owner, view)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    fun bindCamera(lifecycleOwner: LifecycleOwner, previewView: androidx.camera.view.PreviewView) {
        val provider = cameraProvider ?: run {
            pendingBind = lifecycleOwner to previewView
            return
        }
        if (isDemoMode) return

        try {
            provider.unbindAll()

            val selector = if (_state.value.primaryPosition == CameraPosition.FRONT.rawValue) {
                if (provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
            } else {
                if (provider.hasCamera(CameraSelector.DEFAULT_BACK_CAMERA)) CameraSelector.DEFAULT_BACK_CAMERA else CameraSelector.DEFAULT_FRONT_CAMERA
            }

            val preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            provider.bindToLifecycle(lifecycleOwner, selector, preview, imageCapture)
        } catch (_: Exception) {
            isDemoMode = true
        }
    }

    fun swapCameras(lifecycleOwner: LifecycleOwner? = null, previewView: androidx.camera.view.PreviewView? = null) {
        val current = _state.value.primaryPosition
        val next = if (current == CameraPosition.BACK.rawValue) CameraPosition.FRONT.rawValue else CameraPosition.BACK.rawValue
        _state.value = _state.value.copy(primaryPosition = next, timestamp = System.currentTimeMillis())

        if (lifecycleOwner != null && previewView != null) {
            bindCamera(lifecycleOwner, previewView)
        }
    }

    fun toggleToddlerLock(): Boolean {
        val next = !_state.value.isToddlerLocked
        _state.value = _state.value.copy(isToddlerLocked = next, timestamp = System.currentTimeMillis())
        return next
    }

    fun setFaceEmoji(emoji: FaceEmojiType?) {
        _state.value = _state.value.copy(
            activeFaceEmoji = emoji?.rawValue ?: "none",
            timestamp = System.currentTimeMillis()
        )
    }

    fun toggleCaptureMode() {
        val next = if (_state.value.captureMode == CameraCaptureMode.PHOTO.rawValue) {
            CameraCaptureMode.VIDEO.rawValue
        } else {
            CameraCaptureMode.PHOTO.rawValue
        }
        _state.value = _state.value.copy(captureMode = next, timestamp = System.currentTimeMillis())
    }

    fun capturePhoto(onCaptured: (CapturedKeepsakePhoto) -> Unit) {
        // Trigger quick flash animation
        scope.launch {
            _isFlashActive.value = true
            delay(120)
            _isFlashActive.value = false
        }

        val capture = imageCapture
        if (capture != null && !isDemoMode) {
            capture.takePicture(
                cameraExecutor,
                object : ImageCapture.OnImageCapturedCallback() {
                    override fun onCaptureSuccess(image: ImageProxy) {
                        val rotation = image.imageInfo.rotationDegrees
                        val bitmap = imageProxyToBitmap(image, rotation)
                        image.close()

                        scope.launch(Dispatchers.Default) {
                            val keepsake = generateCompositePhoto(bitmap)
                            savePhotoToMediaStore(keepsake)
                            _latestPhoto.value = keepsake
                            _state.value = _state.value.copy(lastPhotoTimestamp = keepsake.timestamp)
                            withContext(Dispatchers.Main) {
                                onCaptured(keepsake)
                            }
                        }
                    }

                    override fun onError(exception: ImageCaptureException) {
                        generateFallbackPhoto(onCaptured)
                    }
                }
            )
        } else {
            generateFallbackPhoto(onCaptured)
        }
    }

    private fun generateFallbackPhoto(onCaptured: (CapturedKeepsakePhoto) -> Unit) {
        scope.launch(Dispatchers.Default) {
            val simulated = generateSimulatedSceneBitmap()
            val keepsake = generateCompositePhoto(simulated)
            savePhotoToMediaStore(keepsake)
            _latestPhoto.value = keepsake
            _state.value = _state.value.copy(lastPhotoTimestamp = keepsake.timestamp)
            withContext(Dispatchers.Main) {
                onCaptured(keepsake)
            }
        }
    }

    private fun imageProxyToBitmap(image: ImageProxy, rotationDegrees: Int): Bitmap {
        val buffer = image.planes[0].buffer
        val bytes = ByteArray(buffer.remaining())
        buffer.get(bytes)
        val original = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        if (rotationDegrees == 0) return original

        val matrix = Matrix()
        matrix.postRotate(rotationDegrees.toFloat())
        return Bitmap.createBitmap(original, 0, 0, original.width, original.height, matrix, true)
    }

    private fun generateSimulatedSceneBitmap(): Bitmap {
        val width = 1200
        val height = 1600
        val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)

        // Gradient background
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val shader = LinearGradient(
            0f, 0f, 0f, height.toFloat(),
            intArrayOf(0xFFFFE0B2.toInt(), 0xFFFFCC80.toInt(), 0xFFFFB74D.toInt()),
            null,
            Shader.TileMode.CLAMP
        )
        paint.shader = shader
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
        paint.shader = null

        // Cheerful toddler drawing / shapes
        paint.color = 0xFFFFFFFF.toInt()
        paint.textSize = 64f
        paint.typeface = Typeface.DEFAULT_BOLD
        paint.textAlign = Paint.Align.CENTER
        canvas.drawText("📸 ToddlerCam Keepsake", width / 2f, height / 2f - 40f, paint)

        paint.textSize = 36f
        paint.color = 0xFF424242.toInt()
        val dateStr = SimpleDateFormat("EEEE, MMM d, yyyy • h:mm a", Locale.getDefault()).format(Date())
        canvas.drawText(dateStr, width / 2f, height / 2f + 40f, paint)

        return bmp
    }

    private fun generateCompositePhoto(mainPhoto: Bitmap): CapturedKeepsakePhoto {
        val outWidth = 1200
        val outHeight = 1600
        val composite = Bitmap.createBitmap(outWidth, outHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(composite)

        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

        // 1. Draw main photo aspect-fill
        val srcRect = calculateAspectFillRect(mainPhoto.width, mainPhoto.height, outWidth, outHeight)
        canvas.drawBitmap(mainPhoto, srcRect, Rect(0, 0, outWidth, outHeight), paint)

        // 2. Picture-in-Picture window (top right)
        val pipWidth = outWidth * 0.32f
        val pipHeight = pipWidth * 1.33f
        val pipRect = RectF(outWidth - pipWidth - 36f, 50f, outWidth - 36f, 50f + pipHeight)

        // Draw PiP shadow & rounded background
        val shadowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0x55000000
            maskFilter = BlurMaskFilter(16f, BlurMaskFilter.Blur.NORMAL)
        }
        canvas.drawRoundRect(pipRect, 28f, 28f, shadowPaint)

        // Clip PiP
        canvas.save()
        val path = Path().apply { addRoundRect(pipRect, 28f, 28f, Path.Direction.CW) }
        canvas.clipPath(path)

        // Draw PiP selfie / opposing view
        val pipFillPaint = Paint().apply { color = 0xFF37474F.toInt() }
        canvas.drawRect(pipRect, pipFillPaint)

        // Draw PiP placeholder child icon
        val pipTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = 54f
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("👶", pipRect.centerX(), pipRect.centerY() + 18f, pipTextPaint)
        canvas.restore()

        // PiP golden border
        val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0xFFFFD54F.toInt()
            style = Paint.Style.STROKE
            strokeWidth = 8f
        }
        canvas.drawRoundRect(pipRect, 28f, 28f, borderPaint)

        // 3. Active Face Emoji Overlay
        val currentEmojiRaw = _state.value.activeFaceEmoji
        val emojiType = FaceEmojiType.fromRaw(currentEmojiRaw)
        if (emojiType != null) {
            val emojiPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                textSize = 140f
                textAlign = Paint.Align.CENTER
            }
            canvas.drawText(emojiType.emoji, outWidth / 2f, 240f, emojiPaint)
        }

        // 4. Cheerful Date watermark at bottom
        val watermarkBg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = 0x99000000.toInt()
        }
        val watermarkRect = RectF(36f, outHeight - 110f, outWidth - 36f, outHeight - 36f)
        canvas.drawRoundRect(watermarkRect, 24f, 24f, watermarkBg)

        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = 28f
            typeface = Typeface.DEFAULT_BOLD
            textAlign = Paint.Align.CENTER
        }
        val dateText = SimpleDateFormat("MMM d, yyyy • h:mm a", Locale.getDefault()).format(Date())
        canvas.drawText("📸 ToddlerCam  •  $dateText", outWidth / 2f, outHeight - 62f, textPaint)

        // Create compressed 200x260 thumbnail for Wear OS
        val thumbBmp = Bitmap.createScaledBitmap(composite, 200, 260, true)
        val thumbStream = ByteArrayOutputStream()
        thumbBmp.compress(Bitmap.CompressFormat.JPEG, 70, thumbStream)
        val thumbBytes = thumbStream.toByteArray()

        return CapturedKeepsakePhoto(
            uri = null,
            bitmap = composite,
            thumbnailBytes = thumbBytes,
            timestamp = System.currentTimeMillis()
        )
    }

    private fun calculateAspectFillRect(srcW: Int, srcH: Int, dstW: Int, dstH: Int): Rect {
        val srcRatio = srcW.toFloat() / srcH.toFloat()
        val dstRatio = dstW.toFloat() / dstH.toFloat()

        return if (srcRatio > dstRatio) {
            val newW = (srcH * dstRatio).toInt()
            val left = (srcW - newW) / 2
            Rect(left, 0, left + newW, srcH)
        } else {
            val newH = (srcW / dstRatio).toInt()
            val top = (srcH - newH) / 2
            Rect(0, top, srcW, top + newH)
        }
    }

    private fun savePhotoToMediaStore(photo: CapturedKeepsakePhoto): Uri? {
        val filename = "ToddlerCam_${System.currentTimeMillis()}.jpg"
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, filename)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ToddlerCam")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }

        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
        if (uri != null) {
            resolver.openOutputStream(uri)?.use { stream ->
                photo.bitmap.compress(Bitmap.CompressFormat.JPEG, 92, stream)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear()
                values.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            }
        }
        return uri
    }

    fun release() {
        cameraExecutor.shutdown()
        cameraProvider?.unbindAll()
    }
}
