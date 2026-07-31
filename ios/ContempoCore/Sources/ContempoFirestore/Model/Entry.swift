import ContempoCore
@preconcurrency import FirebaseFirestore

/// Firestore document shape for `users/{uid}/entries/{entryId}`. Mirrors
/// EntrySchema in backend/functions/src/schemas.ts, plus the bookkeeping
/// fields (status, source, timestamps, riskFlags) that only exist client/
/// Firestore-side, not in the parsing schema.
///
/// Unlike the Android model, Swift's `Codable` maps stored property names
/// literally with no "is"-prefix stripping, so `isVague`/`isBackfilled`/
/// `isTrip` need no special-cased coding keys the way the Kotlin side does.
public struct Entry: Codable, Identifiable, Equatable, Sendable {
    @DocumentID public var id: String?
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
}
