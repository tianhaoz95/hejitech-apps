package com.hejitech.contempo.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// The landing page pairs a serif display face (Iowan Old Style / Palatino /
// Georgia) for h1-h4 with a system sans for body copy and a monospace for
// small uppercase "eyebrow" labels and numeric/tabular values. FontFamily
// .Serif / .Monospace are built-in generic families the platform resolves
// to a real system font (Noto Serif / Droid Sans Mono on stock Android) —
// no font files to bundle, so this gets the brand's headline/eyebrow
// pairing without the "no custom font files" tradeoff Type.kt used to note.
val ContempoTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 34.sp,
        letterSpacing = (-0.3).sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 26.sp,
        letterSpacing = (-0.2).sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.Serif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
    ),
    // The "eyebrow" style: small uppercase mono labels above a screen/section
    // title (see Eyebrow() in Brand.kt), and reused directly wherever the
    // landing page would reach for its .mono/tabular-nums treatment (entry
    // durations, timestamps).
    labelSmall = TextStyle(
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        letterSpacing = 1.3.sp,
    ),
)
