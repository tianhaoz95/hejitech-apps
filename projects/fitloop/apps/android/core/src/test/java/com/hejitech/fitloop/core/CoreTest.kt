package com.hejitech.fitloop.core

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Fixtures are the Worker's real responses for the seed athlete (shared with FitLoopKit's tests). */
class CoreTest {
    private fun fixture(name: String): String = javaClass.classLoader!!.getResource("$name.json")!!.readText()
    private val json = Backend.json

    @Test
    fun decodesToday() {
        val t = json.decodeFromString<TodayResponse>(fixture("today"))
        assertEquals("Full body A", t.state.day?.title)
        val w = t.state.workouts.first()
        assertEquals("8-10 reps @ 24 kg", w.exercises[1].exercise.target)
        assertNull(w.exercises[1].exercise.repsCount)
        assertEquals("40 s", w.exercises[4].exercise.target)
        assertEquals(0, w.next?.first)
        assertEquals(4, t.state.meals.size)
        assertEquals(2200.0, t.state.nutrition.targets.calories!!, 0.0)
    }

    @Test
    fun decodesPlanProgressFeedbackSettings() {
        val p = json.decodeFromString<PlanResponse>(fixture("plan"))
        assertEquals(7, p.current?.plan?.week?.size)
        assertEquals(p.current?.version, p.versions.first().version)
        assertEquals(14, json.decodeFromString<ProgressResponse>(fixture("progress")).adherence.days.size)
        assertTrue(json.decodeFromString<List<Feedback>>(fixture("feedback")).any { "pain" in it.tags })
        val s = json.decodeFromString<SettingsResponse>(fixture("settings"))
        assertTrue(s.settings.reminders.evening.on)
        assertFalse(s.settings.vitals.photos)
    }

    @Test
    fun exerciseAnimationTakesEitherKey() {
        fun ex(key: String) = json.decodeFromString<Exercise>(
            """{"id":"squat","name":"Goblet squat","sets":3,"reps":10,"rest_sec":90,"animation":{"$key":"https://example.com/squat.gif","steps":["Stand tall","Squat down"]}}""",
        )
        assertEquals("https://example.com/squat.gif", ex("gifUrl").animation?.gifUrl)
        assertEquals("https://example.com/squat.gif", ex("gif_url").animation?.gifUrl)
        assertEquals(10, ex("gifUrl").repsCount)
        assertEquals("10 reps", ex("gifUrl").target)
    }

    @Test
    fun settingsAndCheckinsEncodeSnakeCase() {
        val s = json.parseToJsonElement(json.encodeToString(Settings())).jsonObject
        assertNotNull(s["agent_access"])
        assertEquals(10, s.getValue("reminders").jsonObject.getValue("workout").jsonObject.getValue("minutes_before").jsonPrimitive.int)
        assertEquals(Settings(), json.decodeFromString<Settings>(json.encodeToString(Settings())))

        val c = NewCheckin("2026-10-26", "full-body-a/plank/1", "set", "done", CheckinData(durationSec = 40, avgHr = 131))
        val d = json.parseToJsonElement(json.encodeToString(c)).jsonObject.getValue("data").jsonObject
        assertEquals(40, d.getValue("duration_sec").jsonPrimitive.int)
        assertEquals(131, d.getValue("avg_hr").jsonPrimitive.int)
        assertFalse("reps" in d) // nulls aren't sent
    }

    @Test
    fun days() {
        assertEquals("mon", Day.weekday("2026-10-26"))
        assertEquals("sun", Day.weekday("2026-11-01"))
        assertEquals("2026-11-04", Day.adding(7, "2026-10-28"))
        assertNull(Day.time("25:00"))
        assertEquals(9 to 5, Day.time("09:05"))
        assertEquals("1:30", formatSeconds(90))
    }

    @Test
    fun reminders() {
        val plan = json.decodeFromString<PlanResponse>(fixture("plan")).current!!
        var monday = plan.plan.startsOn
        while (Day.weekday(monday) != "mon") monday = Day.adding(1, monday)
        val all = ReminderPlanner.plan(plan, Settings(), monday)
        val workout = all.first { it.id.startsWith("workout:") }
        assertEquals(11, workout.time.hour)
        assertEquals(50, workout.time.minute)
        assertEquals("Full body A in 10 min", workout.title)
        assertTrue(all.any { it.id == "meal:$monday:lunch" })
        assertTrue(all.any { it.id == "evening:$monday" })
        assertEquals(1, all.count { it.id.startsWith("weekly:") })
        assertTrue(all.size <= ReminderPlanner.MAX_PENDING)
        val quiet = Settings(reminders = Settings.Reminders(meals = Settings.Reminders.Toggle(false), evening = Settings.Reminders.Timed(false)))
        assertFalse(ReminderPlanner.plan(plan, quiet, monday).any { it.id.startsWith("meal:") || it.id.startsWith("evening:") })
        assertTrue(ReminderPlanner.plan(null, quiet, monday).all { it.id.startsWith("weekly:") })
    }

    @Test
    fun errorMessagesComeFromTheWorker() {
        assertEquals("no meal lunch on 2026-10-26", BackendException.Http(422, """{"error":"no meal lunch on 2026-10-26"}""").message)
        assertTrue(BackendException.Http(401, "").isUnauthorized)
    }

    @Test
    fun oauthStartUsesPkce() {
        val start = Backend(BackendConfig.LOCAL).oauthStart("google", "fitloop://login-callback")
        assertTrue(start.url.startsWith("http://127.0.0.1:55421/auth/v1/authorize?provider=google&redirect_to=fitloop%3A%2F%2Flogin-callback&code_challenge="))
        assertTrue(start.url.endsWith("&code_challenge_method=s256"))
        assertTrue(start.verifier.length >= 43)
    }
}
