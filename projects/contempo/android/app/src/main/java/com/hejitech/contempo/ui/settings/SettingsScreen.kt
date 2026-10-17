package com.hejitech.contempo.ui.settings

import android.content.Intent
import android.net.Uri
import android.provider.Settings as AndroidSettings
import android.text.format.Formatter
import androidx.compose.foundation.border
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.agent.OnDeviceModelUiStatus
import com.hejitech.contempo.ui.capture.CaptureMode
import com.hejitech.contempo.ui.export.ExportViewModel
import com.hejitech.contempo.ui.export.shareCsv
import com.hejitech.contempo.ui.legal.LegalDoc
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.core.model.CaptureLanguage
import com.hejitech.core.model.TokenUsageWeek
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
    val onDeviceStatus by viewModel.onDeviceModelStatus.collectAsState()
    val quickCaptureEnabled by viewModel.quickCaptureEnabled.collectAsState()
    val shakeToReportEnabled by viewModel.shakeToReportEnabled.collectAsState()
    val captureLanguage by viewModel.captureLanguage.collectAsState()
    val defaultCaptureMode by viewModel.defaultCaptureMode.collectAsState()
    val exportState by exportViewModel.uiState.collectAsState()
    val deleteAccountState by viewModel.deleteAccountState.collectAsState()
    val context = LocalContext.current
    var showWearExplanation by remember { mutableStateOf(false) }
    var showQuickCaptureExplanation by remember { mutableStateOf(false) }
    var showShakeToReportExplanation by remember { mutableStateOf(false) }
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

            val asrModelAvailable by viewModel.asrModelAvailable.collectAsState()

            Spacer(Modifier.height(16.dp))
            OnDeviceModelStatusPanel(
                asrAvailable = asrModelAvailable,
                status = onDeviceStatus,
                onRetry = viewModel::retryOnDeviceModelCheck,
                onDeleteModel = { showDeleteModelConfirmation = true },
            )

            val deviceTokenUsage by viewModel.deviceTokenUsage.collectAsState()
            Spacer(Modifier.height(16.dp))
            TokenUsageSection(deviceUsage = deviceTokenUsage)

            Spacer(Modifier.height(32.dp))
            HorizontalDivider()
            Spacer(Modifier.height(24.dp))

            Text(stringResource(R.string.settings_capture_section), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))

            // App-level now, not a per-capture-session toggle — moved off
            // the Capture tab entirely to keep that screen lean (see
            // CaptureScreen's kdoc). Same label/switch/info-button shape the
            // old Capture-tab row used, just relocated.
            val quickCaptureToggleDescription = stringResource(R.string.capture_quick_capture_toggle_content_description)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.capture_quick_capture_label),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f),
                )
                Switch(
                    checked = quickCaptureEnabled,
                    onCheckedChange = viewModel::setQuickCaptureEnabled,
                    modifier = Modifier.semantics { contentDescription = quickCaptureToggleDescription },
                )
                IconButton(onClick = { showQuickCaptureExplanation = true }) {
                    Icon(
                        Icons.Filled.Info,
                        contentDescription = stringResource(R.string.capture_quick_capture_info_content_description),
                        modifier = Modifier.size(18.dp),
                    )
                }
            }

            Spacer(Modifier.height(20.dp))
            Text(stringResource(R.string.settings_capture_language_label), style = MaterialTheme.typography.bodyLarge)
            Text(
                stringResource(R.string.settings_capture_language_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            Column(Modifier.selectableGroup()) {
                InferenceOptionRow(
                    label = stringResource(R.string.capture_language_english),
                    selected = captureLanguage == CaptureLanguage.ENGLISH,
                    onClick = { viewModel.setCaptureLanguage(CaptureLanguage.ENGLISH) },
                )
                InferenceOptionRow(
                    label = stringResource(R.string.capture_language_chinese),
                    selected = captureLanguage == CaptureLanguage.CHINESE,
                    onClick = { viewModel.setCaptureLanguage(CaptureLanguage.CHINESE) },
                )
                InferenceOptionRow(
                    label = stringResource(R.string.capture_language_auto),
                    selected = captureLanguage == CaptureLanguage.AUTO,
                    onClick = { viewModel.setCaptureLanguage(CaptureLanguage.AUTO) },
                )
            }

            Spacer(Modifier.height(20.dp))
            Text(stringResource(R.string.settings_capture_default_mode_label), style = MaterialTheme.typography.bodyLarge)
            Text(
                stringResource(R.string.settings_capture_default_mode_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(8.dp))
            Column(Modifier.selectableGroup()) {
                InferenceOptionRow(
                    label = stringResource(R.string.capture_mode_audio_first),
                    selected = defaultCaptureMode == CaptureMode.AUDIO_FIRST,
                    onClick = { viewModel.setDefaultCaptureMode(CaptureMode.AUDIO_FIRST) },
                )
                InferenceOptionRow(
                    label = stringResource(R.string.capture_mode_typing),
                    selected = defaultCaptureMode == CaptureMode.TYPING,
                    onClick = { viewModel.setDefaultCaptureMode(CaptureMode.TYPING) },
                )
            }

            Spacer(Modifier.height(32.dp))
            HorizontalDivider()
            Spacer(Modifier.height(24.dp))

            Text(stringResource(R.string.settings_feedback_section), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            val shakeToReportToggleDescription = stringResource(R.string.settings_shake_to_report_toggle_content_description)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    stringResource(R.string.settings_shake_to_report_label),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.weight(1f),
                )
                Switch(
                    checked = shakeToReportEnabled,
                    onCheckedChange = viewModel::setShakeToReportEnabled,
                    modifier = Modifier.semantics { contentDescription = shakeToReportToggleDescription },
                )
                IconButton(onClick = { showShakeToReportExplanation = true }) {
                    Icon(
                        Icons.Filled.Info,
                        contentDescription = stringResource(R.string.settings_shake_to_report_info_content_description),
                        modifier = Modifier.size(18.dp),
                    )
                }
            }

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

        // Deliberately last on the screen, in its own bordered/error-toned
        // block — sign-out and delete-account used to sit at the very top
        // (right under Account), where a mistap was one scroll-position
        // away from every other settings row. Isolating them at the bottom
        // behind a clearly-labeled "danger zone" means reaching them takes
        // a deliberate scroll past everything else, not a stray tap.
        Spacer(Modifier.height(32.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.error.copy(alpha = 0.4f))
        Spacer(Modifier.height(24.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.4f), MaterialTheme.shapes.medium)
                .padding(16.dp),
        ) {
            Text(
                stringResource(R.string.settings_danger_zone_section),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.error,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                stringResource(R.string.settings_danger_zone_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(16.dp))
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

    if (showQuickCaptureExplanation) {
        AlertDialog(
            onDismissRequest = { showQuickCaptureExplanation = false },
            title = { Text(stringResource(R.string.capture_quick_capture_label)) },
            text = { Text(stringResource(R.string.capture_quick_capture_caption)) },
            confirmButton = {
                TextButton(onClick = { showQuickCaptureExplanation = false }) {
                    Text(stringResource(android.R.string.ok))
                }
            },
        )
    }

    if (showShakeToReportExplanation) {
        AlertDialog(
            onDismissRequest = { showShakeToReportExplanation = false },
            title = { Text(stringResource(R.string.settings_shake_to_report_label)) },
            text = { Text(stringResource(R.string.settings_shake_to_report_caption)) },
            confirmButton = {
                TextButton(onClick = { showShakeToReportExplanation = false }) {
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

/**
 * On-device counters are client-written (see EntryRepository.
 * recordOnDeviceTokenUsage) and refresh live as this device runs
 * inference; cloud counters are server-written (askAgentFlow/parseEntryFlow)
 * and refresh live once Firestore syncs the write down — either way this
 * is a live listener, not a one-shot fetch, so it updates in place as usage
 * happens. Both reset automatically at the next ISO week boundary (a new
 * week is simply a new, still-empty document).
 */
// On-device inference costs us nothing marginally (it runs on the user's own
// hardware), so this reference value is purely a progress-bar scale, never
// an enforced cap — every user, free or Pro, is really unlimited. It exists
// so the bar has *something* to measure fullness against; real usage sits
// far below it, which is the point (visibly tons of headroom). Cloud's 20 is
// a real quota — cloud tokens cost real money (see the cloud_ai_enabled
// Remote Config kill switch) — and is Pro-only, so the row is hidden
// entirely for free accounts rather than shown locked/empty.
private const val ON_DEVICE_CREDIT_REFERENCE = 10_000.0

@Composable
private fun TokenUsageSection(deviceUsage: TokenUsageWeek?) {
    Column {
        Text(
            stringResource(R.string.settings_token_usage_title),
            style = MaterialTheme.typography.titleSmall,
        )
        Spacer(Modifier.height(8.dp))
        TokenUsageProgressRow(
            label = stringResource(R.string.settings_token_usage_on_device),
            usage = deviceUsage,
            quota = ON_DEVICE_CREDIT_REFERENCE,
            quotaLabel = { credits -> stringResource(R.string.settings_token_usage_credits_unlimited, credits) },
            color = MaterialTheme.colorScheme.tertiary,
        )
    }
}

@Composable
private fun TokenUsageProgressRow(
    label: String,
    usage: TokenUsageWeek?,
    quota: Double,
    quotaLabel: @Composable (String) -> String,
    color: androidx.compose.ui.graphics.Color,
) {
    val credits = usage?.creditsUsed ?: 0.0
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                label,
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            Text(
                quotaLabel(formatCredits(credits)),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(4.dp))
        LinearProgressIndicator(
            progress = { (credits / quota).toFloat().coerceIn(0f, 1f) },
            modifier = Modifier.fillMaxWidth(),
            color = color,
        )
        if (usage != null && usage.requestCount > 0) {
            Spacer(Modifier.height(2.dp))
            Text(
                stringResource(
                    R.string.settings_token_usage_summary,
                    usage.inputTokens,
                    usage.outputTokens,
                    usage.requestCount,
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Spacer(Modifier.height(2.dp))
            Text(
                stringResource(R.string.settings_token_usage_empty),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private fun formatCredits(value: Double): String = when {
    value <= 0.0 -> "0"
    value < 0.01 -> "< 0.01"
    else -> String.format("%.2f", value)
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
