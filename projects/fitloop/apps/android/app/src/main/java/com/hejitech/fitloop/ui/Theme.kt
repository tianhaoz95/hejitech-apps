package com.hejitech.fitloop.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// FitLoop's orange (the iPhone app's AccentColor) on warm neutrals; dark matches the icon's night blue.
private val Light = lightColorScheme(
    primary = Color(0xFFD9541F), onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDBCE), onPrimaryContainer = Color(0xFF3A0B00),
    secondary = Color(0xFF77574B), secondaryContainer = Color(0xFFFFDBCE), onSecondaryContainer = Color(0xFF2C160C),
    background = Color(0xFFFFFBF8), surface = Color(0xFFFFFBF8),
    surfaceVariant = Color(0xFFF5E6DF), surfaceContainer = Color(0xFFFAEFEA), surfaceContainerHigh = Color(0xFFF5E9E3),
    surfaceContainerLow = Color(0xFFFEF4EF), surfaceContainerHighest = Color(0xFFEFE3DD),
)
private val Dark = darkColorScheme(
    primary = Color(0xFFFF7A45), onPrimary = Color(0xFF2A0A00),
    primaryContainer = Color(0xFF7A2E10), onPrimaryContainer = Color(0xFFFFDBCE),
    secondary = Color(0xFFE7BDAF), secondaryContainer = Color(0xFF3B2A45), onSecondaryContainer = Color(0xFFFFDBCE),
    background = Color(0xFF0D0B1E), surface = Color(0xFF0D0B1E),
    surfaceVariant = Color(0xFF2A2740), surfaceContainer = Color(0xFF191630), surfaceContainerHigh = Color(0xFF221F3A),
    surfaceContainerLow = Color(0xFF141228), surfaceContainerHighest = Color(0xFF2B2845),
)

val Good = Color(0xFF2E9E5B)
val Warn = Color(0xFFE08A00)

@Composable
fun FitLoopTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}

/** A titled group of rows, like a section of the iPhone app's lists. */
@Composable
fun Section(title: String? = null, footer: String? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        if (title != null) {
            Text(title.uppercase(), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
        }
        Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(10.dp), content = content)
        }
        if (footer != null) {
            Text(footer, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp, top = 6.dp, end = 4.dp))
        }
    }
}

@Composable
fun LabeledRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f))
        Spacer(Modifier.width(12.dp))
        Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun SwitchRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f))
        Spacer(Modifier.width(12.dp))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
fun Secondary(text: String, modifier: Modifier = Modifier) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = modifier)
}

@Composable
fun ErrorText(text: String?) {
    if (text != null) Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp))
}

@Composable
fun Headline(text: String, modifier: Modifier = Modifier) {
    Text(text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = modifier)
}
