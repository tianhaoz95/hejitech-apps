import Foundation
import UserNotifications

/// Notices that a tracked trip has parked: speed under `stoppedSpeed` for `dwell` seconds of the
/// fixes' own time (not the wall clock, so late or batched fixes count as when they were taken).
/// Fires once per stop; moving faster than `movingSpeed` re-arms it.
struct ArrivalDetector {
    static let stoppedSpeed = 1.0 // m/s, about 2 mph
    static let movingSpeed = 2.0 // m/s; between the two keeps the current state (stop-and-go)
    static let dwell: TimeInterval = 300

    enum Change: Equatable { case arrived, moving }

    private var stoppedSince: Date?
    private var fired = false

    /// `speed` is `CLLocation.speed` (negative when unknown, which is ignored).
    mutating func observe(speed: Double, at time: Date) -> Change? {
        guard speed >= 0 else { return nil }
        if speed < Self.stoppedSpeed {
            guard let since = stoppedSince else {
                stoppedSince = time
                return nil
            }
            if !fired, time.timeIntervalSince(since) >= Self.dwell {
                fired = true
                return .arrived
            }
            return nil
        }
        if speed > Self.movingSpeed {
            stoppedSince = nil
            if fired {
                fired = false
                return .moving
            }
        }
        return nil
    }
}

/// The "Arrived at Destination?" local notification, shown in the foreground too.
@MainActor
final class ArrivalNotifications: NSObject, UNUserNotificationCenterDelegate {
    static let identifier = "contempo-mileage-arrival"

    func requestPermission() {
        let center = UNUserNotificationCenter.current()
        if center.delegate == nil { center.delegate = self }
        center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    func post(miles: Double) {
        let content = UNMutableNotificationContent()
        content.title = "Arrived at your destination?"
        content.body = "You've been stopped for 5 minutes. Open Contempo to finish and save your \(String(format: "%.1f", miles))-mile trip."
        content.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: Self.identifier, content: content, trigger: nil))
    }

    func withdraw() {
        let center = UNUserNotificationCenter.current()
        center.removeDeliveredNotifications(withIdentifiers: [Self.identifier])
        center.removePendingNotificationRequests(withIdentifiers: [Self.identifier])
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                            withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}
