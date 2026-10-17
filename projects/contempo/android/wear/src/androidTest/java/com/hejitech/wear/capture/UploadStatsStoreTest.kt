package com.hejitech.wear.capture

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.time.LocalDate

/**
 * Instrumented tests for UploadStatsStore — a tiny SharedPreferences-backed
 * daily counter (see its kdoc). Directly manipulates the same
 * "upload_stats" prefs file (mirroring its private PREFS_NAME/KEY_DATE/
 * KEY_COUNT literals) to simulate a stale "yesterday" entry, since the class
 * has no injectable Clock to fake "today" through its public API — a real
 * device/emulator clock is a reasonable dependency to accept here for an
 * MVP-scale local counter, not worth a DI refactor just for this test.
 */
@RunWith(AndroidJUnit4::class)
class UploadStatsStoreTest {

    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val store = UploadStatsStore(context)
    private val rawPrefs = context.getSharedPreferences("upload_stats", Context.MODE_PRIVATE)

    @Before
    fun clearPrefs() {
        rawPrefs.edit().clear().commit()
    }

    @Test
    fun getUploadedTodayCount_withNoPriorRecord_isZero() {
        assertEquals(0, store.getUploadedTodayCount())
    }

    @Test
    fun recordUpload_once_setsCountToOne() {
        store.recordUpload()
        assertEquals(1, store.getUploadedTodayCount())
    }

    @Test
    fun recordUpload_multipleTimesSameDay_incrementsCount() {
        repeat(3) { store.recordUpload() }
        assertEquals(3, store.getUploadedTodayCount())
    }

    @Test
    fun getUploadedTodayCount_withStaleYesterdayRecord_resetsToZero() {
        rawPrefs.edit()
            .putString("date", LocalDate.now().minusDays(1).toString())
            .putInt("count", 5)
            .commit()

        assertEquals(0, store.getUploadedTodayCount())
    }

    @Test
    fun recordUpload_afterDateRollover_resetsToOneRatherThanIncrementingStaleCount() {
        rawPrefs.edit()
            .putString("date", LocalDate.now().minusDays(1).toString())
            .putInt("count", 5)
            .commit()

        store.recordUpload()

        assertEquals(1, store.getUploadedTodayCount())
    }
}
