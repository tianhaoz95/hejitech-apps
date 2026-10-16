import Foundation
import LogCore
#if canImport(WidgetKit)
import WidgetKit
#endif

/// State shared between the app, widgets and App Intents through the App Group container:
/// the SQLite log, the household, who "me" is, and the last status snapshot for widgets.
enum SharedStore {
    static var groupId: String { Bundle.main.object(forInfoDictionaryKey: "AppGroup") as? String ?? "group.com.hejitech.weehours" }

    static var container: URL {
        if let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupId) { return url }
        // Unsigned simulator builds have no group container; fall back to the app's own directory.
        let fallback = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: fallback, withIntermediateDirectories: true)
        return fallback
    }

    static var defaults: UserDefaults { UserDefaults(suiteName: groupId) ?? .standard }

    static var databaseURL: URL { container.appendingPathComponent("log.sqlite") }

    static func store() throws -> SQLiteLogStore { try SQLiteLogStore(url: databaseURL) }

    static var household: Household? {
        get { defaults.data(forKey: "household").flatMap { try? LogCoding.decoder.decode(Household.self, from: $0) } }
        set { defaults.set(newValue.flatMap { try? LogCoding.encoder.encode($0) }, forKey: "household") }
    }

    static var me: UUID? {
        get { defaults.string(forKey: "me").flatMap(UUID.init(uuidString:)) }
        set { defaults.set(newValue?.uuidString, forKey: "me") }
    }

    static var snapshot: StatusSnapshot? {
        get { defaults.data(forKey: "snapshot").flatMap { try? LogCoding.decoder.decode(StatusSnapshot.self, from: $0) } }
        set { defaults.set(newValue.flatMap { try? LogCoding.encoder.encode($0) }, forKey: "snapshot") }
    }

    /// A LogService for out-of-app writers (widget buttons, Siri, Shortcuts). Voice is app-only.
    static func service() throws -> LogService {
        guard let household, let me else { throw SharedError.notSetUp }
        return LogService(store: try store(), household: household, me: me,
                          interpreter: VoiceInterpreter(model: KeywordDecisionModel(), calibration: .bundled))
    }

    /// Recompute the widget snapshot and ask WidgetKit to redraw.
    static func publish(from service: LogService) async {
        if let s = try? await service.status() { snapshot = s }
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }

    enum SharedError: Error, LocalizedError {
        case notSetUp
        var errorDescription: String? { "Open the app once to set up your household." }
    }
}
