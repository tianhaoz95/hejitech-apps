import Foundation
import ContempoCore

/// Firestore document shape for `users/{uid}/entries/{entryId}`. Mirrors
/// EntrySchema in backend/functions/src/schemas.ts, plus the bookkeeping
/// fields (status, source, timestamps, riskFlags) that only exist client/
/// Firestore-side, not in the parsing schema.
///
/// Unlike the Android model, Swift's `Codable` maps stored property names
/// literally with no "is"-prefix stripping, so `isVague`/`isBackfilled`/
/// `isTrip` need no special-cased coding keys the way the Kotlin side does.
public struct Entry: Codable, Identifiable, Equatable, Sendable {
    public var id: String?
    public var propertyId: String
    public var propertyName: String
    public var task: String
    public var durationMinutes: Int
    /// Raw Firestore string value — see `categoryEnum` for the typed accessor.
    public var category: String
    public var status: String
    public var source: String
    /// When the work actually happened — set by the user, not "now."
    public var activityDate: Timestamp
    /// When this entry was first written to Firestore — the contemporaneity anchor.
    public var loggedAt: Timestamp
    public var confirmedAt: Timestamp?
    public var isVague: Bool
    public var isBackfilled: Bool
    public var daysLate: Int
    public var riskReasons: [String]
    public var photoUrls: [String]
    /// True while this entry is an open start/stop timer with no end yet — see TimerEntryCoordinator.
    public var inProgress: Bool
    /// True while an in-progress entry is paused — see TimerEntryCoordinator.handlePause/handleResume.
    /// Optional (not defaulted) for the same reason `roleId`/`roleName` are: Swift's Codable synthesis
    /// doesn't fall back to a default for a missing key, and this field doesn't exist on entries written
    /// before pause/resume shipped.
    public var isPaused: Bool?
    /// Set when a pause begins, cleared on resume. Nil whenever `isPaused` isn't true.
    public var pausedAt: Timestamp?
    /// Running total of all completed pause spans for this entry, subtracted from elapsed time when
    /// computing `durationMinutes`.
    public var pausedDurationSeconds: Int?
    /// Marks this entry as (also) a mileage trip — orthogonal to inProgress/hours,
    /// not a replacement: a work timer and a driving trip can be open at the same
    /// time, so `findOpenEntry` is scoped by this flag rather than there being one
    /// global "the one open entry." See MileageTripCoordinator.
    public var isTrip: Bool
    /// "manual" / "photo" / "gps" — how the mileage below was captured, for
    /// audit-trail transparency and CSV export.
    public var mileageCaptureMethod: String
    /// Final recorded mileage for this trip — 0.0 = not applicable, same
    /// convention as durationMinutes = 0.
    public var miles: Double
    public var odometerStart: Double?
    public var odometerEnd: Double?
    public var tripStartLat: Double?
    public var tripStartLng: Double?
    public var tripEndLat: Double?
    public var tripEndLng: Double?
    /// Where this entry was captured (general "said from here" evidence),
    /// distinct from the trip-specific tripStart/tripEnd fields above.
    public var captureLat: Double?
    public var captureLng: Double?
    /// Permanent Storage download URL for the raw audio behind this entry —
    /// kept forever, unlike the transient local queue it came through.
    public var audioUrl: String
    /// The verbatim Whisper transcription this entry was parsed from — before
    /// AgentClient's cleanup produced `task`. Only ever populated alongside
    /// `audioUrl`.
    public var rawTranscript: String
    /// When/where a start/stop timer entry was actually stopped. Null while
    /// the timer is still open.
    public var stoppedAt: Timestamp?
    public var stopLat: Double?
    public var stopLng: Double?
    /// Who actually did this work — nil/empty means "me" (the owner), the
    /// implicit default for every entry before this field existed. Only set
    /// when logged under someone else's role (see `ParticipantRole`). Optional (not a
    /// defaulted "") because Swift's Codable synthesis does not fall back to
    /// a property's default value for a missing key — an old entry doc
    /// without this field would otherwise fail to decode and silently drop
    /// out of every list (verified empirically; see Attachment.note).
    public var roleId: String?
    public var roleName: String?

    enum CodingKeys: String, CodingKey {
        case id = "id"
        case propertyId = "property_id"
        case propertyName = "property_name"
        case task = "task"
        case durationMinutes = "duration_minutes"
        case category = "category"
        case status = "status"
        case source = "source"
        case activityDate = "activity_date"
        case loggedAt = "logged_at"
        case confirmedAt = "confirmed_at"
        case isVague = "is_vague"
        case isBackfilled = "is_backfilled"
        case daysLate = "days_late"
        case riskReasons = "risk_reasons"
        case photoUrls = "photo_urls"
        case inProgress = "in_progress"
        case isPaused = "is_paused"
        case pausedAt = "paused_at"
        case pausedDurationSeconds = "paused_duration_seconds"
        case isTrip = "is_trip"
        case mileageCaptureMethod = "mileage_capture_method"
        case miles = "miles"
        case odometerStart = "odometer_start"
        case odometerEnd = "odometer_end"
        case tripStartLat = "trip_start_lat"
        case tripStartLng = "trip_start_lng"
        case tripEndLat = "trip_end_lat"
        case tripEndLng = "trip_end_lng"
        case captureLat = "capture_lat"
        case captureLng = "capture_lng"
        case audioUrl = "audio_url"
        case rawTranscript = "raw_transcript"
        case stoppedAt = "stopped_at"
        case stopLat = "stop_lat"
        case stopLng = "stop_lng"
        case roleId = "role_id"
        case roleName = "role_name"
    }

    /// Missing or null columns fall back to the model's defaults (Postgres nulls, older rows).
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id)
        propertyId = try c.decodeIfPresent(String.self, forKey: .propertyId) ?? ""
        propertyName = try c.decodeIfPresent(String.self, forKey: .propertyName) ?? ""
        task = try c.decodeIfPresent(String.self, forKey: .task) ?? ""
        durationMinutes = try c.decodeIfPresent(Int.self, forKey: .durationMinutes) ?? 0
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? ""
        status = try c.decodeIfPresent(String.self, forKey: .status) ?? ""
        source = try c.decodeIfPresent(String.self, forKey: .source) ?? ""
        activityDate = try c.decodeIfPresent(Timestamp.self, forKey: .activityDate) ?? Timestamp(date: Date())
        loggedAt = try c.decodeIfPresent(Timestamp.self, forKey: .loggedAt) ?? Timestamp(date: Date())
        confirmedAt = try c.decodeIfPresent(Timestamp.self, forKey: .confirmedAt)
        isVague = try c.decodeIfPresent(Bool.self, forKey: .isVague) ?? false
        isBackfilled = try c.decodeIfPresent(Bool.self, forKey: .isBackfilled) ?? false
        daysLate = try c.decodeIfPresent(Int.self, forKey: .daysLate) ?? 0
        riskReasons = try c.decodeIfPresent([String].self, forKey: .riskReasons) ?? []
        photoUrls = try c.decodeIfPresent([String].self, forKey: .photoUrls) ?? []
        inProgress = try c.decodeIfPresent(Bool.self, forKey: .inProgress) ?? false
        isPaused = try c.decodeIfPresent(Bool.self, forKey: .isPaused)
        pausedAt = try c.decodeIfPresent(Timestamp.self, forKey: .pausedAt)
        pausedDurationSeconds = try c.decodeIfPresent(Int.self, forKey: .pausedDurationSeconds)
        isTrip = try c.decodeIfPresent(Bool.self, forKey: .isTrip) ?? false
        mileageCaptureMethod = try c.decodeIfPresent(String.self, forKey: .mileageCaptureMethod) ?? ""
        miles = try c.decodeIfPresent(Double.self, forKey: .miles) ?? 0
        odometerStart = try c.decodeIfPresent(Double.self, forKey: .odometerStart)
        odometerEnd = try c.decodeIfPresent(Double.self, forKey: .odometerEnd)
        tripStartLat = try c.decodeIfPresent(Double.self, forKey: .tripStartLat)
        tripStartLng = try c.decodeIfPresent(Double.self, forKey: .tripStartLng)
        tripEndLat = try c.decodeIfPresent(Double.self, forKey: .tripEndLat)
        tripEndLng = try c.decodeIfPresent(Double.self, forKey: .tripEndLng)
        captureLat = try c.decodeIfPresent(Double.self, forKey: .captureLat)
        captureLng = try c.decodeIfPresent(Double.self, forKey: .captureLng)
        audioUrl = try c.decodeIfPresent(String.self, forKey: .audioUrl) ?? ""
        rawTranscript = try c.decodeIfPresent(String.self, forKey: .rawTranscript) ?? ""
        stoppedAt = try c.decodeIfPresent(Timestamp.self, forKey: .stoppedAt)
        stopLat = try c.decodeIfPresent(Double.self, forKey: .stopLat)
        stopLng = try c.decodeIfPresent(Double.self, forKey: .stopLng)
        roleId = try c.decodeIfPresent(String.self, forKey: .roleId)
        roleName = try c.decodeIfPresent(String.self, forKey: .roleName)
    }

    public init(
        id: String? = nil,
        propertyId: String = "",
        propertyName: String = "",
        task: String = "",
        durationMinutes: Int = 0,
        category: String = EntryCategory.other.firestoreValue,
        status: String = EntryStatus.pendingReview.firestoreValue,
        source: String = CaptureSource.manual.firestoreValue,
        activityDate: Timestamp = Timestamp(date: Date()),
        loggedAt: Timestamp = Timestamp(date: Date()),
        confirmedAt: Timestamp? = nil,
        isVague: Bool = false,
        isBackfilled: Bool = false,
        daysLate: Int = 0,
        riskReasons: [String] = [],
        photoUrls: [String] = [],
        inProgress: Bool = false,
        isPaused: Bool? = nil,
        pausedAt: Timestamp? = nil,
        pausedDurationSeconds: Int? = nil,
        isTrip: Bool = false,
        mileageCaptureMethod: String = "",
        miles: Double = 0.0,
        odometerStart: Double? = nil,
        odometerEnd: Double? = nil,
        tripStartLat: Double? = nil,
        tripStartLng: Double? = nil,
        tripEndLat: Double? = nil,
        tripEndLng: Double? = nil,
        captureLat: Double? = nil,
        captureLng: Double? = nil,
        audioUrl: String = "",
        rawTranscript: String = "",
        stoppedAt: Timestamp? = nil,
        stopLat: Double? = nil,
        stopLng: Double? = nil,
        roleId: String? = nil,
        roleName: String? = nil
    ) {
        self.id = id
        self.propertyId = propertyId
        self.propertyName = propertyName
        self.task = task
        self.durationMinutes = durationMinutes
        self.category = category
        self.status = status
        self.source = source
        self.activityDate = activityDate
        self.loggedAt = loggedAt
        self.confirmedAt = confirmedAt
        self.isVague = isVague
        self.isBackfilled = isBackfilled
        self.daysLate = daysLate
        self.riskReasons = riskReasons
        self.photoUrls = photoUrls
        self.inProgress = inProgress
        self.isPaused = isPaused
        self.pausedAt = pausedAt
        self.pausedDurationSeconds = pausedDurationSeconds
        self.isTrip = isTrip
        self.mileageCaptureMethod = mileageCaptureMethod
        self.miles = miles
        self.odometerStart = odometerStart
        self.odometerEnd = odometerEnd
        self.tripStartLat = tripStartLat
        self.tripStartLng = tripStartLng
        self.tripEndLat = tripEndLat
        self.tripEndLng = tripEndLng
        self.captureLat = captureLat
        self.captureLng = captureLng
        self.audioUrl = audioUrl
        self.rawTranscript = rawTranscript
        self.stoppedAt = stoppedAt
        self.stopLat = stopLat
        self.stopLng = stopLng
        self.roleId = roleId
        self.roleName = roleName
    }

    /// True when this entry's hours belong to the app's own user (no role
    /// tagged at all) — the only bucket that should count toward the
    /// 100-hour/500-hour material participation progress on the Dashboard.
    public var isOwnerHours: Bool { (roleId ?? "").isEmpty }

    public var categoryEnum: EntryCategory { EntryCategory(firestoreValue: category) }
    public var statusEnum: EntryStatus { EntryStatus(firestoreValue: status) }
    public var sourceEnum: CaptureSource { CaptureSource(firestoreValue: source) }
    public var riskFlags: RiskFlags { RiskFlags(isVague: isVague, isBackfilled: isBackfilled, daysLate: daysLate, reasons: riskReasons) }

    /// Which of property/task/duration are still unset, derived live from
    /// this entry's own fields — see EntryFieldValidation. Not persisted:
    /// always accurate (including for entries written before this existed),
    /// and never needs a Firestore-rules change. Empty means fully filled in
    /// (whether pending or confirmed); non-empty on a pendingReview entry
    /// distinguishes an incomplete draft from one just awaiting a final
    /// confirm tap — drives the Dashboard's Draft badge and Entry Detail's
    /// missing-field text.
    public var missingFields: [String] {
        EntryFieldValidation.missingFields(property: propertyName, task: task, durationMinutes: durationMinutes)
    }
}
