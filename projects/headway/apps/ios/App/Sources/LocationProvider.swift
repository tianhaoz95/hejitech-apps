import CoreLocation

/// The rider's rough location (100 m), asked once per board refresh at most every two minutes, for
/// the Worker's trip estimate to the station. Only used while the app is open; never stored.
@MainActor
final class LocationProvider: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var waiting: [CheckedContinuation<CLLocation?, Never>] = []
    private var authWaiting: [CheckedContinuation<Void, Never>] = []
    private var last: CLLocation?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    var authorized: Bool {
        manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways
    }

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
        Task { @MainActor in self.finish(l) }
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
