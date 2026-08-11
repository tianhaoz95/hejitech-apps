@preconcurrency import FirebaseFirestore

/// The single box the user drew on a feedback screenshot to point at the
/// area of interest — normalized 0..1 fractions of image width/height (not
/// pixels), so it stays valid regardless of device screen resolution. `nil`
/// (the whole `region` field absent) if the user skipped boxing.
public struct FeedbackRegion: Codable, Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var w: Double
    public var h: Double

    public init(x: Double = 0, y: Double = 0, w: Double = 0, h: Double = 0) {
        self.x = x
        self.y = y
        self.w = w
        self.h = h
    }
}

/// Firestore document shape for `users/{uid}/appFeedback/{feedbackId}` — a
/// "shake to report" bug/improvement report: a screenshot, an optional
/// boxed region of interest, a free-text description, and structured
/// device/app state, so the triage-feedback skill can plan a fix without
/// the user having to describe it by hand. Append-only from the client
/// (see firestore.rules' isValidAppFeedback) — status transitions to
/// "triaged"/"resolved" are made by that skill's fetch script via the
/// Admin SDK, not by this app.
public struct AppFeedback: Codable, Identifiable, Equatable, Sendable {
    @DocumentID public var id: String?
    public var description: String
    public var screenshotPath: String
    public var downloadURL: String
    public var region: FeedbackRegion?
    public var appVersion: String
    public var buildNumber: String
    public var osVersion: String
    public var deviceModel: String
    public var screenName: String
    public var locale: String
    public var status: String
    public var createdAt: Timestamp

    public init(
        id: String? = nil,
        description: String = "",
        screenshotPath: String = "",
        downloadURL: String = "",
        region: FeedbackRegion? = nil,
        appVersion: String = "",
        buildNumber: String = "",
        osVersion: String = "",
        deviceModel: String = "",
        screenName: String = "",
        locale: String = "",
        status: String = "pending",
        createdAt: Timestamp = Timestamp(date: Date())
    ) {
        self.id = id
        self.description = description
        self.screenshotPath = screenshotPath
        self.downloadURL = downloadURL
        self.region = region
        self.appVersion = appVersion
        self.buildNumber = buildNumber
        self.osVersion = osVersion
        self.deviceModel = deviceModel
        self.screenName = screenName
        self.locale = locale
        self.status = status
        self.createdAt = createdAt
    }
}
