package com.hejitech.headway.wear

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.AutoCenteringParams
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*
import com.hejitech.headway.core.model.*

val WearCaltrainRed = Color(0xFFE31837)
val WearStatusGreen = Color(0xFF4CAF50)
val WearStatusAmber = Color(0xFFFF9800)
val WearStatusRed = Color(0xFFF44336)
val WearSurface = Color(0xFF1C1C1E)

val WearColors = Colors(
    primary = WearCaltrainRed,
    primaryVariant = Color(0xFFB31027),
    secondary = Color(0xFFFF5252),
    background = Color.Black,
    surface = WearSurface,
    onPrimary = Color.White,
    onSecondary = Color.Black,
    onBackground = Color.White,
    onSurface = Color.White
)

@Composable
fun WearApp(viewModel: WearViewModel) {
    MaterialTheme(colors = WearColors) {
        Scaffold(
            timeText = { TimeText() },
            vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) }
        ) {
            val syncState by viewModel.syncState.collectAsState()
            val board = syncState?.board
            val tracked = syncState?.tracked
            val isLoading by viewModel.isLoading.collectAsState()

            val listState = rememberScalingLazyListState()

            ScalingLazyColumn(
                modifier = Modifier.fillMaxSize(),
                state = listState,
                contentPadding = PaddingValues(top = 28.dp, bottom = 28.dp, start = 10.dp, end = 10.dp),
                autoCentering = AutoCenteringParams(itemIndex = 0)
            ) {
                // Header item: Station Route + Flip button
                item {
                    val fromShort = board?.from?.short ?: "MTN VIEW"
                    val toShort = board?.to?.short ?: "SF"
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "$fromShort → $toShort",
                            style = MaterialTheme.typography.caption1,
                            fontWeight = FontWeight.Bold,
                            color = WearCaltrainRed
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        CompactButton(
                            onClick = { viewModel.flipStations() },
                            modifier = Modifier.size(24.dp),
                            colors = ButtonDefaults.buttonColors(backgroundColor = WearSurface)
                        ) {
                            Text("⇄", fontSize = 12.sp, color = Color.White)
                        }
                    }
                }

                // Active tracked train card
                if (tracked != null) {
                    item {
                        Card(
                            onClick = { viewModel.untrackTrain() },
                            modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                            backgroundPainter = CardDefaults.cardBackgroundPainter(
                                startBackgroundColor = Color(0xFF2C1014),
                                endBackgroundColor = Color(0xFF2C1014)
                            )
                        ) {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .size(6.dp)
                                                .clip(CircleShape)
                                                .background(WearStatusGreen)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text(
                                            "#${tracked.progress.train}",
                                            style = MaterialTheme.typography.caption2,
                                            fontWeight = FontWeight.Bold,
                                            color = WearCaltrainRed
                                        )
                                    }
                                    Text(
                                        Clock.time(tracked.progress.predArr),
                                        style = MaterialTheme.typography.caption2,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Text(
                                    "Next: ${tracked.progress.next?.short ?: "In transit"}",
                                    style = MaterialTheme.typography.caption2,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    "${tracked.progress.stopsLeft} stops left · Tap to stop",
                                    style = MaterialTheme.typography.caption3,
                                    color = Color.Gray
                                )
                            }
                        }
                    }
                }

                // Train items
                val trains = board?.trains ?: emptyList()
                if (trains.isNotEmpty()) {
                    items(trains.size) { index ->
                        val train = trains[index]
                        val isTracked = tracked?.tripId == train.tripId
                        WearTrainCard(
                            train = train,
                            isTracked = isTracked,
                            onTrack = { viewModel.trackTrain(train) }
                        )
                    }
                } else if (!isLoading) {
                    item {
                        Text(
                            text = "No trains scheduled",
                            style = MaterialTheme.typography.caption2,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            color = Color.Gray
                        )
                    }
                }

                // Refresh chip
                item {
                    CompactChip(
                        onClick = { viewModel.refresh() },
                        label = {
                            Text(
                                if (isLoading) "Updating..." else "Refresh",
                                style = MaterialTheme.typography.caption2
                            )
                        },
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                        colors = ChipDefaults.chipColors(backgroundColor = WearSurface)
                    )
                }
            }
        }
    }
}

@Composable
fun WearTrainCard(
    train: BoardTrain,
    isTracked: Boolean,
    onTrack: () -> Unit
) {
    val delayMin = train.delayMin
    val statusColor = when {
        train.status == TrainStatus.CANCELLED -> WearStatusRed
        delayMin != null && delayMin > 0 -> WearStatusAmber
        train.status == TrainStatus.ON_TIME -> WearStatusGreen
        else -> Color.Gray
    }

    val statusText = when {
        train.status == TrainStatus.CANCELLED -> "CANC"
        delayMin != null && delayMin > 0 -> "+${delayMin}m"
        train.status == TrainStatus.ON_TIME -> "On Time"
        else -> train.status.displayTitle
    }

    Card(
        onClick = onTrack,
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        backgroundPainter = CardDefaults.cardBackgroundPainter(
            startBackgroundColor = if (isTracked) Color(0xFF2E2224) else WearSurface,
            endBackgroundColor = if (isTracked) Color(0xFF2E2224) else WearSurface
        )
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        Clock.time(train.predDep),
                        style = MaterialTheme.typography.title3,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        Clock.until(train.predDep),
                        style = MaterialTheme.typography.caption2,
                        color = WearCaltrainRed,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Text(
                    "#${train.train} ${train.kind}",
                    style = MaterialTheme.typography.caption3,
                    color = Color.LightGray
                )
            }

            Text(
                statusText,
                style = MaterialTheme.typography.caption2,
                color = statusColor,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
