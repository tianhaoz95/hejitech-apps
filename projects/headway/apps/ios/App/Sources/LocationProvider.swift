import CoreLocation
import HeadwayKit
import UIKit

/// The rider's rough location (100 m), asked once per board refresh at most every two minutes, for
/// the Worker's trip estimate to the station, and the recent fixes that tell if you're on a train.
/// Those run while the app is open, and with the app closed only if you chose that (Always location).
/// Nothing is stored beyond these few minutes, in memory.
@MainActor
final class LocationProvider: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var waiting: [CheckedContinuation<CLLocation?, Never>] = []
    private var authWaiting: [CheckedContinuation<Void, Never>] = []
    private var last: CLLocation?
    /// The last few fixes (up to 15 minutes), for telling if you're on a train.
    private(set) var samples: [OnTrainSample] = []
    private var sampling = false
    private var burstEnds: Date?
    /// With the app in the background, once a short burst of fixes has been gathered.
    var onBackgroundFixes: (@MainActor ([OnTrainSample]) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    var authorized: Bool {
        manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways
    }

    var authorizedAlways: Bool { manager.authorizationStatus == .authorizedAlways }

    var denied: Bool { manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted }

    /// Asks for When In Use access if it hasn't been asked yet; returns once the user has answered.
    func requestAccess() async -> Bool {
        if manager.authorizationStatus == .notDetermined {
            await withCheckedContinuation { c in
                authWaiting.append(c)
                manager.requestWhenInUseAuthorization()
            }
        }
        return authorized
    }

    /// Asks for Always access, after When In Use (iOS asks these in that order); returns once answered.
    func requestAlways() async -> Bool {
        guard await requestAccess() else { return false }
        if manager.authorizationStatus == .authorizedWhenInUse {
            // iOS only answers if it shows the prompt, so don't wait forever.
            await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in
                authWaiting.append(c)
                manager.requestAlwaysAuthorization()
                Task {
                    try? await Task.sleep(for: .seconds(30))
                    let w = self.authWaiting
                    self.authWaiting = []
                    for c in w { c.resume() }
                }
            }
        }
        return authorizedAlways
    }

    /// Follows the phone closely while the app is open, to tell if you're on a train.
    func startSampling() {
        guard authorized, !sampling else { return }
        sampling = true
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = 30
        manager.startUpdatingLocation()
    }

    func stopSampling() {
        guard sampling else { return }
        sampling = false
        manager.stopUpdatingLocation()
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        manager.distanceFilter = kCLDistanceFilterNone
    }

    /// With the app closed: wake on significant moves (a few hundred metres, low battery), never continuously.
    func setBackgroundWatching(_ on: Bool) {
        if on, authorizedAlways {
            manager.allowsBackgroundLocationUpdates = true
            manager.showsBackgroundLocationIndicator = true
            manager.pausesLocationUpdatesAutomatically = false
            manager.startMonitoringSignificantLocationChanges()
        } else {
            manager.stopMonitoringSignificantLocationChanges()
            manager.allowsBackgroundLocationUpdates = false
        }
    }

    /// A woken phone looks closely for a minute: speed needs a few fixes in a row.
    private func beginBackgroundBurst() {
        guard burstEnds == nil else { return }
        burstEnds = Date().addingTimeInterval(45)
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = 30
        manager.startUpdatingLocation()
        Task {
            try? await Task.sleep(for: .seconds(45))
            self.endBackgroundBurst()
        }
    }

    private func endBackgroundBurst() {
        guard burstEnds != nil else { return }
        burstEnds = nil
        if !sampling {
            manager.stopUpdatingLocation()
            manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
            manager.distanceFilter = kCLDistanceFilterNone
        }
        onBackgroundFixes?(samples)
    }

    private func remember(_ locations: [CLLocation]) {
        let cutoff = Date().addingTimeInterval(-15 * 60).timeIntervalSince1970 * 1000
        samples += locations.filter { $0.horizontalAccuracy >= 0 && $0.horizontalAccuracy <= 200 }.map {
            OnTrainSample(lat: $0.coordinate.latitude, lon: $0.coordinate.longitude, at: $0.timestamp.timeIntervalSince1970 * 1000, speed: $0.speed >= 0 ? $0.speed : nil)
        }
        samples = Array(samples.filter { $0.at >= cutoff }.suffix(20))
    }

    /// A location at most two minutes old, or nil (no access, or none within a few seconds).
    func current() async -> CLLocation? {
        guard authorized else { return nil }
        if let last, -last.timestamp.timeIntervalSinceNow < 120 { return last }
        return await withCheckedContinuation { c in
            waiting.append(c)
            if waiting.count == 1 { manager.requestLocation() }
            Task {
                try? await Task.sleep(for: .seconds(6))
                self.finish(nil)
            }
        }
    }

    private func finish(_ location: CLLocation?) {
        if let location { last = location }
        let w = waiting
        waiting = []
        for c in w { c.resume(returning: location ?? last) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let l = locations.last
        Task { @MainActor in
            self.remember(locations)
            self.finish(l)
            if UIApplication.shared.applicationState != .active, !self.sampling { self.beginBackgroundBurst() }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.finish(nil) }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            guard manager.authorizationStatus != .notDetermined else { return }
            let w = self.authWaiting
            self.authWaiting = []
            for c in w { c.resume() }
        }
    }
}
