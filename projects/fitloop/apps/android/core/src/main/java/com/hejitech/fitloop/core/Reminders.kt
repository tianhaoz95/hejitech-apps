package com.hejitech.fitloop.core

import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * The local notifications FitLoop schedules from the plan and the user's reminder switches: before
 * each workout, at each meal, the evening check-in nudge and the weekly review for the agent. Pure
 * (the app hands them to AlarmManager), so it's tested; the same rules as the iPhone app's
 * ReminderPlanner. It plans a week ahead and the app re-plans on every launch and plan change.
 */
@Serializable
data class Reminder(
    val id: String,
    /** Local wall-clock time, "YYYY-MM-DDTHH:MM". */
    val at: String,
    val title: String,
    val body: String,
) {
    val time: LocalDateTime get() = LocalDateTime.parse(at)
}

object ReminderPlanner {
    const val MAX_PENDING = 60

    fun plan(published: PublishedPlan?, settings: Settings, from: String, days: Int = 7): List<Reminder> {
        val out = mutableListOf<Reminder>()
        val r = settings.reminders
        for (offset in 0 until days) {
            val date = Day.adding(offset.toLong(), from)
            val day = published?.let { dayPlan(it.plan, date) }
            if (day != null) {
                if (r.workout.on) {
                    for (w in day.workouts) {
                        val (h, m) = Day.time(w.time) ?: continue
                        val total = h * 60 + m - r.workout.minutesBefore
                        if (total < 0) continue
                        val first = w.exercises.firstOrNull()?.let { "First up: ${it.name}, ${it.sets} × ${it.target}." } ?: ""
                        out += Reminder(
                            "workout:$date:${w.id}", at(date, total / 60, total % 60),
                            if (r.workout.minutesBefore > 0) "${w.title} in ${r.workout.minutesBefore} min" else "Time for ${w.title}",
                            "${w.durationMin} min. $first".trim(),
                        )
                    }
                }
                if (r.meals.on) {
                    for (m in day.meals) {
                        val (h, mi) = Day.time(m.time) ?: continue
                        out += Reminder("meal:$date:${m.id}", at(date, h, mi), m.name, m.items.joinToString(", ") { "${it.name} ${it.amount}" })
                    }
                }
                if (r.evening.on && (day.workouts.isNotEmpty() || day.meals.isNotEmpty())) {
                    Day.time(r.evening.time)?.let { (h, m) ->
                        out += Reminder("evening:$date", at(date, h, m), "How did today go?", "Check off what you did and leave your agent a note.")
                    }
                }
            }
            if (r.weekly.on && Day.weekday(date) == r.weekly.weekday) {
                Day.time(r.weekly.time)?.let { (h, m) ->
                    out += Reminder("weekly:$date", at(date, h, m), "Weekly review", "Ask your agent to review the week in FitLoop and update your plan.")
                }
            }
        }
        return out.sortedBy { it.at }.take(MAX_PENDING)
    }

    /** The day plan for a date: an override, else the week's day; null outside the plan's dates. */
    fun dayPlan(plan: Plan, date: String): DayPlan? {
        if (date < plan.startsOn) return null
        if (plan.endsOn != null && date > plan.endsOn) return null
        return plan.overrides?.get(date) ?: plan.week[Day.weekday(date)]
    }

    private fun at(date: String, h: Int, m: Int): String = LocalDate.parse(date).atTime(h, m).toString()
}
