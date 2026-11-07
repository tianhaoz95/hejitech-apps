package com.hejitech.headway.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.*
import com.hejitech.headway.core.model.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BoardScreen(viewModel: HeadwayViewModel) {
    val board by viewModel.board.collectAsState()
    val tracked by viewModel.tracked.collectAsState()
    val onTrain by viewModel.onTrain.collectAsState()
    val fromStation by viewModel.selectedFrom.collectAsState()
    val toStation by viewModel.selectedTo.collectAsState()
    val stations by viewModel.stations.collectAsState()
    val expressPref by viewModel.expressPreference.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    var showFromPicker by remember { mutableStateOf(false) }
    var showToPicker by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier
                                .weight(1f)
                                .clickable { showFromPicker = true }
                        ) {
                            Text(
                                fromStation.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }

                        IconButton(onClick = { viewModel.flipStations() }) {
                            Icon(Icons.Default.SwapHoriz, contentDescription = "Flip directions")
                        }

                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier
                                .weight(1f)
                                .clickable { showToPicker = true }
                        ) {
                            Text(
                                toStation.name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                    }
                },
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
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Express filter segmented row
            item {
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                    SegmentedButton(
                        selected = expressPref == ExpressPreference.ALL,
                        onClick = { viewModel.setExpressPreference(ExpressPreference.ALL) },
                        shape = SegmentedButtonDefaults.itemShape(index = 0, count = 3)
                    ) {
                        Text("All")
                    }
                    SegmentedButton(
                        selected = expressPref == ExpressPreference.PREFER_EXPRESS,
                        onClick = { viewModel.setExpressPreference(ExpressPreference.PREFER_EXPRESS) },
                        shape = SegmentedButtonDefaults.itemShape(index = 1, count = 3)
                    ) {
                        Text("Prefer EXP")
                    }
                    SegmentedButton(
                        selected = expressPref == ExpressPreference.EXPRESS_ONLY,
                        onClick = { viewModel.setExpressPreference(ExpressPreference.EXPRESS_ONLY) },
                        shape = SegmentedButtonDefaults.itemShape(index = 2, count = 3)
                    ) {
                        Text("EXP Only")
                    }
                }
            }

            // The train your location shows you riding
            onTrain?.let { ride ->
                item {
                    OnTrainBanner(
                        card = ride,
                        onTrack = { stop -> viewModel.trackOnTrain(stop) },
                        onDismiss = { viewModel.dismissOnTrain() }
                    )
                }
            }

            // Tracked train banner (if active)
            tracked?.let { tr ->
                item {
                    TrackedBanner(
                        tracked = tr,
                        onUntrack = { viewModel.untrackTrain() }
                    )
                }
            }

            // Error banner if any
            errorMessage?.let { err ->
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            err,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.padding(12.dp),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }

            // Caltrain service alerts
            val alerts = board?.alerts ?: emptyList()
            if (alerts.isNotEmpty()) {
                item {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("Caltrain Alerts", style = MaterialTheme.typography.titleSmall, color = StatusAmber)
                        alerts.forEach { alert ->
                            Card(
                                colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
                                    Icon(Icons.Default.Warning, contentDescription = null, tint = StatusAmber, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(alert.header, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                        if (alert.description.isNotBlank() && alert.description != alert.header) {
                                            Text(alert.description, style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Train departure list
            val trains = board?.trains ?: emptyList()
            if (trains.isNotEmpty()) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Upcoming Trains", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            if (board?.live == true) "● Live predictions" else "Timetable only",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (board?.live == true) StatusGreen else StatusGrey
                        )
                    }
                }

                items(trains, key = { it.id }) { train ->
                    val isBeingTracked = tracked?.tripId == train.tripId
                    TrainCard(
                        train = train,
                        isTracked = isBeingTracked,
                        onTrack = { viewModel.trackTrain(train) }
                    )
                }
            } else if (!isLoading) {
                item {
                    Box(modifier = Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) {
                        Text("No upcoming trains found for today.", color = Color.Gray)
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(16.dp)) }
        }
    }

    if (showFromPicker) {
        StationPickerDialog(
            title = "Departing Station",
            stations = stations,
            selectedStation = fromStation,
            onStationSelected = { viewModel.setStations(it, toStation) },
            onDismiss = { showFromPicker = false }
        )
    }

    if (showToPicker) {
        StationPickerDialog(
            title = "Destination Station",
            stations = stations,
            selectedStation = toStation,
            onStationSelected = { viewModel.setStations(fromStation, it) },
            onDismiss = { showToPicker = false }
        )
    }
}

@Composable
fun TrackedBanner(
    tracked: TrackedWithProgress,
    onUntrack: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(StatusGreen)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        "Tracking Train #${tracked.progress.train}",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                TextButton(onClick = onUntrack) {
                    Text("Stop", color = Color.Gray, style = MaterialTheme.typography.labelMedium)
                }
            }

            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Next Stop", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                    Text(
                        tracked.progress.next?.name ?: "In transit",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Destination Arrival", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                    Text(
                        Clock.time(tracked.progress.predArr),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                "${tracked.progress.stopsLeft} stops remaining",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
fun TrainCard(
    train: BoardTrain,
    isTracked: Boolean,
    onTrack: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (isTracked) DarkSurfaceVariant else DarkSurface
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Departure time column
            Column(modifier = Modifier.width(90.dp)) {
                Text(
                    Clock.time(train.predDep),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    if (train.pastDue) train.dueLabel() else Clock.until(train.predDep),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Details column
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Train badge
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = when (train.kind) {
                            "EXP" -> CaltrainRed
                            "LTD" -> Color(0xFF1976D2)
                            else -> Color(0xFF555555)
                        }
                    ) {
                        Text(
                            train.kindName,
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Spacer(modifier = Modifier.width(6.dp))

                    Text(
                        "#${train.train}",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = Color.LightGray
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Status pill
                val statusColor = when (train.status) {
                    TrainStatus.ON_TIME -> StatusGreen
                    TrainStatus.LATE -> StatusAmber
                    TrainStatus.CANCELLED -> StatusRed
                    else -> StatusGrey
                }

                val delayMin = train.delayMin
                val statusText = when {
                    train.status == TrainStatus.CANCELLED -> "CANCELLED"
                    delayMin != null && delayMin > 0 -> "+${delayMin}m late"
                    train.status == TrainStatus.ON_TIME -> "On Time"
                    else -> train.status.displayTitle
                }

                Text(
                    statusText,
                    style = MaterialTheme.typography.labelSmall,
                    color = statusColor,
                    fontWeight = FontWeight.SemiBold
                )
            }

            // Track button
            IconButton(
                onClick = onTrack,
                colors = IconButtonDefaults.iconButtonColors(
                    contentColor = if (isTracked) CaltrainRed else Color.Gray
                )
            ) {
                Icon(
                    if (isTracked) Icons.Default.LocationOn else Icons.Default.AddLocation,
                    contentDescription = "Track train"
                )
            }
        }
    }
}

/** Shown once your location says you're riding: what's next on this train, not when to leave for one. */
@Composable
fun OnTrainBanner(card: OnTrainCard, onTrack: (String?) -> Unit, onDismiss: () -> Unit) {
    var pickStop by remember { mutableStateOf(false) }
    Card(
        colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.DirectionsTransit, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    if (card.isSure) "On train ${card.train}" else "Looks like train ${card.train}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(card.kindName, style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                Spacer(modifier = Modifier.weight(1f))
                card.delayMin?.let { d ->
                    Text(
                        if (d >= 2) "$d min late" else if (d <= -2) "${-d} min early" else "On time",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (d >= 2) StatusAmber else StatusGreen
                    )
                }
            }
            card.next?.takeIf { it.id != card.to.id }?.let { next ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Next stop ${next.name}", style = MaterialTheme.typography.bodyMedium)
                    Text(Clock.time(next.pred), style = MaterialTheme.typography.bodyMedium)
                }
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(card.to.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(Clock.time(card.predArr), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            }
            val left = maxOf(0, card.stopsLeft - 1)
            val stops = if (left == 0) "your stop is next" else "$left stop${if (left == 1) "" else "s"} before yours"
            Text(
                "In ${Clock.until(card.predArr)} · $stops${if (card.toSource == "terminal") " · end of the line" else ""}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray
            )
            card.alerts.take(2).forEach { a ->
                Text(a.header, style = MaterialTheme.typography.bodySmall, color = StatusAmber)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (card.tracked) {
                    Text("Tracking", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                } else {
                    Button(onClick = { onTrack(null) }) { Text("Track") }
                }
                Box {
                    OutlinedButton(onClick = { pickStop = true }) { Text("Getting off at") }
                    DropdownMenu(expanded = pickStop, onDismissRequest = { pickStop = false }) {
                        card.stops.filter { it.status != "done" }.forEach { s ->
                            DropdownMenuItem(text = { Text(s.name) }, onClick = {
                                pickStop = false
                                onTrack(s.id)
                            })
                        }
                    }
                }
                Spacer(modifier = Modifier.weight(1f))
                if (!card.tracked) TextButton(onClick = onDismiss) { Text("Not on it") }
            }
        }
    }
}
