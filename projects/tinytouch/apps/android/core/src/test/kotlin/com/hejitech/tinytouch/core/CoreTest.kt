package com.hejitech.tinytouch.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CoreTest {
    @Test fun parsesEveryRawValueAndLegacyNames() {
        GameMode.entries.forEach { assertEquals(it, GameMode.parse(it.raw)) }
        assertEquals(GameMode.SOUND_GARDEN, GameMode.parse("Xylophone"))
        assertEquals(GameMode.SOUND_GARDEN, GameMode.parse(" sound_garden "))
        assertEquals(GameMode.BUBBLES, GameMode.parse("Bubble Pop"))
        assertEquals(GameMode.LULLABY, GameMode.parse("SleepyMoon"))
        assertNull(GameMode.parse("tetris"))
        assertNull(GameMode.parse(null))
    }

    @Test fun rawValuesMatchTheAppleApps() {
        assertEquals(
            listOf("bubbles", "animals", "soundGarden", "sparkles", "lullaby"),
            GameMode.entries.map { it.raw },
        )
    }

    @Test fun newerStampWinsAndUnstampedApplies() {
        assertTrue(SettingsSync.isNewer(null, 100.0))
        assertTrue(SettingsSync.isNewer(101.0, 100.0))
        assertFalse(SettingsSync.isNewer(100.0, 100.0))
        assertFalse(SettingsSync.isNewer(99.0, 100.0))
    }

    @Test fun settingsRoundTripWithTheAppleKeys() {
        val p = SettingsPayload(
            currentMode = "lullaby", timerMinutes = 5, soundEnabled = true, voiceEnabled = false,
            hapticsEnabled = true, lowStimulation = true, lockHoldDuration = 5.0,
            settingsChangedAt = 1_700_000_000.5, action = SyncKeys.ACTION_TRIGGER_LULLABY, timestamp = 1.0,
        )
        val m = p.toMap()
        assertEquals("lullaby", m["currentMode"])
        assertEquals(5, m["timerMinutes"])
        assertEquals(1_700_000_000.5, m["settingsChangedAt"])
        assertEquals("triggerLullaby", m["action"])
        assertEquals(p, SettingsPayload.fromMap(m))
        assertTrue(p.triggersLullaby)
    }

    @Test fun payloadsTolerateMissingFieldsAndOtherNumberTypes() {
        val p = SettingsPayload.fromMap(mapOf("timerMinutes" to 3L, "lockHoldDuration" to 3, "junk" to "x"))
        assertEquals(3, p.timerMinutes)
        assertEquals(3.0, p.lockHoldDuration)
        assertNull(p.currentMode)
        assertNull(p.settingsChangedAt)
        assertTrue(SettingsPayload().toMap().isEmpty())
    }

    @Test fun statusRoundTrip() {
        val s = StatusPayload(
            currentMode = "animals", touchesCount = 42, isTimerActive = true, remainingSeconds = 61,
            soundEnabled = false, voiceEnabled = true, hapticsEnabled = false, lowStimulation = false,
            lockHoldDuration = 3.0, settingsChangedAt = 12.0, timestamp = 13.0,
        )
        assertEquals(42, s.toMap()["touchesCount"])
        assertEquals(s, StatusPayload.fromMap(s.toMap()))
    }

    @Test fun timerCountsDownAndFiresOnce() {
        val t = SessionTimer()
        assertFalse(t.tick())
        t.set(1)
        assertTrue(t.isActive)
        assertEquals(60, t.remainingSeconds)
        repeat(59) { assertFalse(t.tick()) }
        assertTrue(t.tick())
        assertFalse(t.isActive)
        assertFalse(t.tick())
        t.set(0)
        assertFalse(t.isActive)
        assertEquals(0, t.selectedMinutes)
    }

    @Test fun formatsRemainingTime() {
        assertEquals("Off", formatRemaining(false, 90))
        assertEquals("1:30", formatRemaining(true, 90))
        assertEquals("10:00", formatRemaining(true, 600))
        assertEquals("0:05", formatRemaining(true, 5))
    }

    @Test fun launchLinks() {
        assertNull(launchModeFor("play", null))
        assertEquals(GameMode.LULLABY, launchModeFor("lullaby", null))
        assertEquals(GameMode.BUBBLES, launchModeFor("play", "bubbles"))
        assertEquals(GameMode.SPARKLES, launchModeFor("PLAY", "Sparkles"))
        assertNull(launchModeFor(null, null))
    }

    @Test fun chimesStayPentatonic() {
        assertEquals(listOf("chime_c4", "chime_d4", "chime_e4", "chime_g4", "chime_a4", "chime_c5"), Sounds.PENTATONIC)
        assertEquals("chime_c4", Sounds.chime(-3))
        assertEquals("chime_c5", Sounds.chime(99))
        assertEquals(15, Sounds.ALL.size)
        assertEquals("woof", Sounds.animal("Puppy"))
        assertEquals("boing", Sounds.animal("bunny"))
    }
}
