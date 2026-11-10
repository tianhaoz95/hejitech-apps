package com.hejitech.headway.core

import com.hejitech.headway.core.model.*
import kotlinx.serialization.json.Json
import org.junit.Assert.*
import org.junit.Test

/** /api/family responses captured from the local stack (the same fixtures as HeadwayKit's tests). */
class FamilyTest {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; encodeDefaults = true }
    private fun fixture(name: String): FamilyState =
        json.decodeFromString(javaClass.classLoader!!.getResource("$name.json")!!.readText())

    @Test
    fun decodesAsViewer() {
        val f = fixture("family-viewer")
        val g = f.group!!
        assertFalse(g.owner)
        assertTrue(g.pendingInvites.isEmpty())
        val alex = f.others.single()
        assertEquals("Alex", alex.displayName)
        assertTrue(alex.isOwner)
        assertEquals(listOf(ShareKind.TRIP, ShareKind.STATUS), alex.sharedWithMe)
        assertEquals(ShareKind.TRIP, alex.train?.source)
        assertEquals(StatusCode.ON_MY_WAY, alex.status?.code)
        assertEquals(FollowPrefs(listOf(ShareKind.TRIP), true), alex.follow)
        assertTrue(f.currentShares.isEmpty())
        assertEquals(mapOf(alex.userId to FollowPrefs(listOf(ShareKind.TRIP), true)), f.currentFollows)
    }

    @Test
    fun decodesAsOwner() {
        val f = fixture("family-owner")
        assertTrue(f.group!!.owner)
        assertEquals(1, f.group!!.pendingInvites.size)
        val viewer = f.others.single().userId
        val trip = f.share(ShareKind.TRIP)!!
        assertEquals(listOf(viewer), trip.viewers)
        assertEquals(listOf(viewer), trip.notified)
        assertEquals(listOf(viewer), trip.live)
        assertEquals(mapOf(ShareKind.TRIP to listOf(viewer), ShareKind.STATUS to listOf(viewer)), f.currentShares)
        assertEquals("On my way", f.me?.status?.text)
    }
}
