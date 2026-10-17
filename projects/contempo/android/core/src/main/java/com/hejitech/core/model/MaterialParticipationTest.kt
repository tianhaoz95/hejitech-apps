package com.hejitech.core.model

/**
 * MVP hardcodes the 100-hour STR test rather than exposing test selection in
 * the UI — the PRD's onboarding-interview feature (which picks the right
 * test for the host's situation) is fast-follow, not MVP scope. Shared by
 * DashboardViewModel and ChatViewModel so the two can't drift apart.
 */
object MaterialParticipationTest {
    const val THRESHOLD_HOURS = 100
    const val NAME = "STR"
}
