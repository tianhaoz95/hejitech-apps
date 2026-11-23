package com.hejitech.fitloop.ui

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

data class NoteItem(val title: String, val text: String)
data class Release(val version: String, val month: String, val notes: List<NoteItem>)

/**
 * The Android app's own release notes: shown once after an update (signed in) and from Settings ›
 * What's New. Every release puts an entry first and sets CURRENT_VERSION, in step with the iPhone
 * app's WhatsNewView.swift (release.env's release_check refuses a version either one leaves out).
 */
object WhatsNew {
    const val CURRENT_VERSION = "1.3.0"
    private const val SEEN = "whats_new_seen"

    val releases = listOf(
        Release(version = "1.3.0", month = "November 2026", notes = listOf(
            NoteItem("Health Connect", "Turn on Settings › Daily Health Connect summary and FitLoop reads your weight, resting heart rate, HRV, sleep, steps and active energy once a day, like the iPhone app does with Health. Only what you allow, and your agent sees it only if you share vitals."),
            NoteItem("Workouts saved to Health Connect", "Finish a workout and FitLoop saves it to Health Connect as what it was: strength, cardio, mobility or intervals, with its title and time."),
            NoteItem("FitLoop on your Wear OS watch", "Open a workout on your phone and your watch follows along: the exercise, the set, the rest timer and your heart rate, which goes to your phone, your glasses and your agent. Tap Set done on your wrist."),
            NoteItem("What's New", "Notes like these now come with every update. Find them any time in Settings."),
        )),
        Release(version = "1.2.2", month = "November 2026", notes = listOf(
            NoteItem("One Pro, everywhere", "FitLoop is free on Google Play, with FitLoop Pro: a free week on the yearly plan, or once for life. Pro belongs to your account, so buying it here, on iPhone or on the web unlocks FitLoop everywhere you sign in."),
        )),
    )

    private fun prefs(context: Context) = context.getSharedPreferences("fitloop", Context.MODE_PRIVATE)

    /** True once per version: the first time the app opens signed in after an update. */
    fun shouldShow(context: Context): Boolean = prefs(context).getString(SEEN, null) != CURRENT_VERSION

    fun markSeen(context: Context) = prefs(context).edit().putString(SEEN, CURRENT_VERSION).apply()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WhatsNewSheet(onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        LazyColumn(
            Modifier.fillMaxWidth().padding(horizontal = 24.dp).testTag("whats-new"),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item { Text("What's New in FitLoop", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
            items(WhatsNew.releases) { r ->
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("${r.version} · ${r.month}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                    for (n in r.notes) {
                        Text(n.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(n.text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            item {
                Button(onClick = onDismiss, modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp).padding(bottom = 24.dp)) { Text("Continue") }
            }
        }
    }
}
