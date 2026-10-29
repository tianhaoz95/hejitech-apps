import HealthKit
import SwiftUI
import WatchConnectivity
import WatchKit
import WidgetKit

/// FitLoop on Apple Watch: during a workout opened on the iPhone it runs the HealthKit workout session
/// (heart rate for the phone and the glasses, the workout saved to Apple Health), shows the current
/// exercise and set with the rest timer, and marks sets done from the wrist.
@main
struct FitLoopWatchApp: App {
    @WKApplicationDelegateAdaptor(WatchDelegate.self) private var delegate

    var body: some Scene {
        WindowGroup { WatchHome().environment(delegate.workout) }
    }
}

final class WatchDelegate: NSObject, WKApplicationDelegate {
    let workout = WorkoutManager()

    func applicationDidFinishLaunching() { workout.activate() }

    /// The iPhone's startWatchApp(with:) lands here: start measuring.
    func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
        Task { @MainActor in workout.start(workoutConfiguration) }
    }
}

@MainActor @Observable
final class WorkoutManager: NSObject {
    var title = ""
    var exercise = ""
    var setLine = ""
    var progress = ""
    var restUntil: Date?
    var heartRate: Int?
    var running = false
    /// Today's progress from the phone (also what the watch face complication shows).
    var day: DayProgress? = DayProgressStore.load()
    /// The phone has a workout open.
    var hasWorkout: Bool { !title.isEmpty }

    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var lastSent = Date.distantPast

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    func start(_ config: HKWorkoutConfiguration = { let c = HKWorkoutConfiguration(); c.activityType = .traditionalStrengthTraining; c.locationType = .indoor; return c }()) {
        guard session == nil else { return }
        Task {
            let share: Set<HKSampleType> = [HKObjectType.workoutType()]
            let read: Set<HKObjectType> = [HKQuantityType(.heartRate), HKQuantityType(.activeEnergyBurned)]
            try? await store.requestAuthorization(toShare: share, read: read)
            do {
                let s = try HKWorkoutSession(healthStore: store, configuration: config)
                let b = s.associatedWorkoutBuilder()
                b.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: config)
                b.delegate = self
                session = s
                builder = b
                s.startActivity(with: Date())
                try await b.beginCollection(at: Date())
                running = true
            } catch {
                running = false
            }
        }
    }

    func end() {
        guard let s = session, let b = builder else { return }
        s.end()
        Task {
            try? await b.endCollection(at: Date())
            _ = try? await b.finishWorkout()
        }
        session = nil
        builder = nil
        running = false
        heartRate = nil
        send([WatchMessage.kind: WatchMessage.kindEnded])
    }

    func setDone() {
        WKInterfaceDevice.current().play(.success)
        send([WatchMessage.kind: WatchMessage.kindSetDone])
    }

    fileprivate func received(_ hr: Double) {
        let bpm = Int(hr.rounded())
        heartRate = bpm
        guard Date().timeIntervalSince(lastSent) >= 4 else { return }
        lastSent = Date()
        send([WatchMessage.kind: WatchMessage.kindHeartRate, WatchMessage.hr: bpm])
    }

    fileprivate func apply(_ context: [String: Any]) {
        let ref = context[WatchMessage.workoutRef] as? String ?? ""
        if ref.isEmpty {
            title = ""
            if running { end() }
            return
        }
        title = context[WatchMessage.workoutTitle] as? String ?? ""
        exercise = context[WatchMessage.exerciseName] as? String ?? ""
        setLine = context[WatchMessage.setLine] as? String ?? ""
        progress = context[WatchMessage.progress] as? String ?? ""
        let rest = context[WatchMessage.restUntil] as? Double ?? 0
        let until = rest > 0 ? Date(timeIntervalSince1970: rest) : nil
        if until != restUntil, until != nil { scheduleRestEndHaptic(until!) }
        restUntil = until
        if !running { start() }
    }

    fileprivate func received(progress data: Data) {
        guard let p = try? JSONDecoder().decode(DayProgress.self, from: data) else { return }
        day = p
        DayProgressStore.save(p)
        WidgetCenter.shared.reloadAllTimelines()
    }

    private func scheduleRestEndHaptic(_ until: Date) {
        let delay = until.timeIntervalSinceNow
        guard delay > 0 else { return }
        Task {
            try? await Task.sleep(for: .seconds(delay))
            if restUntil == until { WKInterfaceDevice.current().play(.start) }
        }
    }

    private func send(_ message: [String: Any]) {
        guard WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(message, replyHandler: nil)
    }
}

extension WorkoutManager: WCSessionDelegate {
    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        let ctx = session.receivedApplicationContext
        Task { @MainActor in self.apply(ctx) }
    }
    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in self.apply(applicationContext) }
    }
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        Task { @MainActor in self.apply(message) }
    }
    nonisolated func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        guard let data = userInfo[DayProgress.userInfoKey] as? Data else { return }
        Task { @MainActor in self.received(progress: data) }
    }
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
    nonisolated func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let type = HKQuantityType(.heartRate)
        guard collectedTypes.contains(type), let q = workoutBuilder.statistics(for: type)?.mostRecentQuantity() else { return }
        let bpm = q.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
        Task { @MainActor in self.received(bpm) }
    }
}

struct WatchHome: View {
    @Environment(WorkoutManager.self) private var w

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    if w.hasWorkout {
                        Text(w.title).font(.caption).foregroundStyle(.secondary)
                        Text(w.exercise).font(.headline).lineLimit(2)
                        Text(w.setLine).font(.footnote)
                        if let until = w.restUntil, until > ctx.date {
                            let left = Int(until.timeIntervalSince(ctx.date).rounded(.up))
                            Text("Rest \(left / 60):\(String(format: "%02d", left % 60))").font(.title2.monospacedDigit()).foregroundStyle(.orange)
                        }
                        HStack {
                            if let hr = w.heartRate { Label("\(hr)", systemImage: "heart.fill").foregroundStyle(.red).font(.title3.monospacedDigit()) }
                            Spacer()
                            Text(w.progress).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                        }
                        Button("Set done") { w.setDone() }.tint(.orange)
                        Button("End", role: .destructive) { w.end() }.font(.footnote)
                    } else {
                        Text("FitLoop").font(.headline)
                        if let day = w.day, day.isToday {
                            DayProgressSummary(day: day)
                        }
                        Text("Open a workout on your iPhone; it shows up here with your heart rate.").font(.footnote).foregroundStyle(.secondary)
                        if w.running, let hr = w.heartRate { Label("\(hr)", systemImage: "heart.fill").foregroundStyle(.red) }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

/// Today at a glance on the watch's home screen: the ring and what's done.
struct DayProgressSummary: View {
    let day: DayProgress

    var body: some View {
        HStack(spacing: 10) {
            Gauge(value: day.completion) {
                EmptyView()
            } currentValueLabel: {
                Text("\(Int((day.completion * 100).rounded()))%").font(.caption2.monospacedDigit())
            }
            .gaugeStyle(.accessoryCircularCapacity)
            .tint(.orange)
            VStack(alignment: .leading, spacing: 2) {
                if day.workoutsTotal > 0 { Text("Workouts \(day.workoutsDone)/\(day.workoutsTotal)").font(.footnote) }
                if day.mealsTotal > 0 { Text("Meals \(day.mealsDone)/\(day.mealsTotal)").font(.footnote) }
                if let next = day.next { Text("Next: \(next)").font(.caption2).foregroundStyle(.secondary).lineLimit(1) }
            }
        }
    }
}
