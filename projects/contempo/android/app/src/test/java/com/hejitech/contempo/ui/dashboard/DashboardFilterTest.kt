package com.hejitech.contempo.ui.dashboard

import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.model.EntryStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DashboardFilterTest {

    private fun createEntry(
        property: String,
        task: String,
        minutes: Int,
        category: String,
        roleId: String = "",
    ): Entry = Entry(
        id = "id_${task.hashCode()}",
        propertyName = property,
        task = task,
        durationMinutes = minutes,
        category = category,
        status = EntryStatus.CONFIRMED.firestoreValue,
        roleId = roleId,
    )

    private val sampleEntries = listOf(
        createEntry("Ocean Ave Cottage", "Turnover clean", 120, "turnover"),
        createEntry("Ocean Ave Cottage", "Fix faucet", 60, "maintenance"),
        createEntry("Pine Ridge Cabin", "Guest messages", 30, "guest_communication"),
        createEntry("Pine Ridge Cabin", "Deck repaint", 240, "maintenance", roleId = "contractor"),
    )

    @Test
    fun testFilteredHoursCountOnlyTheOwnersHours() {
        val selectedProperty = "Pine Ridge Cabin"
        val filtered = sampleEntries.filter { entry ->
            val propName = if (entry.propertyName.isEmpty()) "(No property)" else entry.propertyName
            propName == selectedProperty
        }
        assertEquals(2, filtered.size)

        val filteredHours = filtered
            .filter { it.isOwnerHours && it.statusEnum == EntryStatus.CONFIRMED && !it.inProgress && !it.isTrip }
            .sumOf { it.durationMinutes } / 60.0

        // Contractor's 4h are listed, but only owner's 0.5h are counted
        assertEquals(0.5, filteredHours, 0.001)
    }

    @Test
    fun testCategoryFilterUsesStoredValuesAndReadableLabels() {
        val categories = listOf("All") + sampleEntries.map { it.category }.distinct().sortedBy { EntryCategory.displayName(it) }
        val labels = categories.map { cat ->
            if (cat == "All") "All"
            else EntryCategory.displayName(cat).split(" ").joinToString(" ") { it.replaceFirstChar(Char::titlecase) }
        }
        assertEquals(listOf("All", "Guest Communication", "Maintenance", "Turnover"), labels)

        val selectedCategory = "maintenance"
        val filtered = sampleEntries.filter { it.category.equals(selectedCategory, ignoreCase = true) }
        assertEquals(2, filtered.size)

        val filteredHours = filtered
            .filter { it.isOwnerHours && it.statusEnum == EntryStatus.CONFIRMED && !it.inProgress && !it.isTrip }
            .sumOf { it.durationMinutes } / 60.0

        assertEquals(1.0, filteredHours, 0.001)
    }

    @Test
    fun testSearchMatchesTaskPropertyAndCategory() {
        var query = "faucet"
        var filtered = sampleEntries.filter { entry ->
            entry.task.lowercase().contains(query) ||
            entry.propertyName.lowercase().contains(query) ||
            entry.category.lowercase().contains(query)
        }
        assertEquals(listOf("Fix faucet"), filtered.map { it.task })

        query = "pine"
        filtered = sampleEntries.filter { entry ->
            entry.task.lowercase().contains(query) ||
            entry.propertyName.lowercase().contains(query) ||
            entry.category.lowercase().contains(query)
        }
        assertEquals(2, filtered.size)
    }
}
