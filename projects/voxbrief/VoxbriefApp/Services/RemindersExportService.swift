import Foundation
#if canImport(EventKit)
import EventKit
#endif

public enum RemindersExportError: LocalizedError, Sendable {
    case accessDenied
    case noActionItems
    case unsupportedPlatform
    case saveFailed(String)

    public var errorDescription: String? {
        switch self {
        case .accessDenied:
            return "Reminders permission was denied. Please allow access in Settings to export action items."
        case .noActionItems:
            return "No checklist action items found to export."
        case .unsupportedPlatform:
            return "EventKit is not supported on this platform."
        case .saveFailed(let reason):
            return "Could not save reminders: \(reason)"
        }
    }
}

public final class RemindersExportService: @unchecked Sendable {
    public static let shared = RemindersExportService()

    #if canImport(EventKit)
    private let eventStore = EKEventStore()
    #endif

    public func exportActionItems(_ items: [String], noteTitle: String) async throws -> Int {
        guard !items.isEmpty else {
            throw RemindersExportError.noActionItems
        }

        #if canImport(EventKit)
        let granted: Bool
        if #available(iOS 17.0, macOS 14.0, *) {
            do {
                granted = try await eventStore.requestFullAccessToReminders()
            } catch {
                throw RemindersExportError.accessDenied
            }
        } else {
            granted = try await withCheckedThrowingContinuation { continuation in
                eventStore.requestAccess(to: .reminder) { allowed, error in
                    if let error = error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: allowed)
                    }
                }
            }
        }

        guard granted else {
            throw RemindersExportError.accessDenied
        }

        guard let defaultList = eventStore.defaultCalendarForNewReminders() else {
            throw RemindersExportError.saveFailed("No default Reminders list found on device.")
        }

        var exportedCount = 0
        for item in items {
            let reminder = EKReminder(eventStore: eventStore)
            reminder.title = item
            reminder.notes = "Exported from Voxbrief voice note: \"\(noteTitle)\""
            reminder.calendar = defaultList
            do {
                try eventStore.save(reminder, commit: false)
                exportedCount += 1
            } catch {
                print("[RemindersExportService] Failed to stage reminder: \(error)")
            }
        }

        do {
            try eventStore.commit()
            return exportedCount
        } catch {
            throw RemindersExportError.saveFailed(error.localizedDescription)
        }
        #else
        throw RemindersExportError.unsupportedPlatform
        #endif
    }
}
