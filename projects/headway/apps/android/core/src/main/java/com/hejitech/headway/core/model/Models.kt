package com.hejitech.headway.core.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Station(
    val id: String,
    val name: String,
    val short: String
)

@Serializable
data class StationRef(
    val id: String,
    val name: String,
    val short: String
)

@Serializable
enum class TrainStatus {
    @SerialName("on_time") ON_TIME,
    @SerialName("late") LATE,
    @SerialName("early") EARLY,
    @SerialName("cancelled") CANCELLED,
    @SerialName("scheduled") SCHEDULED;

    val displayTitle: String
        get() = when (this) {
            ON_TIME -> "ON TIME"
            LATE -> "LATE"
            EARLY -> "EARLY"
            CANCELLED -> "CANCELLED"
            SCHEDULED -> "SCHEDULED"
        }
}

@Serializable
enum class ExpressPreference(val value: String, val title: String) {
    @SerialName("all") ALL("all", "All trains"),
    @SerialName("prefer_express") PREFER_EXPRESS("prefer_express", "Prefer express"),
    @SerialName("express_only") EXPRESS_ONLY("express_only", "Express only");

    companion object {
        fun fromValue(v: String?): ExpressPreference =
            entries.firstOrNull { it.value == v } ?: ALL
    }
}

@Serializable
data class BoardTrain(
    @SerialName("trip_id") val tripId: String,
    val train: String,
    val kind: String,
    val dir: String,
    @SerialName("service_date") val serviceDate: String,
    val dep: Double,
    val arr: Double,
    @SerialName("pred_dep") val predDep: Double,
    @SerialName("pred_arr") val predArr: Double,
    @SerialName("delay_min") val delayMin: Int? = null,
    val status: TrainStatus,
    @SerialName("stops_between") val stopsBetween: Int = 0,
    /** Its time at your station has passed; it stays listed for a few minutes because real trains run late. */
    @SerialName("past_due") val pastDue: Boolean = false,
    /** When to leave for it (commute boards with minutes to the station), and whether you still can: "ok", "leave", "run" or "missed". */
    @SerialName("leave_by") val leaveBy: Double? = null,
    @SerialName("catch") val catchState: String? = null,
    @SerialName("buffer_min") val bufferMin: Int? = null,
    @SerialName("ride_min") val rideMin: Int? = null,
    @SerialName("overtaken_by") val overtakenBy: String? = null,
    @SerialName("overtaken_by_train") val overtakenByTrain: String? = null,
    @SerialName("first_in") val firstIn: Boolean? = null,
    val shortest: Boolean? = null
) {
    val id: String get() = "$serviceDate:$tripId"

    /** What to say about a train past its time: right after it, it's probably just arriving. */
    fun dueLabel(nowMs: Long = Clock.now()): String =
        if (nowMs - maxOf(dep, predDep) < 120_000) "Due" else "May have left"

    val kindName: String
        get() = when (kind) {
            "LOC" -> "Local"
            "LTD" -> "Limited"
            "EXP" -> "Express"
            "SCC" -> "South County"
            else -> kind
        }

    val isExpress: Boolean get() = kind == "EXP"
}

@Serializable
data class ServiceAlert(
    val id: String,
    val header: String,
    val description: String = "",
    val url: String? = null
)

@Serializable
data class Board(
    val from: StationRef,
    val to: StationRef,
    val leg: String = "",
    @SerialName("generated_at") val generatedAt: Double = 0.0,
    val live: Boolean = false,
    val trains: List<BoardTrain> = emptyList(),
    val alerts: List<ServiceAlert> = emptyList(),
    @SerialName("express_preference") val expressPreference: String? = null,
    /** Minutes to the station for this leg (commute boards only): the leave-by card shows with it. */
    @SerialName("walk_minutes") val walkMinutes: Int? = null,
    /** A later express that gets you there sooner than a delayed train. */
    val tip: BoardTip? = null,
    /** The trip to the station estimated from where the phone is (Settings › Location). */
    val travel: TravelEstimate? = null,
    /** Weather where you leave now and where you get off when the next train arrives. */
    val weather: BoardWeather? = null
)

@Serializable
data class BoardTip(
    @SerialName("wait_for") val waitFor: String,
    @SerialName("wait_for_kind") val waitForKind: String,
    @SerialName("wait_for_dep") val waitForDep: Double,
    @SerialName("wait_for_arr") val waitForArr: Double,
    @SerialName("instead_of") val insteadOf: String,
    @SerialName("instead_of_arr") val insteadOfArr: Double,
    @SerialName("saves_min") val savesMin: Int
)

/** How you get to the station: the Worker's `travel_mode` strings, with how they read. */
enum class TravelMode(val value: String, val title: String, val verb: String) {
    WALK("walk", "Walk", "walk"),
    BIKE("bike", "Bike", "bike ride"),
    EBIKE("ebike", "E-bike", "e-bike ride"),
    SCOOTER("scooter", "E-scooter", "scooter ride"),
    DRIVE("drive", "Drive", "drive");

    companion object {
        fun of(value: String?): TravelMode = entries.firstOrNull { it.value == value } ?: WALK
    }
}

@Serializable
data class TravelEstimate(
    val mode: String = "walk",
    @SerialName("distance_m") val distanceM: Int = 0,
    val minutes: Int = 0
) {
    val travelMode: TravelMode get() = TravelMode.of(mode)
}

@Serializable
data class Tracked(
    @SerialName("trip_id") val tripId: String,
    @SerialName("service_date") val serviceDate: String,
    val from: String,
    val to: String
)

@Serializable
data class NextStop(
    val id: String,
    val name: String,
    val short: String,
    val pred: Double
)

@Serializable
data class TrainProgress(
    @SerialName("trip_id") val tripId: String,
    val train: String,
    val kind: String,
    @SerialName("service_date") val serviceDate: String,
    val to: StationRef,
    val next: NextStop? = null,
    @SerialName("pred_arr") val predArr: Double,
    val arr: Double,
    @SerialName("delay_min") val delayMin: Int? = null,
    @SerialName("stops_left") val stopsLeft: Int = 0,
    val cancelled: Boolean = false,
    val arrived: Boolean = false,
    val departed: Boolean? = null,
    val live: Boolean = false
) {
    /** It has left your station and hasn't arrived: when to leave for a train is beside the point. */
    val riding: Boolean get() = departed == true && !arrived && !cancelled
}

@Serializable
data class TrackedWithProgress(
    @SerialName("trip_id") val tripId: String,
    @SerialName("service_date") val serviceDate: String,
    val from: String,
    val to: String,
    val progress: TrainProgress
)

@Serializable
data class MyBoard(
    val board: Board? = null,
    @SerialName("has_commute") val hasCommute: Boolean = false,
    val saved: Boolean = false,
    val tracked: TrackedWithProgress? = null,
    @SerialName("on_train") val onTrain: OnTrainCard? = null,
    @SerialName("commute_done") val commuteDone: CommuteDoneCard? = null
)

/** The leg you finished today, while its alerts are held back. */
@Serializable
data class CommuteDoneCard(
    val part: String,
    val to: StationRef,
    val at: Double,
    val until: Double
)

@Serializable
data class EtaShareResponse(
    val token: String,
    val url: String,
    @SerialName("expires_at") val expiresAt: String
)

/** One location fix sent to tell which train you're on. Used for that answer and never stored. */
@Serializable
data class OnTrainSample(
    val lat: Double,
    val lon: Double,
    /** Epoch milliseconds. */
    val at: Double,
    /** Metres per second; null when the phone doesn't know. */
    val speed: Double? = null
)

@Serializable
data class OnTrainStop(
    val id: String,
    val name: String,
    val short: String,
    val pred: Double,
    /** done, now or upcoming. */
    val status: String
)

/** What someone riding a train wants to see instead of when to leave for it. */
@Serializable
data class OnTrainCard(
    @SerialName("trip_id") val tripId: String,
    @SerialName("service_date") val serviceDate: String,
    /** high, or low: "looks like", and Headway won't start tracking by itself. */
    val confidence: String = "low",
    val train: String,
    val kind: String,
    val dir: String,
    val from: StationRef,
    val to: StationRef,
    /** commute, tracked or terminal (no commute matches: the end of the line). */
    @SerialName("to_source") val toSource: String = "terminal",
    val next: NextStop? = null,
    @SerialName("pred_arr") val predArr: Double,
    val arr: Double,
    @SerialName("delay_min") val delayMin: Int? = null,
    @SerialName("stops_left") val stopsLeft: Int = 0,
    val stops: List<OnTrainStop> = emptyList(),
    val alerts: List<ServiceAlert> = emptyList(),
    val tracked: Boolean = false,
    val live: Boolean = false
) {
    val isSure: Boolean get() = confidence == "high"
    val kindName: String
        get() = when (kind) {
            "LOC" -> "Local"
            "LTD" -> "Limited"
            "EXP" -> "Express"
            "SCC" -> "South County"
            else -> kind
        }
}

@Serializable
data class OnTrainReport(
    @SerialName("on_train") val onTrain: OnTrainCard? = null,
    @SerialName("auto_tracked") val autoTracked: Boolean = false
)

/** Which notifications to send. Priority affects your commute; ALL adds the rest, quietly. */
@Serializable
enum class AlertScope(val title: String) {
    @SerialName("priority") PRIORITY("Priority only"),
    @SerialName("all") ALL("Priority and quiet")
}

/** What Headway does when your location shows you're on a train. */
@Serializable
enum class OnTrainMode(val title: String, val detail: String) {
    @SerialName("off") OFF("Off", "Headway won't check whether you're on a train."),
    @SerialName("card") CARD("Show the card", "With the app open, a card shows your next stop and arrival once you're riding. Tracking is one tap."),
    @SerialName("auto") AUTO("Also start tracking", "With the app open, the card appears and Headway starts tracking the train."),
    @SerialName("background") BACKGROUND("Also with the app closed", "Headway keeps watching for a ride with a notification showing, and tells you when it starts tracking. Needs location access all the time.");

    val usesLocation: Boolean get() = this != OFF
    val startsTracking: Boolean get() = this == AUTO || this == BACKGROUND
}

@Serializable
data class TimeWindow(
    val start: String,
    val end: String
)

@Serializable
data class Leg(
    val from: String,
    val to: String,
    @SerialName("walk_minutes") val walkMinutes: Int = 10,
    val usual: String? = null,
    val window: TimeWindow,
    @SerialName("express_preference") val expressPreference: ExpressPreference = ExpressPreference.ALL,
    /** "walk", "drive", "bike", "ebike" or "scooter": see [TravelMode]. */
    @SerialName("travel_mode") val travelMode: String = "walk"
) {
    val mode: TravelMode get() = TravelMode.of(travelMode)

    companion object {
        fun morning(from: String, to: String) = Leg(
            from = from,
            to = to,
            walkMinutes = 10,
            window = TimeWindow(start = "06:00", end = "10:30")
        )

        fun evening(from: String, to: String) = Leg(
            from = from,
            to = to,
            walkMinutes = 10,
            window = TimeWindow(start = "15:30", end = "20:00")
        )
    }
}

@Serializable
data class AlertSettings(
    val delay: Boolean = true,
    @SerialName("delay_threshold") val delayThreshold: Int = 5,
    val cancellation: Boolean = true,
    val service: Boolean = true,
    @SerialName("leave_now") val leaveNow: Boolean = true,
    val arrival: Boolean = true,
    @SerialName("arrival_minutes") val arrivalMinutes: Int = 5,
    @SerialName("better_train") val betterTrain: Boolean = true,
    val scope: AlertScope = AlertScope.PRIORITY,
    /** Stop a leg's alerts for the day once your location shows you got there. */
    @SerialName("stop_when_done") val stopWhenDone: Boolean = true
) {
    val anyOn: Boolean get() = delay || cancellation || service || leaveNow || arrival
}

@Serializable
data class Settings(
    val morning: Leg? = null,
    val evening: Leg? = null,
    @SerialName("switch_at") val switchAt: String = "12:00",
    val days: List<Int> = listOf(0, 1, 2, 3, 4),
    val alerts: AlertSettings = AlertSettings(),
    @SerialName("express_preference") val expressPreference: ExpressPreference = ExpressPreference.ALL,
    /** Shown on the live ETA page when you share a ride. */
    @SerialName("share_name") val shareName: String? = null,
    @SerialName("on_train") val onTrain: OnTrainMode = OnTrainMode.CARD
) {
    companion object {
        val defaults = Settings()
    }
}

@Serializable
data class SettingsResponse(
    val settings: Settings,
    val saved: Boolean = false,
    val email: String? = null
)

@Serializable
data class PairingCode(
    val code: String,
    @SerialName("expires_at") val expiresAt: String
)

@Serializable
data class PairedDevice(
    val id: String,
    val label: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("last_used_at") val lastUsedAt: String? = null
)

@Serializable
data class AuthSession(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("user_id") val userId: String,
    val email: String? = null,
    @SerialName("expires_at_ms") val expiresAtMs: Long
)

// Weather (core's weather.ts, from the National Weather Service).

/** Mirrors core's `WeatherCondition`; an unknown value (from a newer Worker) decodes as CLOUDY. */
@Serializable
enum class WeatherCondition {
    @SerialName("clear") CLEAR,
    @SerialName("mostly_clear") MOSTLY_CLEAR,
    @SerialName("partly_cloudy") PARTLY_CLOUDY,
    @SerialName("cloudy") CLOUDY,
    @SerialName("fog") FOG,
    @SerialName("haze") HAZE,
    @SerialName("smoke") SMOKE,
    @SerialName("drizzle") DRIZZLE,
    @SerialName("rain") RAIN,
    @SerialName("showers") SHOWERS,
    @SerialName("thunder") THUNDER,
    @SerialName("snow") SNOW,
    @SerialName("wind") WIND;

    val isWet: Boolean get() = this in setOf(DRIZZLE, RAIN, SHOWERS, THUNDER, SNOW)

    fun words(day: Boolean): String = when (this) {
        CLEAR -> if (day) "Sunny" else "Clear"
        MOSTLY_CLEAR -> if (day) "Mostly sunny" else "Mostly clear"
        PARTLY_CLOUDY -> "Partly cloudy"
        CLOUDY -> "Cloudy"
        FOG -> "Fog"
        HAZE -> "Haze"
        SMOKE -> "Smoke"
        DRIZZLE -> "Drizzle"
        RAIN -> "Rain"
        SHOWERS -> "Showers"
        THUNDER -> "Thunderstorms"
        SNOW -> "Snow"
        WIND -> "Windy"
    }
}

@Serializable
data class WeatherHour(
    /** Start of the hour, epoch ms. */
    val t: Double,
    @SerialName("temp_f") val tempF: Int,
    /** Chance of precipitation, 0–100. */
    val pop: Int = 0,
    @SerialName("wind_mph") val windMph: Int = 0,
    val cond: WeatherCondition = WeatherCondition.CLOUDY,
    /** NWS's own words, e.g. "Patchy Fog". */
    val text: String = "",
    val day: Boolean = true
) {
    val words: String get() = cond.words(day)
    /** "58° Fog" or "54° Rain 70%". */
    val line: String get() = "$tempF° $words" + if (cond.isWet && pop > 0) " $pop%" else ""
}

@Serializable
data class BoardWeatherAlert(val event: String, val headline: String, val severity: String = "Unknown")

/** Mirrors core's `WeatherTheme`: the animated backdrop behind a board. */
@Serializable
enum class WeatherTheme {
    @SerialName("clear_day") CLEAR_DAY,
    @SerialName("clear_night") CLEAR_NIGHT,
    @SerialName("partly_day") PARTLY_DAY,
    @SerialName("partly_night") PARTLY_NIGHT,
    @SerialName("cloudy") CLOUDY,
    @SerialName("fog") FOG,
    @SerialName("rain") RAIN,
    @SerialName("storm") STORM,
    @SerialName("snow") SNOW;

    companion object {
        fun fromWire(s: String): WeatherTheme? = entries.firstOrNull { it.name.equals(s, ignoreCase = true) }
    }
}

@Serializable
data class BoardWeather(
    /** The backdrop behind the board (the more eventful end of the ride); null from a Worker before 1.7.1 or an unknown theme. */
    val theme: WeatherTheme? = null,
    val from: WeatherHour? = null,
    val to: WeatherHour? = null,
    /** When `to` applies: the next train's predicted arrival, epoch ms. */
    @SerialName("to_at") val toAt: Double? = null,
    val alerts: List<BoardWeatherAlert> = emptyList()
)

@Serializable
data class StationWeather(
    val id: String,
    val name: String,
    val short: String = "",
    val now: WeatherHour? = null,
    val hours: List<WeatherHour> = emptyList(),
    @SerialName("high_f") val highF: Int? = null,
    @SerialName("low_f") val lowF: Int? = null,
    /** First hour in the next 12 with a good chance of rain, when it's dry now. */
    @SerialName("rain_at") val rainAt: Double? = null,
    @SerialName("alert_ids") val alertIds: List<String> = emptyList(),
    @SerialName("fetched_at") val fetchedAt: Double? = null
)

@Serializable
data class WeatherAlert(
    val id: String,
    val event: String,
    val headline: String,
    val severity: String = "Unknown",
    val starts: Double? = null,
    val ends: Double? = null,
    val stations: List<String> = emptyList()
)

@Serializable
data class WeatherReport(
    val source: String = "National Weather Service",
    @SerialName("updated_at") val updatedAt: Double? = null,
    /** North to south, as the line runs. */
    val stations: List<StationWeather> = emptyList(),
    val alerts: List<WeatherAlert> = emptyList()
)

// Assistants changing settings (GET/PUT /api/agent-access).

/** A change an assistant made to the commute over MCP. */
@Serializable
data class AgentChange(
    val id: String,
    /** The assistant's name, when its connection says (null: a personal token or an older connection). */
    val client: String? = null,
    /** What changed, one line each ("Evening: usual train 5:30 PM → 4:00 PM"). */
    val summary: List<String> = emptyList(),
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("undone_at") val undoneAt: String? = null
)

@Serializable
data class AgentAccess(
    /** Whether connected assistants may change the commute (off until the rider turns it on). */
    @SerialName("edit_settings") val editSettings: Boolean = false,
    val changes: List<AgentChange> = emptyList()
)

@Serializable
data class AgentUndoResponse(val settings: Settings, val changes: List<AgentChange> = emptyList())

/** GET /api/pro: the account's Headway Pro from any store (App Store, Google Play, the web) or a grant. */
@Serializable
data class ProStatus(
    val pro: Boolean = false,
    /** app_store, play, stripe, grant, or null without Pro. */
    val source: String? = null,
    /** annual or lifetime. */
    val plan: String? = null,
    /** When it renews or ends (ISO 8601); null for lifetime. */
    val until: String? = null,
    /** Where it's managed: app_store, play, stripe. */
    val manage: String? = null,
    @SerialName("had_purchase") val hadPurchase: Boolean = false,
    val email: String? = null
)

/** A Play Billing purchase handed to the account (POST /api/play/purchases). */
@Serializable
data class PlayPurchaseUpload(val product: String, val token: String)

