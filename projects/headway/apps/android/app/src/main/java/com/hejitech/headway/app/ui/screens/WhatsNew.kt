package com.hejitech.headway.app.ui.screens

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.hejitech.headway.app.ui.theme.StatusGrey

data class WhatsNewItem(val title: String, val description: String)
data class ReleaseNotes(val version: String, val date: String, val items: List<WhatsNewItem>)

/**
 * The in-app release notes, shown once after an update and from Settings › What's New. Every release
 * adds an entry at the top of `releases` and sets `CURRENT_VERSION` to it, in step with the iPhone
 * app's `WhatsNewView.swift` (release.env's release_check refuses a version either doesn't describe).
 */
object WhatsNew {
    const val CURRENT_VERSION = "1.4.3"
    private const val KEY_SEEN = "last_seen_whats_new_version"

    val releases = listOf(
        ReleaseNotes(version = "1.4.3", date = "November 2026", items = listOf(
            WhatsNewItem("Headway on your Wear OS watch", "The watch app now installs from Google Play with the phone app, and its tile works: add Headway to your tiles for a countdown to your next train."),
            WhatsNewItem("Leave now", "When it's time to go, the card says \"Leave now\" instead of \"Leave in now\"."),
            WhatsNewItem("Clearer about location", "Before Android asks for location, Headway explains what it's for: noticing when you're on a train, and estimating your walk to the station. It's never stored."),
            WhatsNewItem("Easier to read", "The status bar stays readable when your phone uses the light theme."),
        )),
        ReleaseNotes(version = "1.4.2", date = "November 2026", items = listOf(
            WhatsNewItem("A fresh build", "Nothing new to try in this one: it's a new build of 1.4.1, with Glasses still in Settings under Devices."),
        )),
        ReleaseNotes(version = "1.4.1", date = "November 2026", items = listOf(
            WhatsNewItem("Glasses moved into Settings", "Even G2 smart glasses pairing and R1 ring controls now live in Settings under Devices, keeping the main tab bar focused on your trains, commute and family."),
        )),
        ReleaseNotes(version = "1.4.0", date = "November 2026", items = listOf(
            WhatsNewItem("Sign in with Google", "Headway on Android now signs in with the same account as your iPhone, watch and glasses, and stays signed in. Your commute, family group and paired glasses come along."),
            WhatsNewItem("Alerts on this phone", "Delays, cancellations, when to leave and your stop coming up arrive as notifications here, with the same choices as on iPhone. Send yourself a test alert in Settings."),
            WhatsNewItem("When to leave, on the Trains tab", "The leave-by card counts down to the train you can still catch and says when you need to run. Train rows show the first to arrive, the shortest ride and trains that get overtaken."),
            WhatsNewItem("Your whole commute, editable here", "Set each leg's stations, usual train, how you get to the station, watch window and alert days, and choose every kind of alert with its minutes."),
            WhatsNewItem("Follow your family", "Choose what you're told about each person in your family group: their train, their usual train running late, or their status."),
            WhatsNewItem("Share your live ETA", "Tracking a train? Send a link that follows it to anyone."),
        )),
        ReleaseNotes(version = "1.3.0", date = "November 2026", items = listOf(
            WhatsNewItem("Quiet once your commute is done", "When your location shows you got off at your commute's stop, Headway stops that leg's delay, cancellation and leave-now alerts for the rest of the day. The Trains tab tells you, with a button to keep them coming that day. Switch it off in Settings under Alerts."),
            WhatsNewItem("Your stop, already picked", "On a train, the card's button now shows where you get off, set to your commute's stop wherever you boarded. Tap it only when you're getting off somewhere else this once."),
        )),
        ReleaseNotes(version = "1.2.2", date = "November 2026", items = listOf(
            WhatsNewItem("No leave-by card on the train", "Once the train you're tracking has left your station, the Trains tab and your glasses stop telling you when to leave and how long the trip to the station takes."),
        )),
        ReleaseNotes(version = "1.2.0", date = "November 2026", items = listOf(
            WhatsNewItem("Family groups", "Create a family group in the Family tab and invite up to 7 people by email. Each person sees the others' trains, when someone's usual train is late, and statuses like Running late, but only what each of them chooses to share."),
            WhatsNewItem("You choose what you share, and with whom", "Nothing is shared until you turn it on: the trains you track, rides Headway detects, your usual train running late, or your status. Your location is never shared."),
        )),
        ReleaseNotes(version = "1.0.0", date = "November 2026", items = listOf(
            WhatsNewItem("A card for when you're on the train", "Once your location shows you riding, Headway shows your next stop, when you arrive and how many stops are left. Choose in Settings whether it just shows the card, also starts tracking, or also works with the app closed."),
            WhatsNewItem("Late trains stay on the board", "A train stays listed until 5 minutes after its time at your station, marked Due or May have left, because real trains are often a few minutes behind."),
            WhatsNewItem("Priority alerts", "Alerts go by whether they affect you: your direction, inside your watch window. Choose Priority and quiet in Settings to get the rest too, without a sound."),
        )),
    )

    private fun prefs(context: Context) = context.getSharedPreferences("headway", Context.MODE_PRIVATE)

    /** True once per version, the first time the app opens signed in after an update. */
    fun shouldShowAutomatically(context: Context): Boolean = prefs(context).getString(KEY_SEEN, null) != CURRENT_VERSION

    fun markSeen(context: Context) {
        prefs(context).edit().putString(KEY_SEEN, CURRENT_VERSION).apply()
    }
}

@Composable
fun WhatsNewDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("What's New") },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp), modifier = Modifier.heightIn(max = 440.dp)) {
                items(WhatsNew.releases, key = { it.version }) { release ->
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Version ${release.version} · ${release.date}", style = MaterialTheme.typography.labelMedium, color = StatusGrey)
                        release.items.forEach { item ->
                            Column {
                                Text(item.title, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyLarge)
                                Text(item.description, style = MaterialTheme.typography.bodyMedium, color = StatusGrey)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Got it") } }
    )
}
