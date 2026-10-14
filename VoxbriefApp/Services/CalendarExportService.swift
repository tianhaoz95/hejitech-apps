import Foundation
#if canImport(EventKit)
import EventKit
#endif

public enum CalendarExportError: LocalizedError, Sendable {
    case accessDenied
    case unsupportedPlatform
    case saveFailed(String)

    public var errorDescription: String? {
        switch self {
        case .accessDenied:
            return "Calendar permission was denied. Please allow calendar access in Settings."
        case .unsupportedPlatform:
            return "EventKit is not supported on this platform."
        case .saveFailed(let reason):
            return "Could not create calendar event: \(reason)"
        }
    }
}

public final class CalendarExportService: @unchecked Sendable {
    public static let shared = CalendarExportService()

    #if canImport(EventKit)
    private let eventStore = EKEventStore()
    #endif

    public func exportEvent(for note: VoiceNote, startDate: Date = Date().addingTimeInterval(3600), duration: TimeInterval = 1800) async throws {
        #if canImport(EventKit)
        let granted: Bool
        if #available(iOS 17.0, macOS 14.0, *) {
            do {
                granted = try await eventStore.requestFullAccessToEvents()
            } catch {
                throw CalendarExportError.accessDenied
            }
        } else {
            granted = try await withCheckedThrowingContinuation { continuation in
                eventStore.requestAccess(to: .event) { allowed, error in
                    if let error = error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume(returning: allowed)
                    }
                }
            }
        }

        guard granted else {
            throw CalendarExportError.accessDenied
        }

        guard let defaultCalendar = eventStore.defaultCalendarForNewEvents else {
            throw CalendarExportError.saveFailed("No default calendar found on device.")
        }

        let event = EKEvent(eventStore: eventStore)
        event.title = note.title
        let noteBody = note.summary.isEmpty ? note.cleanedNote : "\(note.summary)\n\n\(note.cleanedNote)"
        event.notes = "Exported from Voxbrief:\n\(noteBody)"
        event.startDate = startDate
        event.endDate = startDate.addingTimeInterval(duration)
        event.calendar = defaultCalendar

        do {
            try eventStore.save(event, span: .thisEvent, commit: true)
        } catch {
            throw CalendarExportError.saveFailed(error.localizedDescription)
        }
        #else
        throw CalendarExportError.unsupportedPlatform
        #endif
    }
}
