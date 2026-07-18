package com.hejitech.contempo.ui.theme

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp

/**
 * The landing page's `.eyebrow` element: a short leading rule + a small
 * uppercase mono label in pine, sitting above a section/screen title. Ports
 * directly since it's just a Row + a rule + Typography.labelSmall (see
 * Type.kt) — no new visual system to invent.
 */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .width(20.dp)
                .height(1.dp)
                .background(MaterialTheme.colorScheme.primary),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = text.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

/**
 * The landing page's `.mock-card` / `.feature-card` treatment: a flat
 * surface with a hairline border rather than Material's default tonal-tint
 * elevation look. `tonalElevation = 0.dp` matters here — without it, M3
 * washes the card in a translucent primary tint at higher elevations, which
 * reads as "Material" rather than "this brand."
 */
/**
 * The landing page's `.rec-pill` — a pulsing dot + a small mono label,
 * used there for the recording-indicator mockup. Reused literally as-is for
 * CaptureScreen's real listening state: a danger-colored pulsing dot
 * (`--rec-dot`'s `pulse` keyframe, 1.6s ease-in-out infinite between full
 * and ~35% opacity) next to uppercase mono text, on a tinted pill background.
 */
@Composable
fun RecordingIndicator(text: String, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "recording-pulse")
    val dotAlpha by transition.animateFloat(
        initialValue = 1f,
        targetValue = 0.35f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "recording-dot-alpha",
    )

    Row(
        modifier = modifier
            .clip(MaterialTheme.shapes.extraLarge)
            .background(MaterialTheme.colorScheme.errorContainer)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .alpha(dotAlpha)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.error),
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = text.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.error,
        )
    }
}

@Composable
fun ContempoCard(
    modifier: Modifier = Modifier,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier,
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        content = content,
    )
}

/**
 * Renders the parse prompt's only allowed markdown construct — lines
 * starting with "- " — as an actual bullet list; anything else (the common
 * single-task case) is just a plain paragraph. Deliberately hand-rolled
 * rather than a markdown library: bullets are the only formatting the
 * prompt ever produces (see AgentClient.buildEntryPrompt), so a full
 * renderer would be unused surface area. Shared across Capture's review
 * card, Dashboard's entry rows, and Entry detail's task row — anywhere
 * entry.task is shown read-only (Confirm's task field stays a plain
 * editable OutlinedTextField, not this — rendering markdown inside an
 * editable field is a different problem).
 */
@Composable
fun BulletAwareText(text: String, style: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.bodyLarge) {
    val lines = text.lines()
    if (lines.none { it.trimStart().startsWith("- ") }) {
        Text(text, style = style)
        return
    }
    Column {
        lines.forEach { line ->
            val trimmed = line.trimStart()
            if (trimmed.startsWith("- ")) {
                Row {
                    Text("•  ", style = style)
                    Text(trimmed.removePrefix("- "), style = style)
                }
            } else if (trimmed.isNotEmpty()) {
                Text(trimmed, style = style)
            }
        }
    }
}
