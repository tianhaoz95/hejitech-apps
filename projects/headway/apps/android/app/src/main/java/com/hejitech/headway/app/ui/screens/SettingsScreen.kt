package com.hejitech.headway.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Login
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.DarkSurface
import com.hejitech.headway.app.ui.theme.StatusRed
import com.hejitech.headway.core.model.AlertScope
import com.hejitech.headway.core.model.OnTrainMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: HeadwayViewModel, onRideModeChosen: (OnTrainMode) -> Unit = {}, onAskNotifications: () -> Unit = {}) {
    val settings by viewModel.settings.collectAsState()
    val isLocalBackend by viewModel.isLocalBackend.collectAsState()
    val alertsOn by viewModel.alertsOn.collectAsState()
    val notice by viewModel.notice.collectAsState()
    val session = viewModel.apiClient.session
    var showWhatsNewDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Account card
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Account", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))

                        if (session != null) {
                            Text("Signed in as: ${session.email ?: session.userId}", style = MaterialTheme.typography.bodyMedium)
                            Spacer(modifier = Modifier.height(12.dp))
                            OutlinedButton(
                                onClick = { viewModel.signOut() },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.LightGray)
                            ) {
                                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Sign Out")
                            }
                        } else {
                            Text("Signed out (Public Timetable Mode)", style = MaterialTheme.typography.bodyMedium, color = Color.Gray)
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(onClick = { onAskNotifications(); viewModel.signInDebug() }) {
                                Icon(Icons.AutoMirrored.Filled.Login, contentDescription = null)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Sign In (Rider Account)")
                            }
                        }
                    }
                }
            }

            // On a train
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp).selectableGroup()) {
                        Text("On a train", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        OnTrainMode.entries.forEach { mode ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .selectable(
                                        selected = settings.onTrain == mode,
                                        role = Role.RadioButton,
                                        onClick = {
                                            onRideModeChosen(mode)
                                            viewModel.setOnTrainMode(mode)
                                        }
                                    )
                                    .padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(selected = settings.onTrain == mode, onClick = null)
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(mode.title, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        Text(
                            settings.onTrain.detail + " Your location is only used to find the train and is never stored.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.LightGray
                        )
                    }
                }
            }

            // Which notifications
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp).selectableGroup()) {
                        Text("Which alerts", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        AlertScope.entries.forEach { scope ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .selectable(
                                        selected = settings.alerts.scope == scope,
                                        role = Role.RadioButton,
                                        onClick = { viewModel.setAlertScope(scope) }
                                    )
                                    .padding(vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(selected = settings.alerts.scope == scope, onClick = null)
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(scope.title, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        Text(
                            "Priority alerts affect your commute: your direction, inside your watch window, and the train you track. Priority and quiet adds delays and notices for your stations at other times or the other way, silently. Alerts arrive on every phone signed in to the same account.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.LightGray
                        )
                        if (session != null) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                when (alertsOn) {
                                    true -> "This phone gets alerts."
                                    false -> "Alerts aren't switched on for this phone yet."
                                    null -> "Setting up alerts for this phone…"
                                },
                                style = MaterialTheme.typography.bodyMedium
                            )
                            if (alertsOn == true) {
                                Spacer(modifier = Modifier.height(8.dp))
                                OutlinedButton(onClick = { onAskNotifications(); viewModel.sendTestAlert() }) { Text("Send a test alert") }
                            }
                            notice?.let {
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(it, style = MaterialTheme.typography.bodySmall, color = Color.LightGray)
                            }
                        }
                    }
                }
            }

            // Developer / Backend environment switcher
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Backend Server", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(if (isLocalBackend) "Local Dev Stack (this computer, port 8792)" else "Production (headway.hejitech.workers.dev)")
                                Text("Toggle between local dev worker and hosted production.", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                            }
                            Switch(
                                checked = isLocalBackend,
                                onCheckedChange = { viewModel.setBackendMode(it) }
                            )
                        }
                    }
                }
            }

            // What's New & App info
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("About Headway", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "Headway provides real-time Caltrain departure predictions, commute alerts, and trip tracking across Even G2 smart glasses, Android, and Wear OS.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.LightGray
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        TextButton(onClick = { showWhatsNewDialog = true }) {
                            Icon(Icons.Default.Info, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("What's New in v0.1.0")
                        }
                    }
                }
            }

            // Danger zone
            if (session != null) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = DarkSurface),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("Danger Zone", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = StatusRed)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Delete your commute preferences, paired glasses, and alert settings from the server.", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                            Spacer(modifier = Modifier.height(12.dp))
                            OutlinedButton(
                                onClick = { viewModel.deleteAccount() },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusRed)
                            ) {
                                Text("Delete My Headway Data")
                            }
                        }
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(20.dp)) }
        }
    }

    if (showWhatsNewDialog) {
        AlertDialog(
            onDismissRequest = { showWhatsNewDialog = false },
            title = { Text("What's New in Headway") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("• Android & Wear OS companion app launched!", fontWeight = FontWeight.SemiBold)
                    Text("• Live Caltrain departure predictions merged with official timetable.")
                    Text("• Trip tracking with countdown and remaining stops.")
                    Text("• Even G2 smart glasses pairing and status synchronization.")
                    Text("• Wear OS Tile and Watch Face Complication for instant wrist glance.")
                }
            },
            confirmButton = {
                TextButton(onClick = { showWhatsNewDialog = false }) {
                    Text("Got it")
                }
            }
        )
    }
}
