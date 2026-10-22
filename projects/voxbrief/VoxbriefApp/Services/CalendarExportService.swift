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

    /// The first date in `text` that isn't over: a note about a plan often also mentions when
    /// something happened before ("we shipped on Aug 14; aim for December"), and an event belongs
    /// on the plan. Dates earlier today still count (a morning note about a 9 am meeting).
    public static func detectDate(in text: String, now: Date = Date()) -> Date? {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue) else {
            return nil
        }
        let startOfToday = Calendar.current.startOfDay(for: now)
        let matches = detector.matches(in: text, options: [], range: NSRange(location: 0, length: (text as NSString).length))
        return matches.lazy.compactMap(\.date).first { $0 >= startOfToday }
    }

    public static func resolvedStartDate(for note: VoiceNote, fallbackDate: Date = Date().addingTimeInterval(3600), now: Date = Date()) -> Date {
        if let titleDate = detectDate(in: note.title, now: now) {
            return titleDate
        }
        if let bodyDate = detectDate(in: "\(note.summary) \(note.cleanedNote)", now: now) {
            return bodyDate
        }
        return fallbackDate
    }

    public func exportEvent(for note: VoiceNote, startDate: Date? = nil, duration: TimeInterval = 1800) async throws {
        let eventStartDate = startDate ?? Self.resolvedStartDate(for: note)
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
        event.startDate = eventStartDate
        event.endDate = eventStartDate.addingTimeInterval(duration)
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
