package com.hejitech.headway.app.ui.screens

import android.content.Context
import android.content.Intent
import android.provider.Settings as SystemSettings
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hejitech.headway.app.BuildConfig
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.StatusGreen
import com.hejitech.headway.app.ui.theme.StatusGrey
import com.hejitech.headway.app.ui.theme.StatusRed
import com.hejitech.headway.core.model.AlertScope
import com.hejitech.headway.core.model.OnTrainMode

private fun openNotificationSettings(context: Context) {
    val intent = Intent(SystemSettings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(SystemSettings.EXTRA_APP_PACKAGE, context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(intent) }
}

/** The Settings tab: alerts, on-train detection, location, account, What's New, help, privacy, deleting data. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: HeadwayViewModel,
    onRideModeChosen: (OnTrainMode) -> Unit = {},
    onAskNotifications: () -> Unit = {},
    onUseLocation: (Boolean) -> Unit = {}
) {
    val context = LocalContext.current
    val settings by viewModel.settings.collectAsState()
    val email by viewModel.email.collectAsState()
    val isLocalBackend by viewModel.isLocalBackend.collectAsState()
    val notificationsAllowed by viewModel.notificationsAllowed.collectAsState()
    val alertsOn by viewModel.alertsOn.collectAsState()
    val notice by viewModel.notice.collectAsState()
    val useLocation by viewModel.useLocation.collectAsState()
    val error by viewModel.errorMessage.collectAsState()
    var whatsNew by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    val site = viewModel.apiClient.config.site

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Alerts on this phone
            item {
                FormCard {
                    Text("Alerts", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    if (!notificationsAllowed) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.NotificationsOff, contentDescription = null, tint = StatusGrey)
                            Text("Alerts are off")
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = onAskNotifications, modifier = Modifier.testTag("alerts-on")) { Text("Turn on alerts") }
                            TextButton(onClick = { openNotificationSettings(context) }) { Text("Phone settings") }
                        }
                    } else {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.NotificationsActive, contentDescription = null, tint = if (alertsOn == true) StatusGreen else StatusGrey)
                            Text(
                                when (alertsOn) {
                                    true -> "Alerts are on"
                                    false -> "Alerts aren't switched on for this phone yet"
                                    null -> "Setting up alerts for this phone…"
                                },
                                color = if (alertsOn == true) StatusGreen else MaterialTheme.colorScheme.onSurface
                            )
                        }
                        if (alertsOn == true) {
                            OutlinedButton(onClick = { viewModel.sendTestAlert() }, modifier = Modifier.testTag("test-alert")) { Text("Send a test alert") }
                        } else if (alertsOn == false) {
                            TextButton(onClick = { viewModel.registerForAlerts() }) { Text("Try again") }
                        }
                        notice?.let { Note(it) }
                    }
                    HorizontalDivider()
                    Column(modifier = Modifier.selectableGroup()) {
                        Text("Which alerts", style = MaterialTheme.typography.bodyMedium, color = StatusGrey)
                        AlertScope.entries.forEach { scope ->
                            RadioRow(scope.title, settings.alerts.scope == scope) { viewModel.setAlertScope(scope) }
                        }
                    }
                    SwitchRow("Stop once my commute is done", settings.alerts.stopWhenDone) { viewModel.setStopWhenDone(it) }
                    Note("Once your location shows you got off at your commute's stop, Headway stops that leg's delay, cancellation and leave-now alerts for the rest of the day; the Trains tab says so and can turn them back on for the day. Priority alerts affect your commute: your direction, inside your watch window, and the train you track. Priority and quiet adds delays and notices for your stations at other times or the other way; those arrive silently. Choose which kinds of alerts in the Commute tab.")
                }
            }

            // On a train
            item {
                FormCard {
                    Text("On a train", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Column(modifier = Modifier.selectableGroup()) {
                        OnTrainMode.entries.forEach { mode ->
                            RadioRow(mode.title, settings.onTrain == mode) {
                                onRideModeChosen(mode)
                                viewModel.setOnTrainMode(mode)
                            }
                        }
                    }
                    Note(settings.onTrain.detail + " Your location is only used to find the train and is never stored.")
                }
            }

            // Location for the trip estimate
            item {
                FormCard {
                    Text("Location", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    SwitchRow("Estimate my trip from where I am", useLocation) { onUseLocation(it) }
                    Note("Headway measures how far you are from your departure station and estimates the walk or drive (set per leg in Commute) at an average speed, so leave-by times and how many minutes you have to spare fit where you are. It's a rough estimate without routes or traffic. Your location goes with each board request and is never stored.")
                }
            }

            // Account
            item {
                FormCard {
                    Text("Account", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Text("Signed in as", modifier = Modifier.weight(1f))
                        Text(email ?: "—", color = StatusGrey)
                    }
                    OutlinedButton(onClick = { viewModel.signOut() }, modifier = Modifier.testTag("sign-out")) { Text("Sign out") }
                }
            }

            // About
            item {
                FormCard {
                    Text("About", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    LinkRow("What's New", external = false) { whatsNew = true }
                    LinkRow("Help") { openUrl(context, "$site/support/") }
                    LinkRow("Privacy") { openUrl(context, "$site/privacy/") }
                    LinkRow("Assistants (MCP) and web settings") { openUrl(context, "$site/settings/") }
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Text("Version", modifier = Modifier.weight(1f))
                        Text(BuildConfig.VERSION_NAME, color = StatusGrey)
                    }
                }
            }

            if (BuildConfig.DEBUG) {
                item {
                    FormCard {
                        Text("Developer", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        SwitchRow("Local dev stack", isLocalBackend) { viewModel.setBackendMode(it) }
                        Note("Debug builds only. Switching signs you out: a session belongs to one backend.")
                    }
                }
            }

            // Deleting data
            item {
                FormCard {
                    TextButton(onClick = { confirmDelete = true }, modifier = Modifier.testTag("delete-data")) { Text("Delete my Headway data", color = StatusRed) }
                    Note("Removes your commute, alert choices, paired glasses, phones, your family group (or your place in one) and assistant connections from Headway. Headway isn't affiliated with Caltrain.")
                }
            }

            error?.let { item { Text(it, color = StatusRed, style = MaterialTheme.typography.bodySmall) } }
            item { Spacer(modifier = Modifier.height(20.dp)) }
        }
    }

    if (whatsNew) WhatsNewDialog(onDismiss = { whatsNew = false })

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete everything Headway keeps about you?") },
            text = { Text("Your commute, alert choices, paired glasses and family group are removed and you're signed out. Your sign-in for other HEJI apps stays.") },
            confirmButton = { TextButton(onClick = { confirmDelete = false; viewModel.deleteData() }) { Text("Delete", color = StatusRed) } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } }
        )
    }
}

@Composable
private fun RadioRow(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().selectable(selected = selected, role = Role.RadioButton, onClick = onClick).padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        RadioButton(selected = selected, onClick = null)
        Spacer(modifier = Modifier.width(10.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun LinkRow(label: String, external: Boolean = true, onClick: () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.secondary)
        if (external) Icon(Icons.AutoMirrored.Filled.OpenInNew, contentDescription = null, tint = StatusGrey, modifier = Modifier.size(16.dp))
    }
}
