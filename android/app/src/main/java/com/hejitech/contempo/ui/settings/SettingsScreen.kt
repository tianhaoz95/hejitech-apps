package com.hejitech.contempo.ui.settings

import android.content.Intent
import android.net.Uri
import android.provider.Settings as AndroidSettings
import android.text.format.Formatter
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.agent.InferencePreference
import com.hejitech.contempo.agent.OnDeviceModelUiStatus
import com.hejitech.contempo.ui.export.ExportViewModel
import com.hejitech.contempo.ui.export.shareCsv
import com.hejitech.contempo.ui.legal.LegalDoc
import com.hejitech.contempo.ui.theme.Eyebrow
// Aliased — this file already imports androidx.compose.ui.semantics.Role
// (used for e.g. `role = Role.RadioButton`) which would otherwise collide.
import com.hejitech.core.model.Role as ParticipantRole

@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = viewModel(),
    exportViewModel: ExportViewModel = viewModel(),
    onOpenLegalDoc: (LegalDoc) -> Unit = {},
) {
    val account = viewModel.currentAccount()
    val preference by viewModel.inferencePreference.collectAsState()
    val cloudAiEnabled by viewModel.cloudAiEnabled.collectAsState()
    val onDeviceStatus by viewModel.onDeviceModelStatus.collectAsState()
    val showLanguageSelector by viewModel.showLanguageSelector.collectAsState()
    val exportState by exportViewModel.uiState.collectAsState()
    val deleteAccountState by viewModel.deleteAccountState.collectAsState()
    val context = LocalContext.current
    var showWearExplanation by remember { mutableStateOf(false) }
    var showDeleteConfirmation by remember { mutableStateOf(false) }
    var showDeleteModelConfirmation by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        Eyebrow(stringResource(R.string.settings_eyebrow))
        Spacer(Modifier.height(12.dp))
        Text(stringResource(R.string.nav_settings), style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(24.dp))

        Text(stringResource(R.string.settings_account_section), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Text(account.displayName ?: stringResource(R.string.settings_no_name), style = MaterialTheme.typography.bodyLarge)
            account.email?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = viewModel::signOut, shape = MaterialTheme.shapes.small) {
                Text(stringResource(R.string.settings_sign_out))
            }

            Spacer(Modifier.height(12.dp))
            TextButton(
                onClick = { showDeleteConfirmation = true },
                enabled = !deleteAccountState.isDeleting,
            ) {
                if (deleteAccountState.isDeleting) {
                    CircularProgressIndicator(
                        modifier = Modifier.padding(end = 8.dp).size(16.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                Text(
                    stringResource(R.string.settings_delete_account),
                    color = MaterialTheme.colorScheme.error,
                )
            }
            deleteAccountState.errorMessage?.let { error ->
                Spacer(Modifier.height(4.dp))
                Text(error, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
            }

            Spacer(Modifier.height(32.dp))
            HorizontalDivider()
            Spacer(Modifier.height(24.dp))

            Text(stringResource(R.string.settings_ai_section), style = MaterialTheme.typography.titleMedium)
            Text(
                stringResource(R.string.settings_ai_section_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))

            Column(Modifier.selectableGroup()) {
                InferenceOptionRow(
                    label = stringResource(R.string.settings_ai_on_device_only),
                    selected = preference == InferencePreference.ON_DEVICE_ONLY,
                    onClick = { viewModel.setInferencePreference(InferencePreference.ON_DEVICE_ONLY) },
                )
                InferenceOptionRow(
                    label = stringResource(R.string.settings_ai_prefer_on_device),
                    selected = preference == InferencePreference.PREFER_ON_DEVICE,
                    onClick = { viewModel.setInferencePreference(InferencePreference.PREFER_ON_DEVICE) },
                )
                InferenceOptionRow(
                    label = stringResource(R.string.settings_ai_cloud_only),
                    selected = preference == InferencePreference.CLOUD_ONLY,
                    enabled = cloudAiEnabled,
                    onClick = { viewModel.setInferencePreference(InferencePreference.CLOUD_ONLY) },
                )
            }

            if (!cloudAiEnabled) {
                Spacer(Modifier.height(4.dp))
                Text(
                    stringResource(R.string.settings_ai_cloud_disabled_notice),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            val asrModelAvailable by viewModel.asrModelAvailable.collectAsState()

            if (preference != InferencePreference.CLOUD_ONLY) {
                Spacer(Modifier.height(16.dp))
                OnDeviceModelStatusPanel(
                    asrAvailable = asrModelAvailable,
                    status = onDeviceStatus,
                    onRetry = viewModel::retryOnDeviceModelCheck,
                    onDeleteModel = { showDeleteModelConfirmation = true },
                )
            }

            Spacer(Modifier.height(32.dp))
            HorizontalDivider()
            Spacer(Modifier.height(24.dp))

            Text(stringResource(R.string.settings_capture_section), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.settings_show_language_selector_label),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f),
                )
                Switch(checked = showLanguageSelector, onCheckedChange = viewModel::setShowLanguageSelector)
            }
            Text(
                stringResource(R.string.settings_show_language_selector_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(32.dp))
            HorizontalDivider()
            Spacer(Modifier.height(24.dp))

            Text(stringResource(R.string.settings_roles_section), style = MaterialTheme.typography.titleMedium)
            Text(
                stringResource(R.string.settings_roles_section_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))

            val roles by viewModel.roles.collectAsState()
            val roleError by viewModel.roleError.collectAsState()
            var showAddRole by remember { mutableStateOf(false) }
            var renamingRole by remember { mutableStateOf<ParticipantRole?>(null) }

            roles.forEach { role ->
                Row(
                    modifier = Modifier.fillMaxWidth().clickable { renamingRole = role },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(role.name, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    IconButton(onClick = { viewModel.deleteRole(role) }) {
                        Icon(
                            Icons.Filled.Delete,
                            contentDescription = stringResource(R.string.settings_roles_delete_content_description),
                            tint = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }

            TextButton(onClick = { showAddRole = true }) {
                Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.settings_roles_add_button))
            }

            if (showAddRole) {
                RoleNameDialog(
                    title = stringResource(R.string.settings_roles_add_dialog_title),
                    initialName = "",
                    onDismiss = { showAddRole = false },
                    onSave = { name -> viewModel.addRole(name); showAddRole = false },
                )
            }
            renamingRole?.let { role ->
                RoleNameDialog(
                    title = stringResource(R.string.settings_roles_rename_dialog_title),
                    initialName = role.name,
                    onDismiss = { renamingRole = null },
                    onSave = { name -> viewModel.renameRole(role, name); renamingRole = null },
                )
            }
            roleError?.let { error ->
                AlertDialog(
                    onDismissRequest = viewModel::dismissRoleError,
                    title = { Text(stringResource(R.string.settings_roles_error_dialog_title)) },
                    text = { Text(error) },
                    confirmButton = {
                        TextButton(onClick = viewModel::dismissRoleError) {
                            Text(stringResource(R.string.settings_roles_error_dialog_dismiss))
                        }
                    },
                )
            }

            Spacer(Modifier.height(32.dp))
            HorizontalDivider()
            Spacer(Modifier.height(24.dp))

            Text(stringResource(R.string.settings_wear_section), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(4.dp))
            // The full explanation is several lines long — collapsed behind
            // a button rather than always shown, so this section doesn't
            // dominate the Settings screen for something most users only
            // need to read once.
            TextButton(onClick = { showWearExplanation = true }) {
                Icon(Icons.Filled.Info, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.settings_wear_explain_button))
            }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = {
                    val intent = Intent(AndroidSettings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", context.packageName, null)
                    }
                    context.startActivity(intent)
                },
                shape = MaterialTheme.shapes.small,
            ) {
                Text(stringResource(R.string.settings_wear_open_battery_settings))
            }

        Spacer(Modifier.height(32.dp))
        HorizontalDivider()
        Spacer(Modifier.height(24.dp))

        Text(stringResource(R.string.export_title), style = MaterialTheme.typography.titleMedium)
        Text(
            stringResource(R.string.export_eyebrow),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(12.dp))

        Button(
            onClick = { exportViewModel.generateCsv() },
            enabled = !exportState.isGenerating,
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.small,
        ) {
            if (exportState.isGenerating) {
                CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp), strokeWidth = 2.dp)
            }
            Text(stringResource(R.string.export_csv_button))
        }

        exportState.csv?.let { csv ->
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = { shareCsv(context, csv) },
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.small,
            ) {
                Text(stringResource(R.string.export_share_button))
            }
        }

        exportState.errorMessage?.let { error ->
            Spacer(Modifier.height(12.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
        }

        Spacer(Modifier.height(32.dp))
        HorizontalDivider()
        Spacer(Modifier.height(24.dp))

        Text(stringResource(R.string.settings_legal_section), style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        Row {
            TextButton(onClick = { onOpenLegalDoc(LegalDoc.PRIVACY) }) {
                Text(stringResource(R.string.settings_privacy_policy))
            }
            TextButton(onClick = { onOpenLegalDoc(LegalDoc.TERMS) }) {
                Text(stringResource(R.string.settings_terms_of_service))
            }
        }
    }

    if (showWearExplanation) {
        AlertDialog(
            onDismissRequest = { showWearExplanation = false },
            title = { Text(stringResource(R.string.settings_wear_section)) },
            text = { Text(stringResource(R.string.settings_wear_section_hint)) },
            confirmButton = {
                TextButton(onClick = { showWearExplanation = false }) {
                    Text(stringResource(android.R.string.ok))
                }
            },
        )
    }

    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text(stringResource(R.string.settings_delete_account_confirm_title)) },
            text = { Text(stringResource(R.string.settings_delete_account_confirm_body)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteConfirmation = false
                        viewModel.deleteAccount()
                    },
                ) {
                    Text(
                        stringResource(R.string.settings_delete_account_confirm_button),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmation = false }) {
                    Text(stringResource(android.R.string.cancel))
                }
            },
        )
    }

    if (showDeleteModelConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteModelConfirmation = false },
            title = { Text(stringResource(R.string.on_device_status_delete_model_confirm_title)) },
            text = { Text(stringResource(R.string.on_device_status_delete_model_confirm_body)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteModelConfirmation = false
                        viewModel.deleteOnDeviceModel()
                    },
                ) {
                    Text(
                        stringResource(R.string.on_device_status_delete_model),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteModelConfirmation = false }) {
                    Text(stringResource(android.R.string.cancel))
                }
            },
        )
    }
}

@Composable
private fun OnDeviceModelStatusPanel(
    asrAvailable: Boolean,
    status: OnDeviceModelUiStatus,
    onRetry: () -> Unit,
    onDeleteModel: () -> Unit,
) {
    Column {
        // Speech Recognition Model (ASR - Whisper)
        Text(
            text = "Speech Recognition",
            style = MaterialTheme.typography.titleSmall,
        )
        Spacer(Modifier.height(4.dp))
        if (asrAvailable) {
            Text(
                text = "On-device speech model ready (bundled)",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary,
            )
        } else {
            Text(
                text = "On-device speech model unavailable",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.error,
            )
        }

        Spacer(Modifier.height(12.dp))
        HorizontalDivider()
        Spacer(Modifier.height(12.dp))

        // Language Model (LLM - Gemma)
        Text(
            text = "Language Model",
            style = MaterialTheme.typography.titleSmall,
        )
        Spacer(Modifier.height(4.dp))
        when (status) {
            is OnDeviceModelUiStatus.Checking ->
                Text(
                    stringResource(R.string.on_device_status_checking),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

            is OnDeviceModelUiStatus.NotDownloaded -> {
                Text(
                    stringResource(R.string.on_device_status_not_downloaded),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onRetry, shape = MaterialTheme.shapes.small) {
                    Text(stringResource(R.string.on_device_status_download))
                }
            }

            is OnDeviceModelUiStatus.Unavailable ->
                Text(
                    stringResource(R.string.on_device_status_unavailable),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

            is OnDeviceModelUiStatus.Available -> {
                Text(
                    stringResource(R.string.on_device_status_ready),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                TextButton(onClick = onDeleteModel) {
                    Text(
                        stringResource(R.string.on_device_status_delete_model),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            }

            is OnDeviceModelUiStatus.Downloading -> {
                val fraction = if (status.totalBytes > 0) {
                    (status.bytesDownloaded.toFloat() / status.totalBytes).coerceIn(0f, 1f)
                } else {
                    null
                }
                Text(
                    downloadingHeadline(status),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                if (fraction != null) {
                    LinearProgressIndicator(progress = { fraction }, modifier = Modifier.fillMaxWidth())
                } else {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    downloadingDetail(status),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            is OnDeviceModelUiStatus.Failed -> {
                Text(
                    stringResource(R.string.on_device_status_failed, status.message),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
                Spacer(Modifier.height(8.dp))
                Row {
                    OutlinedButton(onClick = onRetry, shape = MaterialTheme.shapes.small) {
                        Text(stringResource(R.string.on_device_status_retry))
                    }
                    Spacer(Modifier.width(8.dp))
                    TextButton(onClick = onDeleteModel) {
                        Text(
                            stringResource(R.string.on_device_status_delete_model),
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun downloadingHeadline(status: OnDeviceModelUiStatus.Downloading): String {
    val percent = if (status.totalBytes > 0) {
        ((status.bytesDownloaded.toFloat() / status.totalBytes) * 100).toInt()
    } else {
        null
    }
    if (percent == null) return stringResource(R.string.on_device_status_downloading)
    val context = LocalContext.current
    val downloadedLabel = Formatter.formatShortFileSize(context, status.bytesDownloaded)
    val totalLabel = Formatter.formatShortFileSize(context, status.totalBytes)
    return stringResource(R.string.on_device_status_downloading_with_size, percent, downloadedLabel, totalLabel)
}

@Composable
private fun downloadingDetail(status: OnDeviceModelUiStatus.Downloading): String {
    val eta = status.etaSeconds?.let(::formatEta)
    val speedLabel = status.bytesPerSecond?.takeIf { it > 0 }?.let {
        Formatter.formatShortFileSize(LocalContext.current, it.toLong())
    }
    return when {
        speedLabel != null && eta != null -> stringResource(R.string.on_device_status_speed_and_eta, speedLabel, eta)
        speedLabel != null -> stringResource(R.string.on_device_status_speed_only, speedLabel)
        else -> stringResource(R.string.on_device_status_estimating_speed)
    }
}

private fun formatEta(totalSeconds: Long): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return if (minutes > 0) "${minutes}m ${seconds}s" else "${seconds}s"
}

@Composable
private fun InferenceOptionRow(label: String, selected: Boolean, onClick: () -> Unit, enabled: Boolean = true) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, enabled = enabled, onClick = onClick, role = Role.RadioButton)
            .alpha(if (enabled) 1f else 0.5f)
            .padding(vertical = 8.dp),
    ) {
        RadioButton(selected = selected, onClick = null, enabled = enabled)
        Spacer(Modifier.height(0.dp))
        Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(start = 12.dp))
    }
}

@Composable
private fun RoleNameDialog(title: String, initialName: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var name by remember { mutableStateOf(initialName) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text(stringResource(R.string.settings_roles_name_placeholder)) },
            )
        },
        confirmButton = {
            TextButton(onClick = { onSave(name) }) {
                Text(stringResource(R.string.settings_roles_save_button))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.settings_roles_cancel_button))
            }
        },
    )
}
