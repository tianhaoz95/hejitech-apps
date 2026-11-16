import AppIntents
import Foundation
import HeadwayKit

// Shared by the Home Screen widget's settings and the Siri / Shortcuts intents on iPhone and the watch.

/// A Caltrain station to pick in the widget's settings or a Siri / Shortcuts action (from the Worker's public station list).
struct StationEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Station"
    static let defaultQuery = StationQuery()

    let id: String
    let name: String
    let short: String

    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }

    static let sanFrancisco = StationEntity(id: "san_francisco", name: "San Francisco", short: "SF")
    static let sanJose = StationEntity(id: "sj_diridon", name: "San Jose Diridon", short: "San Jose")
}

struct StationQuery: EntityQuery {
    private static let cacheKey = "widget_stations"

    /// Caltrain stations north to south, cached for offline edits of the widget.
    static func stations() async -> [StationEntity] {
        if let s = try? await Backend(config: .production).stations(), !s.isEmpty {
            UserDefaults.standard.set(try? JSONEncoder().encode(s), forKey: cacheKey)
            return s.map { StationEntity(id: $0.id, name: $0.name, short: $0.short) }
        }
        if let data = UserDefaults.standard.data(forKey: cacheKey), let s = try? JSONDecoder().decode([Station].self, from: data) {
            return s.map { StationEntity(id: $0.id, name: $0.name, short: $0.short) }
        }
        return [.sanFrancisco, .sanJose]
    }

    func entities(for identifiers: [String]) async throws -> [StationEntity] {
        let all = await Self.stations()
        return identifiers.compactMap { id in all.first { $0.id == id } }
    }

    func suggestedEntities() async throws -> [StationEntity] { await Self.stations() }
}
