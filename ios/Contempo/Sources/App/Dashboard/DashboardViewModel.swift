import ContempoCore
import ContempoFirestore
import Foundation
import Observation

@Observable
@MainActor
final class DashboardViewModel {
    private let entryRepository = ServiceLocator.entryRepository

    var confirmedHours: Double = 0
    let thresholdHours = MaterialParticipationTest.thresholdHours
    let testName = MaterialParticipationTest.name
    var entries: [Entry] = []
    var pendingCount = 0
    /// The one open start/stop timer, if any. Surfaced separately from the generic pending list/count.
    var openTimerEntry: Entry?
    /// The one open mileage trip, if any. Scoped by isTrip so it and openTimerEntry never match the same entry.
    var openTripEntry: Entry?
    /// Sum of `miles` across every entry — a separate tax deduction from the hours progress above.
    var totalMiles: Double = 0

    /// Selection mode is implicit: active whenever this is non-empty.
    var selectedIds: Set<String> = []
    var isDeleting = false
    var deleteError: String?

    init() {
        let repository = entryRepository
        Task { [weak self] in
            let stream = AuthAwareStream.make(
                fallback: { [] },
                onAuthFailure: { try? await ServiceLocator.authManager.signOut() },
                factory: { repository.observeEntries() }
            )
            do {
                for try await entries in stream {
                    guard let self else { return }
                    self.apply(entries: entries)
                }
            } catch {
                // Stream ended with a non-auth error — nothing else to do here.
            }
        }
    }

    private func apply(entries: [Entry]) {
        self.entries = entries
        let confirmed = entries.filter { $0.statusEnum == .confirmed }
        confirmedHours = confirmed.reduce(0) { $0 + Double($1.durationMinutes) } / 60.0
        // Excludes the open timer/trip — they're "still running," not "needs completing."
        pendingCount = entries.filter { $0.statusEnum == .pendingReview && !$0.inProgress }.count
        openTimerEntry = entries.first { $0.inProgress && !$0.isTrip }
        openTripEntry = entries.first { $0.inProgress && $0.isTrip }
        totalMiles = entries.reduce(0) { $0 + $1.miles }
        let validIds = Set(entries.compactMap(\.id))
        selectedIds = selectedIds.intersection(validIds)
    }

    func toggleSelected(_ entryId: String) {
        if selectedIds.contains(entryId) {
            selectedIds.remove(entryId)
        } else {
            selectedIds.insert(entryId)
        }
        deleteError = nil
    }

    func selectAll() {
        selectedIds = Set(entries.compactMap(\.id))
    }

    func clearSelection() {
        selectedIds = []
        deleteError = nil
    }

    /// Single-entry delete via Dashboard's swipe-to-delete gesture.
    func deleteEntry(_ entryId: String) async -> Bool {
        (try? await entryRepository.deleteEntries(entryIds: [entryId])) != nil
    }

    func deleteSelected() {
        let ids = selectedIds
        guard !ids.isEmpty else { return }
        isDeleting = true
        deleteError = nil
        Task {
            do {
                try await entryRepository.deleteEntries(entryIds: Array(ids))
                selectedIds = []
                isDeleting = false
            } catch {
                isDeleting = false
                deleteError = error.localizedDescription
            }
        }
    }

    func dismissDeleteError() {
        deleteError = nil
    }
}
