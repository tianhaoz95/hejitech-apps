package com.hejitech.contempo.ui.export

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hejitech.contempo.data.ServiceLocator
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import com.hejitech.core.model.MaterialParticipationTest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class ExportUiState(
    val isGenerating: Boolean = false,
    val csv: String? = null,
    val errorMessage: String? = null,
)

/**
 * IRS standard mileage rate (business use), cents per mile — illustrative and
 * needs annual updating (the IRS publishes a new rate each tax year); same
 * "flagged, not hardened into fact" spirit as the landing page's placeholder
 * pricing tiers. Verify against the current-year rate before relying on this
 * for a real filing.
 */
private const val IRS_STANDARD_MILEAGE_RATE = 0.67

/**
 * MVP export: CSV only, generated on-device from whatever's already synced
 * locally. The PRD's polished "CPA-ready package" (narrative + attachments +
 * readiness score) is explicitly fast-follow — see
 * reports/mvp-scope-v0.html Section 5.1. This screen exists so there's
 * *something* a host can hand over today, not the final version.
 *
 * Layout (four sections, blank-line separated — deliberately not one flat
 * table): a Summary the CPA can tally against without doing the arithmetic
 * themselves, a Time Log, a Mileage Log (a legally separate deduction from
 * the hours above, under IRC Section 274 rather than Section 469 — kept
 * apart rather than interleaved), and a Flagged-for-review section calling
 * out exactly the entries an auditor would push on first. See the
 * conversation history's IRS-reporting research for the reasoning behind
 * this structure — Treas. Reg. Section 1.469-5T(f)(4) sets a low bar
 * ("reasonable means"), but Moss v. Commissioner, 135 T.C. 365 (2010) shows
 * what actually happens to a reconstructed-after-the-fact log in Tax Court,
 * which is why "logged same day" vs "logged N days late" is surfaced
 * per-entry here rather than left implicit in raw timestamps.
 */
class ExportViewModel : ViewModel() {
    private val entryRepository = ServiceLocator.entryRepository
    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)

    private val _uiState = MutableStateFlow(ExportUiState())
    val uiState: StateFlow<ExportUiState> = _uiState.asStateFlow()

    fun generateCsv() {
        _uiState.value = _uiState.value.copy(isGenerating = true, errorMessage = null)
        viewModelScope.launch {
            try {
                val entries = entryRepository.observeEntries().first()
                _uiState.value = _uiState.value.copy(isGenerating = false, csv = buildCsv(entries))
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isGenerating = false, errorMessage = e.message ?: "Couldn't generate export.")
            }
        }
    }

    private fun buildCsv(entries: List<Entry>): String = buildString {
        // An open timer has no meaningful duration yet (see
        // TimerEntryCoordinator), and pure mileage-trip entries (isTrip)
        // never carry real hours — durationMinutes stays 0 for those by
        // construction (see MileageTripCoordinator) — so both are excluded
        // from the hours-bearing rows below. A mixed entry (real hours plus
        // incidental miles stated in the same utterance) still has
        // isTrip = false and legitimately appears in both the Time Log and
        // Mileage Log, since it contributes to both deductions.
        val hourEntries = entries.filterNot { it.inProgress || it.isTrip }
        val mileageEntries = entries.filter { it.miles > 0 && !it.inProgress }

        appendLine("Contempo hours & mileage export — generated ${dateFormatter.format(Date())}")
        appendLine(
            "This log is maintained contemporaneously per Treas. Reg. Section 1.469-5T(f)(4) " +
                "(material participation — reasonable means, e.g. logs/calendars/narrative summaries). " +
                "Each Time Log row below shows how many days after the activity it was logged (0 = same day)."
        )
        appendLine()

        appendSummarySection(this, hourEntries)
        appendLine()
        appendTimeLogSection(this, hourEntries)
        appendLine()
        appendMileageLogSection(this, mileageEntries)
        appendLine()
        appendFlaggedSection(this, hourEntries)
    }

    /**
     * Confirmed hours per property plus a grand total against the test
     * threshold, flagged once crossed — the arithmetic a CPA (or the host
     * themselves) would otherwise have to do by hand from the raw rows.
     * Pending entries are deliberately excluded from these totals — they
     * aren't a validated record yet — but still show up in the Time Log
     * below so nothing is silently missing from the export.
     */
    private fun appendSummarySection(builder: StringBuilder, hourEntries: List<Entry>) = with(builder) {
        appendLine("SUMMARY")
        appendLine("property,confirmed_hours,pending_hours")
        val confirmed = hourEntries.filter { it.statusEnum == EntryStatus.CONFIRMED }
        val pending = hourEntries.filter { it.statusEnum == EntryStatus.PENDING_REVIEW }
        val properties = (confirmed.map { it.propertyName } + pending.map { it.propertyName })
            .map { it.ifBlank { "(no property)" } }
            .distinct()
            .sorted()
        properties.forEach { property ->
            val confirmedHours = confirmed.filter { it.propertyName.ifBlank { "(no property)" } == property }
                .sumOf { it.durationMinutes } / 60.0
            val pendingHours = pending.filter { it.propertyName.ifBlank { "(no property)" } == property }
                .sumOf { it.durationMinutes } / 60.0
            appendLine("${csvEscape(property)},${"%.2f".format(confirmedHours)},${"%.2f".format(pendingHours)}")
        }
        val totalConfirmedHours = confirmed.sumOf { it.durationMinutes } / 60.0
        val totalPendingHours = pending.sumOf { it.durationMinutes } / 60.0
        appendLine("All properties,${"%.2f".format(totalConfirmedHours)},${"%.2f".format(totalPendingHours)}")
        appendLine()
        val thresholdNote = if (totalConfirmedHours >= MaterialParticipationTest.THRESHOLD_HOURS) {
            "Threshold met: ${"%.2f".format(totalConfirmedHours)} of ${MaterialParticipationTest.THRESHOLD_HOURS} " +
                "confirmed hours toward the ${MaterialParticipationTest.NAME} material participation test."
        } else {
            "${"%.2f".format(totalConfirmedHours)} of ${MaterialParticipationTest.THRESHOLD_HOURS} confirmed hours " +
                "toward the ${MaterialParticipationTest.NAME} material participation test " +
                "(${"%.2f".format(MaterialParticipationTest.THRESHOLD_HOURS - totalConfirmedHours)} still needed)."
        }
        appendLine(thresholdNote)
    }

    private fun appendTimeLogSection(builder: StringBuilder, hourEntries: List<Entry>) = with(builder) {
        appendLine("TIME LOG")
        appendLine("date,property,activity,duration_minutes,category,status,logged_at,contemporaneity")
        hourEntries.forEach { entry ->
            appendLine(
                listOf(
                    dateFormatter.format(entry.activityDate.toDate()),
                    csvEscape(entry.propertyName),
                    csvEscape(entry.task),
                    entry.durationMinutes.toString(),
                    entry.category,
                    entry.status,
                    dateFormatter.format(entry.loggedAt.toDate()),
                    csvEscape(contemporaneityLabel(entry.daysLate)),
                ).joinToString(",")
            )
        }
    }

    private fun contemporaneityLabel(daysLate: Int): String = when {
        daysLate <= 0 -> "logged same day"
        daysLate == 1 -> "logged 1 day late"
        else -> "logged $daysLate days late"
    }

    /**
     * Separate section, not interleaved with the Time Log above — this is a
     * distinct tax deduction (IRS standard mileage rate x business miles,
     * substantiated under IRC Section 274(d) rather than Section 469), computed
     * independently of the material-participation hours math, so it needs
     * its own total rather than folding into it. business_purpose names the
     * property specifically (a vague "business travel" purpose is a known
     * denial risk under Section 274(d)) rather than a generic label.
     */
    private fun appendMileageLogSection(builder: StringBuilder, mileageEntries: List<Entry>) = with(builder) {
        appendLine("MILEAGE LOG (separate deduction under IRC Section 274(d) — IRS standard mileage rate, verify current-year rate before filing)")
        appendLine("date,property,business_purpose,miles,capture_method,deduction_usd")
        mileageEntries.forEach { entry ->
            val purpose = if (entry.propertyName.isNotBlank()) {
                "Property management — ${entry.propertyName}"
            } else {
                "(no property specified — add detail before filing)"
            }
            appendLine(
                listOf(
                    dateFormatter.format(entry.activityDate.toDate()),
                    csvEscape(entry.propertyName),
                    csvEscape(purpose),
                    entry.miles.toString(),
                    entry.mileageCaptureMethod.ifBlank { "manual" },
                    "%.2f".format(entry.miles * IRS_STANDARD_MILEAGE_RATE),
                ).joinToString(",")
            )
        }
        val totalMiles = mileageEntries.sumOf { it.miles }
        appendLine("Total,,,${totalMiles},,${"%.2f".format(totalMiles * IRS_STANDARD_MILEAGE_RATE)}")
    }

    /**
     * Exactly what an auditor would push on first — pulled into its own
     * section rather than left for the CPA to spot buried in the Time Log,
     * since Moss v. Commissioner's outcome turned on exactly this kind of
     * vague/reconstructed entry.
     */
    private fun appendFlaggedSection(builder: StringBuilder, hourEntries: List<Entry>) = with(builder) {
        appendLine("FLAGGED FOR REVIEW")
        appendLine("date,property,activity,reasons")
        val flagged = hourEntries.filter { it.riskFlags.hasWarning }
        if (flagged.isEmpty()) {
            appendLine("(none)")
        } else {
            flagged.forEach { entry ->
                val reasons = buildList {
                    if (entry.isVague) add("vague description")
                    if (entry.isBackfilled) add(contemporaneityLabel(entry.daysLate))
                    addAll(entry.riskReasons)
                }
                appendLine(
                    listOf(
                        dateFormatter.format(entry.activityDate.toDate()),
                        csvEscape(entry.propertyName),
                        csvEscape(entry.task),
                        csvEscape(reasons.joinToString("; ")),
                    ).joinToString(",")
                )
            }
        }
    }

    private fun csvEscape(value: String): String =
        if (value.contains(',') || value.contains('"') || value.contains('\n')) {
            "\"${value.replace("\"", "\"\"")}\""
        } else {
            value
        }
}
