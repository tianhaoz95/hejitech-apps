package com.hejitech.contempo.ui.feedback

import android.graphics.BitmapFactory
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.core.model.FeedbackRegion
import java.io.File
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

private enum class Corner { TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT, BOTTOM_RIGHT }

private sealed interface DragMode {
    data object Idle : DragMode
    data object Creating : DragMode
    data object Moving : DragMode
    data class Resizing(val corner: Corner) : DragMode
}

/**
 * Full-screen overlay shown after a shake capture — box-select (NOT
 * freehand drawing, per product requirement) an area of interest on the
 * screenshot, edit it (drag to move, drag a corner to resize), add a
 * description, submit. Rendered from MainActivity on top of the nav host
 * whenever PendingFeedbackCaptureStore is non-null.
 */
@Composable
fun FeedbackAnnotationScreen(
    imageFile: File,
    onDismiss: () -> Unit,
    viewModel: FeedbackViewModel = viewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val bitmap = remember(imageFile) {
        BitmapFactory.decodeFile(imageFile.absolutePath)?.asImageBitmap()
    }
    var description by remember { mutableStateOf("") }
    var containerSize by remember { mutableStateOf(Offset.Zero) }
    val imageSize = remember(bitmap) { bitmap?.let { Offset(it.width.toFloat(), it.height.toFloat()) } ?: Offset.Zero }

    // The single source of truth for the drawn box — normalized (0..1)
    // fractions of the *displayed image* (not the container), exactly the
    // shape submitted to Firestore (see FeedbackRegion / firestore.rules'
    // isValidFeedbackRegion). Storing it normalized, not in raw pixel
    // coordinates, is what lets the box survive the image resizing (e.g.
    // collapsing the input panel, see isInputExpanded below) without being
    // cleared or drifting out of place — it's simply re-denormalized
    // against whatever containerSize currently is.
    var boxNormalized by remember { mutableStateOf<FeedbackRegion?>(null) }
    var dragMode by remember { mutableStateOf<DragMode>(DragMode.Idle) }
    var boxAtDragStart by remember { mutableStateOf<FeedbackRegion?>(null) }
    var dragStartLocation by remember { mutableStateOf(Offset.Zero) }

    // The bottom controls' own height at rest (keyboard closed, expanded) —
    // captured once from its first measurement, which always happens before
    // the keyboard can possibly be open (this screen only ever appears right
    // after a shake capture, expanded by default). Reserving exactly this
    // much space below the image keeps the two from overlapping in the
    // normal case; only while the keyboard is actually open does the
    // controls section float up on top of the image (see the Box below),
    // which is unavoidable once the image itself isn't allowed to resize.
    var restingControlsHeightPx by remember { mutableStateOf(0f) }
    val density = LocalDensity.current
    val focusManager = LocalFocusManager.current
    // A generous touch target (Material recommends >=48dp) for grabbing a
    // resize handle — the handle itself is drawn much smaller (see the
    // Canvas below), this is just the hit-test radius around it.
    val handleHitRadiusPx = with(density) { 32.dp.toPx() }

    // Lets the user shrink the description/buttons panel down to a small
    // FAB to see the screenshot underneath it (see collapsedReserve below)
    // — a deliberate, discrete resize of the image area. The box (stored
    // normalized, see above) survives this resize correctly, so there's no
    // need to clear it.
    var isInputExpanded by remember { mutableStateOf(true) }
    val collapsedReserve = 88.dp
    fun toggleInputExpanded() {
        focusManager.clearFocus()
        isInputExpanded = !isInputExpanded
    }

    if (uiState.submitted) {
        onDismiss()
        return
    }

    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        // Header + image layer. Nothing in this subtree reacts to the
        // keyboard (imePadding lives only on the overlay below), so this
        // Box's measured size — and therefore the drawn box's position
        // relative to the image — never changes while this screen is up,
        // regardless of whether the keyboard is showing. It *does* resize
        // when isInputExpanded toggles (see collapsedReserve above) —
        // deliberately, so collapsing actually reveals more of the
        // screenshot rather than just hiding an empty area.
        Column(
            modifier = Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(
                    bottom = if (isInputExpanded) {
                        with(density) { restingControlsHeightPx.toDp() }
                    } else {
                        collapsedReserve
                    },
                ),
        ) {
            Text(
                stringResource(R.string.feedback_annotation_title),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(16.dp),
            )
            Text(
                stringResource(
                    if (boxNormalized == null) {
                        R.string.feedback_annotation_hint
                    } else {
                        R.string.feedback_annotation_hint_editing
                    },
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Spacer(Modifier.height(8.dp))

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .onSizeChanged { containerSize = Offset(it.width.toFloat(), it.height.toFloat()) }
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragStart = { offset ->
                                val currentBox = boxNormalized?.let { pixelRect(it, containerSize, imageSize) }
                                val handle = currentBox?.let { hitTestHandle(offset, it, handleHitRadiusPx) }
                                dragMode = when {
                                    handle != null -> DragMode.Resizing(handle)
                                    currentBox != null && grow(currentBox, handleHitRadiusPx).contains(offset) -> DragMode.Moving
                                    else -> DragMode.Creating
                                }
                                boxAtDragStart = boxNormalized
                                dragStartLocation = offset
                            },
                            onDrag = { change, _ ->
                                val position = change.position
                                when (val mode = dragMode) {
                                    is DragMode.Creating -> {
                                        val rect = Rect(
                                            left = min(dragStartLocation.x, position.x),
                                            top = min(dragStartLocation.y, position.y),
                                            right = max(dragStartLocation.x, position.x),
                                            bottom = max(dragStartLocation.y, position.y),
                                        )
                                        boxNormalized = normalize(rect, containerSize, imageSize)
                                    }
                                    is DragMode.Moving -> {
                                        val startBox = boxAtDragStart
                                        if (startBox != null) {
                                            val startPixel = pixelRect(startBox, containerSize, imageSize)
                                            val dx = position.x - dragStartLocation.x
                                            val dy = position.y - dragStartLocation.y
                                            val moved = Rect(
                                                startPixel.left + dx,
                                                startPixel.top + dy,
                                                startPixel.right + dx,
                                                startPixel.bottom + dy,
                                            )
                                            boxNormalized = normalize(
                                                clampRect(moved, displayRect(containerSize, imageSize)),
                                                containerSize,
                                                imageSize,
                                            )
                                        }
                                    }
                                    is DragMode.Resizing -> {
                                        val startBox = boxAtDragStart
                                        if (startBox != null) {
                                            val startPixel = pixelRect(startBox, containerSize, imageSize)
                                            val resized = resizedRect(startPixel, mode.corner, position)
                                            boxNormalized = normalize(
                                                clampRect(resized, displayRect(containerSize, imageSize)),
                                                containerSize,
                                                imageSize,
                                            )
                                        }
                                    }
                                    DragMode.Idle -> Unit
                                }
                            },
                            onDragEnd = {
                                dragMode = DragMode.Idle
                                boxAtDragStart = null
                            },
                        )
                    },
            ) {
                bitmap?.let {
                    Image(
                        bitmap = it,
                        contentDescription = null,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Fit,
                    )
                }
                val displayBox = boxNormalized?.let { pixelRect(it, containerSize, imageSize) }
                Canvas(modifier = Modifier.fillMaxSize()) {
                    if (displayBox != null) {
                        val left = displayBox.left
                        val top = displayBox.top
                        val right = displayBox.right
                        val bottom = displayBox.bottom
                        val scrim = Color.Black.copy(alpha = 0.5f)
                        // Four strips around the box rather than a punch-hole
                        // clear — correct without needing an offscreen
                        // compositing layer.
                        drawRect(color = scrim, topLeft = Offset(0f, 0f), size = Size(size.width, top))
                        drawRect(color = scrim, topLeft = Offset(0f, bottom), size = Size(size.width, size.height - bottom))
                        drawRect(color = scrim, topLeft = Offset(0f, top), size = Size(left, bottom - top))
                        drawRect(color = scrim, topLeft = Offset(right, top), size = Size(size.width - right, bottom - top))
                        drawRect(
                            color = Color.White,
                            topLeft = Offset(left, top),
                            size = Size(right - left, bottom - top),
                            style = Stroke(width = 3f),
                        )
                        // Corner handles — draggable to resize (see
                        // hitTestHandle above).
                        val handleRadiusPx = 10.dp.toPx()
                        for (corner in listOf(Offset(left, top), Offset(right, top), Offset(left, bottom), Offset(right, bottom))) {
                            drawCircle(color = Color.White, radius = handleRadiusPx, center = corner)
                            drawCircle(color = Color(0xFF1F5C46), radius = handleRadiusPx - 3f, center = corner)
                        }
                    }
                }
            }
        }

        // Description + buttons, overlaid on top of the image layer and
        // anchored to the bottom edge. imePadding here (and only here) is
        // what slides this section above the keyboard when the text field
        // is focused, independent of the image layer above — see the
        // comment on the outer Box. AnimatedContent (rather than a plain
        // if/else) scales+fades between the FAB and the panel anchored at
        // the bottom-end corner (TransformOrigin(1f, 1f), where the FAB
        // sits) and cross-fades their sizes, so the panel visibly grows
        // out of the FAB's corner on expand and shrinks back into it on
        // collapse, instead of the two just hard-swapping.
        AnimatedContent(
            targetState = isInputExpanded,
            modifier = Modifier.align(Alignment.BottomEnd),
            transitionSpec = {
                (scaleIn(transformOrigin = TransformOrigin(1f, 1f)) + fadeIn())
                    .togetherWith(scaleOut(transformOrigin = TransformOrigin(1f, 1f)) + fadeOut())
                    .using(SizeTransform(clip = false))
            },
            label = "feedback_input_expand_collapse",
        ) { expanded ->
            if (expanded) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.background)
                        .navigationBarsPadding()
                        .imePadding()
                        .padding(16.dp)
                        .onSizeChanged {
                            if (restingControlsHeightPx == 0f) restingControlsHeightPx = it.height.toFloat()
                        },
                ) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        IconButton(onClick = { toggleInputExpanded() }) {
                            Icon(
                                Icons.Filled.KeyboardArrowDown,
                                contentDescription = stringResource(R.string.feedback_minimize_input_content_description),
                            )
                        }
                    }
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text(stringResource(R.string.feedback_description_placeholder)) },
                        minLines = 3,
                    )
                    uiState.errorMessage?.let { error ->
                        Spacer(Modifier.height(8.dp))
                        Text(error, color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        OutlinedButton(onClick = { viewModel.cancel(); onDismiss() }, enabled = !uiState.isSubmitting) {
                            Text(stringResource(R.string.feedback_cancel_button))
                        }
                        Spacer(Modifier.width(12.dp))
                        Button(
                            onClick = { viewModel.submit(imageFile, boxNormalized, description) },
                            enabled = !uiState.isSubmitting,
                        ) {
                            if (uiState.isSubmitting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.padding(end = 8.dp).width(16.dp).height(16.dp),
                                    strokeWidth = 2.dp,
                                )
                            }
                            Text(stringResource(R.string.feedback_submit_button))
                        }
                    }
                }
            } else {
                FloatingActionButton(
                    onClick = { toggleInputExpanded() },
                    modifier = Modifier
                        .navigationBarsPadding()
                        .padding(16.dp)
                        .size(56.dp),
                ) {
                    Icon(
                        Icons.Filled.KeyboardArrowUp,
                        contentDescription = stringResource(R.string.feedback_expand_input_content_description),
                    )
                }
            }
        }
    }
}

/**
 * The displayed image's bounds within [containerSize] — ContentScale.Fit
 * letterboxes/pillarboxes whenever [containerSize]'s aspect ratio doesn't
 * exactly match [imageSize]'s, so this is almost never just the full
 * container.
 */
private fun displayRect(containerSize: Offset, imageSize: Offset): Rect {
    if (containerSize.x <= 0f || containerSize.y <= 0f || imageSize.x <= 0f || imageSize.y <= 0f) return Rect.Zero
    val scale = min(containerSize.x / imageSize.x, containerSize.y / imageSize.y)
    val displayedWidth = imageSize.x * scale
    val displayedHeight = imageSize.y * scale
    val offsetX = (containerSize.x - displayedWidth) / 2f
    val offsetY = (containerSize.y - displayedHeight) / 2f
    return Rect(offsetX, offsetY, offsetX + displayedWidth, offsetY + displayedHeight)
}

/** Denormalizes a 0..1 region into pixel coordinates within the current displayed image bounds. */
private fun pixelRect(region: FeedbackRegion, containerSize: Offset, imageSize: Offset): Rect {
    val display = displayRect(containerSize, imageSize)
    val x = region.x.toFloat()
    val y = region.y.toFloat()
    val w = region.w.toFloat()
    val h = region.h.toFloat()
    return Rect(
        left = display.left + x * display.width,
        top = display.top + y * display.height,
        right = display.left + (x + w) * display.width,
        bottom = display.top + (y + h) * display.height,
    )
}

/** Normalizes a pixel rect into a 0..1 region, matching firestore.rules' isValidFeedbackRegion. */
private fun normalize(rect: Rect, containerSize: Offset, imageSize: Offset): FeedbackRegion? {
    val display = displayRect(containerSize, imageSize)
    if (display.width <= 0f || display.height <= 0f) return null
    val left = ((rect.left - display.left) / display.width).coerceIn(0f, 1f)
    val top = ((rect.top - display.top) / display.height).coerceIn(0f, 1f)
    val right = ((rect.right - display.left) / display.width).coerceIn(0f, 1f)
    val bottom = ((rect.bottom - display.top) / display.height).coerceIn(0f, 1f)
    return FeedbackRegion(
        x = left.toDouble(),
        y = top.toDouble(),
        w = (right - left).toDouble(),
        h = (bottom - top).toDouble(),
    )
}

private fun grow(rect: Rect, amount: Float): Rect =
    Rect(rect.left - amount, rect.top - amount, rect.right + amount, rect.bottom + amount)

private fun cornerPoint(corner: Corner, rect: Rect): Offset = when (corner) {
    Corner.TOP_LEFT -> Offset(rect.left, rect.top)
    Corner.TOP_RIGHT -> Offset(rect.right, rect.top)
    Corner.BOTTOM_LEFT -> Offset(rect.left, rect.bottom)
    Corner.BOTTOM_RIGHT -> Offset(rect.right, rect.bottom)
}

private fun hitTestHandle(point: Offset, box: Rect, radius: Float): Corner? {
    for (corner in Corner.entries) {
        val cornerOffset = cornerPoint(corner, box)
        val dx = point.x - cornerOffset.x
        val dy = point.y - cornerOffset.y
        if (sqrt(dx * dx + dy * dy) <= radius) return corner
    }
    return null
}

private fun resizedRect(rect: Rect, corner: Corner, point: Offset, minSize: Float = 24f): Rect = when (corner) {
    Corner.TOP_LEFT -> Rect(
        left = min(point.x, rect.right - minSize),
        top = min(point.y, rect.bottom - minSize),
        right = rect.right,
        bottom = rect.bottom,
    )
    Corner.TOP_RIGHT -> Rect(
        left = rect.left,
        top = min(point.y, rect.bottom - minSize),
        right = max(point.x, rect.left + minSize),
        bottom = rect.bottom,
    )
    Corner.BOTTOM_LEFT -> Rect(
        left = min(point.x, rect.right - minSize),
        top = rect.top,
        right = rect.right,
        bottom = max(point.y, rect.top + minSize),
    )
    Corner.BOTTOM_RIGHT -> Rect(
        left = rect.left,
        top = rect.top,
        right = max(point.x, rect.left + minSize),
        bottom = max(point.y, rect.top + minSize),
    )
}

private fun clampRect(rect: Rect, bounds: Rect): Rect {
    if (bounds.width <= 0f || bounds.height <= 0f) return rect
    val width = min(rect.width, bounds.width)
    val height = min(rect.height, bounds.height)
    val left = rect.left.coerceIn(bounds.left, bounds.right - width)
    val top = rect.top.coerceIn(bounds.top, bounds.bottom - height)
    return Rect(left, top, left + width, top + height)
}
