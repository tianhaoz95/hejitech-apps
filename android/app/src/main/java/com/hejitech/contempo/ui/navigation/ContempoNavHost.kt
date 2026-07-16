package com.hejitech.contempo.ui.navigation

import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.NavType
import com.hejitech.contempo.R
import com.hejitech.contempo.ui.capture.CaptureScreen
import com.hejitech.contempo.ui.chat.ChatScreen
import com.hejitech.contempo.ui.confirm.ConfirmScreen
import com.hejitech.contempo.ui.dashboard.DashboardScreen
import com.hejitech.contempo.ui.export.ExportScreen
import com.hejitech.contempo.ui.settings.SettingsScreen

private sealed class TopLevelDestination(val route: String, val labelRes: Int) {
    data object Capture : TopLevelDestination("capture", R.string.nav_capture)
    data object Dashboard : TopLevelDestination("dashboard", R.string.nav_dashboard)
    data object Chat : TopLevelDestination("chat", R.string.nav_chat)
    data object Export : TopLevelDestination("export", R.string.nav_export)
}

private val topLevelDestinations = listOf(
    TopLevelDestination.Capture,
    TopLevelDestination.Dashboard,
    TopLevelDestination.Chat,
    TopLevelDestination.Export,
)

private const val SETTINGS_ROUTE = "settings"

object ConfirmRoute {
    const val PATTERN = "confirm?property={property}&task={task}&durationMinutes={durationMinutes}" +
        "&category={category}&isVague={isVague}&isBackfilled={isBackfilled}&daysLate={daysLate}" +
        "&source={source}&captureSource={captureSource}&photoUri={photoUri}"

    fun build(
        property: String,
        task: String,
        durationMinutes: Int,
        category: String,
        isVague: Boolean,
        isBackfilled: Boolean,
        daysLate: Int,
        source: String = "",
        captureSource: String = "",
        photoUri: String? = null,
    ) = "confirm?property=$property&task=$task&durationMinutes=$durationMinutes" +
        "&category=$category&isVague=$isVague&isBackfilled=$isBackfilled&daysLate=$daysLate" +
        "&source=$source&captureSource=$captureSource" +
        // photoUri is a content:// URI (colons, slashes) — the only field
        // here that can't survive being pasted raw into a query string, so
        // it's the only one that gets encoded/decoded.
        "&photoUri=${photoUri?.let { java.net.URLEncoder.encode(it, "UTF-8") } ?: ""}"
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ContempoNavHost() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val isTopLevelScreen = topLevelDestinations.any { it.route == currentRoute }
    // Scaffold still reserves the bottom bar's height in innerPadding even
    // once the keyboard visually covers that same screen area — nothing
    // shrinks it just because it's now hidden. Hiding the bar outright
    // while the keyboard is up (common in chat-style apps) reclaims that
    // now-pointless reservation instead of leaving a blank gap between the
    // input field and the keyboard.
    val imeVisible = WindowInsets.isImeVisible

    Scaffold(
        topBar = {
            if (isTopLevelScreen) {
                TopAppBar(
                    title = {},
                    actions = {
                        IconButton(onClick = { navController.navigate(SETTINGS_ROUTE) }) {
                            Icon(Icons.Filled.Settings, contentDescription = stringResource(R.string.nav_settings))
                        }
                    },
                    // TopAppBar defaults to colorScheme.surface, but Scaffold's
                    // content area paints with colorScheme.background — two
                    // different tones in this theme (surface = paper-raised/
                    // white for cards, background = paper for the page canvas).
                    // Matching background here keeps the bar visually part of
                    // the page instead of a contrasting white strip.
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
                )
            }
        },
        bottomBar = { if (isTopLevelScreen && !imeVisible) ContempoBottomBar(navController) },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = TopLevelDestination.Capture.route,
            modifier = androidx.compose.ui.Modifier.padding(innerPadding),
        ) {
            composable(TopLevelDestination.Capture.route) {
                CaptureScreen(
                    onDraftReady = { result ->
                        navController.navigate(
                            ConfirmRoute.build(
                                property = result.draft.property.orEmpty(),
                                task = result.draft.task.orEmpty(),
                                durationMinutes = result.draft.durationMinutes ?: 0,
                                category = result.draft.category.orEmpty(),
                                isVague = false,
                                isBackfilled = false,
                                daysLate = 0,
                                source = result.parseSource,
                                captureSource = result.captureSource.name,
                                photoUri = result.photoUri,
                            )
                        )
                    }
                )
            }
            composable(
                ConfirmRoute.PATTERN,
                arguments = listOf(
                    navArgument("property") { type = NavType.StringType; defaultValue = "" },
                    navArgument("task") { type = NavType.StringType; defaultValue = "" },
                    navArgument("durationMinutes") { type = NavType.IntType; defaultValue = 0 },
                    navArgument("category") { type = NavType.StringType; defaultValue = "" },
                    navArgument("isVague") { type = NavType.BoolType; defaultValue = false },
                    navArgument("isBackfilled") { type = NavType.BoolType; defaultValue = false },
                    navArgument("daysLate") { type = NavType.IntType; defaultValue = 0 },
                    navArgument("source") { type = NavType.StringType; defaultValue = "" },
                    navArgument("captureSource") { type = NavType.StringType; defaultValue = "" },
                    navArgument("photoUri") { type = NavType.StringType; defaultValue = "" },
                )
            ) { backStackEntry ->
                val encodedPhotoUri = backStackEntry.arguments?.getString("photoUri").orEmpty()
                ConfirmScreen(
                    property = backStackEntry.arguments?.getString("property").orEmpty(),
                    task = backStackEntry.arguments?.getString("task").orEmpty(),
                    durationMinutes = backStackEntry.arguments?.getInt("durationMinutes") ?: 0,
                    category = backStackEntry.arguments?.getString("category").orEmpty(),
                    source = backStackEntry.arguments?.getString("source").orEmpty(),
                    captureSource = backStackEntry.arguments?.getString("captureSource").orEmpty(),
                    photoUri = encodedPhotoUri.takeIf { it.isNotEmpty() }
                        ?.let { java.net.URLDecoder.decode(it, "UTF-8") },
                    onConfirmed = {
                        navController.navigate(TopLevelDestination.Dashboard.route) {
                            popUpTo(TopLevelDestination.Capture.route)
                        }
                    },
                )
            }
            composable(TopLevelDestination.Dashboard.route) { DashboardScreen() }
            composable(TopLevelDestination.Chat.route) { ChatScreen() }
            composable(TopLevelDestination.Export.route) { ExportScreen() }
            composable(SETTINGS_ROUTE) {
                SettingsScreen(onBack = { navController.popBackStack() })
            }
        }
    }
}

@Composable
private fun ContempoBottomBar(navController: NavHostController) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // Same containerColor fix as the TopAppBar above — NavigationBar defaults
    // to a surface-tier color, not colorScheme.background.
    NavigationBar(containerColor = MaterialTheme.colorScheme.background) {
        topLevelDestinations.forEach { destination ->
            val selected = currentDestination?.hierarchy?.any { it.route == destination.route } == true
            NavigationBarItem(
                selected = selected,
                onClick = {
                    // The Capture tab is the graph's start destination, and
                    // Navigation-Compose's popUpTo(startDestinationId){
                    // saveState = true } + navigate(...){ restoreState = true }
                    // combo has a real bug when the tab being navigated TO is
                    // also the popUpTo target/start destination: instead of
                    // showing Capture, it can surface a *different* tab's
                    // saved-state entry (reproduced live: tapping Capture from
                    // Ask landed on Dashboard). Start destination is never
                    // actually removed from the back stack in the first
                    // place, so a plain popBackStack to it sidesteps the
                    // restoreState codepath entirely instead of relying on it.
                    if (destination.route == TopLevelDestination.Capture.route) {
                        navController.popBackStack(
                            navController.graph.findStartDestination().id,
                            inclusive = false,
                        )
                    } else {
                        navController.navigate(destination.route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                icon = {
                    val icon = when (destination) {
                        TopLevelDestination.Capture -> Icons.Filled.Mic
                        TopLevelDestination.Dashboard -> Icons.AutoMirrored.Filled.ShowChart
                        TopLevelDestination.Chat -> Icons.AutoMirrored.Filled.Chat
                        TopLevelDestination.Export -> Icons.Filled.Share
                    }
                    Icon(icon, contentDescription = stringResource(destination.labelRes))
                },
                label = { androidx.compose.material3.Text(stringResource(destination.labelRes)) },
            )
        }
    }
}
