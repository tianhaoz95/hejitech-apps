import Foundation

/// What Siri says for Headway's App Shortcuts on iPhone and the watch: short sentences built from the
/// same board and tracked train the app shows. Pure, so it's tested here once for both.
public enum SiriSpeech {
    /// The trains worth mentioning: not cancelled, not gone, and (when the board knows) still catchable.
    public static func upcoming(_ board: Board, now: Double) -> [BoardTrain] {
        let ahead = board.trains.filter { $0.status != .cancelled && $0.predDep >= now - 60_000 }
        let catchable = ahead.filter { $0.catchState != "missed" }
        return catchable.isEmpty ? ahead : catchable
    }

    /// "The next train from Mountain View to San Francisco is the 8:52 Local, 7 minutes late, arriving
    /// at 9:53. Leave by 8:42. After that, the 9:15 Express."
    public static func nextTrains(_ board: Board, now: Double) -> String {
        let trains = upcoming(board, now: now)
        guard let t = trains.first else {
            return "No more trains from \(board.from.name) to \(board.to.name) today."
        }
        var s = "The next train from \(board.from.name) to \(board.to.name) is the \(Clock.time(t.predDep)) \(t.kindName)"
        if let d = t.delayMin, t.status == .late, d > 0 { s += ", \(d) minute\(d == 1 ? "" : "s") late" }
        s += ", arriving at \(Clock.time(t.predArr))."
        switch t.catchState {
        case "run": s += " You'll need to hurry."
        case "leave": s += " Leave now."
        default:
            if let leave = t.leaveBy, leave > now { s += " Leave by \(Clock.time(leave))." }
        }
        if trains.count > 1 { s += " After that, the \(Clock.time(trains[1].predDep)) \(trains[1].kindName)." }
        if let w = board.weather, let to = w.to, to.cond.isWet, to.pop >= 40 {
            s += " \(to.words) is likely in \(board.to.name)."
        }
        if !board.alerts.isEmpty { s += " Caltrain has \(board.alerts.count == 1 ? "a service alert" : "\(board.alerts.count) service alerts") for this trip." }
        if !board.live { s += " These are timetable times." }
        return s
    }

    /// Where the tracked train is: "Train 609 is heading to Palo Alto, arriving at San Francisco at 9:53,
    /// 3 minutes late, with 6 stops to go."
    public static func tracked(_ t: TrackedWithProgress, fromName: String?) -> String {
        let p = t.progress
        let train = "Train \(p.train)"
        if p.cancelled { return "\(train) to \(p.to.name) is cancelled." }
        if p.arrived { return "\(train) has arrived at \(p.to.name)." }
        let late = p.delayMin.flatMap { $0 > 0 ? ", \($0) minute\($0 == 1 ? "" : "s") late" : nil } ?? ""
        if p.riding {
            let next = p.next.map { " is heading to \($0.name)," } ?? " is on its way,"
            let stops = p.stopsLeft == 1 ? "with 1 stop to go" : p.stopsLeft == 0 ? "and your stop is next" : "with \(p.stopsLeft) stops to go"
            return "\(train)\(next) arriving at \(p.to.name) at \(Clock.time(p.predArr))\(late), \(stops)."
        }
        let from = fromName.map { " \($0)" } ?? " your station"
        return "\(train) hasn't left\(from) yet. It gets to \(p.to.name) at \(Clock.time(p.predArr))\(late)."
    }

    /// After tracking: "Tracking the 8:52 to San Francisco. It arrives at 9:53, and I'll alert you before your stop."
    public static func startedTracking(_ train: BoardTrain, to: String) -> String {
        "Tracking the \(Clock.time(train.predDep)) to \(to). It arrives at \(Clock.time(train.predArr)), and Headway will alert you before your stop."
    }
}
