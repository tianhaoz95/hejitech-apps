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
    @SerialName("past_due") val pastDue: Boolean = false
) {
    val id: String get() = "$serviceDate:$tripId"

    /** What to say about a train past its time: right after it, it's probably just arriving. */
    fun dueLabel(nowMs: Long = System.currentTimeMillis()): String =
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
    @SerialName("express_preference") val expressPreference: String? = null
)

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
    val live: Boolean = false
)

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
    @SerialName("on_train") val onTrain: OnTrainCard? = null
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
    /** "walk" or "drive" (chosen in the iPhone app); kept so saving here doesn't reset it. */
    @SerialName("travel_mode") val travelMode: String = "walk"
) {
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
    val scope: AlertScope = AlertScope.PRIORITY
)

@Serializable
data class Settings(
    val morning: Leg? = null,
    val evening: Leg? = null,
    @SerialName("switch_at") val switchAt: String = "12:00",
    val days: List<Int> = listOf(0, 1, 2, 3, 4),
    val alerts: AlertSettings = AlertSettings(),
    @SerialName("express_preference") val expressPreference: ExpressPreference = ExpressPreference.ALL,
    /** Kept so saving here doesn't clear it. */
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
