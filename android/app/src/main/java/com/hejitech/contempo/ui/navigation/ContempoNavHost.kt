package com.hejitech.contempo.ui.navigation

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.isImeVisible
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
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
import com.hejitech.contempo.ui.entrydetail.EntryDetailScreen
import com.hejitech.contempo.ui.settings.SettingsScreen

private sealed class TopLevelDestination(val route: String, val labelRes: Int) {
    data object Capture : TopLevelDestination("capture", R.string.nav_capture)
    data object Dashboard : TopLevelDestination("dashboard", R.string.nav_dashboard)
    data object Chat : TopLevelDestination("chat", R.string.nav_chat)
    data object Settings : TopLevelDestination("settings", R.string.nav_settings)
}

private val topLevelDestinations = listOf(
    TopLevelDestination.Capture,
    TopLevelDestination.Dashboard,
    TopLevelDestination.Chat,
    TopLevelDestination.Settings,
)

/** -1 for non-top-level routes (Confirm, EntryDetail) — those never take part in the slide/swipe. */
private fun topLevelIndex(route: String?): Int = topLevelDestinations.indexOfFirst { it.route == route }

// Tab order (Capture -> Dashboard -> Chat -> Settings) doubles as left/right
// direction: moving to a higher index slides the new content in from the
// right, same as swiping left to reveal the "next" tab — shared by both the
// bottom bar's taps and the swipe gesture below so the two stay consistent.
private val topLevelEnterTransition: AnimatedContentTransitionScope<androidx.navigation.NavBackStackEntry>.() -> EnterTransition = {
    val forward = topLevelIndex(targetState.destination.route) >= topLevelIndex(initialState.destination.route)
    slideInHorizontally(initialOffsetX = { fullWidth -> if (forward) fullWidth else -fullWidth })
}
private val topLevelExitTransition: AnimatedContentTransitionScope<androidx.navigation.NavBackStackEntry>.() -> ExitTransition = {
    val forward = topLevelIndex(targetState.destination.route) >= topLevelIndex(initialState.destination.route)
    slideOutHorizontally(targetOffsetX = { fullWidth -> if (forward) -fullWidth else fullWidth })
}

/** Shared by bottom-bar taps and the swipe gesture so both navigate identically. */
private fun navigateToTab(navController: NavHostController, destination: TopLevelDestination) {
    // The Capture tab is the graph's start destination, and Navigation-Compose's
    // popUpTo(startDestinationId){ saveState = true } + navigate(...){ restoreState = true }
    // combo has a real bug when the tab being navigated TO is also the popUpTo
    // target/start destination: instead of showing Capture, it can surface a
    // *different* tab's saved-state entry (reproduced live: tapping Capture from
    // Ask landed on Dashboard). Start destination is never actually removed from
    // the back stack in the first place, so a plain popBackStack to it sidesteps
    // the restoreState codepath entirely instead of relying on it.
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
}

object EntryDetailRoute {
    const val PATTERN = "entryDetail/{entryId}"
    fun build(entryId: String) = "entryDetail/$entryId"
}

object LegalRoute {
    const val PATTERN = "legal/{doc}"
    fun build(doc: com.hejitech.contempo.ui.legal.LegalDoc) = "legal/${doc.routeArg}"
}

object ConfirmRoute {
    const val PATTERN = "confirm?property={property}&task={task}&durationMinutes={durationMinutes}" +
        "&category={category}&isVague={isVague}&isBackfilled={isBackfilled}&daysLate={daysLate}" +
        "&source={source}&captureSource={captureSource}&miles={miles}&photoUri={photoUri}&entryId={entryId}" +
        "&captureLat={captureLat}&captureLng={captureLng}&resolvedActivityDateIso={resolvedActivityDateIso}"

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
        miles: Double = 0.0,
        photoUri: String? = null,
        /** Non-blank when resuming a pending_review entry (see DashboardScreen's pending badge). */
        entryId: String = "",
        /** Best-effort "captured from here" location — see CaptureViewModel.captureLocation. */
        captureLat: Double? = null,
        captureLng: Double? = null,
        /** AI-resolved activity time from the parse draft, if any — see EntryDraft.resolvedActivityDateIso. */
        resolvedActivityDateIso: String? = null,
    ) = "confirm?property=$property&task=$task&durationMinutes=$durationMinutes" +
        "&category=$category&isVague=$isVague&isBackfilled=$isBackfilled&daysLate=$daysLate" +
        "&source=$source&captureSource=$captureSource&miles=$miles" +
        // photoUri is a content:// URI (colons, slashes) — the only field
        // here that can't survive being pasted raw into a query string, so
        // it's the only one that gets encoded/decoded.
        "&photoUri=${photoUri?.let { java.net.URLEncoder.encode(it, "UTF-8") } ?: ""}" +
        "&entryId=$entryId" +
        "&captureLat=${captureLat ?: ""}&captureLng=${captureLng ?: ""}" +
        // Also encoded — an ISO-8601 timestamp contains ':' characters, unsafe raw in a query string.
        "&resolvedActivityDateIso=${resolvedActivityDateIso?.let { java.net.URLEncoder.encode(it, "UTF-8") } ?: ""}"
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
        bottomBar = { if (isTopLevelScreen && !imeVisible) ContempoBottomBar(navController) },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = TopLevelDestination.Capture.route,
            modifier = androidx.compose.ui.Modifier.padding(innerPadding),
        ) {
            composable(
                TopLevelDestination.Capture.route,
                enterTransition = topLevelEnterTransition,
                exitTransition = topLevelExitTransition,
            ) {
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
                                miles = result.draft.miles ?: 0.0,
                                photoUri = result.photoUri,
                                captureLat = result.captureLat,
                                captureLng = result.captureLng,
                                resolvedActivityDateIso = result.draft.resolvedActivityDateIso,
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
                    // No native Double NavType — carried as a string and
                    // parsed on read, same reasoning as durationMinutes
                    // being Int-only elsewhere in this route.
                    navArgument("miles") { type = NavType.StringType; defaultValue = "0.0" },
                    navArgument("photoUri") { type = NavType.StringType; defaultValue = "" },
                    navArgument("entryId") { type = NavType.StringType; defaultValue = "" },
                    // Also string-carried (no native nullable-Double
                    // NavType) — empty string means "no fix captured",
                    // distinct from an actual 0.0 coordinate.
                    navArgument("captureLat") { type = NavType.StringType; defaultValue = "" },
                    navArgument("captureLng") { type = NavType.StringType; defaultValue = "" },
                    // URL-encoded, same reasoning as photoUri — an ISO-8601
                    // timestamp contains ':' characters unsafe raw in a query string.
                    navArgument("resolvedActivityDateIso") { type = NavType.StringType; defaultValue = "" },
                ),
                // A subtle slide-up + fade "settling into the structured
                // record UI" — the visual bridge from Capture's finalized-
                // text/parsing-progress sequence into this screen.
                enterTransition = { slideInVertically(initialOffsetY = { it / 6 }) + fadeIn() },
                exitTransition = { fadeOut() },
                popExitTransition = { slideOutVertically(targetOffsetY = { it / 6 }) + fadeOut() },
            ) { backStackEntry ->
                val encodedPhotoUri = backStackEntry.arguments?.getString("photoUri").orEmpty()
                val encodedResolvedActivityDateIso = backStackEntry.arguments?.getString("resolvedActivityDateIso").orEmpty()
                ConfirmScreen(
                    property = backStackEntry.arguments?.getString("property").orEmpty(),
                    task = backStackEntry.arguments?.getString("task").orEmpty(),
                    durationMinutes = backStackEntry.arguments?.getInt("durationMinutes") ?: 0,
                    category = backStackEntry.arguments?.getString("category").orEmpty(),
                    source = backStackEntry.arguments?.getString("source").orEmpty(),
                    captureSource = backStackEntry.arguments?.getString("captureSource").orEmpty(),
                    miles = backStackEntry.arguments?.getString("miles")?.toDoubleOrNull() ?: 0.0,
                    photoUri = encodedPhotoUri.takeIf { it.isNotEmpty() }
                        ?.let { java.net.URLDecoder.decode(it, "UTF-8") },
                    entryId = backStackEntry.arguments?.getString("entryId").orEmpty(),
                    captureLat = backStackEntry.arguments?.getString("captureLat")?.toDoubleOrNull(),
                    captureLng = backStackEntry.arguments?.getString("captureLng")?.toDoubleOrNull(),
                    resolvedActivityDateIso = encodedResolvedActivityDateIso.takeIf { it.isNotEmpty() }
                        ?.let { java.net.URLDecoder.decode(it, "UTF-8") },
                    onConfirmed = {
                        navController.navigate(TopLevelDestination.Dashboard.route) {
                            popUpTo(TopLevelDestination.Capture.route)
                        }
                    },
                )
            }
            composable(
                TopLevelDestination.Dashboard.route,
                enterTransition = topLevelEnterTransition,
                exitTransition = topLevelExitTransition,
            ) {
                DashboardScreen(
                    onEntryClick = { entry -> navController.navigate(EntryDetailRoute.build(entry.id)) },
                )
            }
            composable(
                TopLevelDestination.Chat.route,
                enterTransition = topLevelEnterTransition,
                exitTransition = topLevelExitTransition,
            ) { ChatScreen() }
            composable(
                TopLevelDestination.Settings.route,
                enterTransition = topLevelEnterTransition,
                exitTransition = topLevelExitTransition,
            ) {
                SettingsScreen(
                    onOpenLegalDoc = { doc -> navController.navigate(LegalRoute.build(doc)) },
                )
            }
            composable(
                LegalRoute.PATTERN,
                arguments = listOf(navArgument("doc") { type = NavType.StringType }),
                enterTransition = { slideInVertically(initialOffsetY = { it / 6 }) + fadeIn() },
                exitTransition = { fadeOut() },
                popExitTransition = { slideOutVertically(targetOffsetY = { it / 6 }) + fadeOut() },
            ) { backStackEntry ->
                com.hejitech.contempo.ui.legal.LegalScreen(
                    doc = com.hejitech.contempo.ui.legal.LegalDoc.fromRouteArg(
                        backStackEntry.arguments?.getString("doc"),
                    ),
                    onBack = { navController.popBackStack() },
                )
            }
            composable(
                EntryDetailRoute.PATTERN,
                arguments = listOf(navArgument("entryId") { type = NavType.StringType }),
                enterTransition = { slideInVertically(initialOffsetY = { it / 6 }) + fadeIn() },
                exitTransition = { fadeOut() },
                popExitTransition = { slideOutVertically(targetOffsetY = { it / 6 }) + fadeOut() },
            ) { backStackEntry ->
                EntryDetailScreen(
                    entryId = backStackEntry.arguments?.getString("entryId").orEmpty(),
                    onBack = { navController.popBackStack() },
                    onEditEntry = { entry ->
                        navController.navigate(
                            ConfirmRoute.build(
                                property = entry.propertyName,
                                task = entry.task,
                                durationMinutes = entry.durationMinutes,
                                category = entry.category,
                                isVague = false,
                                isBackfilled = false,
                                daysLate = 0,
                                captureSource = entry.sourceEnum.name,
                                miles = entry.miles,
                                entryId = entry.id,
                                // Deliberately not threading photoUri here —
                                // it's only meaningful as a fresh local
                                // content:// URI to upload, and an existing
                                // pending entry's photoUrls (if any) are
                                // already remote and preserved by
                                // ConfirmViewModel's resume path.
                            )
                        )
                    },
                )
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
                onClick = { navigateToTab(navController, destination) },
                icon = {
                    val icon = when (destination) {
                        TopLevelDestination.Capture -> Icons.Filled.Mic
                        TopLevelDestination.Dashboard -> Icons.AutoMirrored.Filled.ShowChart
                        // A sparkle rather than a generic chat bubble — this
                        // tab is specifically the AI Q&A feature (see
                        // "Ask AI" label), not a messaging inbox.
                        TopLevelDestination.Chat -> Icons.Filled.AutoAwesome
                        TopLevelDestination.Settings -> Icons.Filled.Settings
                    }
                    Icon(icon, contentDescription = stringResource(destination.labelRes))
                },
                label = { androidx.compose.material3.Text(stringResource(destination.labelRes)) },
            )
        }
    }
}
