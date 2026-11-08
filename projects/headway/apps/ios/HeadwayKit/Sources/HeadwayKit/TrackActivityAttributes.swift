#if os(iOS) && canImport(ActivityKit)
import ActivityKit
import Foundation

/// ActivityAttributes for tracking a Caltrain train on the Lock Screen and in Dynamic Island.
public struct TrackActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable, Sendable {
        /// Predicted arrival at destination (epoch ms).
        public var predArr: Double
        /// Minutes late (nil when on timetable/no live data).
        public var delayMin: Int?
        /// Next station name.
        public var next: String?
        /// Predicted arrival at next station (epoch ms).
        public var nextPred: Double?
        /// Stops left until destination.
        public var stopsLeft: Int
        public var cancelled: Bool
        public var arrived: Bool
        /// The app's demo-clock offset (ms; never set in production). The system draws countdowns with its own
        /// clock, so they count to `countdownArr`, the arrival moved by it; clock times still show `predArr`.
        public var clockOffsetMs: Double?

        /// What the system's countdowns ("in 12 min") count to.
        public var countdownArr: Date { Date(timeIntervalSince1970: (predArr - (clockOffsetMs ?? 0)) / 1000) }

        public init(
            predArr: Double,
            delayMin: Int? = nil,
            next: String? = nil,
            nextPred: Double? = nil,
            stopsLeft: Int,
            cancelled: Bool = false,
            arrived: Bool = false,
            clockOffsetMs: Double? = nil
        ) {
            self.predArr = predArr
            self.delayMin = delayMin
            self.next = next
            self.nextPred = nextPred
            self.stopsLeft = stopsLeft
            self.cancelled = cancelled
            self.arrived = arrived
            self.clockOffsetMs = clockOffsetMs
        }

        enum CodingKeys: String, CodingKey {
            case predArr = "pred_arr"
            case delayMin = "delay_min"
            case next
            case nextPred = "next_pred"
            case stopsLeft = "stops_left"
            case cancelled
            case arrived
            case clockOffsetMs = "clock_offset_ms"
        }
    }

    public var tripId: String
    public var train: String
    public var kind: String
    public var to: String

    public init(tripId: String, train: String, kind: String, to: String) {
        self.tripId = tripId
        self.train = train
        self.kind = kind
        self.to = to
    }

    enum CodingKeys: String, CodingKey {
        case tripId = "trip_id"
        case train
        case kind
        case to
    }
}
#endif
