package com.hejitech.contempo.feedback

import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackKitConfiguration
import com.feedbackkit.FeedbackTheme

/**
 * Shake to report, through FeedbackKit: the SDK captures the screenshot, lets the user mark it up
 * and describe the problem, and sends it to Contempo's FeedbackKit project, where it's triaged
 * (dashboard, Portal app or `npx feedbackkit-cli`). Opt-in from Settings
 * (ShakeToReportSettingsStore); turning it off also stops the "is it fixed?" prompt for the
 * reporter's earlier reports. Mirrors iOS's Feedback/FeedbackReporting.swift.
 */
object FeedbackReporting {
    fun configure(enabled: Boolean) {
        FeedbackKit.configure(
            FeedbackKitConfiguration(
                endpointUrl = "https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback",
                projectKey = "pk_e34cf12ad7d2c103d4ce464337ecf0869f6b",
            ),
        )
        FeedbackKit.theme = FeedbackTheme(primaryColorHex = "#1F5C46", secondaryColorHex = "#A67C34") // pine, brass
        apply(enabled)
    }

    fun apply(enabled: Boolean) {
        if (enabled) {
            FeedbackKit.enableShakeToReport()
            FeedbackKit.enableFixVerification()
        } else {
            FeedbackKit.disableShakeToReport()
            FeedbackKit.disableFixVerification()
        }
    }
}
