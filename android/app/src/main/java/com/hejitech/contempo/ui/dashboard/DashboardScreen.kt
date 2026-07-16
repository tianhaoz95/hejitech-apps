package com.hejitech.contempo.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hejitech.contempo.R
import com.hejitech.contempo.ui.theme.ContempoCard
import com.hejitech.contempo.ui.theme.Eyebrow
import com.hejitech.core.model.Entry
import com.hejitech.core.model.EntryStatus
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun DashboardScreen(
    onCompleteEntry: (Entry) -> Unit = {},
    viewModel: DashboardViewModel = viewModel(),
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
        Eyebrow(stringResource(R.string.dashboard_eyebrow))
        Spacer(Modifier.height(12.dp))
        Text(stringResource(R.string.dashboard_title), style = MaterialTheme.typography.headlineMedium)
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
            ),
            style = MaterialTheme.typography.bodyLarge,
        )

        if (uiState.pendingCount > 0) {
            Spacer(Modifier.height(8.dp))
            Text(
                stringResource(R.string.dashboard_pending_callout, uiState.pendingCount),
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.tertiary,
            )
        }

        Spacer(Modifier.height(24.dp))

        if (uiState.entries.isEmpty()) {
            Text(stringResource(R.string.dashboard_no_entries), style = MaterialTheme.typography.bodyLarge)
        } else {
            LazyColumn {
                items(uiState.entries, key = { it.id }) { entry -> EntryRow(entry, onCompleteEntry) }
            }
        }
    }
}

private val dateFormatter = SimpleDateFormat("EEE MMM d, HH:mm", Locale.getDefault())

@Composable
private fun EntryRow(entry: Entry, onCompleteEntry: (Entry) -> Unit) {
    val isPending = entry.statusEnum == EntryStatus.PENDING_REVIEW
    ContempoCard(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .let { if (isPending) it.clickable { onCompleteEntry(entry) } else it },
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(entry.propertyName.ifBlank { "—" }, style = MaterialTheme.typography.titleLarge)
                Text(
                    "${entry.durationMinutes}m",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (isPending) {
                Spacer(Modifier.height(4.dp))
                PendingBadge()
            }
            Text(entry.task.ifBlank { "—" }, style = MaterialTheme.typography.bodyLarge)
            Text(
                dateFormatter.format(entry.activityDate.toDate()),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (entry.riskFlags.hasWarning) {
                Spacer(Modifier.height(4.dp))
                entry.riskFlags.reasons.forEach { reason ->
                    Text(reason, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
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
