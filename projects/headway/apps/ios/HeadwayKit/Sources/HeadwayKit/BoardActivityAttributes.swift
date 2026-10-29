#if os(iOS) && canImport(ActivityKit)
import ActivityKit
import Foundation

/// ActivityAttributes for the "next trains" Live Activity: a board pinned to the Lock Screen and the
/// Dynamic Island. The content state mirrors core's `BoardActivityState`, which the cron pushes.
public struct BoardActivityAttributes: ActivityAttributes {
    public struct Train: Codable, Hashable, Sendable {
        public var train: String
        public var kind: String
        /// Predicted departure and arrival (epoch ms).
        public var dep: Double
        public var arr: Double
        public var delayMin: Int?
        public var cancelled: Bool

        public init(train: String, kind: String, dep: Double, arr: Double, delayMin: Int? = nil, cancelled: Bool = false) {
            self.train = train
            self.kind = kind
            self.dep = dep
            self.arr = arr
            self.delayMin = delayMin
            self.cancelled = cancelled
        }

        public var depDate: Date { Date(timeIntervalSince1970: dep / 1000) }
        public var arrDate: Date { Date(timeIntervalSince1970: arr / 1000) }

        enum CodingKeys: String, CodingKey {
            case train, kind, dep, arr, cancelled
            case delayMin = "delay_min"
        }
    }

    public struct ContentState: Codable, Hashable, Sendable {
        public var trains: [Train]
        public var live: Bool

        public init(trains: [Train], live: Bool) {
            self.trains = trains
            self.live = live
        }

        /// The next `max` trains still to leave on `board` (what core's `boardActivityState` sends).
        public init(board: Board, now: Date = Date(), max: Int = 3) {
            let nowMs = now.timeIntervalSince1970 * 1000
            trains = board.trains.filter { $0.predDep > nowMs }.prefix(max).map {
                Train(train: $0.train, kind: $0.kind, dep: $0.predDep, arr: $0.predArr, delayMin: $0.delayMin, cancelled: $0.status == .cancelled)
            }
            live = board.live
        }
    }

    public var fromId: String
    public var toId: String
    public var fromShort: String
    public var toShort: String

    public init(fromId: String, toId: String, fromShort: String, toShort: String) {
        self.fromId = fromId
        self.toId = toId
        self.fromShort = fromShort
        self.toShort = toShort
    }

    /// The `trip_id` its push token is registered under, so the cron knows which board to push.
    public var tokenKey: String { "board:\(fromId)>\(toId)" }

    enum CodingKeys: String, CodingKey {
        case fromId = "from_id"
        case toId = "to_id"
        case fromShort = "from_short"
        case toShort = "to_short"
    }
}
#endif
