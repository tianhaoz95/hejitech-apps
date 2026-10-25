import Foundation

/// What the iPhone and the Watch say to each other over WatchConnectivity (compiled into both).
///
///   phone → watch  application context: the open workout (or none) and where it is
///   watch → phone  message: heart rate samples, "set done", "workout ended"
enum WatchMessage {
    // Application context keys (phone → watch).
    static let workoutRef = "workoutRef"
    static let workoutTitle = "workoutTitle"
    static let exerciseName = "exerciseName"
    static let setLine = "setLine"
    static let restUntil = "restUntil"
    static let progress = "progress"

    // Message keys (watch → phone).
    static let kind = "kind"
    static let hr = "hr"
    static let kindHeartRate = "hr"
    static let kindSetDone = "setDone"
    static let kindEnded = "ended"
}
