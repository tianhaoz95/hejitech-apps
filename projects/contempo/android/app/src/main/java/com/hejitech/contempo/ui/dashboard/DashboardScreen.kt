package com.hejitech.contempo.ui.dashboard

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.ui.theme.BulletAwareText
import com.hejitech.contempo.ui.theme.ContempoCard
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import com.hejitech.core.model.TestYearProgress
import java.time.format.DateTimeFormatter
import java.text.SimpleDateFormat
import java.util.Locale

import androidx.compose.material3.pulltorefresh.PullToRefreshBox

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onEntryClick: (Entry) -> Unit = {},
    viewModel: DashboardViewModel = viewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()
    val isSelectionMode = uiState.selectedIds.isNotEmpty()
    var showDeleteDialog by remember { mutableStateOf(false) }
    // Collapsed by default — a role-by-role comparison is audit context,
    // not the thing most users open the app to check, so it stays hidden
    // until tapped rather than always taking up space under the progress bar.
    var isRoleBreakdownExpanded by remember { mutableStateOf(false) }

    PullToRefreshBox(
        isRefreshing = uiState.isSyncing,
        onRefresh = viewModel::refreshAndProcessPendingAudios,
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            if (uiState.isSyncing) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.primaryContainer)
                        .padding(16.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(
                            modifier = Modifier.padding(end = 12.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                        Text(
                            text = uiState.syncStatusMessage.ifBlank { "Syncing pending audios..." },
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { uiState.syncProgressFraction },
                        modifier = Modifier.fillMaxWidth().height(4.dp),
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Spacer(Modifier.height(16.dp))
            } else if (uiState.syncNotice != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(12.dp),
                ) {
                    Text(
                        text = uiState.syncNotice!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.height(16.dp))
            }

            if (isSelectionMode) {
            SelectionToolbar(
                selectedCount = uiState.selectedIds.size,
                totalCount = uiState.entries.size,
                onClear = viewModel::clearSelection,
                onSelectAll = viewModel::selectAll,
                onDeleteClick = { showDeleteDialog = true },
            )
        } else {
            Eyebrow(stringResource(R.string.dashboard_eyebrow))
            Spacer(Modifier.height(12.dp))
            Text(stringResource(R.string.dashboard_title), style = MaterialTheme.typography.headlineMedium)
        }
        Spacer(Modifier.height(16.dp))

        val progress = (uiState.confirmedHours / uiState.thresholdHours).toFloat().coerceIn(0f, 1f)
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().height(8.dp),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            stringResource(
                R.string.dashboard_hours_progress,
                uiState.confirmedHours.toInt(),
                uiState.thresholdHours,
                uiState.testName,
                uiState.testProgress.year,
            ),
            style = MaterialTheme.typography.bodyLarge,
        )
        Spacer(Modifier.height(4.dp))
        PaceLine(uiState.testProgress, uiState.thresholdHours)

        if (uiState.pendingCount > 0) {
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.dashboard_pending_callout, uiState.pendingCount),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.tertiary,
            )
        }

        uiState.openTimerEntry?.let { timerEntry ->
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(
                    R.string.dashboard_timer_callout,
                    timerEntry.task.ifBlank { timerEntry.propertyName.ifBlank { "work" } },
                    dateFormatter.format(timerEntry.activityDate.toDate()),
                ),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
        }

        uiState.openTripEntry?.let { tripEntry ->
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.dashboard_trip_callout, formatMiles(tripEntry.miles)),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
            )
        }

        if (uiState.totalMiles > 0) {
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.dashboard_miles_total, formatMiles(uiState.totalMiles)),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (uiState.roleBreakdown.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            HorizontalDivider()
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { isRoleBreakdownExpanded = !isRoleBreakdownExpanded }
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(R.string.dashboard_role_breakdown_toggle),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Icon(
                    imageVector = if (isRoleBreakdownExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            AnimatedVisibility(
                visible = isRoleBreakdownExpanded,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut(),
            ) {
                Column {
                    Text(
                        stringResource(R.string.dashboard_other_roles_hint),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(6.dp))
                    // Bar width is relative to the largest bucket in this
                    // breakdown (not the 100-hour threshold) — the point of
                    // this view is comparing participants against each
                    // other, not against the test's own progress bar above.
                    val maxRoleHours = (uiState.roleBreakdown.maxOfOrNull { it.hours } ?: 0.0).coerceAtLeast(0.01)
                    uiState.roleBreakdown.forEach { summary ->
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text(summary.name, style = MaterialTheme.typography.labelSmall)
                                Text(
                                    stringResource(R.string.dashboard_other_role_hours, summary.hours.toInt()),
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            val fraction = (summary.hours / maxRoleHours).toFloat().coerceIn(0f, 1f)
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant),
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(fraction)
                                        .fillMaxHeight()
                                        .clip(RoundedCornerShape(3.dp))
                                        .background(
                                            // "Me" (id == "") stands out as the reference bar; other
                                            // roles share a second color so the comparison reads at a
                                            // glance without needing a legend.
                                            if (summary.id.isEmpty()) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.tertiary,
                                        ),
                                )
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                    }
                }
            }
        }

        Spacer(Modifier.height(24.dp))

        if (uiState.entries.isEmpty()) {
            Text(stringResource(R.string.dashboard_no_entries), style = MaterialTheme.typography.bodyLarge)
        } else {
            LazyColumn {
                items(uiState.entries, key = { it.id }) { entry ->
                    EntryRow(
                        entry = entry,
                        isSelectionMode = isSelectionMode,
                        isSelected = entry.id in uiState.selectedIds,
                        onClick = {
                            if (isSelectionMode) viewModel.toggleSelected(entry.id) else onEntryClick(entry)
                        },
                        onLongClick = { viewModel.toggleSelected(entry.id) },
                        onSwipeToDelete = { viewModel.deleteEntry(entry.id) },
                    )
                }
            }
        }
    }
    }

    if (showDeleteDialog) {
        DeleteSelectedDialog(
            count = uiState.selectedIds.size,
            isDeleting = uiState.isDeleting,
            errorMessage = uiState.deleteError,
            onDismiss = { showDeleteDialog = false; viewModel.dismissDeleteError() },
            onConfirm = {
                viewModel.deleteSelected()
                showDeleteDialog = false
            },
        )
    }
}

@Composable
private fun SelectionToolbar(
    selectedCount: Int,
    totalCount: Int,
    onClear: () -> Unit,
    onSelectAll: () -> Unit,
    onDeleteClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onClear) {
            Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.dashboard_clear_selection_content_description))
        }
        Text(
            stringResource(R.string.dashboard_selection_count, selectedCount),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.weight(1f),
        )
        if (selectedCount < totalCount) {
            TextButton(onClick = onSelectAll) {
                Text(stringResource(R.string.dashboard_select_all))
            }
        }
        IconButton(onClick = onDeleteClick) {
            Icon(
                Icons.Filled.Delete,
                contentDescription = stringResource(R.string.dashboard_delete_selected_content_description),
                tint = MaterialTheme.colorScheme.error,
            )
        }
    }
}

@Composable
private fun DeleteSelectedDialog(
    count: Int,
    isDeleting: Boolean,
    errorMessage: String?,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = { if (!isDeleting) onDismiss() },
        title = { Text(pluralStringResource(R.plurals.dashboard_delete_dialog_title, count, count)) },
        text = {
            Column {
                Text(stringResource(R.string.dashboard_delete_dialog_text))
                errorMessage?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !isDeleting) {
                if (isDeleting) {
                    CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp), strokeWidth = 2.dp)
                }
                Text(stringResource(R.string.dashboard_delete_dialog_confirm), color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isDeleting) {
                Text(stringResource(R.string.dashboard_delete_dialog_cancel))
            }
        },
    )
}

private val dateFormatter = SimpleDateFormat("EEE MMM d, HH:mm", Locale.getDefault())

private fun formatMiles(miles: Double): String =
    if (miles == miles.toLong().toDouble()) miles.toLong().toString() else "%.2f".format(miles)

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun EntryRow(
    entry: Entry,
    isSelectionMode: Boolean,
    isSelected: Boolean,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    // suspend + Boolean (not fire-and-forget) so a failed delete can snap the
    // row back to Settled instead of leaving it permanently swiped-away —
    // LazyColumn keys this composable by entry.id, so if the underlying
    // Firestore delete fails and the entry stays in the list, this exact
    // composable instance (and its remembered dismissState) survives to the
    // next recomposition rather than getting a fresh Settled state for free.
    onSwipeToDelete: suspend () -> Boolean,
) {
    val isPending = entry.statusEnum == EntryStatus.PENDING_REVIEW
    // Disabled while a bulk selection is active — checkbox tap is that mode's
    // deletion path, and letting swipe fire too would delete a single entry
    // out from under a multi-select the user is still building up.
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { it != SwipeToDismissBoxValue.Settled },
    )
    LaunchedEffect(dismissState.currentValue) {
        if (dismissState.currentValue != SwipeToDismissBoxValue.Settled) {
            if (!onSwipeToDelete()) dismissState.reset()
        }
    }

    SwipeToDismissBox(
        state = dismissState,
        // Tagged (rather than relying on child-text lookups) so
        // instrumented tests can target the full swipeable width directly —
        // a swipeLeft() performed on a narrower descendant node computes its
        // travel distance from that smaller node's bounds, which may not
        // cross SwipeToDismissBox's own dismiss threshold. See
        // CoreFlowTest.kt's dashboard swipe-to-delete test.
        modifier = Modifier.padding(vertical = 6.dp).testTag("entry_row"),
        enableDismissFromStartToEnd = !isSelectionMode,
        enableDismissFromEndToStart = !isSelectionMode,
        backgroundContent = { SwipeDeleteBackground(dismissState.dismissDirection) },
    ) {
    ContempoCard(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(onClick = onClick, onLongClick = onLongClick),
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            if (isSelectionMode) {
                Checkbox(
                    checked = isSelected,
                    onCheckedChange = { onClick() },
                    modifier = Modifier.padding(end = 4.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(entry.propertyName.ifBlank { "—" }, style = MaterialTheme.typography.titleLarge)
                    Text(
                        if (entry.inProgress) "tracking…" else "${entry.durationMinutes}m",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (entry.inProgress) {
                    Spacer(Modifier.height(4.dp))
                    if (entry.isTrip) TripBadge() else TimerBadge()
                } else if (isPending) {
                    Spacer(Modifier.height(4.dp))
                    if (entry.missingFields.isNotEmpty()) DraftBadge() else PendingBadge()
                }
                BulletAwareText(entry.task.ifBlank { "—" }, style = MaterialTheme.typography.bodyLarge)
                Text(
                    dateFormatter.format(entry.activityDate.toDate()),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (entry.miles > 0) {
                    Text(
                        stringResource(R.string.dashboard_entry_miles, formatMiles(entry.miles)),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (entry.riskFlags.hasWarning) {
                    Spacer(Modifier.height(4.dp))
                    entry.riskFlags.reasons.forEach { reason ->
                        Text(reason, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
    }
}

@Composable
private fun SwipeDeleteBackground(direction: SwipeToDismissBoxValue) {
    val alignment = when (direction) {
        SwipeToDismissBoxValue.StartToEnd -> Alignment.CenterStart
        SwipeToDismissBoxValue.EndToStart -> Alignment.CenterEnd
        SwipeToDismissBoxValue.Settled -> Alignment.Center
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(MaterialTheme.shapes.large)
            .background(MaterialTheme.colorScheme.error)
            .padding(horizontal = 20.dp),
        contentAlignment = alignment,
    ) {
        Icon(
            Icons.Filled.Delete,
            contentDescription = stringResource(R.string.dashboard_swipe_delete_content_description),
            tint = MaterialTheme.colorScheme.onError,
        )
    }
}

@Composable
private fun DraftBadge() {
    Text(
        stringResource(R.string.dashboard_draft_badge),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onErrorContainer,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.errorContainer)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
private fun PendingBadge() {
    Text(
        stringResource(R.string.dashboard_pending_badge),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onTertiaryContainer,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
private fun TimerBadge() {
    Text(
        stringResource(R.string.dashboard_timer_badge),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onPrimaryContainer,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.primaryContainer)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
private fun TripBadge() {
    Text(
        stringResource(R.string.dashboard_trip_badge),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onPrimaryContainer,
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.primaryContainer)
            .padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

/** One line under the progress: met, the projected finish date, or the weekly hours that still reach the threshold by Dec 31 (see [TestYearProgress.Pace]). */
@Composable
private fun PaceLine(progress: TestYearProgress, thresholdHours: Int) {
    val (text, color) = when (val pace = progress.pace) {
        TestYearProgress.Pace.Met ->
            stringResource(R.string.dashboard_pace_met, progress.year) to MaterialTheme.colorScheme.primary
        is TestYearProgress.Pace.OnPace ->
            stringResource(R.string.dashboard_pace_on_pace, thresholdHours, pace.finish.format(paceDateFormatter)) to MaterialTheme.colorScheme.primary
        is TestYearProgress.Pace.Behind ->
            stringResource(R.string.dashboard_pace_behind, "%.1f".format(pace.weeklyHoursNeeded), thresholdHours) to MaterialTheme.colorScheme.tertiary
    }
    Text(text, style = MaterialTheme.typography.labelLarge, color = color, modifier = Modifier.testTag("dashboard_pace"))
}

private val paceDateFormatter = DateTimeFormatter.ofPattern("MMM d")
