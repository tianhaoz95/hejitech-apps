#if canImport(AppIntents)
import AppIntents
import ContempoCore
import ContempoData
import Foundation

private func makeRepository() -> SupabaseEntryRepository {
    SupabaseEntryRepository()
}

public struct StartWorkTimerIntent: AppIntent {
    public static var title: LocalizedStringResource = "Start Work Timer"
    public static var description = IntentDescription("Starts tracking work hours for your property.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Property Name")
    public var propertyName: String?

    @Parameter(title: "Task Description")
    public var task: String?

    public init() {}

    public init(propertyName: String? = nil, task: String? = nil) {
        self.propertyName = propertyName
        self.task = task
    }

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let repo = makeRepository()
        let coordinator = TimerEntryCoordinator(entryRepository: repo)
        let now = Timestamp(date: Date())
        let prop = propertyName?.trimmingCharacters(in: .whitespacesAndNewlines)
        let t = task?.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            let res = try await coordinator.handleStart(
                property: (prop?.isEmpty ?? true) ? nil : prop,
                task: (t?.isEmpty ?? true) ? nil : t,
                category: "maintenance",
                source: .voice,
                startedAt: now
            )
            switch res {
            case .started:
                let msg = (prop?.isEmpty ?? true)
                    ? "Started work timer in Contempo."
                    : "Started work timer for \(prop!) in Contempo."
                return .result(dialog: IntentDialog(stringLiteral: msg))
            default:
                return .result(dialog: IntentDialog("Started work timer in Contempo."))
            }
        } catch {
            return .result(dialog: IntentDialog("Could not start work timer."))
        }
    }
}

public struct StopWorkTimerIntent: AppIntent {
    public static var title: LocalizedStringResource = "Stop Work Timer"
    public static var description = IntentDescription("Stops the active work timer and saves your participation hours.")
    public static var openAppWhenRun: Bool = false

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let repo = makeRepository()
        let coordinator = TimerEntryCoordinator(entryRepository: repo)
        let now = Timestamp(date: Date())

        do {
            if let res = try await coordinator.handleStop(
                property: nil,
                task: nil,
                stoppedAt: now
            ) {
                switch res {
                case .stopped(_, let durationMinutes):
                    let hours = Double(durationMinutes) / 60.0
                    let formatted = String(format: "%.1f", hours)
                    return .result(dialog: IntentDialog("Stopped work timer. Logged \(formatted) hours."))
                default:
                    return .result(dialog: IntentDialog("Stopped active timer."))
                }
            } else {
                return .result(dialog: IntentDialog("No active work timer found."))
            }
        } catch {
            return .result(dialog: IntentDialog("Failed to stop work timer."))
        }
    }
}

public struct LogHoursIntent: AppIntent {
    public static var title: LocalizedStringResource = "Log Rental Hours"
    public static var description = IntentDescription("Logs participation hours directly for a rental property.")
    public static var openAppWhenRun: Bool = false

    @Parameter(title: "Property Name")
    public var propertyName: String

    @Parameter(title: "Hours")
    public var hours: Double

    @Parameter(title: "Task Description")
    public var task: String?

    public init() {}

    public func perform() async throws -> some IntentResult & ProvidesDialog {
        let repo = makeRepository()
        let now = Timestamp(date: Date())
        let durationMinutes = max(1, Int((hours * 60.0).rounded()))
        let prop = propertyName.trimmingCharacters(in: .whitespacesAndNewlines)
        let taskName = task?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Property management"

        let entry = Entry(
            propertyName: prop,
            task: taskName,
            durationMinutes: durationMinutes,
            category: EntryCategory.maintenance.firestoreValue,
            status: EntryStatus.confirmed.firestoreValue,
            source: CaptureSource.voice.firestoreValue,
            activityDate: now,
            loggedAt: now,
            inProgress: false
        )

        do {
            _ = try await repo.createEntry(entry)
            let formatted = String(format: "%.1f", hours)
            return .result(dialog: IntentDialog("Logged \(formatted) hours for \(prop) in Contempo."))
        } catch {
            return .result(dialog: IntentDialog("Could not log hours in Contempo."))
        }
    }
}

public struct ContempoShortcutsProvider: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartWorkTimerIntent(),
            phrases: [
                "Start work timer in \(.applicationName)",
                "Start tracking hours in \(.applicationName)",
                "Start property timer in \(.applicationName)"
            ],
            shortTitle: "Start Timer",
            systemImageName: "play.circle.fill"
        )
        AppShortcut(
            intent: StopWorkTimerIntent(),
            phrases: [
                "Stop work timer in \(.applicationName)",
                "Stop tracking hours in \(.applicationName)",
                "Finish work in \(.applicationName)"
            ],
            shortTitle: "Stop Timer",
            systemImageName: "stop.circle.fill"
        )
        AppShortcut(
            intent: LogHoursIntent(),
            phrases: [
                "Log hours in \(.applicationName)",
                "Log rental hours in \(.applicationName)"
            ],
            shortTitle: "Log Hours",
            systemImageName: "clock.badge.checkmark"
        )
    }
}
#endif
