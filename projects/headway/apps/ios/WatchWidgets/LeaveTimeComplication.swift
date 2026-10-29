import HeadwayKit
import SwiftUI
import WidgetKit

public struct LeaveTimeEntry: TimelineEntry {
    public let date: Date
    public let train: BoardTrain?
    public let board: Board?
    public let leaveByDate: Date?
    public let isUrgent: Bool
    public let destinationShort: String
    public let walkMinutes: Int
    public let statusMessage: String?

    public init(
        date: Date,
        train: BoardTrain? = nil,
        board: Board? = nil,
        leaveByDate: Date? = nil,
        isUrgent: Bool = false,
        destinationShort: String = "SF",
        walkMinutes: Int = 10,
        statusMessage: String? = nil
    ) {
        self.date = date
        self.train = train
        self.board = board
        self.leaveByDate = leaveByDate
        self.isUrgent = isUrgent
        self.destinationShort = destinationShort
        self.walkMinutes = walkMinutes
        self.statusMessage = statusMessage
    }
}

public struct LeaveTimeProvider: TimelineProvider {
    public typealias Entry = LeaveTimeEntry

    public init() {}

    public func placeholder(in context: Context) -> LeaveTimeEntry {
        let now = Date()
        let sampleTrain = BoardTrain(
            train: "512",
            kind: "EXP",
            dir: "NB",
            serviceDate: "2026-10-28",
            dep: now.addingTimeInterval(22 * 60).timeIntervalSince1970 * 1000,
            arr: now.addingTimeInterval(52 * 60).timeIntervalSince1970 * 1000,
            predDep: now.addingTimeInterval(22 * 60).timeIntervalSince1970 * 1000,
            predArr: now.addingTimeInterval(52 * 60).timeIntervalSince1970 * 1000,
            delayMin: 0,
            status: .onTime,
            stopsBetween: 4,
            leaveBy: now.addingTimeInterval(12 * 60).timeIntervalSince1970 * 1000,
            catchState: "walk"
        )
        return LeaveTimeEntry(
            date: now,
            train: sampleTrain,
            leaveByDate: now.addingTimeInterval(12 * 60),
            isUrgent: false,
            destinationShort: "SF",
            walkMinutes: 10
        )
    }

    public func getSnapshot(in context: Context, completion: @escaping (LeaveTimeEntry) -> Void) {
        let now = Date()
        if let state = WatchStore.loadCachedState(), let b = state.board {
            let nowMs = now.timeIntervalSince1970 * 1000
            let upcoming = b.trains.filter { $0.predDep > nowMs }
            if let first = upcoming.first {
                let depDate = Date(timeIntervalSince1970: first.predDep / 1000)
                let walkMin = first.leaveBy.map { max(1, Int(round((first.predDep - $0) / 60_000))) } ?? b.walkMinutes ?? 10
                let leaveDate = first.leaveBy.map { Date(timeIntervalSince1970: $0 / 1000) } ?? depDate.addingTimeInterval(-Double(walkMin * 60))
                let isUrgent = now >= leaveDate
                completion(LeaveTimeEntry(
                    date: now,
                    train: first,
                    board: b,
                    leaveByDate: leaveDate,
                    isUrgent: isUrgent,
                    destinationShort: b.to.short,
                    walkMinutes: walkMin
                ))
                return
            }
        }
        completion(placeholder(in: context))
    }

    public func getTimeline(in context: Context, completion: @escaping (Timeline<LeaveTimeEntry>) -> Void) {
        Task {
            let now = Date()
            var board: Board? = nil
            let state = WatchStore.loadCachedState()
            board = state?.board

            let fromStation = board?.from.id ?? "san_francisco"
            let toStation = board?.to.id ?? "sj_diridon"
            let expressPref = state?.expressPreference ?? .all

            let nowMs = now.timeIntervalSince1970 * 1000
            let hasUpcoming = board?.trains.contains(where: { $0.predDep > nowMs }) ?? false

            // Fetch live board if cached board is missing or has no upcoming departures
            if !hasUpcoming {
                do {
                    let backend = Backend(config: .production, session: state?.session)
                    if state?.session != nil {
                        let my = try await backend.myBoard(from: fromStation, to: toStation, express: expressPref)
                        board = my.board
                    } else {
                        board = try await backend.board(from: fromStation, to: toStation, express: expressPref)
                    }
                } catch {
                    // Retain existing board if fetch fails
                }
            }

            guard let b = board else {
                let fallback = placeholder(in: context)
                let timeline = Timeline(entries: [fallback], policy: .after(now.addingTimeInterval(10 * 60)))
                completion(timeline)
                return
            }

            let upcoming = b.trains.filter { $0.predDep > nowMs }
            if upcoming.isEmpty {
                let fallback = LeaveTimeEntry(
                    date: now,
                    board: b,
                    destinationShort: b.to.short,
                    statusMessage: "No trains tonight"
                )
                let timeline = Timeline(entries: [fallback], policy: .after(now.addingTimeInterval(15 * 60)))
                completion(timeline)
                return
            }

            var entries: [LeaveTimeEntry] = []
            for (idx, train) in upcoming.prefix(4).enumerated() {
                let depDate = Date(timeIntervalSince1970: train.predDep / 1000)
                let walkMin = train.leaveBy.map { max(1, Int(round((train.predDep - $0) / 60_000))) } ?? b.walkMinutes ?? 10
                let leaveDate = train.leaveBy.map { Date(timeIntervalSince1970: $0 / 1000) } ?? depDate.addingTimeInterval(-Double(walkMin * 60))

                if idx == 0 {
                    if now < leaveDate {
                        // Counting down to leave time
                        entries.append(LeaveTimeEntry(
                            date: now,
                            train: train,
                            board: b,
                            leaveByDate: leaveDate,
                            isUrgent: false,
                            destinationShort: b.to.short,
                            walkMinutes: walkMin
                        ))
                        // Triggers "Leave now!" once leave time is reached
                        entries.append(LeaveTimeEntry(
                            date: leaveDate,
                            train: train,
                            board: b,
                            leaveByDate: leaveDate,
                            isUrgent: true,
                            destinationShort: b.to.short,
                            walkMinutes: walkMin
                        ))
                    } else {
                        // Already inside walk window or urgent
                        entries.append(LeaveTimeEntry(
                            date: now,
                            train: train,
                            board: b,
                            leaveByDate: leaveDate,
                            isUrgent: true,
                            destinationShort: b.to.short,
                            walkMinutes: walkMin
                        ))
                    }
                } else {
                    let prevDep = Date(timeIntervalSince1970: upcoming[idx - 1].predDep / 1000)
                    if leaveDate > prevDep {
                        entries.append(LeaveTimeEntry(
                            date: prevDep,
                            train: train,
                            board: b,
                            leaveByDate: leaveDate,
                            isUrgent: false,
                            destinationShort: b.to.short,
                            walkMinutes: walkMin
                        ))
                        entries.append(LeaveTimeEntry(
                            date: leaveDate,
                            train: train,
                            board: b,
                            leaveByDate: leaveDate,
                            isUrgent: true,
                            destinationShort: b.to.short,
                            walkMinutes: walkMin
                        ))
                    } else {
                        entries.append(LeaveTimeEntry(
                            date: prevDep,
                            train: train,
                            board: b,
                            leaveByDate: leaveDate,
                            isUrgent: true,
                            destinationShort: b.to.short,
                            walkMinutes: walkMin
                        ))
                    }
                }
            }

            let nextRefresh = min(now.addingTimeInterval(15 * 60), entries.last?.date ?? now.addingTimeInterval(15 * 60))
            let timeline = Timeline(entries: entries, policy: .after(nextRefresh))
            completion(timeline)
        }
    }
}

public struct LeaveTimeComplicationView: View {
    @Environment(\.widgetFamily) var family
    public var entry: LeaveTimeEntry

    private var accentEmerald: Color {
        Color(red: 0.24, green: 0.82, blue: 0.48)
    }

    public var body: some View {
        switch family {
        case .accessoryRectangular:
            rectangularView
        case .accessoryCircular:
            circularView
        case .accessoryInline:
            inlineView
        case .accessoryCorner:
            cornerView
        default:
            circularView
        }
    }

    // MARK: - Rectangular (Modular / Ultra Modular)
    private var rectangularView: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let train = entry.train {
                HStack(spacing: 4) {
                    Image(systemName: "tram.fill")
                        .font(.caption2)
                        .foregroundStyle(accentEmerald)
                    Text("#\(train.train) \(train.kind)")
                        .font(.caption2.bold())
                    Spacer()
                    let depDate = Date(timeIntervalSince1970: train.predDep / 1000)
                    Text(depDate, format: .dateTime.hour().minute())
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                if entry.isUrgent {
                    HStack(spacing: 4) {
                        Image(systemName: "figure.run")
                            .font(.subheadline.bold())
                            .foregroundStyle(.orange)
                        Text("Leave now!")
                            .font(.headline.bold())
                            .foregroundStyle(.orange)
                    }
                } else if let leaveByDate = entry.leaveByDate {
                    HStack(spacing: 4) {
                        Image(systemName: "figure.walk")
                            .font(.caption.bold())
                            .foregroundStyle(accentEmerald)
                        Text("Leave in")
                            .font(.subheadline)
                        Text(leaveByDate, style: .relative)
                            .font(.headline.bold())
                            .monospacedDigit()
                            .foregroundStyle(accentEmerald)
                    }
                } else {
                    let depDate = Date(timeIntervalSince1970: train.predDep / 1000)
                    HStack(spacing: 4) {
                        Text("Departs in")
                            .font(.subheadline)
                        Text(depDate, style: .relative)
                            .font(.headline.bold())
                            .foregroundStyle(accentEmerald)
                    }
                }

                HStack(spacing: 4) {
                    Text("To \(entry.destinationShort) · \(entry.walkMinutes)m walk")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    if let delay = train.delayMin, delay >= 2 {
                        Text("+\(delay)m")
                            .font(.caption2.bold())
                            .foregroundStyle(.orange)
                    }
                }
            } else {
                HStack(spacing: 4) {
                    Image(systemName: "tram.fill")
                        .foregroundStyle(accentEmerald)
                    Text("Headway")
                        .font(.headline)
                }
                Text(entry.statusMessage ?? "No upcoming trains")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .widgetURL(URL(string: "headway://board"))
    }

    // MARK: - Circular (Infograph / Metropolitan)
    private var circularView: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                if let _ = entry.train, let leaveDate = entry.leaveByDate {
                    Image(systemName: entry.isUrgent ? "figure.run" : "figure.walk")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(entry.isUrgent ? .orange : accentEmerald)

                    if entry.isUrgent {
                        Text("NOW")
                            .font(.system(size: 10, weight: .heavy, design: .rounded))
                            .foregroundStyle(.orange)
                    } else {
                        Text(leaveDate, style: .relative)
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .minimumScaleFactor(0.6)
                    }
                } else if let train = entry.train {
                    let depDate = Date(timeIntervalSince1970: train.predDep / 1000)
                    Image(systemName: "tram.fill")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(accentEmerald)
                    Text(depDate, style: .relative)
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .monospacedDigit()
                } else {
                    Image(systemName: "figure.walk")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(accentEmerald)
                    Text("--m")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .widgetURL(URL(string: "headway://board"))
    }

    // MARK: - Inline (Top text on Modular)
    private var inlineView: some View {
        HStack(spacing: 4) {
            if let train = entry.train {
                Image(systemName: entry.isUrgent ? "figure.run" : "figure.walk")
                if entry.isUrgent {
                    Text("Leave now · #\(train.train)")
                } else if let leaveByDate = entry.leaveByDate {
                    Text("Leave in ")
                    Text(leaveByDate, style: .relative)
                    Text(" · #\(train.train)")
                } else {
                    Text("#\(train.train) to \(entry.destinationShort)")
                }
            } else {
                Image(systemName: "figure.walk")
                Text(entry.statusMessage ?? "Headway")
            }
        }
        .widgetURL(URL(string: "headway://board"))
    }

    // MARK: - Corner (Infograph Corners)
    private var cornerView: some View {
        VStack {
            Image(systemName: entry.isUrgent ? "figure.run" : "figure.walk")
                .font(.title3.bold())
                .foregroundStyle(entry.isUrgent ? .orange : accentEmerald)
            if entry.isUrgent {
                Text("NOW")
                    .font(.caption2.bold())
                    .foregroundStyle(.orange)
            } else if let leaveByDate = entry.leaveByDate {
                Text(leaveByDate, style: .relative)
                    .font(.caption2.bold())
                    .monospacedDigit()
            } else {
                Text("--m")
                    .font(.caption2.bold())
            }
        }
        .widgetURL(URL(string: "headway://board"))
    }
}

public struct LeaveTimeComplication: Widget {
    public let kind: String = "com.hejitech.headway.watchkitapp.widgets.leavetime"

    public init() {}

    public var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LeaveTimeProvider()) { entry in
            LeaveTimeComplicationView(entry: entry)
        }
        .configurationDisplayName("Leave in X Countdown")
        .description("Live countdown showing when to leave the door for your next Caltrain.")
        .supportedFamilies([
            .accessoryRectangular,
            .accessoryCircular,
            .accessoryInline,
            .accessoryCorner
        ])
    }
}
