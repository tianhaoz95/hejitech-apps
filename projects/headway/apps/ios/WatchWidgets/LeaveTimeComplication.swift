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
        let sampleTrain = BoardTrain(
            train: "512",
            kind: "EXP",
            dir: "NB",
            serviceDate: "2026-10-28",
            dep: Date().addingTimeInterval(22 * 60).timeIntervalSince1970 * 1000,
            arr: Date().addingTimeInterval(52 * 60).timeIntervalSince1970 * 1000,
            predDep: Date().addingTimeInterval(22 * 60).timeIntervalSince1970 * 1000,
            predArr: Date().addingTimeInterval(52 * 60).timeIntervalSince1970 * 1000,
            delayMin: 0,
            status: .onTime,
            stopsBetween: 4,
            leaveBy: Date().addingTimeInterval(12 * 60).timeIntervalSince1970 * 1000,
            catchState: "walk"
        )
        return LeaveTimeEntry(
            date: Date(),
            train: sampleTrain,
            leaveByDate: Date().addingTimeInterval(12 * 60),
            isUrgent: false,
            destinationShort: "SF",
            walkMinutes: 10
        )
    }

    public func getSnapshot(in context: Context, completion: @escaping (LeaveTimeEntry) -> Void) {
        if let state = WatchStore.loadCachedState(), let b = state.board {
            let now = Date()
            let upcoming = b.trains.filter { $0.predDep > now.timeIntervalSince1970 * 1000 }
            if let first = upcoming.first {
                let leaveDate = first.leaveBy.map { Date(timeIntervalSince1970: $0 / 1000) }
                let isUrgent = leaveDate.map { now >= $0 } ?? false
                completion(LeaveTimeEntry(
                    date: now,
                    train: first,
                    board: b,
                    leaveByDate: leaveDate,
                    isUrgent: isUrgent,
                    destinationShort: b.to.short,
                    walkMinutes: calculateWalkMinutes(for: first)
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

            // 1. Try to read from shared/local watch cache
            if let state = WatchStore.loadCachedState() {
                board = state.board
            }

            // 2. If no board or stale, attempt direct fetch from backend
            if board == nil {
                do {
                    let backend = Backend(config: .production)
                    board = try await backend.board(from: "70011", to: "70261")
                } catch {
                    // Offline fallback
                }
            }

            guard let b = board else {
                let fallback = LeaveTimeEntry(
                    date: now,
                    statusMessage: "Set commute in app"
                )
                let timeline = Timeline(entries: [fallback], policy: .after(now.addingTimeInterval(15 * 60)))
                completion(timeline)
                return
            }

            var entries: [LeaveTimeEntry] = []
            let nowMs = now.timeIntervalSince1970 * 1000
            let upcoming = b.trains.filter { $0.predDep > nowMs }

            if upcoming.isEmpty {
                entries.append(LeaveTimeEntry(
                    date: now,
                    board: b,
                    destinationShort: b.to.short,
                    statusMessage: "No more trains today"
                ))
                let timeline = Timeline(entries: entries, policy: .after(now.addingTimeInterval(20 * 60)))
                completion(timeline)
                return
            }

            // Generate timeline for upcoming trains
            for (idx, train) in upcoming.prefix(3).enumerated() {
                let depDate = Date(timeIntervalSince1970: train.predDep / 1000)
                let leaveDate = train.leaveBy.map { Date(timeIntervalSince1970: $0 / 1000) }
                let walkMin = calculateWalkMinutes(for: train)

                if idx == 0 {
                    // Current active train
                    if let lDate = leaveDate {
                        if now < lDate {
                            // Stage 1: Counting down to leaveBy
                            entries.append(LeaveTimeEntry(
                                date: now,
                                train: train,
                                board: b,
                                leaveByDate: lDate,
                                isUrgent: false,
                                destinationShort: b.to.short,
                                walkMinutes: walkMin
                            ))
                            // Stage 2: From leaveBy until departure ("Leave now!")
                            entries.append(LeaveTimeEntry(
                                date: lDate,
                                train: train,
                                board: b,
                                leaveByDate: lDate,
                                isUrgent: true,
                                destinationShort: b.to.short,
                                walkMinutes: walkMin
                            ))
                        } else {
                            // Currently in walk window or urgent
                            entries.append(LeaveTimeEntry(
                                date: now,
                                train: train,
                                board: b,
                                leaveByDate: lDate,
                                isUrgent: true,
                                destinationShort: b.to.short,
                                walkMinutes: walkMin
                            ))
                        }
                    } else {
                        // Train without leaveBy
                        entries.append(LeaveTimeEntry(
                            date: now,
                            train: train,
                            board: b,
                            leaveByDate: nil,
                            isUrgent: false,
                            destinationShort: b.to.short,
                            walkMinutes: walkMin
                        ))
                    }
                } else {
                    // Subsequent trains roll over at the previous train's departure
                    let prevDep = Date(timeIntervalSince1970: upcoming[idx - 1].predDep / 1000)
                    if let lDate = leaveDate, lDate > prevDep {
                        entries.append(LeaveTimeEntry(
                            date: prevDep,
                            train: train,
                            board: b,
                            leaveByDate: lDate,
                            isUrgent: false,
                            destinationShort: b.to.short,
                            walkMinutes: walkMin
                        ))
                        entries.append(LeaveTimeEntry(
                            date: lDate,
                            train: train,
                            board: b,
                            leaveByDate: lDate,
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
                            isUrgent: leaveDate.map { prevDep >= $0 } ?? false,
                            destinationShort: b.to.short,
                            walkMinutes: walkMin
                        ))
                    }
                }
            }

            let nextRefresh = entries.last?.date.addingTimeInterval(15 * 60) ?? now.addingTimeInterval(15 * 60)
            let timeline = Timeline(entries: entries, policy: .after(nextRefresh))
            completion(timeline)
        }
    }

    private func calculateWalkMinutes(for train: BoardTrain) -> Int {
        guard let leaveBy = train.leaveBy else { return 10 }
        let diffMs = train.predDep - leaveBy
        return max(1, Int(round(diffMs / 60_000)))
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
                if entry.train != nil {
                    Image(systemName: entry.isUrgent ? "figure.run" : "figure.walk")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(entry.isUrgent ? .orange : accentEmerald)

                    if entry.isUrgent {
                        Text("NOW")
                            .font(.system(size: 10, weight: .heavy, design: .rounded))
                            .foregroundStyle(.orange)
                    } else if let leaveByDate = entry.leaveByDate {
                        Text(leaveByDate, style: .relative)
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .minimumScaleFactor(0.65)
                    } else {
                        Text("LEAVE")
                            .font(.system(size: 8, weight: .bold))
                    }
                } else {
                    Image(systemName: "tram.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(accentEmerald)
                    Text("CAL")
                        .font(.system(size: 8, weight: .bold))
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
                Image(systemName: "tram.fill")
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
