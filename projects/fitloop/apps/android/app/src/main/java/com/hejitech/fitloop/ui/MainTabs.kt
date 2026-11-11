package com.hejitech.fitloop.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Checklist
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShowChart
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import com.hejitech.fitloop.AppModel

private data class TabItem(val id: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    TabItem("today", "Today", Icons.Outlined.Checklist),
    TabItem("plan", "Plan", Icons.Outlined.CalendarMonth),
    TabItem("progress", "Progress", Icons.Outlined.ShowChart),
    TabItem("feedback", "Feedback", Icons.AutoMirrored.Outlined.Chat),
    TabItem("settings", "Settings", Icons.Outlined.Settings),
)

/** Today, Plan, Progress, Feedback and Settings: the iPhone app's five tabs. */
@Composable
fun MainTabs(model: AppModel) {
    val workout = model.openWorkout?.let { ref -> model.today?.state?.workouts?.firstOrNull { it.ref == ref } }
    if (workout != null) {
        WorkoutPlayer(model, workout, Modifier.systemBarsPadding()) { model.openWorkout = null }
        return
    }
    var tab by rememberSaveable { mutableStateOf(model.initialTab.takeIf { t -> tabs.any { it.id == t } } ?: "today") }
    Scaffold(
        bottomBar = {
            NavigationBar {
                for (t in tabs) {
                    NavigationBarItem(
                        selected = tab == t.id, onClick = { tab = t.id },
                        icon = { Icon(t.icon, contentDescription = null) }, label = { Text(t.label) },
                        modifier = Modifier.testTag("tab-${t.id}"),
                    )
                }
            }
        },
    ) { padding ->
        val m = Modifier.padding(padding)
        when (tab) {
            "today" -> TodayScreen(model, m)
            "plan" -> PlanScreen(model, m)
            "progress" -> ProgressScreen(model, m)
            "feedback" -> FeedbackScreen(model, m)
            else -> SettingsScreen(model, m)
        }
    }
}
