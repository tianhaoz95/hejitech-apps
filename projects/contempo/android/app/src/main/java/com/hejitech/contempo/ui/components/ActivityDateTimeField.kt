package com.hejitech.contempo.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.hejitech.contempo.R
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Date
import java.util.Locale

/**
 * Read-only trigger field that opens a date picker, then a time picker,
 * merging both into a single epoch-millis value. No Material3
 * TimePickerDialog exists, so the time step is a plain AlertDialog wrapping
 * TimePicker. Shared between ConfirmScreen (new/pending entries) and
 * EntryDetailScreen's inline field editor (already-confirmed entries) — see
 * both call sites for why this needs to be editable in each place, not just
 * displayed.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActivityDateTimeField(millis: Long, onChanged: (Long) -> Unit) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    var pendingMillis by remember { mutableStateOf(millis) }

    OutlinedTextField(
        value = formatActivityDateTime(millis),
        onValueChange = {},
        readOnly = true,
        label = { Text(stringResource(R.string.confirm_activity_date_label)) },
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                pendingMillis = millis
                showDatePicker = true
            },
    )

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = utcMidnightMillis(pendingMillis))
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { pendingMillis = mergeUtcDateWithLocalTime(it, pendingMillis) }
                    showDatePicker = false
                    showTimePicker = true
                }) { Text(stringResource(R.string.confirm_date_picker_next)) }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text(stringResource(R.string.confirm_cancel_button)) } },
        ) { DatePicker(state = datePickerState) }
    }

    if (showTimePicker) {
        val localTime = Instant.ofEpochMilli(pendingMillis).atZone(ZoneId.systemDefault()).toLocalTime()
        val timePickerState = rememberTimePickerState(initialHour = localTime.hour, initialMinute = localTime.minute)
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text(stringResource(R.string.confirm_time_picker_title)) },
            text = { TimePicker(state = timePickerState) },
            confirmButton = {
                TextButton(onClick = {
                    onChanged(mergeLocalTimeIntoMillis(pendingMillis, timePickerState.hour, timePickerState.minute))
                    showTimePicker = false
                }) { Text(stringResource(R.string.confirm_button)) }
            },
            dismissButton = { TextButton(onClick = { showTimePicker = false }) { Text(stringResource(R.string.confirm_cancel_button)) } },
        )
    }
}

/** Material3's DatePicker seeds/reports selections as UTC-midnight millis for the calendar date. */
private fun utcMidnightMillis(millis: Long): Long =
    Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()

/** Takes the UTC-midnight date the picker returned, keeps the previously-selected time-of-day. */
private fun mergeUtcDateWithLocalTime(utcMidnightMillisValue: Long, previousMillis: Long): Long {
    val newDate = Instant.ofEpochMilli(utcMidnightMillisValue).atZone(ZoneOffset.UTC).toLocalDate()
    val previousTime = Instant.ofEpochMilli(previousMillis).atZone(ZoneId.systemDefault()).toLocalTime()
    return LocalDateTime.of(newDate, previousTime).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
}

private fun mergeLocalTimeIntoMillis(baseMillis: Long, hour: Int, minute: Int): Long {
    val baseDate = Instant.ofEpochMilli(baseMillis).atZone(ZoneId.systemDefault()).toLocalDate()
    return LocalDateTime.of(baseDate, LocalTime.of(hour, minute)).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
}

private val activityDateFormatter = SimpleDateFormat("EEE MMM d, HH:mm", Locale.getDefault())
private fun formatActivityDateTime(millis: Long): String = activityDateFormatter.format(Date(millis))
