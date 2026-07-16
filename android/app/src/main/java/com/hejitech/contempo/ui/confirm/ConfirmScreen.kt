package com.hejitech.contempo.ui.confirm

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
    /** Local content:// URI for a just-taken photo, if this entry came from photo capture. */
    photoUri: String? = null,
    onConfirmed: () -> Unit,
    viewModel: ConfirmViewModel = viewModel(
        factory = ConfirmViewModel.Factory(property, task, durationMinutes, category, captureSource, photoUri)
    ),
) {
    val uiState by viewModel.uiState.collectAsState()
    var categoryMenuExpanded by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val photoPreview = remember(photoUri) {
        photoUri?.let { uri -> runCatching { PhotoUtils.decodeSampledBitmap(context, uri.toUri(), PHOTO_PREVIEW_MAX_DIMENSION_PX) }.getOrNull() }
    }

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
        Spacer(Modifier.height(20.dp))

        OutlinedTextField(
            value = uiState.property,
            onValueChange = viewModel::onPropertyChanged,
            label = { Text(stringResource(R.string.confirm_property_label)) },
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = uiState.task,
            onValueChange = viewModel::onTaskChanged,
            label = { Text(stringResource(R.string.confirm_task_label)) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
        )
        Spacer(Modifier.height(12.dp))

        OutlinedTextField(
            value = uiState.durationMinutes,
            onValueChange = viewModel::onDurationChanged,
            label = { Text(stringResource(R.string.confirm_duration_label)) },
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

        Spacer(Modifier.height(24.dp))

        Button(
            onClick = { viewModel.confirm(onConfirmed) },
            enabled = !uiState.isSaving,
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.small,
        ) {
            if (uiState.isSaving) {
                CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp), strokeWidth = 2.dp)
            }
            Text(stringResource(R.string.confirm_button))
        }

        uiState.errorMessage?.let { error ->
            Spacer(Modifier.height(12.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
        }
    }
}
