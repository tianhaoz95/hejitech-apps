import Foundation

/// Last-change-wins settings sync between the iPhone and the watch.
///
/// Both sides stamp their settings with the time a parent last changed them
/// (`settingsChangedAtKey`, seconds since 1970) and send that stamp, not the send time, with every
/// payload. A payload is applied only when its stamp is newer than the last change the receiver
/// knows of. That keeps WatchConnectivity's replays harmless: the application context the watch
/// re-reads at every launch, and the user-info queue, can't undo a change made on the watch since,
/// or re-fire a one-shot action like "Bedtime lullaby now".
enum SettingsSync {
    static let settingsChangedAtKey = "settingsChangedAt"
    /// Where the watch keeps the stamp of the settings it has (applied or changed itself).
    static let watchDefaultsKey = "tinyTouch_settingsChangedAt"

    /// Whether settings stamped `changedAt` replace settings last changed at `lastChange`.
    /// Payloads without a stamp (an iPhone app from before this sync) apply as they always did.
    static func isNewer(_ changedAt: Double?, than lastChange: Double) -> Bool {
        guard let changedAt else { return true }
        return changedAt > lastChange
    }
}
