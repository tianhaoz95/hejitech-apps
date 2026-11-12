package com.hejitech.toddlercam.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CoreTest {

    @Test
    fun testFaceEmojiTypeValues() {
        assertEquals("👑", FaceEmojiType.CROWN.emoji)
        assertEquals("Lion", FaceEmojiType.LION.displayName)
        assertEquals(FaceAnchorPosition.EYES, FaceEmojiType.SUNGLASSES.anchorPosition)
        assertEquals(FaceEmojiType.UNICORN, FaceEmojiType.fromRaw("unicorn"))
        assertNull(FaceEmojiType.fromRaw("unknown"))
    }

    @Test
    fun testSoundTypeAttentionGrabbers() {
        assertTrue(SoundType.QUACK.isAttentionGrabber)
        assertTrue(SoundType.WOOF.isAttentionGrabber)
        assertTrue(SoundType.MEOW.isAttentionGrabber)
        assertTrue(SoundType.GIGGLE.isAttentionGrabber)
        assertEquals("shutter", SoundType.SHUTTER.rawValue)
        assertEquals(SoundType.BOING, SoundType.fromRaw("boing"))
    }

    @Test
    fun testToddlerStateSerialization() {
        val state = ToddlerState(
            isToddlerLocked = true,
            captureMode = CameraCaptureMode.VIDEO.rawValue,
            isRecordingVideo = true,
            videoRecordingDurationSec = 42,
            primaryPosition = CameraPosition.FRONT.rawValue,
            activeFaceEmoji = "lion",
            lastPhotoTimestamp = 123456789L
        )

        val json = state.toJson()
        val decoded = ToddlerState.fromJson(json)

        assertNotNull(decoded)
        assertEquals(true, decoded?.isToddlerLocked)
        assertEquals("Video", decoded?.captureMode)
        assertEquals(true, decoded?.isRecordingVideo)
        assertEquals(42L, decoded?.videoRecordingDurationSec)
        assertEquals("front", decoded?.primaryPosition)
        assertEquals("lion", decoded?.activeFaceEmoji)
        assertEquals(123456789L, decoded?.lastPhotoTimestamp)
    }

    @Test
    fun testWatchActionMessageSerialization() {
        val msg = WatchActionMessage(
            action = WatchConstants.ACTION_PLAY_SOUND,
            sound = "quack"
        )
        val json = msg.toJson()
        val decoded = WatchActionMessage.fromJson(json)
        assertNotNull(decoded)
        assertEquals(WatchConstants.ACTION_PLAY_SOUND, decoded?.action)
        assertEquals("quack", decoded?.sound)
    }
}
