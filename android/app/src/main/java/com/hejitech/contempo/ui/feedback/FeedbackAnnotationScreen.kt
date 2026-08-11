package com.hejitech.contempo.ui.feedback

import android.graphics.BitmapFactory
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
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
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
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * Full-screen overlay shown after a shake capture — box-select (NOT
 * freehand drawing, per product requirement) an area of interest on the
 * screenshot, add a description, submit. Rendered from MainActivity on top
 * of the nav host whenever PendingFeedbackCaptureStore is non-null.
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
    var dragStart by remember { mutableStateOf<Offset?>(null) }
    var dragEnd by remember { mutableStateOf<Offset?>(null) }
    var containerSize by remember { mutableStateOf(Offset.Zero) }
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

    // Lets the user shrink the description/buttons panel down to a small
    // FAB to see the screenshot underneath it (see collapsedReserve below)
    // — this is a deliberate, discrete resize of the image area, unlike
    // the keyboard case above, so any drawn box is cleared on toggle
    // instead of trying to rescale it: the box is drawn relative to a
    // *specific* image size, and there's no cheap way to keep it correctly
    // positioned across an arbitrary resize without re-deriving it, so
    // clearing it (the user can just redraw in a couple seconds) is the
    // simplest correct choice.
    var isInputExpanded by remember { mutableStateOf(true) }
    val collapsedReserve = 88.dp
    fun toggleInputExpanded() {
        dragStart = null
        dragEnd = null
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
                stringResource(R.string.feedback_annotation_hint),
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
                                dragStart = offset
                                dragEnd = offset
                            },
                            onDrag = { change, _ -> dragEnd = change.position },
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
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val start = dragStart
                    val end = dragEnd
                    if (start != null && end != null) {
                        val left = min(start.x, end.x)
                        val top = min(start.y, end.y)
                        val right = max(start.x, end.x)
                        val bottom = max(start.y, end.y)
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
                    }
                }
            }
        }

        // Description + buttons, overlaid on top of the image layer and
        // anchored to the bottom edge. imePadding here (and only here) is
        // what slides this section above the keyboard when the text field
        // is focused, independent of the image layer above — see the
        // comment on the outer Box.
        if (isInputExpanded) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
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
                        onClick = {
                            val region = bitmap?.let {
                                normalizedRegion(dragStart, dragEnd, containerSize, Offset(it.width.toFloat(), it.height.toFloat()))
                            }
                            viewModel.submit(imageFile, region, description)
                        },
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
                    .align(Alignment.BottomEnd)
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

/**
 * A drag under 8px in both axes reads as a tap, not an intentional box —
 * treated as "no region." Normalizes against the image's actual displayed
 * bounds within [containerSize], not the container itself — ContentScale.Fit
 * letterboxes/pillarboxes whenever the container's aspect ratio doesn't
 * exactly match the screenshot's (it never does here: the container is
 * narrower than the full device screen since the title/hint text and the
 * description field above/below it eat into the available height), so
 * normalizing against the raw container would silently shift the stored
 * region away from what the user actually boxed on the image.
 */
private fun normalizedRegion(start: Offset?, end: Offset?, containerSize: Offset, imageSize: Offset): FeedbackRegion? {
    if (start == null || end == null || containerSize.x <= 0f || containerSize.y <= 0f) return null
    if (imageSize.x <= 0f || imageSize.y <= 0f) return null
    if (abs(end.x - start.x) < 8f && abs(end.y - start.y) < 8f) return null

    val scale = min(containerSize.x / imageSize.x, containerSize.y / imageSize.y)
    val displayedWidth = imageSize.x * scale
    val displayedHeight = imageSize.y * scale
    val offsetX = (containerSize.x - displayedWidth) / 2f
    val offsetY = (containerSize.y - displayedHeight) / 2f

    val left = ((min(start.x, end.x) - offsetX) / displayedWidth)
    val top = ((min(start.y, end.y) - offsetY) / displayedHeight)
    val right = ((max(start.x, end.x) - offsetX) / displayedWidth)
    val bottom = ((max(start.y, end.y) - offsetY) / displayedHeight)
    val clampedLeft = left.coerceIn(0f, 1f)
    val clampedTop = top.coerceIn(0f, 1f)
    val clampedRight = right.coerceIn(0f, 1f)
    val clampedBottom = bottom.coerceIn(0f, 1f)
    return FeedbackRegion(
        x = clampedLeft.toDouble(),
        y = clampedTop.toDouble(),
        w = (clampedRight - clampedLeft).toDouble(),
        h = (clampedBottom - clampedTop).toDouble(),
    )
}
