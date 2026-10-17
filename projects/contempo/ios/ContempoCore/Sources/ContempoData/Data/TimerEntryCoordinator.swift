import ContempoCore
import Foundation

public enum TimerEventResult: Sendable, Equatable {
    case started(entryId: String)
    case stopped(entryId: String, durationMinutes: Int)
    case paused(entryId: String)
    case resumed(entryId: String)
}

/// Orchestrates the "start work" / "finished work" voice-timer feature: at
/// most one Entry ever has `inProgress = true` for a given user (enforced
/// here, not by a Firestore rule — see `EntryRepository.findOpenEntry`),
/// since a host can't honestly claim overlapping hours across two
/// simultaneous tasks. Shared by the phone-direct capture path and the
/// watch-relay path — both point at the same real Firestore/uid, so "the one
/// open entry" is consistent regardless of which device queries it.
public final class TimerEntryCoordinator: Sendable {
    /// Beyond this, an elapsed timer is almost certainly a forgotten "stop" — cap and flag rather than trust it.
    public static let maxOpenTimerMinutes = 12 * 60

    private let entryRepository: EntryRepository

    public init(entryRepository: EntryRepository) {
        self.entryRepository = entryRepository
    }

    /// Opens a new timer, auto-closing whatever was previously open first (no
    /// blocking/asking — matches this app's "capture is meant to be fast, not
    /// a conversation" principle). `startedAt` is the moment the "start"
    /// utterance actually happened, not necessarily now — the watch-relay
    /// path can be syncing minutes late, so callers must pass the original
    /// capture time, or the timer anchors late and every later duration
    /// computed from it is proportionally wrong.
    public func handleStart(
        property: String?,
        task: String?,
        category: String?,
        source: CaptureSource,
        startedAt: Timestamp,
        captureLat: Double? = nil,
        captureLng: Double? = nil
    ) async throws -> TimerEventResult {
        if let previous = try await entryRepository.findOpenEntry(isTrip: false) {
            _ = try await closeEntry(previous, closedAt: startedAt)
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
            captureLat: captureLat,
            captureLng: captureLng
        )
        let entryId = try await entryRepository.createEntry(entry)
        return .started(entryId: entryId)
    }

    /// Closes the open timer, if any. `stoppedAt` is the original "finished"
    /// capture time for the same late-sync reason as `handleStart`. `stopLat`/
    /// `stopLng` are best-effort "where the user was when they finished" —
    /// distinct from `Entry.captureLat`/`captureLng`, which records the
    /// *start* location instead. Returns nil when nothing was open — callers
    /// should fall back to treating the utterance as a normal standalone
    /// entry rather than silently dropping it.
    public func handleStop(
        property: String?,
        task: String?,
        stoppedAt: Timestamp,
        stopLat: Double? = nil,
        stopLng: Double? = nil
    ) async throws -> TimerEventResult? {
        guard let open = try await entryRepository.findOpenEntry(isTrip: false) else { return nil }
        let duration = try await closeEntry(open, closedAt: stoppedAt, property: property, task: task, stopLat: stopLat, stopLng: stopLng)
        return .stopped(entryId: open.id ?? "", durationMinutes: duration)
    }

    /// Pauses the open timer, if any. Returns nil if nothing is open or it's
    /// already paused — mirrors `handleStop`'s "nil means nothing to do"
    /// contract.
    public func handlePause(pausedAt: Timestamp) async throws -> TimerEventResult? {
        guard let open = try await entryRepository.findOpenEntry(isTrip: false), let entryId = open.id else { return nil }
        if open.isPaused == true { return nil }
        var updated = open
        updated.isPaused = true
        updated.pausedAt = pausedAt
        try await entryRepository.updateEntry(entryId: entryId, entry: updated)
        return .paused(entryId: entryId)
    }

    /// Resumes a paused timer, folding the just-finished pause span into
    /// `Entry.pausedDurationSeconds` so `closeEntry`'s elapsed-time math can
    /// subtract it back out later. Returns nil if nothing is open or it isn't
    /// currently paused.
    public func handleResume(resumedAt: Timestamp) async throws -> TimerEventResult? {
        guard let open = try await entryRepository.findOpenEntry(isTrip: false), let entryId = open.id,
              let pausedSince = open.pausedAt else { return nil }
        let pauseSpanSeconds = max(0, resumedAt.seconds - pausedSince.seconds)
        var updated = open
        updated.isPaused = false
        updated.pausedAt = nil
        updated.pausedDurationSeconds = Int((open.pausedDurationSeconds ?? 0)) + Int(pauseSpanSeconds)
        try await entryRepository.updateEntry(entryId: entryId, entry: updated)
        return .resumed(entryId: entryId)
    }

    /// Discards the open timer outright — deletes the Entry rather than
    /// closing it, for a "started by mistake" / changed-my-mind cancel.
    /// Unlike `handleStop`, nothing is finalized: no duration, no status
    /// flip, just gone. Returns the deleted entry's id, or nil if nothing
    /// was open. Safe to call unconditionally; the caller's confirmation UI
    /// is what actually gates this being destructive.
    @discardableResult
    public func handleCancel() async throws -> String? {
        guard let open = try await entryRepository.findOpenEntry(isTrip: false), let entryId = open.id else { return nil }
        try await entryRepository.deleteEntry(entryId: entryId)
        return entryId
    }

    @discardableResult
    private func closeEntry(
        _ open: Entry,
        closedAt: Timestamp,
        property: String? = nil,
        task: String? = nil,
        stopLat: Double? = nil,
        stopLng: Double? = nil
    ) async throws -> Int {
        // Fold in whatever pause span was still active at stop time, so
        // stopping mid-pause doesn't lose that span from the subtraction below.
        let finalPausedDurationSeconds = Int64(open.pausedDurationSeconds ?? 0) +
            (open.pausedAt.map { max(0, closedAt.seconds - $0.seconds) } ?? 0)
        let elapsedMinutes = max(0, Int((closedAt.seconds - open.activityDate.seconds - finalPausedDurationSeconds) / 60))
        let isStale = elapsedMinutes > Self.maxOpenTimerMinutes
        let duration = isStale ? Self.maxOpenTimerMinutes : elapsedMinutes

        // Only fill in from the closing utterance if the timer didn't already
        // know it — never clobber what the user said at start time.
        let resolvedProperty = open.propertyName.isEmpty ? (property ?? "") : open.propertyName
        let resolvedTask = open.task.isEmpty ? (task ?? "") : open.task
        let isComplete = !resolvedProperty.isEmpty && !resolvedTask.isEmpty && duration > 0

        var updated = open
        updated.propertyName = resolvedProperty
        updated.task = resolvedTask
        updated.durationMinutes = duration
        updated.inProgress = false
        updated.isPaused = false
        updated.pausedAt = nil
        updated.pausedDurationSeconds = Int(finalPausedDurationSeconds)
        updated.status = (isComplete ? EntryStatus.confirmed : EntryStatus.pendingReview).firestoreValue
        updated.confirmedAt = isComplete ? Timestamp(date: Date()) : nil
        updated.isVague = open.isVague || isStale
        if isStale {
            updated.riskReasons = open.riskReasons + ["Very long duration between start and stop — please double-check"]
        }
        updated.stoppedAt = closedAt
        updated.stopLat = stopLat
        updated.stopLng = stopLng

        guard let entryId = open.id else { return duration }
        try await entryRepository.updateEntry(entryId: entryId, entry: updated)
        return duration
    }
}
