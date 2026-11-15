package com.hejitech.headway.app.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hejitech.headway.app.HeadwayViewModel
import com.hejitech.headway.app.ui.theme.StatusAmber
import com.hejitech.headway.app.ui.theme.StatusGrey
import com.hejitech.headway.app.ui.theme.StatusRed
import com.hejitech.headway.core.model.*
import kotlinx.coroutines.launch

private val RainBlue = Color(0xFF2F80ED)
private val SunYellow = Color(0xFFF5B400)
private val NightIndigo = Color(0xFF5C6BC0)

/** The condition's icon and a color that reads on light and dark backgrounds. */
fun WeatherHour.icon(): Pair<ImageVector, Color> = when (cond) {
    WeatherCondition.CLEAR, WeatherCondition.MOSTLY_CLEAR -> if (day) Icons.Default.WbSunny to SunYellow else Icons.Default.NightsStay to NightIndigo
    WeatherCondition.PARTLY_CLOUDY -> Icons.Default.FilterDrama to StatusGrey
    WeatherCondition.CLOUDY -> Icons.Default.Cloud to StatusGrey
    WeatherCondition.FOG, WeatherCondition.HAZE, WeatherCondition.SMOKE -> Icons.Default.BlurOn to StatusGrey
    WeatherCondition.DRIZZLE -> Icons.Default.Grain to RainBlue
    WeatherCondition.RAIN, WeatherCondition.SHOWERS -> Icons.Default.Umbrella to RainBlue
    WeatherCondition.THUNDER -> Icons.Default.Thunderstorm to RainBlue
    WeatherCondition.SNOW -> Icons.Default.AcUnit to RainBlue
    WeatherCondition.WIND -> Icons.Default.Air to StatusGrey
}

@Composable
fun WeatherIcon(hour: WeatherHour, size: Int = 28) {
    val (icon, tint) = hour.icon()
    Icon(icon, contentDescription = hour.words, tint = tint, modifier = Modifier.size(size.dp))
}

/**
 * The Weather tab: every Caltrain station's weather from the National Weather Service, your
 * commute's stations first, then the whole line north to south. Tap a station for its next hours.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WeatherScreen(viewModel: HeadwayViewModel, onClose: (() -> Unit)? = null) {
    val weather by viewModel.weather.collectAsState()
    val failed by viewModel.weatherError.collectAsState()
    val board by viewModel.board.collectAsState()
    val settings by viewModel.settings.collectAsState()
    val stations by viewModel.stations.collectAsState()
    var open by remember { mutableStateOf<String?>(null) }
    var refreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { viewModel.loadWeather() }
    BackHandler(enabled = open != null) { open = null }

    val detail = open?.let { id -> weather?.stations?.firstOrNull { it.id == id } }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(detail?.name ?: "Station weather", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    if (detail != null) {
                        IconButton(onClick = { open = null }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                    } else if (onClose != null) {
                        IconButton(onClick = onClose) { Icon(Icons.Default.Close, contentDescription = "Close") }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { scope.launch { refreshing = true; viewModel.loadWeather(force = true); refreshing = false } },
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            val w = weather
            when {
                w == null && failed -> Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Icon(Icons.Default.CloudOff, contentDescription = null, tint = StatusGrey, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("No weather right now", style = MaterialTheme.typography.titleMedium)
                    Text("Couldn't load the forecast. Pull to try again.", color = StatusGrey)
                }
                w == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                detail != null -> StationWeatherDetail(detail, w.alerts.filter { it.id in detail.alertIds }, w.updatedAt)
                else -> {
                    val mineIds = listOfNotNull(board?.from?.id, board?.to?.id, settings.morning?.from, settings.morning?.to).distinct()
                    val mine = mineIds.mapNotNull { id -> w.stations.firstOrNull { it.id == id } }
                    val nameOf = { id: String -> stations.firstOrNull { it.id == id }?.name ?: id }
                    LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (w.alerts.isNotEmpty()) {
                            item { SectionTitle("Weather alerts") }
                            items(w.alerts, key = { "alert-" + it.id }) { a -> WeatherAlertCard(a, a.stations.map(nameOf)) }
                        }
                        if (mine.isNotEmpty()) {
                            item { SectionTitle("Your stations") }
                            items(mine, key = { "mine-" + it.id }) { s -> StationWeatherRow(s) { open = s.id } }
                        }
                        item { SectionTitle("All stations, north to south") }
                        items(w.stations, key = { "all-" + it.id }) { s -> StationWeatherRow(s) { open = s.id } }
                        item { WeatherSource(w.updatedAt) }
                        item { Spacer(Modifier.height(16.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleSmall, color = StatusGrey, modifier = Modifier.padding(top = 12.dp, bottom = 2.dp))
}

@Composable
private fun WeatherSource(updatedAt: Double?) {
    Text(
        "Forecast from the National Weather Service" + (updatedAt?.let { ", updated ${Clock.timeWithAmPm(it)}" } ?: "") + ", refreshed every two hours. Temperatures in °F.",
        style = MaterialTheme.typography.bodySmall,
        color = StatusGrey,
        modifier = Modifier.padding(top = 8.dp)
    )
}

@Composable
private fun StationWeatherRow(station: StationWeather, onClick: () -> Unit) {
    val h = station.now
    val subtitle = when {
        h == null -> "No forecast yet"
        station.alertIds.isNotEmpty() -> "Weather alert · ${h.words}"
        h.cond.isWet -> "${h.words} · ${h.pop}% chance"
        station.rainAt != null -> "${h.words} · rain from ${Clock.hour(station.rainAt!!)}"
        h.windMph >= 20 -> "${h.words} · wind ${h.windMph} mph"
        else -> h.words
    }
    val subtitleColor = when {
        station.alertIds.isNotEmpty() -> StatusAmber
        h?.cond?.isWet == true || station.rainAt != null -> RainBlue
        else -> StatusGrey
    }
    Card(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(40.dp)) {
                if (h != null) WeatherIcon(h) else Icon(Icons.Default.HelpOutline, contentDescription = null, tint = StatusGrey)
            }
            Column(Modifier.weight(1f)) {
                Text(station.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = subtitleColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (h != null) {
                Column(horizontalAlignment = Alignment.End) {
                    Text("${h.tempF}°", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    val hi = station.highF
                    val lo = station.lowF
                    if (hi != null && lo != null && hi != lo) Text("$lo° – $hi°", style = MaterialTheme.typography.bodySmall, color = StatusGrey)
                }
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = StatusGrey)
        }
    }
}

@Composable
private fun StationWeatherDetail(station: StationWeather, alerts: List<WeatherAlert>, updatedAt: Double?) {
    LazyColumn(modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        station.now?.let { h ->
            item {
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                        WeatherIcon(h, size = 56)
                        Spacer(Modifier.width(16.dp))
                        Column {
                            Text("${h.tempF}°", fontSize = 44.sp, fontWeight = FontWeight.SemiBold)
                            Text(h.text.ifEmpty { h.words }, style = MaterialTheme.typography.titleMedium)
                            val range = if (station.highF != null && station.lowF != null) "${station.lowF}° – ${station.highF}° next 12 h · " else ""
                            Text("$range${h.pop}% rain · wind ${h.windMph} mph", style = MaterialTheme.typography.bodyMedium, color = StatusGrey)
                        }
                    }
                }
            }
        }
        if (alerts.isNotEmpty()) {
            item { SectionTitle("Weather alerts") }
            items(alerts, key = { it.id }) { a -> WeatherAlertCard(a, emptyList()) }
        }
        if (station.hours.isNotEmpty()) {
            item { SectionTitle("Next hours") }
            item {
                Card(Modifier.fillMaxWidth()) {
                    Row(Modifier.horizontalScroll(rememberScrollState()).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        station.hours.forEach { h ->
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.semantics(mergeDescendants = true) {
                                    contentDescription = "${Clock.hour(h.t)}: ${h.tempF} degrees, ${h.words}" + if (h.pop >= 10) ", ${h.pop} percent chance of rain" else ""
                                }
                            ) {
                                Text(Clock.hour(h.t), style = MaterialTheme.typography.labelMedium, color = StatusGrey)
                                WeatherIcon(h, size = 24)
                                Text("${h.tempF}°", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                Text(if (h.pop >= 10) "${h.pop}%" else " ", style = MaterialTheme.typography.labelSmall, color = RainBlue)
                            }
                        }
                    }
                }
            }
        }
        item { WeatherSource(updatedAt) }
    }
}

@Composable
private fun WeatherAlertCard(alert: WeatherAlert, stations: List<String>) {
    val color = if (alert.severity == "Extreme" || alert.severity == "Severe") StatusRed else StatusAmber
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = color, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(alert.event, color = color, fontWeight = FontWeight.SemiBold)
            }
            if (alert.headline != alert.event) Text(alert.headline, style = MaterialTheme.typography.bodySmall)
            if (stations.isNotEmpty()) {
                Text(
                    if (stations.size > 4) "${stations.take(3).joinToString(", ")} and ${stations.size - 3} more" else stations.joinToString(", "),
                    style = MaterialTheme.typography.bodySmall,
                    color = StatusGrey
                )
            }
        }
    }
}

/**
 * On the Trains tab: the weather where you leave now and where you get off when the next train gets
 * there, with a nudge to bring an umbrella. Tap for every station.
 */
@Composable
fun BoardWeatherStrip(board: Board, weather: BoardWeather, onClick: () -> Unit) {
    val note: Triple<String, ImageVector, Color>? = run {
        weather.alerts.firstOrNull()?.let { return@run Triple(it.headline, Icons.Default.Warning, StatusAmber) }
        val wetFrom = weather.from?.let { it.cond.isWet && it.pop >= 40 } ?: false
        val wetTo = weather.to?.let { it.cond.isWet && it.pop >= 40 } ?: false
        if (wetFrom || wetTo) {
            val place = if (wetFrom && wetTo) "at both ends" else if (wetFrom) "at ${board.from.name}" else "when you get to ${board.to.name}"
            return@run Triple("Bring an umbrella: rain likely $place.", Icons.Default.Umbrella, RainBlue)
        }
        val f = weather.from
        val t = weather.to
        if (f != null && t != null && kotlin.math.abs(f.tempF - t.tempF) >= 8) {
            val text = if (t.tempF < f.tempF) "${f.tempF - t.tempF}° colder at ${board.to.name}: bring a layer." else "${t.tempF - f.tempF}° warmer at ${board.to.name}."
            return@run Triple(text, Icons.Default.Thermostat, StatusGrey)
        }
        null
    }
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClickLabel = "Shows the weather at every station", onClick = onClick),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                WeatherEnd(board.from.name, "Now", weather.from, Modifier.weight(1f))
                Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = StatusGrey, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(10.dp))
                WeatherEnd(board.to.name, weather.toAt?.let { "At ${Clock.time(it)}" } ?: "Now", weather.to, Modifier.weight(1f))
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null, tint = StatusGrey)
            }
            note?.let { (text, icon, color) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(text, style = MaterialTheme.typography.bodySmall, color = color, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}

@Composable
private fun WeatherEnd(name: String, caption: String, hour: WeatherHour?, modifier: Modifier) {
    Column(modifier.semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(name, style = MaterialTheme.typography.labelMedium, color = StatusGrey, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (hour != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                WeatherIcon(hour, size = 22)
                Spacer(Modifier.width(6.dp))
                Text("${hour.tempF}°", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
            }
            Text("$caption · ${hour.words}" + if (hour.cond.isWet) " ${hour.pop}%" else "", style = MaterialTheme.typography.bodySmall, color = StatusGrey, maxLines = 1, overflow = TextOverflow.Ellipsis)
        } else {
            Text("—", style = MaterialTheme.typography.titleLarge, color = StatusGrey)
            Text(caption, style = MaterialTheme.typography.bodySmall, color = StatusGrey)
        }
    }
}
