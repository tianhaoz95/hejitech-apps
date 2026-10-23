package com.hejitech.contempo.ui.export

import com.hejitech.core.model.Entry
import com.hejitech.core.model.Timestamp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar

class PdfExportGeneratorTest {
    @Test
    fun mileageRateFollowsTheIrsRateForEachYear() {
        val cal = Calendar.getInstance()

        cal.set(2023, Calendar.JUNE, 1)
        assertEquals(0.655, PdfExportGenerator.mileageRate(cal.time), 1e-4)

        cal.set(2024, Calendar.JULY, 1)
        assertEquals(0.67, PdfExportGenerator.mileageRate(cal.time), 1e-4)

        cal.set(2025, Calendar.DECEMBER, 31)
        assertEquals(0.70, PdfExportGenerator.mileageRate(cal.time), 1e-4)

        cal.set(2026, Calendar.JANUARY, 1)
        assertEquals(0.725, PdfExportGenerator.mileageRate(cal.time), 1e-4)
    }

    @Test
    fun columnFormatsAndPadsOrTruncates() {
        assertEquals("Hello     ", PdfExportGenerator.column("Hello", 10))
        assertEquals("Very long…", PdfExportGenerator.column("Very long description that exceeds limit", 10))
    }

    @Test
    fun timeLogRowFormatsCorrectly() {
        val cal = Calendar.getInstance()
        cal.set(2026, Calendar.OCTOBER, 22, 10, 0)
        val entry = Entry(
            propertyName = "Ocean View Cottage",
            task = "Repair water heater",
            durationMinutes = 120,
            category = "maintenance",
            status = "confirmed",
            activityDate = Timestamp(cal.time),
        )
        val row = PdfExportGenerator.timeLogRow(entry)
        assertTrue(row.contains("2026-10-22"))
        assertTrue(row.contains("Ocean View Cottage"))
        assertTrue(row.contains("Repair water heater"))
        assertTrue(row.contains("2.0"))
        assertTrue(row.contains("Confirmed"))
    }
}
