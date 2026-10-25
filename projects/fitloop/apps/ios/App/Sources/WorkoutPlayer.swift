import FitLoopKit
import SwiftUI

/// The workout player: one exercise at a time with its set target, how-to and cues; "Set done"
/// checks the set in and starts the rest timer; timed sets run a work timer. The Watch (when paired)
/// runs the workout session for heart rate and can mark sets done too.
struct WorkoutPlayer: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let initial: WorkoutState
    @State private var ex = 0
    @State private var set = 1
    @State private var restUntil: Date?
    @State private var workStarted: Date?
    @State private var note: NoteTarget?
    @State private var confirmEnd = false

    /// The latest state of this workout (check-ins refresh model.today).
    private var state: WorkoutState { model.today?.state.workouts.first { $0.ref == initial.ref } ?? initial }
    private var current: ExerciseState { state.exercises[min(ex, state.exercises.count - 1)] }

    var body: some View {
        NavigationStack {
            TimelineView(.periodic(from: .now, by: 1)) { ctx in
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        header
                        exerciseCard(now: ctx.date)
                        if let cues = current.exercise.cues, !cues.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                ForEach(cues, id: \.self) { Label($0, systemImage: "checkmark").font(.callout) }
                            }
                        }
                        if let how = current.exercise.instructions { DisclosureGroup("How to") { Text(how).font(.callout) } }
                        if let alt = current.exercise.alternative { Label("Instead: \(alt)", systemImage: "arrow.triangle.swap").font(.footnote).foregroundStyle(.secondary) }
                        upNext
                    }
                    .padding()
                }
            }
            .navigationTitle(state.workout.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { close() } }
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("Skip this exercise", systemImage: "forward") { skipExercise() }
                        Button("Note for my agent", systemImage: "bubble.left") { note = NoteTarget(ref: current.ref, title: current.exercise.name, tags: [.tooHard, .tooEasy, .pain, .lovedIt, .other]) }
                        Button("End workout", systemImage: "flag.checkered") { confirmEnd = true }
                    } label: { Label("More", systemImage: "ellipsis.circle") }
                }
            }
            .sheet(item: $note) { NoteSheet(target: $0) }
            .confirmationDialog("End the workout?", isPresented: $confirmEnd, titleVisibility: .visible) {
                Button("End and save") { Task { await finish(state.setsDone >= state.setsTotal ? "done" : "partial") } }
            }
            .onAppear {
                if let n = state.next { ex = n.exercise; set = n.set }
                model.beginWorkout(state.ref)
                model.watchSetDone = { setDone() }
                pushToWatch()
            }
            .onDisappear { model.watchSetDone = nil }
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading) {
                Text("\(state.setsDone) of \(state.setsTotal) sets").font(.subheadline.monospacedDigit())
                ProgressView(value: Double(state.setsDone), total: Double(max(state.setsTotal, 1)))
            }
            if let hr = model.heartRate {
                Label("\(hr)", systemImage: "heart.fill").font(.title3.monospacedDigit()).foregroundStyle(.red).padding(.leading)
            }
        }
    }

    private func exerciseCard(now: Date) -> some View {
        let e = current.exercise
        let settled = ["done", "skipped", "swapped"].contains(current.status)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(e.name).font(.title.bold())
                Spacer()
                Text("\(ex + 1)/\(state.exercises.count)").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
            }
            if settled {
                Text(current.status == "done" ? "Done" : current.status.capitalized).font(.title3).foregroundStyle(.secondary)
            } else {
                Text("Set \(set) of \(e.sets)").font(.title3)
                Text(e.target).font(.title2.weight(.semibold))
            }
            timer(now: now)
            HStack {
                Button { previous() } label: { Image(systemName: "chevron.left") }.buttonStyle(.bordered).accessibilityLabel("Previous exercise")
                Button { mainAction(now: now) } label: {
                    Text(mainLabel(now: now)).frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                Button { next() } label: { Image(systemName: "chevron.right") }.buttonStyle(.bordered).accessibilityLabel("Next exercise")
            }
            .font(.headline)
        }
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
    }

    @ViewBuilder private func timer(now: Date) -> some View {
        if let started = workStarted, let d = current.exercise.durationSec {
            let left = Double(d) - now.timeIntervalSince(started)
            Text(left > 0 ? "Work \(clock(left))" : "Time!").font(.system(size: 44, weight: .bold, design: .rounded).monospacedDigit()).foregroundStyle(Color.accentColor)
        } else if let until = restUntil {
            let left = until.timeIntervalSince(now)
            Text(left > 0 ? "Rest \(clock(left))" : "Go").font(.system(size: 44, weight: .bold, design: .rounded).monospacedDigit()).foregroundStyle(left > 0 ? Color.secondary : Color.accentColor)
        }
    }

    private var upNext: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("This workout").font(.headline)
            ForEach(Array(state.exercises.enumerated()), id: \.element.ref) { i, e in
                Button { ex = i; set = min(e.setsDone + 1, e.exercise.sets); restUntil = nil; workStarted = nil; pushToWatch() } label: {
                    HStack {
                        Image(systemName: e.status == "done" ? "checkmark.circle.fill" : i == ex ? "circle.inset.filled" : "circle").foregroundStyle(e.status == "done" ? .green : .accentColor)
                        Text(e.exercise.name)
                        Spacer()
                        Text(e.status == "skipped" ? "skipped" : "\(e.setsDone)/\(e.exercise.sets)").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func clock(_ s: Double) -> String {
        let t = max(0, Int(s.rounded(.up)))
        return "\(t / 60):\(String(format: "%02d", t % 60))"
    }

    private func mainLabel(now: Date) -> String {
        if ["done", "skipped", "swapped"].contains(current.status) { return "Next exercise" }
        if current.exercise.durationSec != nil { return workStarted == nil ? "Start \(Exercise.seconds(current.exercise.durationSec!))" : "Done" }
        return "Set done"
    }

    private func mainAction(now: Date) {
        if ["done", "skipped", "swapped"].contains(current.status) { return next() }
        if current.exercise.durationSec != nil, workStarted == nil {
            workStarted = now
            restUntil = nil
            return
        }
        setDone()
    }

    private func setDone() {
        let e = current
        var data = CheckinData(reps: e.exercise.reps?.count, load: e.exercise.load, avgHr: model.heartRate)
        if let started = workStarted { data.durationSec = Int(Date().timeIntervalSince(started)) }
        let setNumber = set
        workStarted = nil
        let last = setNumber >= e.exercise.sets
        Task {
            await model.checkin(NewCheckin(date: model.date, ref: "\(e.ref)/\(setNumber)", kind: "set", status: "done", data: data))
            if last {
                await model.checkin(NewCheckin(date: model.date, ref: e.ref, kind: "exercise", status: "done"))
                if state.next == nil { await finish("done"); return }
            }
            if model.settings.glasses.autoRestTimer, e.exercise.restSec > 0 { restUntil = Date().addingTimeInterval(TimeInterval(e.exercise.restSec)) }
            if last { if let n = state.next { ex = n.exercise; set = n.set } } else { set = setNumber + 1 }
            pushToWatch()
        }
    }

    private func skipExercise() {
        let e = current
        Task {
            await model.checkin(NewCheckin(date: model.date, ref: e.ref, kind: "exercise", status: "skipped"))
            if let n = state.next { ex = n.exercise; set = n.set }
            pushToWatch()
        }
    }

    private func next() { move(1) }
    private func previous() { move(-1) }
    private func move(_ d: Int) {
        ex = (ex + d + state.exercises.count) % state.exercises.count
        set = min(current.setsDone + 1, current.exercise.sets)
        restUntil = nil
        workStarted = nil
        pushToWatch()
    }

    private func pushToWatch() {
        let e = current
        model.updateWatch(title: state.workout.title, exercise: e.exercise.name, setLine: "Set \(set)/\(e.exercise.sets) · \(e.exercise.target)",
                          restUntil: restUntil, progress: "\(state.setsDone)/\(state.setsTotal)")
    }

    private func finish(_ status: String) async {
        await model.checkin(NewCheckin(date: model.date, ref: state.ref, kind: "workout", status: status, data: model.heartRate.map { CheckinData(avgHr: $0) }))
        await model.endWorkout()
        dismiss()
    }

    private func close() {
        Task { await model.endWorkout() }
        dismiss()
    }
}
