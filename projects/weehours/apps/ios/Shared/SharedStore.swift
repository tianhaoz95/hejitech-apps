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

    /// The first shown child's status (widgets set to no particular child).
    static var snapshot: StatusSnapshot? {
        get { defaults.data(forKey: "snapshot").flatMap { try? LogCoding.decoder.decode(StatusSnapshot.self, from: $0) } }
        set { defaults.set(newValue.flatMap { try? LogCoding.encoder.encode($0) }, forKey: "snapshot") }
    }

    /// Every shown child's status, for widgets set to a child and the "everyone" widget.
    static var snapshots: [UUID: StatusSnapshot] {
        get { defaults.data(forKey: "snapshots").flatMap { try? LogCoding.decoder.decode([UUID: StatusSnapshot].self, from: $0) } ?? [:] }
        set { defaults.set(try? LogCoding.encoder.encode(newValue), forKey: "snapshots") }
    }

    /// Children hidden on this phone (Settings → Children). Hiding is per phone, unlike archiving.
    static var hiddenChildren: Set<UUID> {
        get { Set((defaults.stringArray(forKey: "hiddenChildren") ?? []).compactMap(UUID.init(uuidString:))) }
        set { defaults.set(newValue.map(\.uuidString), forKey: "hiddenChildren") }
    }

    /// The household's children this phone shows: active and not hidden (never none).
    static func shown(_ h: Household) -> [Baby] {
        let hidden = hiddenChildren
        let list = h.active.filter { !hidden.contains($0.id) }
        return list.isEmpty ? h.active : list
    }

    /// Who Now's quick actions log for ("Log for"), kept to children that are shown.
    static func logFor(_ h: Household) -> [UUID] {
        let shown = shown(h).map(\.id)
        let saved = (defaults.stringArray(forKey: "logFor") ?? []).compactMap(UUID.init(uuidString:)).filter(shown.contains)
        return saved.isEmpty ? Array(shown.prefix(1)) : saved
    }

    static func setLogFor(_ ids: [UUID]) { defaults.set(ids.map(\.uuidString), forKey: "logFor") }

    /// A LogService for out-of-app writers (widget buttons, Siri, Shortcuts). Voice is app-only.
    static func service() throws -> LogService {
        guard let household, let me else { throw SharedError.notSetUp }
        return LogService(store: try store(), household: household, me: me,
                          interpreter: VoiceInterpreter(model: KeywordDecisionModel(), calibration: .bundled))
    }

    /// Recompute the widget snapshots and ask WidgetKit to redraw.
    static func publish(from service: LogService) async {
        let h = await service.household
        var all: [UUID: StatusSnapshot] = [:]
        for b in shown(h) { all[b.id] = try? await service.status(baby: b.id) }
        snapshots = all
        if let first = shown(h).first, let s = all[first.id] { snapshot = s }
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadAllTimelines()
        #endif
    }

    enum SharedError: Error, LocalizedError {
        case notSetUp
        var errorDescription: String? { "Open the app once to set up your household." }
    }
}
