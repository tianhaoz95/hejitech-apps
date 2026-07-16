package com.hejitech.core.model

/** Mirrors FlagRiskOutputSchema in backend/functions/src/schemas.ts. */
data class RiskFlags(
    val isVague: Boolean = false,
    val isBackfilled: Boolean = false,
    val daysLate: Int = 0,
    val reasons: List<String> = emptyList(),
) {
    val hasWarning: Boolean get() = isVague || isBackfilled
}
