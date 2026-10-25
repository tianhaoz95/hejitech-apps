import FitLoopKit
import Foundation
import HealthKit
import WatchConnectivity

/// The daily Apple Health summary (when that option is on): weight, resting heart rate, HRV, sleep,
/// steps and active energy per day, sent as `health` vitals. Read-only; asks once.
final class HealthSync: @unchecked Sendable {
    private let store = HKHealthStore()
    var available: Bool { HKHealthStore.isHealthDataAvailable() }

    private var readTypes: Set<HKObjectType> {
        var s: Set<HKObjectType> = [HKCategoryType(.sleepAnalysis), HKObjectType.workoutType()]
        for id in [HKQuantityTypeIdentifier.bodyMass, .restingHeartRate, .heartRateVariabilitySDNN, .stepCount, .activeEnergyBurned, .heartRate] {
            s.insert(HKQuantityType(id))
        }
        return s
    }

    func requestAccess() async -> Bool {
        guard available else { return false }
        do {
            try await store.requestAuthorization(toShare: [], read: readTypes)
            return true
        } catch { return false }
    }

    /// One value per metric and day for the last `days` days (local calendar).
    func dailySummary(days: Int) async -> [Vital] {
        guard await requestAccess() else { return [] }
        let cal = Calendar.current
        let end = Date()
        let start = cal.startOfDay(for: cal.date(byAdding: .day, value: -(days - 1), to: end)!)
        var out: [Vital] = []
        let specs: [(HKQuantityTypeIdentifier, String, HKUnit, HKStatisticsOptions)] = [
            (.bodyMass, "weight", .gramUnit(with: .kilo), .discreteAverage),
            (.restingHeartRate, "resting_hr", HKUnit.count().unitDivided(by: .minute()), .discreteAverage),
            (.heartRateVariabilitySDNN, "hrv", .secondUnit(with: .milli), .discreteAverage),
            (.stepCount, "steps", .count(), .cumulativeSum),
            (.activeEnergyBurned, "active_energy", .kilocalorie(), .cumulativeSum),
        ]
        for (id, metric, unit, option) in specs {
            for (day, value) in await daily(HKQuantityType(id), unit: unit, option: option, start: start, end: end) {
                out.append(Vital(date: Day.string(day), metric: metric, value: (value * 10).rounded() / 10, source: "health"))
            }
        }
        for (day, hours) in await sleepHours(start: start, end: end) {
            out.append(Vital(date: Day.string(day), metric: "sleep_hours", value: (hours * 10).rounded() / 10, source: "health"))
        }
        return out
    }

    private func daily(_ type: HKQuantityType, unit: HKUnit, option: HKStatisticsOptions, start: Date, end: Date) async -> [(Date, Double)] {
        await withCheckedContinuation { cont in
            let q = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: HKQuery.predicateForSamples(withStart: start, end: end),
                                                options: option, anchorDate: start, intervalComponents: DateComponents(day: 1))
            q.initialResultsHandler = { _, results, _ in
                var out: [(Date, Double)] = []
                results?.enumerateStatistics(from: start, to: end) { s, _ in
                    let q = option == .cumulativeSum ? s.sumQuantity() : s.averageQuantity()
                    if let v = q?.doubleValue(for: unit), v > 0 { out.append((s.startDate, v)) }
                }
                cont.resume(returning: out)
            }
            store.execute(q)
        }
    }

    /// Hours asleep per night, credited to the day the night ends.
    private func sleepHours(start: Date, end: Date) async -> [(Date, Double)] {
        await withCheckedContinuation { cont in
            let q = HKSampleQuery(sampleType: HKCategoryType(.sleepAnalysis), predicate: HKQuery.predicateForSamples(withStart: start, end: end), limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                var byDay: [Date: Double] = [:]
                let asleep: Set<Int> = [HKCategoryValueSleepAnalysis.asleepCore.rawValue, HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                                        HKCategoryValueSleepAnalysis.asleepREM.rawValue, HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue]
                for s in (samples as? [HKCategorySample]) ?? [] where asleep.contains(s.value) {
                    let day = Calendar.current.startOfDay(for: s.endDate)
                    byDay[day, default: 0] += s.endDate.timeIntervalSince(s.startDate) / 3600
                }
                cont.resume(returning: byDay.map { ($0.key, $0.value) })
            }
            store.execute(q)
        }
    }
}

/// The iPhone's side of WatchConnectivity: tells the Watch which workout is open (it runs the
/// workout session that measures heart rate) and hears back heart rate, "set done" and the end.
final class WatchLink: NSObject, WCSessionDelegate, @unchecked Sendable {
    var onHeartRate: ((Int) -> Void)?
    var onSetDone: (() -> Void)?
    var onEnded: (() -> Void)?
    private let store = HKHealthStore()

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    var available: Bool { WCSession.isSupported() && WCSession.default.isPaired && WCSession.default.isWatchAppInstalled }

    /// Launches the Watch app into a workout (it starts the HKWorkoutSession that measures heart rate).
    func startOnWatch() {
        guard available else { return }
        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining
        config.locationType = .indoor
        store.startWatchApp(with: config) { _, _ in }
    }

    func send(context: [String: Any]) {
        guard WCSession.isSupported(), WCSession.default.activationState == .activated else { return }
        try? WCSession.default.updateApplicationContext(context)
        if WCSession.default.isReachable { WCSession.default.sendMessage(context, replyHandler: nil) }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        switch message[WatchMessage.kind] as? String {
        case WatchMessage.kindHeartRate: if let hr = message[WatchMessage.hr] as? Int { onHeartRate?(hr) }
        case WatchMessage.kindSetDone: onSetDone?()
        case WatchMessage.kindEnded: onEnded?()
        default: break
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
}
