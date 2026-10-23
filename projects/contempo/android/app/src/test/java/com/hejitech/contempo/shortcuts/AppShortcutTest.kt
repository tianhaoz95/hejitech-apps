package com.hejitech.contempo.shortcuts

import java.net.URI
import org.junit.Assert.assertEquals
import org.junit.Test

class AppShortcutTest {
    @Test
    fun testShortcutUriStructure() {
        val voiceUri = URI.create("contempo://capture?mode=audio")
        assertEquals("contempo", voiceUri.scheme)
        assertEquals("capture", voiceUri.host)
        assertEquals("mode=audio", voiceUri.query)

        val mileageUri = URI.create("contempo://capture?mode=trip")
        assertEquals("mode=trip", mileageUri.query)

        val manualUri = URI.create("contempo://capture?mode=manual")
        assertEquals("mode=manual", manualUri.query)
    }
}
