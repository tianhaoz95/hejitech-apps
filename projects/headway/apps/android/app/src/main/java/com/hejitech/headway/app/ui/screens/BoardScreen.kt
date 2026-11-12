package com.hejitech.headway.app.ui.screens

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.DirectionsWalk
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.*
import com.hejitech.headway.core.model.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale
import kotlin.math.floor
import kotlin.math.roundToInt

private enum class BoardSort(val title: String) { LEAVING("Leaving"), ARRIVING("Arriving") }

private val StatusBlue = Color(0xFF64B5F6)

/**
 * The Trains tab: the commute for the time of day (or a pair picked here), when to leave, the next
 * trains with live delays, Caltrain's alerts, and the tracked train.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BoardScreen(viewModel: HeadwayViewModel) {
    val board by viewModel.board.collectAsState()
    val tracked by viewModel.tracked.collectAsState()
    val onTrain by viewModel.onTrain.collectAsState()
    val commuteDone by viewModel.commuteDone.collectAsState()
    val hasCommute by viewModel.hasCommute.collectAsState()
    val customPair by viewModel.customPair.collectAsState()
    val stations by viewModel.stations.collectAsState()
    val expressPref by viewModel.expressPreference.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    var picking by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var expressMenu by remember { mutableStateOf(false) }
    var sort by remember { mutableStateOf(BoardSort.LEAVING) }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    // A card that appears above the board (tracking, on a train, commute done) would otherwise land
    // off-screen: the list keeps its place by the row that was first.
    LaunchedEffect(tracked?.tripId, onTrain?.tripId, commuteDone != null) { listState.animateScrollToItem(0) }

    // Countdowns move on between refreshes.
    val now by produceState(Clock.now(), board) {
        while (true) {
            value = Clock.now()
            delay(15_000)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        board?.let { "${it.from.name} → ${it.to.name}" } ?: "Trains",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                actions = {
                    IconButton(onClick = { viewModel.flip() }, enabled = board != null) {
                        Icon(Icons.Default.SwapVert, contentDescription = "Flip direction")
                    }
                    Box {
                        IconButton(onClick = { menu = true }) { Icon(Icons.Default.MoreVert, contentDescription = "Stations") }
                        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                            if (customPair != null && hasCommute) {
                                DropdownMenuItem(
                                    text = { Text("My commute") },
                                    leadingIcon = { Icon(Icons.Default.Home, contentDescription = null) },
                                    onClick = { menu = false; viewModel.showCommute() }
                                )
                            }
                            DropdownMenuItem(
                                text = { Text("Pick stations") },
                                leadingIcon = { Icon(Icons.Default.Place, contentDescription = null) },
                                onClick = { menu = false; picking = true }
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = {
                scope.launch {
                    refreshing = true
                    viewModel.refreshAndWait()
                    refreshing = false
                }
            },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                onTrain?.let { ride ->
                    item(key = "on-train") {
                        OnTrainBanner(card = ride, onTrack = { stop -> viewModel.trackOnTrain(stop) }, onDismiss = { viewModel.dismissOnTrain() })
                    }
                }
                commuteDone?.let { done ->
                    item(key = "commute-done") { CommuteDoneCardView(done, onResume = { viewModel.resumeCommuteAlerts() }) }
                }
                tracked?.let { tr ->
                    item(key = "tracked") {
                        TrackedBanner(
                            tracked = tr,
                            now = now,
                            // The on-train card above already says where this train is: only what you can do about it.
                            compact = onTrain?.tripId == tr.tripId,
                            onShare = { done -> viewModel.shareEta(done) },
                            onUntrack = { viewModel.untrackTrain() }
                        )
                    }
                }

                val b = board
                if (b != null) {
                    // On the train (detected, or the tracked one has left your station), when to leave for one is beside the point.
                    val riding = onTrain != null || tracked?.progress?.riding == true
                    if (!riding) {
                        b.tip?.let { tip -> item(key = "tip") { InsightBanner(tip) } }
                        b.walkMinutes?.let { walk -> if (catchTarget(b) != null) item(key = "catch") { CatchCard(b, walk, now) } }
                    }

                    item(key = "header") {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    when (b.leg) { "custom" -> "Next trains"; "morning" -> "Morning commute"; else -> "Evening commute" },
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1f)
                                )
                                Pill(if (b.live) "LIVE" else "TIMETABLE", if (b.live) StatusGreen else StatusGrey)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                SingleChoiceSegmentedButtonRow(modifier = Modifier.weight(1f)) {
                                    BoardSort.entries.forEachIndexed { i, s ->
                                        SegmentedButton(
                                            selected = sort == s,
                                            onClick = { sort = s },
                                            shape = SegmentedButtonDefaults.itemShape(index = i, count = BoardSort.entries.size)
                                        ) { Text(s.title) }
                                    }
                                }
                                Box {
                                    OutlinedButton(onClick = { expressMenu = true }) {
                                        Text(expressPref.title, maxLines = 1)
                                        Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                                    }
                                    DropdownMenu(expanded = expressMenu, onDismissRequest = { expressMenu = false }) {
                                        ExpressPreference.entries.forEach { pref ->
                                            DropdownMenuItem(text = { Text(pref.title) }, onClick = { expressMenu = false; viewModel.setExpressPreference(pref) })
                                        }
                                    }
                                }
                            }
                        }
                    }

                    val trains = when (sort) {
                        BoardSort.LEAVING -> b.trains
                        // Cancelled trains go last: they don't arrive.
                        BoardSort.ARRIVING -> b.trains.sortedWith(compareBy<BoardTrain> { it.status == TrainStatus.CANCELLED }.thenBy { it.predArr })
                    }
                    items(trains, key = { it.id }) { train ->
                        TrainCard(
                            train = train,
                            destinationShort = b.to.short,
                            now = now,
                            isTracked = tracked?.tripId == train.tripId,
                            onTrack = { viewModel.trackTrain(train) }
                        )
                    }
                    if (b.trains.isEmpty()) {
                        item(key = "empty") {
                            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    if (expressPref == ExpressPreference.EXPRESS_ONLY) "No express trains scheduled today for this route." else "No more trains today.",
                                    color = StatusGrey
                                )
                                if (expressPref == ExpressPreference.EXPRESS_ONLY) {
                                    TextButton(onClick = { viewModel.setExpressPreference(ExpressPreference.ALL) }) { Text("Show all trains") }
                                }
                            }
                        }
                    }
                    item(key = "footer") {
                        Text(
                            if (b.live) "Ride times and leave-by use live Caltrain feeds. A train is overtaken when a later departure reaches your destination first."
                            else "No fresh live data: these are timetable times.",
                            style = MaterialTheme.typography.bodySmall,
                            color = StatusGrey
                        )
                    }

                    if (b.alerts.isNotEmpty()) {
                        item(key = "alerts") {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Caltrain alerts", style = MaterialTheme.typography.titleSmall, color = StatusGrey)
                                b.alerts.forEach { alert ->
                                    Card(colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant), modifier = Modifier.fillMaxWidth()) {
                                        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
                                            Icon(Icons.Default.Warning, contentDescription = null, tint = StatusAmber, modifier = Modifier.size(20.dp))
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Column {
                                                Text(alert.header, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = StatusAmber)
                                                if (alert.description.isNotBlank() && alert.description != alert.header) {
                                                    Text(alert.description, style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else if (!hasCommute && !isLoading) {
                    item(key = "no-commute") {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(Icons.Default.DirectionsTransit, contentDescription = null, tint = StatusGrey, modifier = Modifier.size(44.dp))
                            Text("No commute yet", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            Text(
                                "Save your morning and evening stations in the Commute tab, or pick two stations to see their trains.",
                                color = StatusGrey, textAlign = TextAlign.Center
                            )
                            Button(onClick = { picking = true }) { Text("Pick stations") }
                        }
                    }
                } else if (isLoading) {
                    item(key = "loading") {
                        Box(modifier = Modifier.fillMaxWidth().padding(vertical = 48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                    }
                }

                errorMessage?.let { err ->
                    item(key = "error") { Text(err, color = StatusRed, style = MaterialTheme.typography.bodySmall) }
                }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }

    if (picking) {
        PairPickerDialog(
            stations = stations,
            from = board?.from?.id ?: CaltrainStations.defaultMorningFrom.id,
            to = board?.to?.id ?: CaltrainStations.defaultMorningTo.id,
            onShow = { from, to -> picking = false; viewModel.show(from, to) },
            onDismiss = { picking = false }
        )
    }
}

@Composable
private fun Pill(text: String, color: Color, heavy: Boolean = true) {
    Text(
        text,
        color = color,
        fontSize = 10.sp,
        fontWeight = if (heavy) FontWeight.Bold else FontWeight.Medium,
        maxLines = 1,
        softWrap = false,
        modifier = Modifier.background(color.copy(alpha = 0.18f), RoundedCornerShape(50)).padding(horizontal = 6.dp, vertical = 2.dp)
    )
}

/** Two stations to look at instead of the commute. */
@Composable
fun PairPickerDialog(stations: List<Station>, from: String, to: String, onShow: (String, String) -> Unit, onDismiss: () -> Unit) {
    var fromId by remember { mutableStateOf(from) }
    var toId by remember { mutableStateOf(to) }
    var pick by remember { mutableStateOf<String?>(null) }
    val name = { id: String -> stations.firstOrNull { it.id == id }?.name ?: id }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Pick stations") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                StationField("From", name(fromId)) { pick = "from" }
                StationField("To", name(toId)) { pick = "to" }
                if (fromId == toId) Text("Pick two different stations.", color = StatusRed, style = MaterialTheme.typography.bodySmall)
            }
        },
        confirmButton = { TextButton(enabled = fromId != toId, onClick = { onShow(fromId, toId) }) { Text("Show") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } }
    )

    pick?.let { which ->
        StationPickerDialog(
            title = if (which == "from") "From" else "To",
            stations = stations,
            selectedStation = stations.firstOrNull { it.id == (if (which == "from") fromId else toId) } ?: stations.first(),
            onStationSelected = { if (which == "from") fromId = it.id else toId = it.id },
            onDismiss = { pick = null }
        )
    }
}

/** A labelled row that opens the station list. */
@Composable
fun StationField(label: String, value: String, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp)) {
        Text(label, color = StatusGrey, modifier = Modifier.width(52.dp))
        Text(value, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        Icon(Icons.Default.ArrowDropDown, contentDescription = null)
    }
}

/** A later express that gets you there sooner than the delayed train before it. */
@Composable
private fun InsightBanner(tip: BoardTip) {
    Card(colors = CardDefaults.cardColors(containerColor = DarkSurface), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(modifier = Modifier.size(32.dp).background(CaltrainRed.copy(alpha = 0.18f), CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Bolt, contentDescription = null, tint = CaltrainRedLight, modifier = Modifier.size(20.dp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Wait for ${tip.waitFor} ${if (tip.waitForKind == "EXP") "Express" else tip.waitForKind}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                Text(
                    "${tip.insteadOf} is delayed. ${tip.waitFor} leaves after it and gets to your stop ${tip.savesMin} min sooner: ${Clock.time(tip.waitForArr)} instead of ${Clock.time(tip.insteadOfArr)}.",
                    style = MaterialTheme.typography.bodySmall,
                    color = StatusGrey
                )
            }
        }
    }
}

private fun leaveTrain(board: Board) = board.trains.firstOrNull { it.catchState == "leave" && it.status != TrainStatus.CANCELLED }
private fun runTrain(board: Board) = board.trains.firstOrNull { it.catchState == "run" && it.status != TrainStatus.CANCELLED }
/** The train the leave-by card is about: the next one to leave for, else one you'd have to run for. */
private fun catchTarget(board: Board) = (leaveTrain(board) ?: runTrain(board))?.takeIf { it.leaveBy != null }

private fun minutesUntil(epochMs: Double, now: Long) = maxOf(0, ((epochMs - now) / 60_000.0).roundToInt())

/** "450 ft" close by, "1.2 mi" otherwise. */
fun distanceText(meters: Int): String {
    val miles = meters / 1609.34
    return if (miles < 0.2) "${((meters * 3.281 / 50).roundToInt()) * 50} ft" else String.format(Locale.US, "%.1f mi", miles)
}

/** When to leave for the train you can still catch, counted down, and whether you need to run. */
@Composable
private fun CatchCard(board: Board, walkMinutes: Int, now: Long) {
    val train = catchTarget(board) ?: return
    val leaveBy = train.leaveBy ?: return
    val isRun = train.catchState == "run"
    val minutesLeft = minutesUntil(leaveBy, now)
    val depMinutesLeft = minutesUntil(train.predDep, now)
    val travel = board.travel
    val accent = if (isRun) StatusAmber else MaterialTheme.colorScheme.secondary

    Card(colors = CardDefaults.cardColors(containerColor = DarkSurface), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth().testTag("catch-card")) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val mode = travel?.travelMode ?: TravelMode.WALK
                Icon(
                    when (mode) { TravelMode.WALK -> Icons.AutoMirrored.Filled.DirectionsWalk; TravelMode.DRIVE -> Icons.Default.DirectionsCar; TravelMode.SCOOTER -> Icons.Default.ElectricScooter; else -> Icons.Default.DirectionsBike },
                    contentDescription = null, tint = StatusGrey, modifier = Modifier.size(16.dp)
                )
                Text(
                    if (travel != null) "~${travel.minutes} min ${mode.verb} to ${board.from.short} · ${distanceText(travel.distanceM)}"
                    else "$walkMinutes min walk to ${board.from.short}",
                    style = MaterialTheme.typography.bodySmall, color = StatusGrey
                )
            }

            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (isRun) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Pill("RUN", StatusAmber)
                            Text("for ${train.train}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            // "Leave now", not "Leave in now", once it's time to go.
                            val leaveIn = Clock.until(leaveBy, now)
                            Text(if (leaveIn == "now") "Leave" else "Leave in", style = MaterialTheme.typography.titleLarge)
                            Text(leaveIn, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = accent)
                        }
                    }
                    val late = train.delayMin?.takeIf { it > 0 }?.let { " ($it min late)" } ?: ""
                    Text(
                        "for ${train.train} at ${Clock.time(train.predDep)}$late · leave by ${Clock.time(leaveBy)}",
                        style = MaterialTheme.typography.bodySmall, color = StatusGrey
                    )
                }
                Box(modifier = Modifier.size(46.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(
                        progress = { if (isRun) 1f else (minutesLeft.toFloat() / maxOf(1, walkMinutes + 15)).coerceIn(0.05f, 1f) },
                        modifier = Modifier.fillMaxSize(),
                        color = accent,
                        trackColor = StatusGrey.copy(alpha = 0.25f),
                        strokeWidth = 4.dp,
                        strokeCap = StrokeCap.Round
                    )
                    Text("${if (isRun) depMinutesLeft else minutesLeft}", fontWeight = FontWeight.Bold, color = if (isRun) StatusAmber else Color.White)
                }
            }

            // Spare minutes counted from now (the board's buffer_min is as of its refresh).
            travel?.let { t ->
                val spare = floor((train.predDep - now) / 60_000.0).toInt() - t.minutes
                Text(
                    if (spare >= 0) "Leave now and you'll have about $spare min to spare" else "Leaving now, you'd be about ${-spare} min late",
                    style = MaterialTheme.typography.bodySmall,
                    color = if (spare >= 3) StatusGreen else StatusAmber
                )
            }

            runTrain(board)?.takeIf { it.tripId != train.tripId }?.let { run ->
                Text(
                    "${run.train} at ${Clock.time(run.predDep)} needs a run: ${minutesUntil(run.predDep, now)} min left, your ${travel?.travelMode?.verb ?: "walk"} is $walkMinutes",
                    style = MaterialTheme.typography.bodySmall, color = StatusGrey
                )
            }
        }
    }
}

@Composable
private fun CommuteDoneCardView(card: CommuteDoneCard, onResume: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = StatusGreen.copy(alpha = 0.14f)), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = StatusGreen)
                Text("${if (card.part == "evening") "Evening" else "Morning"} commute done", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = StatusGreen)
            }
            Text(
                "You reached ${card.to.name} at ${Clock.time(card.at)}, so Headway won't send more alerts about catching a train until ${Clock.time(card.until)}.",
                style = MaterialTheme.typography.bodySmall, color = StatusGrey
            )
            OutlinedButton(onClick = onResume) { Text("Keep alerting me today") }
        }
    }
}

/** Hands a message to the system share sheet. */
private fun shareText(context: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    runCatching { context.startActivity(Intent.createChooser(send, "Share live ETA")) }
}

@Composable
fun TrackedBanner(
    tracked: TrackedWithProgress,
    now: Long,
    compact: Boolean,
    onShare: ((String?) -> Unit) -> Unit,
    onUntrack: () -> Unit
) {
    val context = LocalContext.current
    var sharing by remember { mutableStateOf(false) }
    val p = tracked.progress
    Card(colors = CardDefaults.cardColors(containerColor = DarkSurfaceVariant), shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            if (!compact) {
                Text("Tracking", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Train ${p.train} to ${p.to.name}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    p.delayMin?.takeIf { it >= 2 }?.let { Text("+$it min", color = StatusAmber, fontWeight = FontWeight.SemiBold) }
                }
                if (p.cancelled) Text("Cancelled", color = StatusRed, style = MaterialTheme.typography.bodyMedium)
                p.next?.takeIf { it.id != p.to.id }?.let { next ->
                    Text("Next stop ${next.name} at ${Clock.time(next.pred)}", style = MaterialTheme.typography.bodyMedium)
                }
                Text(
                    "Arrives ${Clock.time(p.predArr)} · in ${Clock.until(p.predArr, now)} · ${maxOf(0, p.stopsLeft - 1)} stops to go",
                    style = MaterialTheme.typography.bodyMedium, color = StatusGrey
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(
                    enabled = !sharing,
                    onClick = {
                        sharing = true
                        onShare { message ->
                            sharing = false
                            if (message != null) shareText(context, message)
                        }
                    }
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Share live ETA")
                }
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onUntrack) { Text("Stop tracking", color = StatusRed) }
            }
        }
    }
}

/** One train: its times, status, how it compares with the others, and when to leave for it. */
@Composable
fun TrainCard(train: BoardTrain, destinationShort: String, now: Long, isTracked: Boolean, onTrack: () -> Unit) {
    val cancelled = train.status == TrainStatus.CANCELLED
    val statusColor = when (train.status) {
        TrainStatus.ON_TIME -> StatusGreen
        TrainStatus.LATE -> StatusAmber
        TrainStatus.CANCELLED -> StatusRed
        else -> StatusGrey
    }
    val statusText = when (train.status) {
        TrainStatus.CANCELLED -> "Cancelled"
        TrainStatus.LATE -> "${train.delayMin ?: 0} min late"
        TrainStatus.EARLY -> "${-(train.delayMin ?: 0)} min early"
        TrainStatus.ON_TIME -> "On time"
        TrainStatus.SCHEDULED -> "Scheduled"
    }
    val ride = train.rideMin?.takeIf { it > 0 }

    Card(
        colors = CardDefaults.cardColors(containerColor = if (isTracked) DarkSurfaceVariant else DarkSurface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth().alpha(if (train.pastDue) 0.6f else if (train.overtakenByTrain != null) 0.75f else 1f)
    ) {
        Row(modifier = Modifier.padding(start = 14.dp, top = 10.dp, bottom = 10.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.width(88.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(train.train, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                when {
                    train.isExpress -> Pill("⚡ EXPRESS", CaltrainRedLight)
                    train.kind == "LTD" -> Pill(train.kindName, StatusAmber, heavy = false)
                    else -> Text(train.kindName, style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                }
            }

            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                // The departure, the timetable time struck out when it differs to the minute, and the arrival.
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        Clock.time(train.predDep), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, maxLines = 1,
                        textDecoration = if (cancelled) TextDecoration.LineThrough else null
                    )
                    if (Clock.time(train.predDep) != Clock.time(train.dep)) {
                        Text(Clock.time(train.dep), style = MaterialTheme.typography.bodyMedium, color = StatusGrey, textDecoration = TextDecoration.LineThrough, maxLines = 1)
                    }
                    Text("→ ${Clock.time(train.predArr)}", style = MaterialTheme.typography.bodyMedium, color = StatusGrey, maxLines = 1)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(statusText, style = MaterialTheme.typography.bodySmall, color = statusColor, maxLines = 1)
                    Text(
                        "· ${if (train.stopsBetween == 0) "nonstop" else "${train.stopsBetween} stop${if (train.stopsBetween == 1) "" else "s"}"}",
                        style = MaterialTheme.typography.bodySmall, color = StatusGrey, maxLines = 1
                    )
                }
                if (!cancelled && (train.firstIn == true || train.shortest == true || train.overtakenByTrain != null || ride != null)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        if (train.firstIn == true) Pill("First to $destinationShort", StatusBlue)
                        if (train.shortest == true) Pill("Shortest ride", StatusGreen)
                        train.overtakenByTrain?.let { Pill("Overtaken by $it", StatusGrey, heavy = false) }
                        ride?.let { Text("${it}m ride", style = MaterialTheme.typography.labelSmall, color = StatusGrey, maxLines = 1) }
                    }
                }
            }

            // When to leave for it, or how long until it goes.
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                val leaveBy = train.leaveBy
                when {
                    train.pastDue -> Text(train.dueLabel(now), color = StatusAmber, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.End)
                    cancelled -> {}
                    train.catchState != null && leaveBy != null -> when (train.catchState) {
                        "run" -> {
                            Pill("RUN", StatusAmber)
                            Text("${minutesUntil(train.predDep, now)} min left", style = MaterialTheme.typography.labelSmall, color = StatusGrey)
                        }
                        "missed" -> Text("Missed", color = StatusGrey, style = MaterialTheme.typography.bodyMedium)
                        else -> {
                            Text(
                                "Leave ${Clock.time(leaveBy)}", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium,
                                color = if (train.catchState == "leave") MaterialTheme.colorScheme.secondary else Color.White
                            )
                            Clock.until(leaveBy, now).let { Text(if (it == "now") "now" else "in $it", style = MaterialTheme.typography.labelSmall, color = StatusGrey) }
                        }
                    }
                    else -> Text(Clock.until(train.predDep, now), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                }
            }

            if (cancelled) Spacer(Modifier.width(12.dp)) else IconButton(onClick = onTrack) {
                Icon(
                    if (isTracked) Icons.Default.LocationOn else Icons.Default.AddLocation,
                    contentDescription = if (isTracked) "Tracking" else "Track this train",
                    tint = if (isTracked) MaterialTheme.colorScheme.secondary else StatusGrey
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
                    OutlinedButton(onClick = { pickStop = true }) { Text("Get off at ${card.to.short} ▾", maxLines = 1) }
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
