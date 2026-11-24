package com.hejitech.contempo.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

data class WhatsNewEntry(val title: String, val detail: String)
data class WhatsNewRelease(val version: String, val headline: String, val items: List<WhatsNewEntry>)

val WHATS_NEW_RELEASES = listOf(
    WhatsNewRelease(
        version = "3.4.0",
        headline = "MCP assistant access, unified Pro, Sign in with Apple & nudges",
        items = listOf(
            WhatsNewEntry(
                title = "Connect AI assistants via MCP",
                detail = "Query your 100h / 500h / 750h progress, check IRS audit risks, and log entries from Claude or ChatGPT using OAuth 2.1.",
            ),
            WhatsNewEntry(
                title = "Unified Contempo Pro",
                detail = "One account unlocks Pro across Android, iPhone, Web, and MCP via Google Play, App Store, Stripe, or an email invite.",
            ),
            WhatsNewEntry(
                title = "Sign in with Apple on Android",
                detail = "Use your Apple account through the browser so your log stays synced across iPhone and Android.",
            ),
            WhatsNewEntry(
                title = "14-day contemporaneity nudges",
                detail = "Get a reminder before unconfirmed drafts cross the IRS 14-day backfill window.",
            ),
        ),
    ),
)

@Composable
fun WhatsNewDialog(onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("What's New") },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                WHATS_NEW_RELEASES.forEach { release ->
                    Text(
                        text = "Version ${release.version} — ${release.headline}",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    release.items.forEach { item ->
                        Column {
                            Text(item.title, style = MaterialTheme.typography.titleSmall)
                            Text(
                                item.detail,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Done") }
        },
    )
}
