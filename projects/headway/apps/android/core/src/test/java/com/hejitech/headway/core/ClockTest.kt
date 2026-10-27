package com.hejitech.headway.core

import com.hejitech.headway.core.model.Clock
import org.junit.Assert.*
import org.junit.Test

class ClockTest {
    @Test
    fun testUntil() {
        val now = 1000000000L
        assertEquals("now", Clock.until(now.toDouble(), now))
        assertEquals("now", Clock.until((now - 60000).toDouble(), now))
        assertEquals("5m", Clock.until((now + 5 * 60000).toDouble(), now))
        assertEquals("65m", Clock.until((now + 65 * 60000).toDouble(), now))
        assertEquals("2h05", Clock.until((now + 125 * 60000).toDouble(), now))
    }

    @Test
    fun testMinutesAndHhmm() {
        assertEquals(0, Clock.minutes("00:00"))
        assertEquals(495, Clock.minutes("08:15"))
        assertEquals(1050, Clock.minutes("17:30"))
        assertNull(Clock.minutes("invalid"))

        assertEquals("08:15", Clock.hhmm(495))
        assertEquals("17:30", Clock.hhmm(1050))
    }
}
