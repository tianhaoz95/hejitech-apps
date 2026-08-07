package com.hejitech.contempo.ui.confirm

import com.hejitech.contempo.ui.components.ActivityDateTimeField
import com.hejitech.contempo.ui.components.OsmAddressAutoCompleteField
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
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

private const val PHOTO_PREVIEW_MAX_DIMENSION_PX = 512

@OptIn(ExperimentalMaterial3Api::class)
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
                        onClick = { viewModel.onPropertySelected(savedProperty) },
                        label = { Text(savedProperty.name) },
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

        ExposedDropdownMenuBox(
            expanded = categoryMenuExpanded,
            onExpandedChange = { categoryMenuExpanded = it },
        ) {
            OutlinedTextField(
                value = uiState.category.name.lowercase().replace('_', ' '),
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
                            viewModel.onCategoryChanged(option)
                            categoryMenuExpanded = false
                        },
                    )
                }
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
