package com.hejitech.headway.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.DarkSurface
import com.hejitech.headway.app.ui.theme.DarkSurfaceVariant

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlassesScreen(viewModel: HeadwayViewModel) {
    val pairingCode by viewModel.pairingCode.collectAsState()
    val pairedDevices by viewModel.pairedDevices.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadDevices()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Even G2 Glasses", fontWeight = FontWeight.Bold) },
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
            // Hero card
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            "Pair Your Smart Glasses",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            "Generate a 6-digit code here and enter it on your Even G2 glasses to sync your commute board and enable R1 ring trip tracking.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.Gray
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        if (pairingCode != null) {
                            val code = pairingCode!!.code
                            val formattedCode = if (code.length == 6) "${code.substring(0, 3)} ${code.substring(3)}" else code
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = DarkSurfaceVariant,
                                modifier = Modifier.padding(vertical = 8.dp)
                            ) {
                                Text(
                                    formattedCode,
                                    style = MaterialTheme.typography.headlineLarge.copy(
                                        fontFamily = FontFamily.Monospace,
                                        letterSpacing = 6.sp,
                                        fontWeight = FontWeight.Bold
                                    ),
                                    color = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)
                                )
                            }
                            Text(
                                "Expires in 10 minutes",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color.Gray
                            )
                        } else {
                            Button(
                                onClick = { viewModel.generatePairingCode() },
                                shape = RoundedCornerShape(8.dp),
                                enabled = !isLoading
                            ) {
                                Icon(Icons.Default.Key, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Generate Pairing Code")
                            }
                        }
                    }
                }
            }

            // Paired devices section
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Paired Devices", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    IconButton(onClick = { viewModel.loadDevices() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh devices")
                    }
                }
            }

            if (pairedDevices.isNotEmpty()) {
                items(pairedDevices, key = { it.id }) { device ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = DarkSurface),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(device.label.ifBlank { "Even G2 Glasses" }, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                                Text("Paired: ${device.createdAt.take(10)}", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                            }
                            IconButton(onClick = { viewModel.unpairDevice(device.id) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Unpair", tint = Color.Gray)
                            }
                        }
                    }
                }
            } else {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp), contentAlignment = Alignment.Center) {
                        Text("No glasses paired yet.", color = Color.Gray)
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(20.dp)) }
        }
    }
}
