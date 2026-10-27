package com.hejitech.headway.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.DarkSurface
import com.hejitech.headway.core.model.AlertSettings
import com.hejitech.headway.core.model.CaltrainStations
import com.hejitech.headway.core.model.Leg
import com.hejitech.headway.core.model.Settings
import com.hejitech.headway.core.model.Station

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommuteScreen(viewModel: HeadwayViewModel) {
    val settings by viewModel.settings.collectAsState()
    val stations by viewModel.stations.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    var morningFrom by remember(settings) {
        mutableStateOf(CaltrainStations.findById(settings.morning?.from ?: "mountain_view") ?: stations.first())
    }
    var morningTo by remember(settings) {
        mutableStateOf(CaltrainStations.findById(settings.morning?.to ?: "san_francisco") ?: stations.last())
    }
    var eveningFrom by remember(settings) {
        mutableStateOf(CaltrainStations.findById(settings.evening?.from ?: "san_francisco") ?: stations.last())
    }
    var eveningTo by remember(settings) {
        mutableStateOf(CaltrainStations.findById(settings.evening?.to ?: "mountain_view") ?: stations.first())
    }

    var delayAlert by remember(settings) { mutableStateOf(settings.alerts.delay) }
    var cancellationAlert by remember(settings) { mutableStateOf(settings.alerts.cancellation) }
    var serviceAlert by remember(settings) { mutableStateOf(settings.alerts.service) }
    var leaveNowAlert by remember(settings) { mutableStateOf(settings.alerts.leaveNow) }
    var arrivalAlert by remember(settings) { mutableStateOf(settings.alerts.arrival) }

    var showPickerStationFor by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Commute Setup", fontWeight = FontWeight.Bold) },
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
            // Morning Commute Card
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Morning Commute", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("Window: 06:00 – 10:30", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                        Spacer(modifier = Modifier.height(12.dp))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { showPickerStationFor = "morningFrom" },
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(horizontalAlignment = Alignment.Start) {
                                    Text("From", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                                    Text(morningFrom.name, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                                }
                            }
                            OutlinedButton(
                                onClick = { showPickerStationFor = "morningTo" },
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(horizontalAlignment = Alignment.Start) {
                                    Text("To", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                                    Text(morningTo.name, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                                }
                            }
                        }
                    }
                }
            }

            // Evening Commute Card
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Evening Commute", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("Window: 15:30 – 20:00", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                        Spacer(modifier = Modifier.height(12.dp))

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { showPickerStationFor = "eveningFrom" },
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(horizontalAlignment = Alignment.Start) {
                                    Text("From", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                                    Text(eveningFrom.name, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                                }
                            }
                            OutlinedButton(
                                onClick = { showPickerStationFor = "eveningTo" },
                                modifier = Modifier.weight(1f)
                            ) {
                                Column(horizontalAlignment = Alignment.Start) {
                                    Text("To", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                                    Text(eveningTo.name, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                                }
                            }
                        }
                    }
                }
            }

            // Notifications & Alerts Card
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Alerts & Notifications", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Delays (≥ 5 min)")
                            Switch(checked = delayAlert, onCheckedChange = { delayAlert = it })
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Cancellations")
                            Switch(checked = cancellationAlert, onCheckedChange = { cancellationAlert = it })
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Caltrain Service Bulletins")
                            Switch(checked = serviceAlert, onCheckedChange = { serviceAlert = it })
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Leave Now Reminder")
                            Switch(checked = leaveNowAlert, onCheckedChange = { leaveNowAlert = it })
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Destination Arrival Alert")
                            Switch(checked = arrivalAlert, onCheckedChange = { arrivalAlert = it })
                        }
                    }
                }
            }

            // Save Button
            item {
                Button(
                    onClick = {
                        val newSettings = settings.copy(
                            morning = Leg.morning(morningFrom.id, morningTo.id),
                            evening = Leg.evening(eveningFrom.id, eveningTo.id),
                            alerts = AlertSettings(
                                delay = delayAlert,
                                cancellation = cancellationAlert,
                                service = serviceAlert,
                                leaveNow = leaveNowAlert,
                                arrival = arrivalAlert
                            )
                        )
                        viewModel.saveSettings(newSettings)
                    },
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !isLoading
                ) {
                    Icon(Icons.Default.Save, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (isLoading) "Saving..." else "Save Commute Settings", fontWeight = FontWeight.Bold)
                }
            }

            item { Spacer(modifier = Modifier.height(20.dp)) }
        }
    }

    // Station picker sheet
    showPickerStationFor?.let { key ->
        val currentStation = when (key) {
            "morningFrom" -> morningFrom
            "morningTo" -> morningTo
            "eveningFrom" -> eveningFrom
            else -> eveningTo
        }
        StationPickerDialog(
            title = "Select Station",
            stations = stations,
            selectedStation = currentStation,
            onStationSelected = { station ->
                when (key) {
                    "morningFrom" -> morningFrom = station
                    "morningTo" -> morningTo = station
                    "eveningFrom" -> eveningFrom = station
                    "eveningTo" -> eveningTo = station
                }
            },
            onDismiss = { showPickerStationFor = null }
        )
    }
}
