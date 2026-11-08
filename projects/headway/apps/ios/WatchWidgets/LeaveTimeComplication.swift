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

    public var trainDepartureDate: Date? {
        guard let train = train else { return nil }
        return Date(timeIntervalSince1970: train.predDep / 1000)
    }

    public var userStationArrivalDate: Date? {
        date.addingTimeInterval(Double(walkMinutes * 60))
    }

    public var travelMode: TravelMode {
        board?.travel?.mode ?? .walk
    }

    public var bufferMinutes: Int {
        guard let trainDate = trainDepartureDate, let arrivalDate = userStationArrivalDate else { return 0 }
        return Int(round(trainDate.timeIntervalSince(arrivalDate) / 60))
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
        if let b = WatchStore.loadCachedState()?.board, let first = Self.entries(for: b, from: now).first {
            completion(first)
            return
        }
        completion(placeholder(in: context))
    }

    public func getTimeline(in context: Context, completion: @escaping (Timeline<LeaveTimeEntry>) -> Void) {
        Task {
            let now = Date()
            let state = WatchStore.loadCachedState()
            var board = state?.board
            let expressPref = state?.expressPreference ?? .all
            let signedIn = state?.session != nil
            // Signed in and nothing picked: no stations, so the Worker gives the commute leg for now
            // (the morning/evening switch); otherwise the picked or last pair.
            let pick = WatchStore.boardQuery(signedIn: signedIn, board: board, at: now)
            let fallback = (from: board?.from.id ?? "san_francisco", to: board?.to.id ?? "sj_diridon")

            // Live predictions move: fetch a fresh board, keeping the cached one if offline.
            do {
                let backend = Backend(config: .production, session: state?.session)
                if signedIn {
                    var fresh = try await backend.myBoard(from: pick?.from, to: pick?.to, express: expressPref).board
                    if fresh == nil, pick == nil {
                        fresh = try await backend.myBoard(from: fallback.from, to: fallback.to, express: expressPref).board
                    }
                    board = fresh ?? board
                } else {
                    let p = pick ?? fallback
                    board = try await backend.board(from: p.from, to: p.to, express: expressPref)
                }
            } catch {}

            guard let b = board else {
                completion(Timeline(entries: [placeholder(in: context)], policy: .after(now.addingTimeInterval(10 * 60))))
                return
            }
            let entries = Self.entries(for: b, from: now)
            if entries.isEmpty {
                let none = LeaveTimeEntry(date: now, board: b, destinationShort: b.to.short, statusMessage: "No trains tonight")
                completion(Timeline(entries: [none], policy: .after(now.addingTimeInterval(15 * 60))))
                return
            }
            completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(10 * 60))))
        }
    }

    /// One entry a minute for the next hour, each counting down to the nearest train still
    /// catchable then (its leave-by time not yet passed), so the face shows "Leave in N min" and only
    /// says to leave now in that train's last minute.
    static func entries(for b: Board, from now: Date) -> [LeaveTimeEntry] {
        let start = Date(timeIntervalSince1970: floor(now.timeIntervalSince1970 / 60) * 60)
        var entries: [LeaveTimeEntry] = []
        for minute in 0..<60 {
            let date = minute == 0 ? now : start.addingTimeInterval(Double(minute) * 60)
            let catchable = b.trains.lazy
                .filter { $0.status != .cancelled }
                .map { ($0, leaveBy(for: $0, board: b)) }
                .first { $0.1.timeIntervalSince(date) > -30 }
            guard let (train, leaveDate) = catchable else { break }
            let walk = max(0, Int(round((train.predDep / 1000 - leaveDate.timeIntervalSince1970) / 60)))
            entries.append(LeaveTimeEntry(
                date: date,
                train: train,
                board: b,
                leaveByDate: leaveDate,
                isUrgent: leaveDate.timeIntervalSince(date) < 60,
                destinationShort: b.to.short,
                walkMinutes: walk
            ))
        }
        return entries
    }

    /// When to walk out the door for `train`: the Worker's leave_by, or departure minus the walk.
    static func leaveBy(for train: BoardTrain, board b: Board) -> Date {
        if let l = train.leaveBy { return Date(timeIntervalSince1970: l / 1000) }
        return Date(timeIntervalSince1970: train.predDep / 1000).addingTimeInterval(-Double((b.walkMinutes ?? 10) * 60))
    }
}

/// Whole minutes from `date` to `target`, rounded up (a countdown never shows 0 before it's time).
func minutesUntil(_ target: Date, from date: Date) -> Int {
    max(0, Int(ceil(target.timeIntervalSince(date) / 60)))
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
            if let train = entry.train,
               let trainDate = entry.trainDepartureDate,
               let stnDate = entry.userStationArrivalDate {
                HStack(spacing: 4) {
                    Image(systemName: "tram.fill")
                        .font(.caption2)
                        .foregroundStyle(accentEmerald)
                    Text("#\(train.train) \(train.kind)")
                        .font(.caption2.bold())
                    Spacer()
                    Text("Trn")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(trainDate, format: .dateTime.hour().minute())
                        .font(.caption2.monospacedDigit().bold())
                        .foregroundStyle(.primary)
                    if let delay = train.delayMin, delay >= 2 {
                        Text("+\(delay)m")
                            .font(.caption2.bold())
                            .foregroundStyle(.orange)
                    }
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
                        Image(systemName: entry.travelMode.symbol)
                            .font(.caption.bold())
                            .foregroundStyle(accentEmerald)
                        Text("Leave in")
                            .font(.subheadline)
                        Text("\(minutesUntil(leaveByDate, from: entry.date)) min")
                            .font(.headline.bold())
                            .monospacedDigit()
                            .foregroundStyle(accentEmerald)
                    }
                } else {
                    HStack(spacing: 4) {
                        Text("Departs in")
                            .font(.subheadline)
                        Text("\(minutesUntil(trainDate, from: entry.date)) min")
                            .font(.headline.bold())
                            .foregroundStyle(accentEmerald)
                    }
                }

                HStack(spacing: 3) {
                    Text("Stn")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(stnDate, format: .dateTime.hour().minute())
                        .font(.caption2.monospacedDigit().bold())
                        .foregroundStyle(.primary)
                    let modeDesc = entry.travelMode == .walk ? "walk" : entry.travelMode.title.lowercased()
                    Text("(\(entry.walkMinutes)m \(modeDesc))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer()
                    let buf = entry.bufferMinutes
                    Text(buf >= 0 ? "+\(buf)m buf" : "\(buf)m")
                        .font(.caption2.bold())
                        .foregroundStyle(buf < 2 ? .orange : accentEmerald)
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

    // MARK: - Circular (Infograph / Metropolitan / the small round slots)
    // Two numbers inside the circle, stacked: minutes until the train departs on top, minutes for you to
    // get to the station (walk or drive, from now) below in green, orange once the buffer is under 2
    // minutes. Tiny glyphs say which is which when there's room; otherwise they go first.
    private var circularView: some View {
        ZStack {
            AccessoryWidgetBackground()
            if entry.train != nil, let trainDate = entry.trainDepartureDate, let stnDate = entry.userStationArrivalDate {
                let late = entry.isUrgent || entry.bufferMinutes < 2
                ViewThatFits(in: .horizontal) {
                    circularTimes(train: trainDate, station: stnDate, late: late, glyphs: true)
                    circularTimes(train: trainDate, station: stnDate, late: late, glyphs: false)
                    circularTimes(train: trainDate, station: stnDate, late: late, glyphs: false, fixed: false)
                        .minimumScaleFactor(0.7)
                }
                .padding(.horizontal, 5)
            } else {
                Text("--")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(.secondary)
            }
        }
        .widgetLabel {
            if let trainDate = entry.trainDepartureDate, let stnDate = entry.userStationArrivalDate {
                Text("Trn \(trainDate, format: .dateTime.hour().minute()) · Stn \(stnDate, format: .dateTime.hour().minute())")
            }
        }
        .widgetURL(URL(string: "headway://board"))
    }

    @ViewBuilder
    private func circularTimes(train: Date, station: Date, late: Bool, glyphs: Bool, fixed: Bool = true) -> some View {
        let v = circularStack(train: train, station: station, late: late, glyphs: glyphs)
        if fixed { v.fixedSize() } else { v }
    }

    private func circularStack(train: Date, station: Date, late: Bool, glyphs: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: 1) {
                if glyphs { Image(systemName: "tram.fill").font(.system(size: 7, weight: .bold)).foregroundStyle(.secondary) }
                Text(Self.minutes(train.timeIntervalSince(entry.date)))
                    .font(.system(size: 15, weight: .bold, design: .rounded))
            }
            Rectangle().fill(.secondary.opacity(0.5)).frame(width: 16, height: 1).padding(.vertical, 1)
            HStack(spacing: 1) {
                if glyphs { Image(systemName: entry.travelMode.symbol).font(.system(size: 7, weight: .bold)).foregroundStyle(.secondary) }
                Text(Self.minutes(station.timeIntervalSince(entry.date)))
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(late ? Color.orange : accentEmerald)
            }
        }
        .monospacedDigit()
        .lineLimit(1)
    }

    /// "29" (minutes, rounded up so "1" means within the minute); "2h" from 100 minutes on.
    static func minutes(_ seconds: TimeInterval) -> String {
        let m = max(0, Int(ceil(seconds / 60)))
        return m < 100 ? "\(m)" : "\(m / 60)h"
    }

    // MARK: - Inline (Top text on Modular)
    private var inlineView: some View {
        HStack(spacing: 4) {
            if let train = entry.train,
               let trainDate = entry.trainDepartureDate,
               let stnDate = entry.userStationArrivalDate {
                ViewThatFits {
                    if entry.isUrgent {
                        Text("GO! Trn \(trainDate, format: .dateTime.hour().minute()) · Stn \(stnDate, format: .dateTime.hour().minute())")
                    } else if let leaveByDate = entry.leaveByDate {
                        Text("Trn \(trainDate, format: .dateTime.hour().minute()) · Stn \(stnDate, format: .dateTime.hour().minute()) (Leave \(minutesUntil(leaveByDate, from: entry.date))m)")
                        Text("Trn \(trainDate, format: .dateTime.hour().minute()) · Stn \(stnDate, format: .dateTime.hour().minute())")
                        Text("Leave \(minutesUntil(leaveByDate, from: entry.date))m · Trn \(trainDate, format: .dateTime.hour().minute())")
                    } else {
                        Text("Trn \(trainDate, format: .dateTime.hour().minute()) · Stn \(stnDate, format: .dateTime.hour().minute())")
                    }
                }
            } else {
                Text(entry.statusMessage ?? "Headway")
            }
        }
        .widgetURL(URL(string: "headway://board"))
    }

    // MARK: - Corner (Infograph Corners)
    private var cornerView: some View {
        Group {
            if entry.isUrgent {
                Text("GO").foregroundStyle(.orange)
            } else if let leaveByDate = entry.leaveByDate {
                Text("\(minutesUntil(leaveByDate, from: entry.date))m").foregroundStyle(accentEmerald)
            } else {
                Text("--")
            }
        }
        .font(.system(size: 18, weight: .bold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.5)
        .widgetLabel {
            if let trainDate = entry.trainDepartureDate, let stnDate = entry.userStationArrivalDate {
                Text("Trn \(trainDate, format: .dateTime.hour().minute()) · Stn \(stnDate, format: .dateTime.hour().minute())")
            } else {
                Text("Headway")
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
        .description("Live countdown showing when to leave the door for your next Caltrain, with train and station ETAs.")
        .supportedFamilies([
            .accessoryRectangular,
            .accessoryCircular,
            .accessoryInline,
            .accessoryCorner
        ])
    }
}
