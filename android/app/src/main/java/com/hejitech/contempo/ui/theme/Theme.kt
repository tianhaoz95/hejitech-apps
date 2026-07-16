package com.hejitech.contempo.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// Every ColorScheme role Material3 components actually paint themselves
// with is set explicitly here — leaving roles like primaryContainer or
// surfaceVariant unset means they fall back to Material's baseline purple
// defaults, which then leaks through wherever a stock component uses them
// (chat bubbles via primaryContainer/surfaceVariant, the nav bar's selected
// pill via secondaryContainer, dropdown menus via surface containers, etc).
// Filling all of these in is what makes the whole app read as one brand
// instead of "mostly on-brand, except these few components."
private val LightColors = lightColorScheme(
    primary = PineLight,
    onPrimary = PaperRaisedLight,
    primaryContainer = PineTintLight,
    onPrimaryContainer = PineDeepLight,
    secondary = NavyLight,
    onSecondary = PaperRaisedLight,
    secondaryContainer = NavyTintLight,
    onSecondaryContainer = NavyLight,
    tertiary = BrassLight,
    onTertiary = PaperRaisedLight,
    tertiaryContainer = BrassTintLight,
    onTertiaryContainer = BrassDeepLight,
    error = DangerLight,
    onError = PaperRaisedLight,
    errorContainer = DangerTintLight,
    onErrorContainer = DangerLight,
    background = PaperLight,
    onBackground = InkLight,
    surface = PaperRaisedLight,
    onSurface = InkLight,
    surfaceVariant = SurfaceVariantLight,
    onSurfaceVariant = InkSoftLight,
    outline = HairlineStrongLight,
    outlineVariant = HairlineLight,
    surfaceContainerLowest = SurfaceContainerLowestLight,
    surfaceContainerLow = SurfaceContainerLowLight,
    surfaceContainer = SurfaceContainerLight,
    surfaceContainerHigh = SurfaceContainerHighLight,
    surfaceContainerHighest = SurfaceContainerHighestLight,
    inverseSurface = InkLight,
    inverseOnSurface = PaperLight,
    inversePrimary = PineTintLight,
    scrim = Color.Black,
)

private val DarkColors = darkColorScheme(
    primary = PineDark,
    onPrimary = PaperDark,
    primaryContainer = PineTintDark,
    onPrimaryContainer = PineDark,
    secondary = NavyDark,
    onSecondary = PaperDark,
    secondaryContainer = NavyTintDark,
    onSecondaryContainer = NavyDark,
    tertiary = BrassDark,
    onTertiary = BrassTintDark,
    tertiaryContainer = BrassTintDark,
    onTertiaryContainer = BrassDark,
    error = DangerDark,
    onError = PaperDark,
    errorContainer = DangerTintDark,
    onErrorContainer = DangerDark,
    background = PaperDark,
    onBackground = InkDark,
    surface = PaperRaisedDark,
    onSurface = InkDark,
    surfaceVariant = SurfaceVariantDark,
    onSurfaceVariant = InkSoftDark,
    outline = HairlineStrongDark,
    outlineVariant = HairlineDark,
    surfaceContainerLowest = SurfaceContainerLowestDark,
    surfaceContainerLow = SurfaceContainerLowDark,
    surfaceContainer = SurfaceContainerDark,
    surfaceContainerHigh = SurfaceContainerHighDark,
    surfaceContainerHighest = SurfaceContainerHighestDark,
    inverseSurface = InkDark,
    inverseOnSurface = PaperDark,
    inversePrimary = PineDeepDark,
    scrim = Color.Black,
)

/**
 * Deliberately does NOT opt into Material You dynamic color by default —
 * the brand has a specific pine/navy/brass identity (see the landing page),
 * and letting it get overridden by the user's wallpaper palette would lose
 * that. dynamicColor param exists for later experimentation, defaulted off.
 */
@Composable
fun ContempoTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = ContempoTypography,
        shapes = ContempoShapes,
        content = content,
    )
}
