package com.hejitech.contempo.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

// Mirrors --radius-sm/md/lg from branding/landing_v0/site/assets/style.css
// (4 / 8 / 14dp) — the brand's buttons and inputs are deliberately blockier
// than Material3's default near-stadium shapes, so this alone is most of
// what makes buttons/fields/cards read as "the same product" as the landing
// page mockups.
val ContempoShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(4.dp),
    medium = RoundedCornerShape(8.dp),
    large = RoundedCornerShape(14.dp),
    extraLarge = RoundedCornerShape(14.dp),
)
