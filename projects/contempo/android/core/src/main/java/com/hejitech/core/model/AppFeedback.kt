package com.hejitech.core.model


/**
 * The single box the user drew on the screenshot to point at the area of
 * interest — normalized 0..1 fractions of image width/height, not pixels,
 * so it stays valid regardless of device screen resolution. Absent (null)
 * on [AppFeedback.region] if the user skipped boxing.
 */
data class FeedbackRegion(
    val x: Double = 0.0,
    val y: Double = 0.0,
    val w: Double = 0.0,
    val h: Double = 0.0,
)

/**
 * Firestore document shape for `users/{uid}/appFeedback/{feedbackId}` — a
 * shake-to-report bug/improvement report: a screenshot, an optional boxed
 * region, a free-form description, and a snapshot of app/device state at
 * capture time. Append-only from the client (see firestore.rules'
 * isValidAppFeedback) — status transitions are made by the
 * triage-feedback skill's fetch script via the Admin SDK.
 */
data class AppFeedback(
    val id: String = "",
    val description: String = "",
    val screenshotPath: String = "",
    val downloadURL: String = "",
    val region: FeedbackRegion? = null,
    val appVersion: String = "",
    val buildNumber: String = "",
    val osVersion: String = "",
    val deviceModel: String = "",
    val screenName: String = "",
    val locale: String = "",
    val status: String = "pending",
    val createdAt: Timestamp = Timestamp.now(),
)
