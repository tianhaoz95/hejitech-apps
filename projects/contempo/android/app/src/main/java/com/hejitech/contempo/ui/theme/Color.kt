package com.hejitech.contempo.ui.theme

import androidx.compose.ui.graphics.Color

// Mirrors branding/landing_v0/site/assets/style.css tokens. Kept as a plain
// literal palette here (not a shared design-token pipeline) — see that
// file's comment for why a shared build-time token system would be
// over-engineering at this stage.
//
// A handful of values below (marked "derived") have no literal counterpart
// in style.css — the landing page is a single flat page with no tonal
// elevation system, but Material3's ColorScheme needs surface-container
// tiers and container/on-container pairs for roles the CSS never had to
// name. Those are hand-picked to sit consistently within the pine/navy/brass
// system rather than falling back to Material's baseline purple defaults.

// Light
val PaperLight = Color(0xFFF5F6F2)
val PaperRaisedLight = Color(0xFFFFFFFF)
val InkLight = Color(0xFF14201B)
val InkSoftLight = Color(0xFF45524B)
val InkFaintLight = Color(0xFF7C8880)
val PineLight = Color(0xFF1F5C46)
val PineDeepLight = Color(0xFF163F31)
val PineTintLight = Color(0xFFE4EEE8)
val NavyLight = Color(0xFF16273D)
val NavyTintLight = Color(0xFFE7EBF1)
val BrassLight = Color(0xFFA67C34)
val BrassTintLight = Color(0xFFF3E9D6)
val HairlineLight = Color(0xFFDBE1D8)
val HairlineStrongLight = Color(0xFFC3CCC3)
val DangerLight = Color(0xFFA13F36)
val DangerTintLight = Color(0xFFFBECEB)

// Derived (light) — onTertiaryContainer needs to read on top of BrassTintLight.
val BrassDeepLight = Color(0xFF6B4E1F)
val SurfaceVariantLight = Color(0xFFEEF1EC)
val SurfaceContainerLowestLight = Color(0xFFFFFFFF)
val SurfaceContainerLowLight = Color(0xFFF9FAF7)
val SurfaceContainerLight = Color(0xFFF2F3EF)
val SurfaceContainerHighLight = Color(0xFFECEEE8)
val SurfaceContainerHighestLight = Color(0xFFE6E8E2)

// Dark
val PaperDark = Color(0xFF0E1613)
val PaperRaisedDark = Color(0xFF16201C)
val InkDark = Color(0xFFECEEE8)
val InkSoftDark = Color(0xFFA9B3AC)
val InkFaintDark = Color(0xFF71827A)
val PineDark = Color(0xFF45A67C)
val PineDeepDark = Color(0xFF327A5B)
val PineTintDark = Color(0xFF16261F)
val NavyDark = Color(0xFF9FB2CF)
val NavyTintDark = Color(0xFF17222F)
val BrassDark = Color(0xFFCDA35C)
val BrassTintDark = Color(0xFF2A2214)
val HairlineDark = Color(0xFF263029)
val HairlineStrongDark = Color(0xFF364039)
val DangerDark = Color(0xFFD97A70)
val DangerTintDark = Color(0xFF2C1A18)

// Derived (dark)
val SurfaceVariantDark = Color(0xFF1B2420)
val SurfaceContainerLowestDark = Color(0xFF0B100E)
val SurfaceContainerLowDark = Color(0xFF121915)
val SurfaceContainerDark = Color(0xFF16201C)
val SurfaceContainerHighDark = Color(0xFF1D2823)
val SurfaceContainerHighestDark = Color(0xFF27332D)
