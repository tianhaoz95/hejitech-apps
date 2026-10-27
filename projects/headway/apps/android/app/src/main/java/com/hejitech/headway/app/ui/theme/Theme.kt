package com.hejitech.headway.app.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val CaltrainRed = Color(0xFFE31837)
val CaltrainRedDark = Color(0xFFB31027)
val CaltrainRedLight = Color(0xFFFF5252)

val DarkBackground = Color(0xFF121212)
val DarkSurface = Color(0xFF1E1E1E)
val DarkSurfaceVariant = Color(0xFF282828)

val StatusGreen = Color(0xFF4CAF50)
val StatusAmber = Color(0xFFFF9800)
val StatusRed = Color(0xFFF44336)
val StatusGrey = Color(0xFF9E9E9E)

private val DarkColorScheme = darkColorScheme(
    primary = CaltrainRed,
    onPrimary = Color.White,
    primaryContainer = CaltrainRedDark,
    onPrimaryContainer = Color.White,
    secondary = CaltrainRedLight,
    onSecondary = Color.Black,
    background = DarkBackground,
    surface = DarkSurface,
    surfaceVariant = DarkSurfaceVariant,
    onBackground = Color.White,
    onSurface = Color.White,
    onSurfaceVariant = Color(0xFFDDDDDD)
)

@Composable
fun HeadwayTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
