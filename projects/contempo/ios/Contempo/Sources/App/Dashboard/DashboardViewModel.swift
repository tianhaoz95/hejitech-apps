import ContempoCore
import ContempoData
import Foundation
import Observation

@Observable
@MainActor
final class DashboardViewModel {
    private let entryRepository = ServiceLocator.entryRepository

    /// Only entries with no role tagged (i.e. the owner's own hours) — see
    /// `Entry.isOwnerHours`. This is deliberately NOT every confirmed hour;
    /// the 100-hour/500-hour tests require the owner's participation to
    /// exceed everyone else's, so other roles' hours must never inflate this.
    var confirmedHours: Double = 0
    /// The tax year `confirmedHours` counts and the pace toward the threshold.
    var testProgress = TestYearProgress.compute(from: [])
    /// Other roles' confirmed hours, for audit-context comparison — see `RoleHoursSummary`.
    var otherRoleHours: [RoleHoursSummary] = []
    /// Unified owner + other-roles breakdown for the Dashboard's
    /// expand-to-compare UI — see `DashboardMetrics.roleBreakdown`.
    var roleBreakdown: [RoleHoursSummary] = []
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

    // Filter & Search state
    var selectedProperty: String = "All"
    var selectedCategory: String = "All"
    var searchText: String = ""

    var propertyOptions: [String] {
        let set = Set(entries.map { $0.propertyName.isEmpty ? "(No property)" : $0.propertyName })
        return ["All"] + set.sorted()
    }

    /// Stored category values ("guest_communication"), "All" first; show them with `categoryLabel`.
    var categoryOptions: [String] {
        let set = Set(entries.map(\.category).filter { !$0.isEmpty })
        return ["All"] + set.sorted { EntryCategory.displayName(for: $0) < EntryCategory.displayName(for: $1) }
    }

    func categoryLabel(_ value: String) -> String {
        value == "All" ? "All" : EntryCategory.displayName(for: value)
    }

    var filteredEntries: [Entry] {
        entries.filter { entry in
            if selectedProperty != "All" {
                let name = entry.propertyName.isEmpty ? "(No property)" : entry.propertyName
                if name != selectedProperty { return false }
            }
            if selectedCategory != "All" {
                if entry.category.lowercased() != selectedCategory.lowercased() { return false }
            }
            if !searchText.isEmpty {
                let query = searchText.lowercased()
                let matchesTask = entry.task.lowercased().contains(query)
                let matchesProperty = entry.propertyName.lowercased().contains(query)
                let matchesCategory = entry.category.lowercased().contains(query)
                if !matchesTask && !matchesProperty && !matchesCategory { return false }
            }
            return true
        }
    }

    /// The owner's confirmed hours among the filtered entries: the same rule as `confirmedHours`,
    /// so other roles' hours never count toward the test here either.
    var filteredHours: Double {
        filteredEntries.filter { $0.isOwnerHours && $0.statusEnum == .confirmed && !$0.inProgress && !$0.isTrip }
            .reduce(0.0) { $0 + Double($1.durationMinutes) } / 60.0
    }

    var isFilterActive: Bool {
        selectedProperty != "All" || selectedCategory != "All" || !searchText.isEmpty
    }

    // Pull-to-refresh & pending audio sync state
    var isSyncing = false
    var syncStatusMessage = ""
    var syncProgressFraction: Double = 0
    var syncNotice: String?

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
        let metrics = DashboardMetrics.compute(from: entries)
        confirmedHours = metrics.confirmedHours
        testProgress = metrics.testProgress
        otherRoleHours = metrics.otherRoleHours
        roleBreakdown = metrics.roleBreakdown
        pendingCount = metrics.pendingCount
        openTimerEntry = metrics.openTimerEntry
        openTripEntry = metrics.openTripEntry
        totalMiles = metrics.totalMiles
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

    func refreshAndProcessPendingAudios() async {
        isSyncing = true
        syncNotice = nil

        let localPending = ServiceLocator.pendingCaptureStore.listPending()
        let cloudPending = (try? await ServiceLocator.audioCaptureQueue.listPending()) ?? []
        let textPending = (try? await ServiceLocator.textCaptureQueue.listPending()) ?? []
        let total = localPending.count + cloudPending.count + textPending.count

        if total == 0 {
            syncStatusMessage = "Checking for pending voice entries..."
            syncProgressFraction = 1.0
            try? await Task.sleep(nanoseconds: 400_000_000)
            isSyncing = false
            syncNotice = "Dashboard up to date — no pending voice notes."
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                if self.syncNotice == "Dashboard up to date — no pending voice notes." {
                    self.syncNotice = nil
                }
            }
            return
        }

        // Phase 1: Uploading local pending WAVs
        for (index, item) in localPending.enumerated() {
            let step = index + 1
            syncStatusMessage = "Uploading voice recording \(step) of \(total)..."
            syncProgressFraction = Double(step) / Double(total + 1)
            _ = await PendingCaptureSyncer.syncOne(item)
        }

        // Phase 2: Transcribing and parsing cloud queue
        let processedCount = await AudioCaptureProcessor.shared.processPendingCaptures { current, _, stage in
            let step = localPending.count + current
            self.syncStatusMessage = "\(stage.rawValue) (\(step) of \(total))..."
            self.syncProgressFraction = Double(step) / Double(total + 1)
        }

        // Phase 3: Parsing queued typed-text Quick Captures — no upload
        // step needed (see TextCaptureQueue's doc comment), so this goes
        // straight from "queued" to "parsed."
        if !textPending.isEmpty {
            syncStatusMessage = "Structuring \(textPending.count) typed \(textPending.count == 1 ? "entry" : "entries")..."
        }
        let processedTextCount = await AudioCaptureProcessor.shared.processPendingTextCaptures()

        syncProgressFraction = 1.0
        syncStatusMessage = "Sync complete"
        isSyncing = false
        let totalProcessed = max(processedCount, localPending.count) + processedTextCount
        if totalProcessed > 0 {
            syncNotice = "Successfully processed \(totalProcessed) pending \(totalProcessed == 1 ? "entry" : "entries")"
        } else {
            syncNotice = "Dashboard refreshed"
        }

        Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            self.syncNotice = nil
        }
    }
}
