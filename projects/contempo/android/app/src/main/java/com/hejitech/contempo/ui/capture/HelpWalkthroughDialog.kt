package com.hejitech.contempo.ui.capture

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ShowChart
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.hejitech.contempo.R

private data class WalkthroughStep(
    val icon: ImageVector,
    val titleRes: Int,
    val bodyRes: Int,
)

// One step per top-level tab, in the same Capture -> Dashboard -> Chat ->
// Settings order as the bottom nav (see ContempoNavHost's
// topLevelDestinations) so the walkthrough reads as a left-to-right tour of
// the tab bar rather than an arbitrary order.
private val walkthroughSteps = listOf(
    WalkthroughStep(Icons.Filled.Mic, R.string.help_walkthrough_capture_title, R.string.help_walkthrough_capture_body),
    WalkthroughStep(Icons.AutoMirrored.Filled.ShowChart, R.string.help_walkthrough_dashboard_title, R.string.help_walkthrough_dashboard_body),
    WalkthroughStep(Icons.Filled.AutoAwesome, R.string.help_walkthrough_chat_title, R.string.help_walkthrough_chat_body),
    WalkthroughStep(Icons.Filled.Settings, R.string.help_walkthrough_settings_title, R.string.help_walkthrough_settings_body),
)

/**
 * A sequential, full-screen card dialog stepping through what each bottom-nav
 * tab does — the app's only tutorial surface. Kept to a plain custom Dialog
 * over a step index rather than a spotlighted coach-mark overlay: the app has
 * no shared top bar and no precedent for anchoring cutouts to real on-screen
 * elements, whereas this matches the AlertDialog-only modal pattern already
 * used everywhere else (e.g. showQuickCaptureExplanation in CaptureScreen).
 */
@Composable
fun HelpWalkthroughDialog(onDismiss: () -> Unit) {
    var step by remember { mutableIntStateOf(0) }
    val current = walkthroughSteps[step]
    val isLastStep = step == walkthroughSteps.lastIndex

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = MaterialTheme.shapes.large,
            color = MaterialTheme.colorScheme.surface,
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        walkthroughSteps.indices.forEach { index ->
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (index == step) MaterialTheme.colorScheme.primary
                                        else MaterialTheme.colorScheme.outlineVariant,
                                    ),
                            )
                        }
                    }
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(R.string.help_walkthrough_skip_button))
                    }
                }

                Spacer(Modifier.height(20.dp))

                Icon(
                    current.icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(40.dp),
                )

                Spacer(Modifier.height(16.dp))

                Text(stringResource(current.titleRes), style = MaterialTheme.typography.headlineSmall)

                Spacer(Modifier.height(8.dp))

                Text(
                    stringResource(current.bodyRes),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                Spacer(Modifier.height(24.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (step > 0) {
                        TextButton(onClick = { step -= 1 }) {
                            Text(stringResource(R.string.help_walkthrough_back_button))
                        }
                    } else {
                        Spacer(Modifier.height(1.dp))
                    }
                    TextButton(onClick = { if (isLastStep) onDismiss() else step += 1 }) {
                        Text(
                            stringResource(
                                if (isLastStep) R.string.help_walkthrough_done_button
                                else R.string.help_walkthrough_next_button
                            )
                        )
                    }
                }
            }
        }
    }
}
