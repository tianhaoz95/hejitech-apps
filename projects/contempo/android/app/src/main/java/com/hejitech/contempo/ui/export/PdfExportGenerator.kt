package com.hejitech.contempo.ui.export

import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryCategory
import com.hejitech.core.model.EntryStatus
import com.hejitech.core.model.MaterialParticipationTest
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object PdfExportGenerator {
    const val DISCLAIMER_TEXT =
        "DISCLAIMER (BETA FEATURE): This document is generated for contemporaneous record-keeping under " +
            "Treas. Reg. §1.469-5T(f)(4). It is provided as a beta feature for documentation assistance only and " +
            "does not constitute legal, tax, or financial advice. Consult a certified CPA or tax attorney " +
            "for audit defense and tax filing determinations."

    private val dateFormatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    fun mileageRate(date: Date): Double {
        val cal = Calendar.getInstance().apply { time = date }
        val year = cal.get(Calendar.YEAR)
        return when {
            year < 2024 -> 0.655
            year == 2024 -> 0.67
            year == 2025 -> 0.70
            else -> 0.725
        }
    }

    fun column(text: String, width: Int): String {
        return if (text.length > width) {
            text.take(width - 1) + "…"
        } else {
            text.padEnd(width, ' ')
        }
    }

    fun timeLogRow(entry: Entry): String {
        val date = dateFormatter.format(entry.activityDate.toDate())
        val property = column(entry.propertyName.ifEmpty { "-" }, 20)
        val task = column(entry.task.ifEmpty { "Management" }, 30)
        val category = column(EntryCategory.displayName(entry.category).capitalizeWords(), 14)
        val hours = "%.1f".format(Locale.US, entry.durationMinutes / 60.0).padStart(5)
        val status = if (entry.statusEnum == EntryStatus.CONFIRMED) "Confirmed" else "Pending"
        return "$date  $property  $task  $category  $hours  $status"
    }

    val timeLogHeader =
        "${column("Date", 10)}  ${column("Property", 20)}  ${column("Task / Activity", 30)}  ${column("Category", 14)}  Hours  Status"

    fun mileageRow(entry: Entry): String {
        val date = entry.activityDate.toDate()
        val rate = mileageRate(date)
        val prop = column(entry.propertyName.ifEmpty { "-" }, 20)
        val milesStr = "%.1f".format(Locale.US, entry.miles).padStart(7)
        val rateStr = "%.3f".format(Locale.US, rate)
        val totalStr = "%.2f".format(Locale.US, entry.miles * rate)
        return "${dateFormatter.format(date)}  $prop  $milesStr mi @ \$$rateStr/mi = \$$totalStr"
    }

    fun generatePdf(entries: List<Entry>, outputFile: File) {
        val document = PdfDocument()
        val pageWidth = 612
        val pageHeight = 792
        val margin = 36f
        val bottom = pageHeight - margin - 14f
        val contentWidth = pageWidth - margin * 2

        val titlePaint = Paint().apply {
            color = Color.BLACK
            textSize = 18f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val subPaint = Paint().apply {
            color = Color.DKGRAY
            textSize = 9.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            isAntiAlias = true
        }
        val h1Paint = Paint().apply {
            color = Color.BLACK
            textSize = 12f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val monoFont = Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL)
        val monoBoldFont = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        val rowPaint = Paint().apply {
            color = Color.DKGRAY
            textSize = 7.5f
            typeface = monoFont
            isAntiAlias = true
        }
        val headerPaint = Paint().apply {
            color = Color.BLACK
            textSize = 7.5f
            typeface = monoBoldFont
            isAntiAlias = true
        }
        val footerPaint = Paint().apply {
            color = Color.GRAY
            textSize = 7f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
            isAntiAlias = true
        }
        val boxFillPaint = Paint().apply {
            color = Color.rgb(242, 242, 242)
            style = Paint.Style.FILL
        }
        val boxStrokePaint = Paint().apply {
            color = Color.LTGRAY
            style = Paint.Style.STROKE
            strokeWidth = 1f
        }
        val disclaimerPaint = Paint().apply {
            color = Color.DKGRAY
            textSize = 7.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.ITALIC)
            isAntiAlias = true
        }
        val statusGreenPaint = Paint().apply {
            color = Color.rgb(34, 139, 34)
            textSize = 10f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }
        val statusOrangePaint = Paint().apply {
            color = Color.rgb(204, 102, 0)
            textSize = 10f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }

        val rowHeight = 11f
        val timeEntries = entries.filter { !it.inProgress && !it.isTrip }.sortedBy { it.activityDate.toDate() }
        val trips = entries.filter { it.miles > 0 && !it.inProgress }.sortedBy { it.activityDate.toDate() }

        var pageNumber = 1
        var pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
        var currentPage = document.startPage(pageInfo)
        var canvas = currentPage.canvas
        var y = margin

        fun newPage() {
            canvas.drawText("Contempo Audit Binder · page $pageNumber", margin, pageHeight - margin, footerPaint)
            document.finishPage(currentPage)
            pageNumber++
            pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
            currentPage = document.startPage(pageInfo)
            canvas = currentPage.canvas
            y = margin
        }

        fun ensure(height: Float, header: String? = null) {
            if (y + height > bottom) {
                newPage()
                if (header != null) {
                    canvas.drawText(header, margin, y + 8f, headerPaint)
                    y += rowHeight + 2f
                }
            }
        }

        // Title
        y += 18f
        canvas.drawText("Contempo STR Material Participation Audit Binder", margin, y, titlePaint)
        y += 20f
        canvas.drawText("Generated on ${dateFormatter.format(Date())} · Treas. Reg. §1.469-5T(f)(4) Contemporaneous Log", margin, y, subPaint)
        y += 16f

        // Disclaimer box
        val boxRect = RectF(margin, y, margin + contentWidth, y + 46f)
        canvas.drawRect(boxRect, boxFillPaint)
        canvas.drawRect(boxRect, boxStrokePaint)
        val lines = listOf(
            "DISCLAIMER (BETA FEATURE): This document is generated for contemporaneous record-keeping under",
            "Treas. Reg. §1.469-5T(f)(4). It is provided as a beta feature for documentation assistance only and",
            "does not constitute legal, tax, or financial advice. Consult a certified CPA or tax attorney",
            "for audit defense and tax filing determinations."
        )
        var dy = y + 12f
        for (l in lines) {
            canvas.drawText(l, margin + 6f, dy, disclaimerPaint)
            dy += 10f
        }
        y += 56f

        // 1. Summary
        canvas.drawText("1. MATERIAL PARTICIPATION SUMMARY", margin, y, h1Paint)
        y += 18f
        val confirmed = timeEntries.filter { it.statusEnum == EntryStatus.CONFIRMED }.sumOf { it.durationMinutes } / 60.0
        val pending = timeEntries.filter { it.statusEnum == EntryStatus.PENDING_REVIEW }.sumOf { it.durationMinutes } / 60.0
        val threshold = MaterialParticipationTest.THRESHOLD_HOURS
        val summaryLine = "Confirmed Hours: %.1f hrs  |  Pending Review: %.1f hrs  |  Goal (%s): %d hrs".format(
            Locale.US, confirmed, pending, MaterialParticipationTest.NAME, threshold
        )
        val summaryPaint = if (confirmed >= threshold) statusGreenPaint else statusOrangePaint
        canvas.drawText(summaryLine, margin + 8f, y, summaryPaint)
        y += 14f
        canvas.drawText("${timeEntries.size} time entries and ${trips.size} trips, all listed below.", margin + 8f, y, subPaint)
        y += 22f

        // 2. Time Log
        ensure(18f + rowHeight * 3f)
        canvas.drawText("2. CONTEMPORANEOUS TIME LOG (HOURS)", margin, y, h1Paint)
        y += 18f
        canvas.drawText(timeLogHeader, margin, y, headerPaint)
        y += rowHeight + 2f
        for (entry in timeEntries) {
            ensure(rowHeight, header = timeLogHeader)
            canvas.drawText(timeLogRow(entry), margin, y, rowPaint)
            y += rowHeight
        }
        y += 16f

        // 3. Mileage Log
        if (trips.isNotEmpty()) {
            ensure(16f + rowHeight * 2f)
            canvas.drawText("3. BUSINESS MILEAGE LOG (IRC §274(d))", margin, y, h1Paint)
            y += 16f
            for (trip in trips) {
                ensure(rowHeight)
                canvas.drawText(mileageRow(trip), margin, y, rowPaint)
                y += rowHeight
            }
        }

        canvas.drawText("Contempo Audit Binder · page $pageNumber", margin, pageHeight - margin, footerPaint)
        document.finishPage(currentPage)

        outputFile.parentFile?.mkdirs()
        FileOutputStream(outputFile).use { out ->
            document.writeTo(out)
        }
        document.close()
    }

    private fun String.capitalizeWords(): String =
        split(' ').joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
}
