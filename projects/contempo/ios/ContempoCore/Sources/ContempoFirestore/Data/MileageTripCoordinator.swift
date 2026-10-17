import ContempoCore
import FirebaseFirestore
import Foundation

public enum TripEventResult: Sendable, Equatable {
    case started(entryId: String)
    case ended(entryId: String, miles: Double)
    case paused(entryId: String)
    case resumed(entryId: String)
}

/// Orchestrates the two mileage-capture methods that have a real start/end
/// (odometer photo, GPS tracking) — voice/manual one-shot capture doesn't go
/// through this at all, since a stated total needs no open/close state.
///
/// Structurally parallel to `TimerEntryCoordinator`: at most one entry ever
/// has `(inProgress: true, isTrip: true)` by construction, scoped
/// independently from the work-timer's open entry via
/// `EntryRepository.findOpenEntry`'s `isTrip` parameter — a host can
/// legitimately be timing a task and driving at the same time, so these must
/// not auto-close each other.
public final class MileageTripCoordinator: Sendable {
    private let entryRepository: EntryRepository

    public init(entryRepository: EntryRepository) {
        self.entryRepository = entryRepository
    }

    public func handleStartTrip(
        property: String?,
        task: String?,
        category: String?,
        source: CaptureSource,
        startedAt: Timestamp,
        captureMethod: String,
        odometerStart: Double? = nil,
        startLat: Double? = nil,
        startLng: Double? = nil
    ) async throws -> TripEventResult {
        // Unlike a work timer, a trip's mileage can't be derived from
        // timestamps alone — if one was already open, there's no data to
        // close it with here, so it's marked abandoned/incomplete rather than
        // silently guessed at. Still fully visible/editable afterward, just
        // flagged for review.
        if let previous = try await entryRepository.findOpenEntry(isTrip: true) {
            _ = try await closeTrip(previous, endedAt: startedAt, captureMethod: previous.mileageCaptureMethod, abandoned: true)
        }

        let entry = Entry(
            propertyName: property ?? "",
            task: task ?? "",
            durationMinutes: 0,
            category: category.map { EntryCategory(firestoreValue: $0).firestoreValue } ?? EntryCategory.other.firestoreValue,
            status: EntryStatus.pendingReview.firestoreValue,
            source: source.firestoreValue,
            activityDate: startedAt,
            loggedAt: Timestamp(date: Date()),
            inProgress: true,
            isTrip: true,
            mileageCaptureMethod: captureMethod,
            odometerStart: odometerStart,
            tripStartLat: startLat,
            tripStartLng: startLng
        )
        let entryId = try await entryRepository.createEntry(entry)
        return .started(entryId: entryId)
    }

    /// `directMiles` wins when supplied — GPS trips close with their
    /// continuously-accumulated total, not a point-to-point recompute here,
    /// since a straight line between start/end coordinates would cut every
    /// corner a real route takes and understate the true distance. Otherwise
    /// falls back to `odometerEnd - odometerStart` for the photo method.
    /// Returns nil when nothing was open, same "caller falls back to a normal
    /// capture" contract as `TimerEntryCoordinator.handleStop`.
    public func handleEndTrip(
        endedAt: Timestamp,
        captureMethod: String,
        odometerEnd: Double? = nil,
        endLat: Double? = nil,
        endLng: Double? = nil,
        directMiles: Double? = nil
    ) async throws -> TripEventResult? {
        guard let open = try await entryRepository.findOpenEntry(isTrip: true) else { return nil }
        let miles = try await closeTrip(open, endedAt: endedAt, captureMethod: captureMethod, odometerEnd: odometerEnd, endLat: endLat, endLng: endLng, directMiles: directMiles)
        return .ended(entryId: open.id ?? "", miles: miles)
    }

    /// Checkpoints a GPS trip's continuously-accumulated running total to the
    /// open entry without closing it — called on every location fix, so the
    /// trip-so-far distance survives a process death mid-drive and is visible
    /// live on the Dashboard. Re-fetches `findOpenEntry` each call rather than
    /// trusting a cached reference, so a concurrent edit elsewhere isn't
    /// clobbered by a stale copy. A no-op if the trip was already ended by
    /// the time a queued update lands.
    public func updateTripDistance(miles: Double) async throws {
        guard let open = try await entryRepository.findOpenEntry(isTrip: true), let entryId = open.id else { return }
        // Frozen while paused — the location callback may keep firing, but a
        // paused trip shouldn't accumulate distance until resumed.
        if open.isPaused == true { return }
        var updated = open
        updated.miles = miles
        try await entryRepository.updateEntry(entryId: entryId, entry: updated)
    }

    /// Pauses the open trip, if any. Returns nil if nothing is open or it's
    /// already paused.
    public func handlePauseTrip(pausedAt: Timestamp) async throws -> TripEventResult? {
        guard let open = try await entryRepository.findOpenEntry(isTrip: true), let entryId = open.id else { return nil }
        if open.isPaused == true { return nil }
        var updated = open
        updated.isPaused = true
        updated.pausedAt = pausedAt
        try await entryRepository.updateEntry(entryId: entryId, entry: updated)
        return .paused(entryId: entryId)
    }

    /// Resumes a paused trip, folding the just-finished pause span into
    /// `Entry.pausedDurationSeconds` (unused for trip duration today, but
    /// kept for audit-trail consistency with the work timer). Returns nil if
    /// nothing is open or it isn't currently paused.
    public func handleResumeTrip(resumedAt: Timestamp) async throws -> TripEventResult? {
        guard let open = try await entryRepository.findOpenEntry(isTrip: true), let entryId = open.id,
              let pausedSince = open.pausedAt else { return nil }
        let pauseSpanSeconds = max(0, resumedAt.seconds - pausedSince.seconds)
        var updated = open
        updated.isPaused = false
        updated.pausedAt = nil
        updated.pausedDurationSeconds = Int((open.pausedDurationSeconds ?? 0)) + Int(pauseSpanSeconds)
        try await entryRepository.updateEntry(entryId: entryId, entry: updated)
        return .resumed(entryId: entryId)
    }

    /// Discards the open trip outright — deletes the Entry rather than
    /// closing it, mirroring `TimerEntryCoordinator.handleCancel`. For a
    /// GPS trip, callers must also stop the location tracker/Live Activity
    /// (see CaptureViewModel.cancelTrip) — this only handles the Firestore
    /// side. Returns the deleted entry's id, or nil if nothing was open.
    @discardableResult
    public func handleCancelTrip() async throws -> String? {
        guard let open = try await entryRepository.findOpenEntry(isTrip: true), let entryId = open.id else { return nil }
        try await entryRepository.deleteEntry(entryId: entryId)
        return entryId
    }

    @discardableResult
    private func closeTrip(
        _ open: Entry,
        endedAt: Timestamp,
        captureMethod: String,
        odometerEnd: Double? = nil,
        endLat: Double? = nil,
        endLng: Double? = nil,
        directMiles: Double? = nil,
        abandoned: Bool = false
    ) async throws -> Double {
        let rawMiles: Double
        if let directMiles {
            rawMiles = directMiles
        } else if let odometerEnd, let odometerStart = open.odometerStart {
            rawMiles = max(0, odometerEnd - odometerStart)
        } else {
            rawMiles = 0
        }
        let miles = (rawMiles * 100).rounded() / 100

        let isComplete = !abandoned && !open.propertyName.isEmpty && !open.task.isEmpty && miles > 0

        var updated = open
        updated.inProgress = false
        updated.isPaused = false
        updated.pausedAt = nil
        updated.pausedDurationSeconds = Int((open.pausedDurationSeconds ?? 0)) +
            Int(open.pausedAt.map { max(0, endedAt.seconds - $0.seconds) } ?? 0)
        updated.miles = miles
        updated.mileageCaptureMethod = captureMethod
        updated.odometerEnd = odometerEnd
        updated.tripEndLat = endLat
        updated.tripEndLng = endLng
        updated.status = (isComplete ? EntryStatus.confirmed : EntryStatus.pendingReview).firestoreValue
        updated.confirmedAt = isComplete ? Timestamp(date: Date()) : nil
        updated.isVague = open.isVague || abandoned
        if abandoned {
            updated.riskReasons = open.riskReasons + ["Trip ended automatically when a new one started — mileage may be missing, please verify or delete."]
        }

        guard let entryId = open.id else { return miles }
        try await entryRepository.updateEntry(entryId: entryId, entry: updated)
        return miles
    }
}
