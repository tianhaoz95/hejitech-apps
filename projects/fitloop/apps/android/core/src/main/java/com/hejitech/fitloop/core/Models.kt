@file:OptIn(ExperimentalSerializationApi::class)

package com.hejitech.fitloop.core

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonNames
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import java.time.LocalDate
import java.util.TimeZone

// Kotlin mirrors of @fitloop/core's JSON (packages/core/src/types.ts and plan.ts), the same shapes
// as the iPhone app's FitLoopKit. The agent writes plans, the Worker computes each day's state; the
// app shows them and sends check-ins.

@Serializable
data class Macros(
    val calories: Double? = null,
    @SerialName("protein_g") val proteinG: Double? = null,
    @SerialName("carbs_g") val carbsG: Double? = null,
    @SerialName("fat_g") val fatG: Double? = null,
) {
    /** "680 kcal · 48 g protein". */
    val summary: String
        get() = listOfNotNull(
            calories?.let { "${it.toInt()} kcal" }, proteinG?.let { "${it.toInt()} g protein" },
            carbsG?.let { "${it.toInt()} g carbs" }, fatG?.let { "${it.toInt()} g fat" },
        ).joinToString(" · ")
}

@Serializable
data class ExerciseAnimation(
    @JsonNames("gif_url") val gifUrl: String? = null,
    val steps: List<String>? = null,
    val description: String? = null,
)

@Serializable
data class Exercise(
    val id: String,
    val name: String,
    val sets: Int,
    /** A number (10) or a range ("8-10"). */
    val reps: JsonPrimitive? = null,
    @SerialName("duration_sec") val durationSec: Int? = null,
    val load: String? = null,
    @SerialName("rest_sec") val restSec: Int = 0,
    val cues: List<String>? = null,
    val instructions: String? = null,
    val alternative: String? = null,
    @SerialName("video_url") val videoUrl: String? = null,
    val animation: ExerciseAnimation? = null,
) {
    /** The reps as a number, when they aren't a range. */
    val repsCount: Int? get() = reps?.takeIf { !it.isString }?.intOrNull

    /** "8-10 reps @ 24 kg", "45 s", "5 min @ easy" (same wording as core's setTarget). */
    val target: String
        get() = listOfNotNull(reps?.let { "${it.content} reps" } ?: durationSec?.let(::formatSeconds), load).joinToString(" @ ")
}

fun formatSeconds(s: Int): String = when {
    s < 60 -> "$s s"
    s % 60 == 0 -> "${s / 60} min"
    else -> "${s / 60}:${"%02d".format(s % 60)}"
}

@Serializable
data class Workout(
    val id: String,
    val title: String,
    val time: String? = null,
    @SerialName("duration_min") val durationMin: Int,
    val kind: String = "",
    val exercises: List<Exercise> = emptyList(),
    val notes: String? = null,
)

@Serializable
data class MealItem(val name: String, val amount: String = "")

@Serializable
data class Meal(
    val id: String,
    val name: String,
    val time: String? = null,
    val items: List<MealItem> = emptyList(),
    val macros: Macros? = null,
    val prep: List<String>? = null,
    val notes: String? = null,
)

@Serializable
data class DayPlan(
    val title: String,
    val workouts: List<Workout> = emptyList(),
    val meals: List<Meal> = emptyList(),
    val notes: String? = null,
)

@Serializable
data class Goal(
    val id: String,
    val text: String,
    val metric: String? = null,
    val target: Double? = null,
    val unit: String? = null,
    val by: String? = null,
)

@Serializable
data class Plan(
    val title: String,
    val summary: String = "",
    @SerialName("starts_on") val startsOn: String,
    @SerialName("ends_on") val endsOn: String? = null,
    val goals: List<Goal> = emptyList(),
    val constraints: List<String> = emptyList(),
    val targets: Macros? = null,
    val week: Map<String, DayPlan> = emptyMap(),
    val overrides: Map<String, DayPlan>? = null,
) {
    companion object {
        val WEEKDAYS = listOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
    }
}

@Serializable
data class PublishedPlan(
    val version: Int,
    val plan: Plan,
    @SerialName("change_note") val changeNote: String = "",
    @SerialName("published_at") val publishedAt: String = "",
)

@Serializable
data class PlanVersion(
    val version: Int,
    val title: String = "",
    @SerialName("change_note") val changeNote: String = "",
    @SerialName("starts_on") val startsOn: String = "",
)

@Serializable
data class PlanResponse(val current: PublishedPlan? = null, val versions: List<PlanVersion> = emptyList())

// ---- a day's state (computed by the Worker with core's dayState)

@Serializable
data class ExerciseState(
    val exercise: Exercise,
    val ref: String,
    val setsDone: Int = 0,
    /** todo, in_progress, done, skipped, swapped */
    val status: String = "todo",
) {
    val settled: Boolean get() = status == "done" || status == "skipped" || status == "swapped"
}

@Serializable
data class WorkoutState(
    val workout: Workout,
    val ref: String,
    val exercises: List<ExerciseState> = emptyList(),
    /** todo, in_progress, done, skipped */
    val status: String = "todo",
    val setsDone: Int = 0,
    val setsTotal: Int = 0,
) {
    /** Where to resume: the first exercise not done (its index), and its next set (1-based). */
    val next: Pair<Int, Int>?
        get() = exercises.withIndex().firstOrNull { it.value.status == "todo" || it.value.status == "in_progress" }
            ?.let { it.index to it.value.setsDone + 1 }
}

@Serializable
data class MealState(
    val meal: Meal,
    val ref: String,
    /** todo, done, skipped, swapped */
    val status: String = "todo",
    val portion: String? = null,
)

@Serializable
data class Nutrition(val planned: Macros = Macros(), val eaten: Macros = Macros(), val targets: Macros = Macros())

@Serializable
data class DayState(
    val date: String,
    val day: DayPlan? = null,
    val workouts: List<WorkoutState> = emptyList(),
    val meals: List<MealState> = emptyList(),
    val completion: Double = 0.0,
    val nutrition: Nutrition = Nutrition(),
)

@Serializable
data class PlanSummary(val version: Int, val title: String = "", @SerialName("change_note") val changeNote: String = "")

@Serializable
data class LiveHR(val hr: Int? = null)

@Serializable
data class TodayResponse(val date: String, val plan: PlanSummary? = null, val state: DayState, val live: LiveHR? = null)

// ---- check-ins, feedback, vitals

@Serializable
data class CheckinData(
    val reps: Int? = null,
    val load: String? = null,
    @SerialName("duration_sec") val durationSec: Int? = null,
    val rpe: Double? = null,
    @SerialName("avg_hr") val avgHr: Int? = null,
    @SerialName("max_hr") val maxHr: Int? = null,
    val portion: String? = null,
    @SerialName("swapped_for") val swappedFor: String? = null,
    @SerialName("moved_to") val movedTo: String? = null,
)

@Serializable
data class NewCheckin(
    val date: String,
    val ref: String,
    /** set, exercise, workout, meal */
    val kind: String,
    /** done, partial, skipped, swapped */
    val status: String,
    val data: CheckinData? = null,
    val note: String? = null,
)

enum class FeedbackTag(val raw: String, val label: String) {
    TOO_EASY("too_easy", "Too easy"),
    TOO_HARD("too_hard", "Too hard"),
    PAIN("pain", "Pain or discomfort"),
    NO_TIME("no_time", "Not enough time"),
    LOVED_IT("loved_it", "Loved it"),
    HUNGRY("hungry", "Still hungry"),
    TOO_MUCH_FOOD("too_much_food", "Too much food"),
    OTHER("other", "Other");

    companion object {
        fun of(raw: String): FeedbackTag? = entries.firstOrNull { it.raw == raw }
    }
}

@Serializable
data class Feedback(
    val id: String,
    val date: String? = null,
    val ref: String? = null,
    val text: String = "",
    val tags: List<String> = emptyList(),
    val status: String = "open",
    @SerialName("agent_reply") val agentReply: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    val source: String? = null,
)

@Serializable
data class NewFeedback(val date: String?, val ref: String?, val text: String, val tags: List<String>)

@Serializable
data class Vital(
    val date: String,
    val metric: String,
    val value: Double,
    /** health, manual, watch */
    val source: String,
)

@Serializable
data class AdherenceDay(
    val date: String,
    val completion: Double = 0.0,
    @SerialName("workouts_done") val workoutsDone: Int = 0,
    @SerialName("workouts_planned") val workoutsPlanned: Int = 0,
    @SerialName("meals_done") val mealsDone: Int = 0,
    @SerialName("meals_planned") val mealsPlanned: Int = 0,
)

@Serializable
data class Count(val done: Int = 0, val planned: Int = 0)

@Serializable
data class Adherence(
    val days: List<AdherenceDay> = emptyList(),
    val average: Double = 0.0,
    val workouts: Count = Count(),
    val meals: Count = Count(),
    val streak: Int = 0,
)

@Serializable
data class ProgressResponse(val adherence: Adherence, val vitals: List<Vital> = emptyList())

@Serializable
data class Photo(val id: String, @SerialName("taken_on") val takenOn: String, val note: String? = null, val url: String? = null)

// ---- settings (every option is the user's switch)

@Serializable
data class Settings(
    val units: String = "metric",
    val timezone: String = TimeZone.getDefault().id,
    val vitals: Vitals = Vitals(),
    @SerialName("agent_access") val agentAccess: AgentAccess = AgentAccess(),
    val reminders: Reminders = Reminders(),
    val glasses: Glasses = Glasses(),
    val about: About = About(),
) {
    @Serializable
    data class Vitals(
        @SerialName("live_hr") val liveHr: Boolean = true,
        @SerialName("health_daily") val healthDaily: Boolean = true,
        val manual: Boolean = true,
        val photos: Boolean = false,
    )

    @Serializable
    data class AgentAccess(val vitals: Boolean = false, val photos: Boolean = false, val feedback: Boolean = true, val checkins: Boolean = true)

    @Serializable
    data class Reminders(
        val workout: Workout = Workout(),
        val meals: Toggle = Toggle(),
        val evening: Timed = Timed(),
        val weekly: Weekly = Weekly(),
    ) {
        @Serializable
        data class Workout(val on: Boolean = true, @SerialName("minutes_before") val minutesBefore: Int = 10)

        @Serializable
        data class Toggle(val on: Boolean = true)

        @Serializable
        data class Timed(val on: Boolean = true, val time: String = "21:00")

        @Serializable
        data class Weekly(val on: Boolean = true, val weekday: String = "sun", val time: String = "18:00")
    }

    @Serializable
    data class Glasses(@SerialName("show_hr") val showHr: Boolean = true, @SerialName("auto_rest_timer") val autoRestTimer: Boolean = true)

    @Serializable
    data class About(
        val goals: String = "",
        val restrictions: String = "",
        val equipment: String = "",
        val schedule: String = "",
        val diet: String = "",
        val notes: String = "",
    )
}

@Serializable
data class SettingsResponse(val settings: Settings, val saved: Boolean = false, val email: String? = null)

@Serializable
data class PairingCode(val code: String, @SerialName("expires_at") val expiresAt: String = "")

@Serializable
data class PairedDevice(val id: String, val label: String = "", @SerialName("last_used_at") val lastUsedAt: String? = null)

// ---- dates

object Day {
    /** The local date "YYYY-MM-DD". */
    fun today(): String = LocalDate.now().toString()

    fun date(s: String): LocalDate? = runCatching { LocalDate.parse(s) }.getOrNull()

    fun adding(days: Long, to: String): String = date(to)?.plusDays(days)?.toString() ?: to

    /** "HH:MM" → (hour, minute). */
    fun time(hhmm: String?): Pair<Int, Int>? {
        val p = hhmm?.split(":")?.map { it.toIntOrNull() ?: return null } ?: return null
        if (p.size != 2 || p[0] !in 0..23 || p[1] !in 0..59) return null
        return p[0] to p[1]
    }

    /** mon … sun for a date. */
    fun weekday(s: String): String = date(s)?.let { Plan.WEEKDAYS[it.dayOfWeek.value - 1] } ?: "mon"
}
