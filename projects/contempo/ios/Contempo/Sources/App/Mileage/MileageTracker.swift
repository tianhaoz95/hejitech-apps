import ContempoCore
import ContempoData
import CoreLocation
import Foundation
import Observation
import UserNotifications

/// iOS equivalent of Android's `MileageTrackingService` — continuously
/// accumulates GPS driving distance for a tracked trip by summing
/// `CLLocation.distance(from:)` between fixes at least
/// `minDisplacementMeters` apart (a straight line from start to end would cut
/// every corner a real route takes and understate the true number, bad for a
/// tax record). Owns the trip Entry's full lifecycle end to end via
/// `MileageTripCoordinator`, same as Android's service does. When-in-use
/// authorization only (no "Always"), with background updates while a trip
/// runs so it keeps counting and `ArrivalDetector` can notice the host has
/// parked.
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
    private(set) var isPaused = false
    private(set) var isStationaryArrivalDetected = false

    private var lastLocation: CLLocation?
    private var accumulatedMeters = 0.0
    private var pausedAt: Date?
    private var pausedDurationSeconds: Double = 0
    /// The last fix distance was measured from; moves only once a fix is
    /// `minDisplacementMeters` away, so GPS jitter while parked adds nothing.
    private var referenceLocation: CLLocation?
    private var arrival = ArrivalDetector()
    private let arrivalNotifications = ArrivalNotifications()

    override init() {
        super.init()
        manager.desiredAccuracy = kCLLocationAccuracyBest
        // Every fix, not `distanceFilter`: with a filter iOS stops delivering fixes once the car is
        // parked, and arrival can't be noticed. Jitter is cut in `didUpdateLocations` instead.
        manager.distanceFilter = kCLDistanceFilterNone
        manager.activityType = .automotiveNavigation
        manager.pausesLocationUpdatesAutomatically = false
    }

    func start() async {
        guard !isTracking else { return }
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        }
        guard manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways else { return }
        arrivalNotifications.requestPermission()

        lastLocation = nil
        referenceLocation = nil
        accumulatedMeters = 0
        accumulatedMiles = 0
        isPaused = false
        pausedAt = nil
        pausedDurationSeconds = 0
        arrival = ArrivalDetector()
        isStationaryArrivalDetected = false
        isTracking = true
        manager.delegate = self
        // Keeps counting with the app in the background (UIBackgroundModes has `location`); the
        // system shows its location indicator meanwhile.
        manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
        manager.startUpdatingLocation()

        let startLocation = manager.location
        _ = try? await mileageTripCoordinator.handleStartTrip(
            property: nil,
            task: nil,
            category: nil,
            source: .manual,
            startedAt: Timestamp(date: Date()),
            captureMethod: "gps",
            startLat: startLocation?.coordinate.latitude,
            startLng: startLocation?.coordinate.longitude
        )
        LiveActivityController.startTrip(miles: 0)
    }

    func stop() async {
        guard isTracking else { return }
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        isTracking = false
        isStationaryArrivalDetected = false
        arrivalNotifications.withdraw()
        let finalMiles = accumulatedMiles
        let endLocation = lastLocation
        _ = try? await mileageTripCoordinator.handleEndTrip(
            endedAt: Timestamp(date: Date()),
            captureMethod: "gps",
            endLat: endLocation?.coordinate.latitude,
            endLng: endLocation?.coordinate.longitude,
            directMiles: finalMiles
        )
        await LiveActivityController.endTrip()
    }

    /// Discards the trip in progress — stops location updates and deletes
    /// the Entry instead of finalizing it (see
    /// `MileageTripCoordinator.handleCancelTrip`), for a "started by
    /// mistake" / changed-my-mind cancel.
    func cancel() async {
        guard isTracking else { return }
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
        isTracking = false
        isStationaryArrivalDetected = false
        arrivalNotifications.withdraw()
        _ = try? await mileageTripCoordinator.handleCancelTrip()
        await LiveActivityController.endTrip()
    }

    /// Pauses distance accumulation without stopping location updates — the
    /// reference point (`lastLocation`) is kept current so resuming doesn't
    /// retroactively count distance covered while paused (mirrors Android's
    /// `MileageTrackingService.locationCallback`).
    func pause() async {
        guard isTracking, !isPaused else { return }
        let now = Date()
        isPaused = true
        pausedAt = now
        _ = try? await mileageTripCoordinator.handlePauseTrip(pausedAt: Timestamp(date: now))
        LiveActivityController.pauseTrip()
    }

    func resume() async {
        guard isTracking, isPaused, let pausedAt else { return }
        pausedDurationSeconds += Date().timeIntervalSince(pausedAt)
        isPaused = false
        self.pausedAt = nil
        _ = try? await mileageTripCoordinator.handleResumeTrip(resumedAt: Timestamp(date: Date()))
        LiveActivityController.resumeTrip()
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor [weak self] in
            guard let self, self.isTracking else { return }
            if self.isPaused {
                self.lastLocation = location
                self.referenceLocation = location
                return
            }
            if let reference = self.referenceLocation {
                let step = reference.distance(from: location)
                guard step >= Self.minDisplacementMeters else {
                    self.checkArrival(location)
                    return
                }
                self.accumulatedMeters += step
            }
            self.referenceLocation = location
            self.lastLocation = location
            let miles = (self.accumulatedMeters / Self.metersPerMile * 100).rounded() / 100
            self.accumulatedMiles = miles
            try? await self.mileageTripCoordinator.updateTripDistance(miles: miles)
            await LiveActivityController.updateTrip(miles: miles)
            self.checkArrival(location)
        }
    }

    private func checkArrival(_ location: CLLocation) {
        switch arrival.observe(speed: location.speed, at: location.timestamp) {
        case .arrived:
            isStationaryArrivalDetected = true
            arrivalNotifications.post(miles: accumulatedMiles)
        case .moving:
            isStationaryArrivalDetected = false
        case .none:
            break
        }
    }
}
