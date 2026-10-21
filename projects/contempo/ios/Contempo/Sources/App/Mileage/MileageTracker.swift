import ContempoCore
import ContempoData
import CoreLocation
import Foundation
import Observation
import UserNotifications

/// iOS equivalent of Android's `MileageTrackingService` — continuously
/// accumulates GPS driving distance for a tracked trip by summing
/// `CLLocation.distance(from:)` between consecutive fixes. Includes
/// stationary arrival detection and local alerts to prevent runaway GPS trips.
@Observable
@MainActor
final class MileageTracker: NSObject, CLLocationManagerDelegate {
    /// Roughly matches Android's `MIN_DISPLACEMENT_METERS` — cuts GPS jitter
    /// noise without a dedicated smoothing pass.
    private static let minDisplacementMeters: CLLocationDistance = 15
    private static let metersPerMile = 1609.344
    /// After 5 minutes of stationary speed (< 1 m/s), prompt the host to finalize the trip.
    private static let stationaryAlertThresholdSeconds: TimeInterval = 300

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
    private var stationaryStartedAt: Date?
    private var hasAlertedForArrival = false

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
        isPaused = false
        pausedAt = nil
        pausedDurationSeconds = 0
        stationaryStartedAt = nil
        hasAlertedForArrival = false
        isStationaryArrivalDetected = false
        isTracking = true
        manager.delegate = self
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
        isTracking = false
        isStationaryArrivalDetected = false
        stationaryStartedAt = nil
        hasAlertedForArrival = false
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
        isTracking = false
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
                return
            }
            if let previous = self.lastLocation {
                self.accumulatedMeters += previous.distance(from: location)
            }
            self.lastLocation = location
            let miles = (self.accumulatedMeters / Self.metersPerMile * 100).rounded() / 100
            self.accumulatedMiles = miles
            try? await self.mileageTripCoordinator.updateTripDistance(miles: miles)
            await LiveActivityController.updateTrip(miles: miles)

            // Stationary arrival detection: speed < 1.0 m/s (~2.2 mph)
            if location.speed >= 0 && location.speed < 1.0 {
                if let started = self.stationaryStartedAt {
                    let duration = Date().timeIntervalSince(started)
                    if duration >= Self.stationaryAlertThresholdSeconds && !self.hasAlertedForArrival {
                        self.isStationaryArrivalDetected = true
                        self.hasAlertedForArrival = true
                        self.sendArrivalAlert(miles: miles)
                    }
                } else {
                    self.stationaryStartedAt = Date()
                }
            } else if location.speed > 2.0 {
                // Moving again — reset stationary timer
                self.stationaryStartedAt = nil
                self.isStationaryArrivalDetected = false
                self.hasAlertedForArrival = false
            }
        }
    }

    private func sendArrivalAlert(miles: Double) {
        let content = UNMutableNotificationContent()
        content.title = "Arrived at Destination?"
        content.body = "You've been stopped for 5 minutes. Tap to finalize and save your \(String(format: "%.1f", miles))-mile trip."
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "contempo-mileage-arrival",
            content: content,
            trigger: nil // deliver immediately
        )
        UNUserNotificationCenter.current().add(request)
    }
}
