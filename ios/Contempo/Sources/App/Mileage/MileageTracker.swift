import ContempoCore
import ContempoFirestore
import CoreLocation
import FirebaseFirestore
import Foundation
import Observation

/// iOS equivalent of Android's `MileageTrackingService` — continuously
/// accumulates GPS driving distance for a tracked trip by summing
/// `CLLocation.distance(from:)` between consecutive fixes (a straight line
/// from start to end would cut every corner a real route takes and
/// understate the true number, bad for a tax record). Owns the trip Entry's
/// full lifecycle end to end via `MileageTripCoordinator`, same as Android's
/// service does. Foreground-only — no "Always" location authorization
/// requested, matching this MVP's out-of-scope background-signal stance
/// (see CLAUDE.md's MVP-scope notes on geofencing/bank signals).
@Observable
@MainActor
final class MileageTracker: NSObject, CLLocationManagerDelegate {
    /// Roughly matches Android's `MIN_DISPLACEMENT_METERS` — cuts GPS jitter
    /// noise without a dedicated smoothing pass.
    private static let minDisplacementMeters: CLLocationDistance = 15
    private static let metersPerMile = 1609.344

    private let manager = CLLocationManager()
    private let mileageTripCoordinator = ServiceLocator.mileageTripCoordinator

    private(set) var isTracking = false
    private(set) var accumulatedMiles: Double = 0

    private var lastLocation: CLLocation?
    private var accumulatedMeters = 0.0

    override init() {
        super.init()
        manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = Self.minDisplacementMeters
    }

    func start() async {
        guard !isTracking else { return }
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
        guard manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways else { return }

        lastLocation = nil
        accumulatedMeters = 0
        accumulatedMiles = 0
        isTracking = true
        manager.delegate = self
        manager.startUpdatingLocation()

        _ = try? await mileageTripCoordinator.handleStartTrip(
            property: nil,
            task: nil,
            category: nil,
            source: .manual,
            startedAt: Timestamp(date: Date()),
            captureMethod: "gps"
        )
        LiveActivityController.startTrip(miles: 0)
    }

    func stop() async {
        guard isTracking else { return }
        manager.stopUpdatingLocation()
        isTracking = false
        let finalMiles = accumulatedMiles
        _ = try? await mileageTripCoordinator.handleEndTrip(endedAt: Timestamp(date: Date()), captureMethod: "gps", directMiles: finalMiles)
        await LiveActivityController.endTrip()
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor [weak self] in
            guard let self, self.isTracking else { return }
            if let previous = self.lastLocation {
                self.accumulatedMeters += previous.distance(from: location)
            }
            self.lastLocation = location
            let miles = (self.accumulatedMeters / Self.metersPerMile * 100).rounded() / 100
            self.accumulatedMiles = miles
            try? await self.mileageTripCoordinator.updateTripDistance(miles: miles)
            await LiveActivityController.updateTrip(miles: miles)
        }
    }
}
