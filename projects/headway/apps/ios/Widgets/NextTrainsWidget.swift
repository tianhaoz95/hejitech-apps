#if os(iOS) && canImport(WidgetKit)
import AppIntents
import HeadwayKit
import SwiftUI
import WidgetKit

private let green = Color(red: 0.12, green: 0.62, blue: 0.34)

// MARK: configuration

/// A Caltrain station to pick in the widget's settings (from the Worker's public station list).
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

struct NextTrainsIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Next trains"
    static let description = IntentDescription("Live Caltrain departures between two stations.")

    @Parameter(title: "From", default: StationEntity.sanFrancisco)
    var from: StationEntity?

    @Parameter(title: "To", default: StationEntity.sanJose)
    var to: StationEntity?

    @Parameter(title: "Flip in the afternoon", description: "From noon, show the trip back.", default: true)
    var flipAfternoon: Bool

    init() {}
}

// MARK: timeline

struct NextTrainsEntry: TimelineEntry {
    let date: Date
    let fromShort: String
    let toShort: String
    let live: Bool
    /// Trains still to leave at `date`.
    let trains: [BoardTrain]
    let failed: Bool
}

struct NextTrainsProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> NextTrainsEntry {
        let now = Date()
        let minutes: [Double] = [8, 23, 41, 62]
        let numbers = ["512", "137", "416", "141"]
        var trains: [BoardTrain] = []
        for i in 0..<minutes.count {
            let dep: Double = now.addingTimeInterval(minutes[i] * 60).timeIntervalSince1970 * 1000
            let arr: Double = dep + 50 * 60_000
            let late = i == 1
            trains.append(BoardTrain(
                tripId: "placeholder-\(i)", train: numbers[i], kind: i % 2 == 0 ? "EXP" : "LOC",
                dep: dep, arr: arr, predDep: dep, predArr: arr,
                delayMin: late ? 4 : 0, status: late ? .late : .onTime, stopsBetween: 6
            ))
        }
        return NextTrainsEntry(date: now, fromShort: "SF", toShort: "San Jose", live: true, trains: trains, failed: false)
    }

    func snapshot(for configuration: NextTrainsIntent, in context: Context) async -> NextTrainsEntry {
        if context.isPreview { return placeholder(in: context) }
        return await timeline(for: configuration, in: context).entries.first ?? placeholder(in: context)
    }

    func timeline(for configuration: NextTrainsIntent, in context: Context) async -> Timeline<NextTrainsEntry> {
        let now = Date()
        var from = configuration.from ?? .sanFrancisco
        var to = configuration.to ?? .sanJose
        if configuration.flipAfternoon, Self.isAfternoonInCaltrainTime(now) { swap(&from, &to) }

        guard let board = try? await Backend(config: .production).board(from: from.id, to: to.id) else {
            let entry = NextTrainsEntry(date: now, fromShort: from.short, toShort: to.short, live: false, trains: [], failed: true)
            return Timeline(entries: [entry], policy: .after(now.addingTimeInterval(5 * 60)))
        }

        // One entry now and one as each train leaves, so the list drops departed trains between refreshes.
        let nowMs = now.timeIntervalSince1970 * 1000
        let upcoming = board.trains.filter { $0.predDep > nowMs }
        var dates = [now]
        dates += upcoming.prefix(4).map { Date(timeIntervalSince1970: $0.predDep / 1000 + 1) }
        let entries = dates.map { d in
            NextTrainsEntry(
                date: d, fromShort: board.from.short, toShort: board.to.short, live: board.live,
                trains: upcoming.filter { $0.predDep > d.timeIntervalSince1970 * 1000 }, failed: false
            )
        }
        // Live predictions change by the minute: ask for a fresh board soon (WidgetKit paces it).
        let refresh = board.live ? 5.0 : 15.0
        return Timeline(entries: entries, policy: .after(now.addingTimeInterval(refresh * 60)))
    }

    private static func isAfternoonInCaltrainTime(_ date: Date) -> Bool {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/Los_Angeles") ?? .current
        return cal.component(.hour, from: date) >= 12
    }
}

// MARK: views

struct NextTrainsWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "NextTrains", intent: NextTrainsIntent.self, provider: NextTrainsProvider()) { entry in
            NextTrainsView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
                .widgetURL(URL(string: "headway://board"))
        }
        .configurationDisplayName("Next trains")
        .description("Live Caltrain departures and countdowns at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

struct NextTrainsView: View {
    @Environment(\.widgetFamily) private var family
    let entry: NextTrainsEntry

    private var first: BoardTrain? { entry.trains.first }

    var body: some View {
        switch family {
        case .accessoryInline: inline
        case .accessoryCircular: circular
        case .accessoryRectangular: rectangular
        case .systemSmall: small
        case .systemLarge: list(rows: 6)
        default: list(rows: 3)
        }
    }

    private var title: some View {
        HStack(spacing: 4) {
            Image(systemName: "tram.fill").foregroundStyle(green)
            Text("\(entry.fromShort) → \(entry.toShort)").lineLimit(1).minimumScaleFactor(0.7)
            Spacer(minLength: 0)
            if entry.live {
                Circle().fill(.green).frame(width: 6, height: 6).accessibilityLabel("Live")
            }
        }
        .font(.caption.weight(.semibold))
    }

    private var empty: some View {
        Text(entry.failed ? "Can't reach Headway" : "No more trains today")
            .font(.caption)
            .foregroundStyle(.secondary)
    }

    // Home Screen

    private var small: some View {
        VStack(alignment: .leading, spacing: 4) {
            title
            Spacer(minLength: 0)
            if let t = first {
                Text("\(t.train) · \(t.kindName)").font(.caption2).foregroundStyle(.secondary)
                Text(t.predDepDate, style: .relative)
                    .font(.title2.weight(.bold).monospacedDigit())
                    .foregroundStyle(t.status == .cancelled ? .red : green)
                    .lineLimit(1).minimumScaleFactor(0.6)
                HStack(spacing: 4) {
                    Text(t.predDepDate, format: .dateTime.hour().minute())
                    DelayBadge(train: t)
                }
                .font(.caption.monospacedDigit())
                if entry.trains.count > 1 {
                    Text("then \(entry.trains[1].predDepDate, format: .dateTime.hour().minute())")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            } else {
                empty
            }
            Spacer(minLength: 0)
        }
    }

    private func list(rows: Int) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            title
            if entry.trains.isEmpty { empty }
            ForEach(entry.trains.prefix(rows)) { t in
                HStack(spacing: 8) {
                    Text(t.train).font(.subheadline.weight(.bold).monospacedDigit()).frame(width: 36, alignment: .leading)
                    Text(t.kindName).font(.caption).foregroundStyle(t.isExpress ? green : .secondary).lineLimit(1)
                    Text(t.predDepDate, format: .dateTime.hour().minute()).font(.subheadline.monospacedDigit())
                    DelayBadge(train: t).font(.caption.weight(.semibold))
                    Spacer(minLength: 4)
                    if t.status != .cancelled {
                        Text(t.predDepDate, style: .timer)
                            .font(.subheadline.weight(.semibold).monospacedDigit())
                            .foregroundStyle(green)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 64, alignment: .trailing)
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }

    // Lock Screen

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("\(entry.fromShort) → \(entry.toShort)").font(.caption2.weight(.semibold)).lineLimit(1)
            if let t = first {
                HStack(spacing: 4) {
                    Text(t.train).bold()
                    Text(t.predDepDate, style: .relative)
                }
                .font(.headline.monospacedDigit())
                .lineLimit(1)
                if entry.trains.count > 1 {
                    Text("then \(entry.trains[1].predDepDate, format: .dateTime.hour().minute())").font(.caption2).lineLimit(1)
                }
            } else {
                Text(entry.failed ? "Offline" : "No more trains").font(.caption)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inline: some View {
        Group {
            if let t = first {
                Text("\(Image(systemName: "tram.fill")) \(t.train) \(t.predDepDate, style: .relative)")
            } else {
                Text("\(Image(systemName: "tram.fill")) No more trains")
            }
        }
    }

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Image(systemName: "tram.fill").font(.caption2)
                if let t = first {
                    let minutes = max(0, Int(ceil(t.predDepDate.timeIntervalSince(entry.date) / 60)))
                    Text("\(minutes)").font(.title3.weight(.bold).monospacedDigit())
                    Text("min").font(.system(size: 9))
                } else {
                    Text("—").font(.title3)
                }
            }
        }
    }
}

private struct DelayBadge: View {
    let train: BoardTrain
    var body: some View {
        if train.status == .cancelled {
            Text("Cancelled").foregroundStyle(.red)
        } else if let d = train.delayMin, d >= 2 {
            Text("+\(d)m").foregroundStyle(.orange)
        }
    }
}

extension BoardTrain {
    var predDepDate: Date { Date(timeIntervalSince1970: predDep / 1000) }
}
#endif
