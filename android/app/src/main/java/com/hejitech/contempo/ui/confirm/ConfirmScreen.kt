package com.hejitech.contempo.ui.confirm

import android.Manifest
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.hejitech.contempo.ui.components.ActivityDateTimeField
import com.hejitech.contempo.ui.components.OsmAddressAutoCompleteField
import androidx.compose.foundation.Image
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.core.net.toUri
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.contempo.util.PhotoUtils
import com.hejitech.core.model.CaptureSource
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.model.Property

private const val PHOTO_PREVIEW_MAX_DIMENSION_PX = 512

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ConfirmScreen(
    property: String,
    task: String,
    durationMinutes: Int,
    category: String,
    /** "on_device" / "cloud" / empty (manual entry, no AI parse happened) — see ConfirmRoute. */
    source: String = "",
    /** CaptureSource enum name (MANUAL/TEXT/VOICE/PHOTO) — see ConfirmRoute. */
    captureSource: String = "",
    /** Business miles driven, if any — always optional, unlike duration. */
    miles: Double = 0.0,
    /** AI-resolved activity time from the parse draft, if any — see EntryDraft.resolvedActivityDateIso. */
    resolvedActivityDateIso: String? = null,
    /** Local content:// URI for a just-taken photo, if this entry came from photo capture. */
    photoUri: String? = null,
    /** Non-blank when resuming a pending_review entry from the Dashboard's pending badge. */
    entryId: String = "",
    /** Best-effort "captured from here" location — see CaptureViewModel.captureLocation. */
    captureLat: Double? = null,
    captureLng: Double? = null,
    /**
     * Set only when a fresh photo capture was classified as an odometer
     * reading (see CaptureViewModel.handleOdometerPhoto / CaptureResult) —
     * never set on the EntryDetail edit path. Swaps the usual work-entry
     * fields for a single odometer-reading field, user-correctable via the
     * toggle below the photo preview.
     */
    isTripCapture: Boolean = false,
    /** Display-only — which button label to show; the actual open/close branch is re-derived at save time. */
    tripIsEndingExistingTrip: Boolean = false,
    odometerReading: Double? = null,
    onConfirmed: () -> Unit,
    /** Pops the back stack — see the unsaved-changes BackHandler below, which needs an actual escape hatch for "Discard Changes." */
    onBack: () -> Unit,
    viewModel: ConfirmViewModel = viewModel(
        factory = ConfirmViewModel.Factory(
            property, task, durationMinutes, category, captureSource, miles, resolvedActivityDateIso,
            photoUri, entryId, captureLat, captureLng, isTripCapture, odometerReading,
        )
    ),
) {
    val uiState by viewModel.uiState.collectAsState()
    var categoryMenuExpanded by remember { mutableStateOf(false) }
    var roleMenuExpanded by remember { mutableStateOf(false) }
    val context = LocalContext.current

    // Intercepts the system back gesture/button when there's something to
    // lose — confirmed live as a real gap: a stray back press silently
    // dropped whatever the user had just typed. Only enabled while dirty, so
    // an unmodified entry still backs out immediately as before.
    var showUnsavedChangesConfirm by remember { mutableStateOf(false) }
    var propertyPendingDeletion by remember { mutableStateOf<Property?>(null) }
    BackHandler(enabled = viewModel.hasUnsavedChanges()) {
        showUnsavedChangesConfirm = true
    }
    if (showUnsavedChangesConfirm) {
        AlertDialog(
            onDismissRequest = { showUnsavedChangesConfirm = false },
            title = { Text(stringResource(R.string.confirm_unsaved_changes_title)) },
            confirmButton = {
                TextButton(onClick = {
                    showUnsavedChangesConfirm = false
                    // saveForLater only handles the regular entry shape, not
                    // a trip's odometer save — trip mode always goes through
                    // confirm() (-> saveTrip), same as the primary button below.
                    if (!uiState.isTripMode && uiState.isIncomplete) {
                        viewModel.saveForLater(onConfirmed)
                    } else {
                        viewModel.confirm(onConfirmed)
                    }
                }) {
                    Text(stringResource(R.string.confirm_unsaved_changes_save))
                }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = {
                        showUnsavedChangesConfirm = false
                        onBack()
                    }) {
                        Text(stringResource(R.string.confirm_unsaved_changes_discard))
                    }
                    TextButton(onClick = { showUnsavedChangesConfirm = false }) {
                        Text(stringResource(R.string.confirm_cancel_button))
                    }
                }
            },
        )
    }

    // Long-press to delete a saved property — confirmed here rather than
    // deleting on the press itself, since this list has no undo and a stray
    // long-press is easy to trigger while scrolling the chip row.
    propertyPendingDeletion?.let { property ->
        AlertDialog(
            onDismissRequest = { propertyPendingDeletion = null },
            title = { Text(stringResource(R.string.confirm_delete_property_title, property.name)) },
            text = { Text(stringResource(R.string.confirm_delete_property_message)) },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.deleteProperty(property)
                    propertyPendingDeletion = null
                }) {
                    Text(stringResource(R.string.confirm_delete_property_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { propertyPendingDeletion = null }) {
                    Text(stringResource(R.string.confirm_cancel_button))
                }
            },
        )
    }

    // Voice input for the task field (see ConfirmViewModel.startRecordingTask)
    // — pendingTaskRecording remembers that a permission request was
    // triggered by the dictate button, so the launcher's callback can start
    // recording once granted, same pattern as CaptureScreen's
    // pendingRecordAfterPermission. "AI rewrite" is a separate button that
    // rewrites the field's existing text (ConfirmViewModel.rewriteTask) — no
    // microphone or permission involved.
    var micPermissionDenied by remember { mutableStateOf(false) }
    var pendingTaskRecording by remember { mutableStateOf(false) }
    val micPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        micPermissionDenied = !granted
        if (granted && pendingTaskRecording) viewModel.startRecordingTask()
        pendingTaskRecording = false
    }
    fun onTaskMicTap() {
        when {
            uiState.isRecordingTask -> viewModel.stopRecordingTask()
            uiState.isTranscribingTask -> Unit
            hasPermission(context, Manifest.permission.RECORD_AUDIO) -> viewModel.startRecordingTask()
            else -> {
                pendingTaskRecording = true
                micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }
    val photoPreview = remember(photoUri) {
        photoUri?.let { uri -> runCatching { PhotoUtils.decodeSampledBitmap(context, uri.toUri(), PHOTO_PREVIEW_MAX_DIMENSION_PX) }.getOrNull() }
    }
    // Only a photo capture can be re-classified — voice/text/manual entries
    // never show the odometer-vs-work toggle at all.
    val isPhotoCapture = captureSource == CaptureSource.PHOTO.name

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        Eyebrow(stringResource(R.string.confirm_eyebrow))
        Spacer(Modifier.height(12.dp))
        Text(stringResource(R.string.confirm_title), style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(R.string.confirm_edit_hint),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        when (source) {
            "on_device" -> Text(
                stringResource(R.string.confirm_source_on_device),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            "cloud" -> Text(
                stringResource(R.string.confirm_source_cloud),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        photoPreview?.let { bitmap ->
            Spacer(Modifier.height(16.dp))
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = stringResource(R.string.confirm_photo_description),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(12.dp)),
                contentScale = ContentScale.Crop,
            )
        }

        // Only a photo capture ever shows this — the vision model's
        // odometer-vs-work classification (see
        // CaptureViewModel.processCapturedPhoto) is a one-tap-correctable
        // suggestion, not a silent hard commit. Flipping it re-runs the
        // *other* AgentClient photo call against the same held photo (see
        // ConfirmViewModel.onTripModeToggled).
        if (isPhotoCapture) {
            Spacer(Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.confirm_photo_intent_toggle_label),
                    style = MaterialTheme.typography.labelLarge,
                )
                Spacer(Modifier.width(8.dp))
                if (uiState.isReclassifying) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                } else {
                    Switch(checked = uiState.isTripMode, onCheckedChange = viewModel::onTripModeToggled)
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        if (uiState.isTripMode) {
            // A trip has no property/task/duration/category/date to review
            // here — MileageTripCoordinator.handleStartTrip/handleEndTrip
            // owns those (property/task stay blank, activityDate is
            // "now"), and the odometer reading is the only thing this
            // screen lets the user correct before it's committed.
            OutlinedTextField(
                value = uiState.odometerReading,
                onValueChange = viewModel::onOdometerReadingChanged,
                label = { Text(stringResource(R.string.confirm_odometer_reading_label)) },
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))

            Button(
                onClick = { viewModel.confirm(onConfirmed) },
                enabled = !uiState.isSaving,
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.small,
            ) {
                if (uiState.isSaving) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    Text(
                        stringResource(
                            if (tripIsEndingExistingTrip) R.string.confirm_end_trip_button
                            else R.string.confirm_start_trip_button
                        )
                    )
                }
            }

            uiState.errorMessage?.let { error ->
                Spacer(Modifier.height(12.dp))
                Text(error, color = MaterialTheme.colorScheme.error)
            }
            return@Column
        }

        if (uiState.isAddingNewProperty) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                OsmAddressAutoCompleteField(
                    value = uiState.newPropertyName,
                    onValueChange = viewModel::onNewPropertyNameChanged,
                    label = { Text(stringResource(R.string.confirm_new_property_label)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                )
                TextButton(onClick = viewModel::onConfirmNewProperty) {
                    Text(stringResource(R.string.confirm_add_property_button))
                }
                TextButton(onClick = viewModel::onCancelAddNewProperty) {
                    Text(stringResource(R.string.confirm_cancel_button))
                }
            }
            Spacer(Modifier.height(12.dp))
        } else if (uiState.properties.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                uiState.properties.forEach { savedProperty ->
                    FilterChip(
                        selected = savedProperty.name == uiState.property,
                        // Click handling moved onto the combinedClickable
                        // modifier below (long-press to delete a saved
                        // property, confirmed via dialog before it's ever
                        // called) — this onClick would otherwise fire
                        // alongside it and double-handle every tap.
                        onClick = {},
                        label = { Text(savedProperty.name) },
                        modifier = Modifier.combinedClickable(
                            onClick = { viewModel.onPropertySelected(savedProperty) },
                            onLongClick = { propertyPendingDeletion = savedProperty },
                        ),
                    )
                }
                FilterChip(
                    selected = false,
                    onClick = viewModel::onAddNewPropertyClicked,
                    label = { Text(stringResource(R.string.confirm_add_new_property_chip)) },
                    leadingIcon = { Icon(Icons.Filled.Add, contentDescription = null) },
                )
            }
            Spacer(Modifier.height(8.dp))
        } else {
            TextButton(onClick = viewModel::onAddNewPropertyClicked) {
                Icon(Icons.Filled.Add, contentDescription = null)
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.confirm_add_new_property_chip))
            }
            Spacer(Modifier.height(4.dp))
        }

        OsmAddressAutoCompleteField(
            value = uiState.property,
            onValueChange = viewModel::onPropertyChanged,
            label = { RequiredFieldLabel(stringResource(R.string.confirm_property_label), missing = uiState.property.isBlank()) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = uiState.task,
            onValueChange = viewModel::onTaskChanged,
            label = { RequiredFieldLabel(stringResource(R.string.confirm_task_label), missing = uiState.task.isBlank()) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        Spacer(Modifier.height(8.dp))
        // Two full labeled buttons below the field, not icon-only buttons
        // crammed into the text field's own trailing-icon slot — that
        // cramped layout led to real mis-taps (reported live: tapping the
        // AI-rewrite button was triggering raw dictation instead), and
        // neither button explained what it actually did. FlowRow, not a
        // plain Row, for the same overflow safety net as CaptureScreen's
        // quick-action row — these labels are long enough that a narrow
        // phone or larger accessibility text could push them past one line.
        //
        // "Dictate" records new speech; "AI rewrite" copy-edits the text
        // already in the field via ConfirmViewModel.rewriteTask — it does
        // not record anything. Fixed a real bug: this button used to start
        // a fresh recording and clean up only that, so tapping it while
        // editing an already-populated entry silently did nothing to the
        // visible text.
        if (uiState.isTranscribingTask) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.confirm_task_dictate_transcribing),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else if (uiState.isRewritingTask) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
                Text(
                    stringResource(R.string.confirm_task_rewriting),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = { onTaskMicTap() },
                    colors = if (uiState.isRecordingTask) {
                        ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    } else {
                        ButtonDefaults.outlinedButtonColors()
                    },
                ) {
                    Icon(
                        if (uiState.isRecordingTask) Icons.Filled.Stop else Icons.Filled.Mic,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        stringResource(
                            if (uiState.isRecordingTask) R.string.confirm_task_dictate_stop else R.string.confirm_task_dictate_raw,
                        ),
                    )
                }
                OutlinedButton(
                    onClick = { viewModel.rewriteTask() },
                    enabled = uiState.task.isNotBlank(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.primary),
                ) {
                    Icon(Icons.Filled.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.confirm_task_dictate_cleanup))
                }
            }
        }
        if (micPermissionDenied) {
            Text(
                stringResource(R.string.capture_mic_permission_needed),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = uiState.durationMinutes,
            onValueChange = viewModel::onDurationChanged,
            label = {
                RequiredFieldLabel(
                    stringResource(R.string.confirm_duration_label),
                    missing = (uiState.durationMinutes.toIntOrNull() ?: 0) <= 0,
                )
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))

        ActivityDateTimeField(millis = uiState.activityDateMillis, onChanged = viewModel::onActivityDateTimeChanged)
        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = uiState.miles,
            onValueChange = viewModel::onMilesChanged,
            label = { Text(stringResource(R.string.confirm_miles_label)) },
            placeholder = { Text(stringResource(R.string.confirm_miles_placeholder)) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))

        // Category dropdown + on-device auto-detect button side by side —
        // available regardless of whether a category is already set (an
        // already-confirmed entry reaching this screen for editing always
        // arrives with a real one, not just fresh captures). The button is
        // a correctable suggestion, not a silent commit: it just fills the
        // dropdown, which stays fully editable afterward (see
        // ConfirmViewModel.detectCategory's kdoc). "Add new category" swaps
        // this whole row for an inline text field, mirroring the role
        // picker below exactly (see ConfirmViewModel.onAddNewCategoryClicked's
        // kdoc for why this is create-only, same as roles).
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
            ExposedDropdownMenuBox(
                expanded = categoryMenuExpanded,
                onExpandedChange = { categoryMenuExpanded = it },
            ) {
                OutlinedTextField(
                    value = EntryCategory.displayName(uiState.category),
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
                                viewModel.onCategoryChanged(option.firestoreValue)
                                categoryMenuExpanded = false
                            },
                        )
                    }
                    uiState.categories.forEach { category ->
                        DropdownMenuItem(
                            text = { Text(category.name) },
                            onClick = {
                                viewModel.onCategoryChanged(category.name)
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
            Spacer(Modifier.height(8.dp))
            // A full labeled row below the dropdown, not a bare icon button
            // beside it — confirmed live: the icon-only button was too
            // small and didn't explain what it did. A correctable
            // suggestion, not a silent commit: it just fills the dropdown
            // above, which stays fully editable afterward (see
            // ConfirmViewModel.detectCategory's kdoc).
            if (uiState.isDetectingCategory) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        stringResource(R.string.confirm_category_detecting),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                OutlinedButton(onClick = viewModel::detectCategory) {
                    Icon(Icons.Filled.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.confirm_category_detect_button))
                }
            }
            uiState.categoryDetectError?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(12.dp))

        if (uiState.isAddingNewRole) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = uiState.newRoleName,
                    onValueChange = viewModel::onNewRoleNameChanged,
                    label = { Text(stringResource(R.string.confirm_new_role_label)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                )
                TextButton(onClick = viewModel::onConfirmNewRole) {
                    Text(stringResource(R.string.confirm_add_role_button))
                }
                TextButton(onClick = viewModel::onCancelAddNewRole) {
                    Text(stringResource(R.string.confirm_cancel_button))
                }
            }
        } else {
            ExposedDropdownMenuBox(
                expanded = roleMenuExpanded,
                onExpandedChange = { roleMenuExpanded = it },
            ) {
                val selectedRoleName = uiState.roles.find { it.id == uiState.selectedRoleId }?.name
                    ?: stringResource(R.string.confirm_role_me)
                OutlinedTextField(
                    value = selectedRoleName,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.confirm_role_label)) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = roleMenuExpanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable),
                )
                ExposedDropdownMenu(
                    expanded = roleMenuExpanded,
                    onDismissRequest = { roleMenuExpanded = false },
                ) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.confirm_role_me)) },
                        onClick = {
                            viewModel.onRoleSelected(null)
                            roleMenuExpanded = false
                        },
                    )
                    uiState.roles.forEach { role ->
                        DropdownMenuItem(
                            text = { Text(role.name) },
                            onClick = {
                                viewModel.onRoleSelected(role.id)
                                roleMenuExpanded = false
                            },
                        )
                    }
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.confirm_add_new_role_item)) },
                        leadingIcon = { Icon(Icons.Filled.Add, contentDescription = null) },
                        onClick = {
                            roleMenuExpanded = false
                            viewModel.onAddNewRoleClicked()
                        },
                    )
                }
            }
        }
        Text(
            stringResource(R.string.confirm_role_hint),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(24.dp))

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (uiState.isIncomplete) {
                OutlinedButton(
                    onClick = { viewModel.saveForLater(onConfirmed) },
                    enabled = !uiState.isSaving && !uiState.isSavingForLater,
                    modifier = Modifier.weight(1f),
                    shape = MaterialTheme.shapes.small,
                ) {
                    // Replaces the label rather than appending to it — an
                    // appended spinner widened/wrapped the fixed-width
                    // button, visibly resizing it while saving.
                    if (uiState.isSavingForLater) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    } else {
                        Text(stringResource(R.string.confirm_complete_later_button))
                    }
                }
            }

            Button(
                onClick = { viewModel.confirm(onConfirmed) },
                enabled = !uiState.isSaving && !uiState.isSavingForLater,
                modifier = Modifier.weight(1f),
                shape = MaterialTheme.shapes.small,
            ) {
                if (uiState.isSaving) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    Text(stringResource(R.string.confirm_button))
                }
            }
        }

        uiState.errorMessage?.let { error ->
            Spacer(Modifier.height(12.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun RequiredFieldLabel(text: String, missing: Boolean) {
    Text(
        text = if (missing) stringResource(R.string.confirm_required_field_format, text) else text,
        color = if (missing) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

private fun hasPermission(context: android.content.Context, permission: String): Boolean =
    androidx.core.content.ContextCompat.checkSelfPermission(context, permission) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
