package com.hejitech.contempo.ui.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.agent.InferencePreference
import com.hejitech.contempo.agent.OnDeviceModelUiStatus

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    viewModel: SettingsViewModel = viewModel(),
) {
    val account = viewModel.currentAccount()
    val preference by viewModel.inferencePreference.collectAsState()
    val onDeviceStatus by viewModel.onDeviceModelStatus.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_settings)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.nav_back))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding).padding(24.dp)) {
            Text(stringResource(R.string.settings_account_section), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            Text(account.displayName ?: stringResource(R.string.settings_no_name), style = MaterialTheme.typography.bodyLarge)
            account.email?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = viewModel::signOut, shape = MaterialTheme.shapes.small) {
                Text(stringResource(R.string.settings_sign_out))
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
                    onClick = { viewModel.setInferencePreference(InferencePreference.CLOUD_ONLY) },
                )
            }

            if (preference != InferencePreference.CLOUD_ONLY) {
                Spacer(Modifier.height(16.dp))
                OnDeviceModelStatusPanel(status = onDeviceStatus, onRetry = viewModel::retryOnDeviceModelCheck)
            }
        }
    }
}

@Composable
private fun OnDeviceModelStatusPanel(status: OnDeviceModelUiStatus, onRetry: () -> Unit) {
    Column {
        when (status) {
            is OnDeviceModelUiStatus.Checking, is OnDeviceModelUiStatus.NotDownloaded ->
                Text(
                    stringResource(R.string.on_device_status_checking),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

            is OnDeviceModelUiStatus.Unavailable ->
                Text(
                    stringResource(R.string.on_device_status_unavailable),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

            is OnDeviceModelUiStatus.Available ->
                Text(
                    stringResource(R.string.on_device_status_ready),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                )

            is OnDeviceModelUiStatus.Downloading -> {
                val fraction = if (status.totalBytes > 0) {
                    (status.bytesDownloaded.toFloat() / status.totalBytes).coerceIn(0f, 1f)
                } else {
                    null
                }
                Text(
                    downloadingLabel(status),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                if (fraction != null) {
                    LinearProgressIndicator(progress = { fraction }, modifier = Modifier.fillMaxWidth())
                } else {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
            }

            is OnDeviceModelUiStatus.Failed -> {
                Text(
                    stringResource(R.string.on_device_status_failed, status.message),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                )
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onRetry, shape = MaterialTheme.shapes.small) {
                    Text(stringResource(R.string.on_device_status_retry))
                }
            }
        }
    }
}

@Composable
private fun downloadingLabel(status: OnDeviceModelUiStatus.Downloading): String {
    val percent = if (status.totalBytes > 0) {
        ((status.bytesDownloaded.toFloat() / status.totalBytes) * 100).toInt()
    } else {
        null
    }
    val eta = status.etaSeconds?.let(::formatEta)
    return when {
        percent != null && eta != null -> stringResource(R.string.on_device_status_downloading_with_eta, percent, eta)
        percent != null -> stringResource(R.string.on_device_status_downloading_percent, percent)
        else -> stringResource(R.string.on_device_status_downloading)
    }
}

private fun formatEta(totalSeconds: Long): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return if (minutes > 0) "${minutes}m ${seconds}s" else "${seconds}s"
}

@Composable
private fun InferenceOptionRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
            .padding(vertical = 8.dp),
    ) {
        RadioButton(selected = selected, onClick = null)
        Spacer(Modifier.height(0.dp))
        Text(label, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(start = 12.dp))
    }
}
