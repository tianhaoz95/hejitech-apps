import FitLoopKit
import SwiftUI

/// The Today tab: the day's workouts (open one in the player) and meals (check off, portion, swap,
/// skip), progress against the targets, and a note for the agent on anything.
struct TodayView: View {
    @Environment(AppModel.self) private var model
    @State private var openWorkout: WorkoutState?
    @State private var noteFor: NoteTarget?

    var body: some View {
        NavigationStack {
            List {
                if let t = model.today, let day = t.state.day, t.plan != nil {
                    Section {
                        DaySummary(state: t.state, hr: model.heartRate)
                        if let note = day.notes { Text(note).font(.callout) }
                        if let change = t.plan?.changeNote, !change.isEmpty {
                            Label(change, systemImage: "sparkles").font(.footnote).foregroundStyle(.secondary)
                        }
                    } header: { Text(day.title) }
                    if !t.state.workouts.isEmpty {
                        Section("Workouts") {
                            ForEach(t.state.workouts) { w in
                                Button { openWorkout = w } label: { WorkoutRow(state: w) }.tint(.primary)
                                    .swipeActions {
                                        Button("Skip") { Task { await model.checkin(NewCheckin(date: model.date, ref: w.ref, kind: "workout", status: "skipped")) } }.tint(.gray)
                                        Button("Note") { noteFor = NoteTarget(ref: w.ref, title: w.workout.title, tags: [.tooHard, .tooEasy, .noTime, .lovedIt, .other]) }.tint(.accentColor)
                                    }
                            }
                        }
                    }
                    if !t.state.meals.isEmpty {
                        Section("Meals") {
                            ForEach(t.state.meals) { m in MealRow(state: m, onNote: { noteFor = NoteTarget(ref: m.ref, title: m.meal.name, tags: [.hungry, .tooMuchFood, .lovedIt, .other]) }) }
                        }
                    }
                    Section {
                        Button("Note for my agent about today", systemImage: "bubble.left") { noteFor = NoteTarget(ref: nil, title: "Today", tags: FeedbackTag.allCases) }
                    }
                } else if model.loading && model.today == nil {
                    ProgressView()
                } else {
                    ContentUnavailableView {
                        Label(model.today?.plan == nil ? "No plan yet" : "Nothing planned", systemImage: "figure.run")
                    } description: {
                        Text(model.today?.plan == nil
                             ? "Ask your AI agent to build your FitLoop plan: connect it in Settings → Agents, then say \"make me a FitLoop plan\"."
                             : "Your plan has nothing on this day.")
                    }
                }
                if let e = model.error { Text(e).font(.footnote).foregroundStyle(.red) }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await model.refresh() }
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Previous day", systemImage: "chevron.left") { Task { await model.show(date: Day.adding(-1, to: model.date)) } }
                    Button("Next day", systemImage: "chevron.right") { Task { await model.show(date: Day.adding(1, to: model.date)) } }
                }
                if model.date != Day.string() {
                    ToolbarItem(placement: .topBarLeading) { Button("Today") { Task { await model.show(date: Day.string()) } } }
                }
            }
            .fullScreenCover(item: $openWorkout) { w in WorkoutPlayer(initial: w) }
            .task {
                #if DEBUG
                // `-openWorkout` opens the day's first workout in the player (screenshots).
                if ProcessInfo.processInfo.arguments.contains("-openWorkout") {
                    for _ in 0..<20 where model.today == nil { try? await Task.sleep(for: .milliseconds(300)) }
                    openWorkout = model.today?.state.workouts.first
                }
                #endif
            }
            .sheet(item: $noteFor) { n in NoteSheet(target: n) }
        }
    }

    private var title: String {
        guard let d = Day.date(model.date) else { return "Today" }
        return model.date == Day.string() ? "Today" : d.formatted(.dateTime.weekday(.wide).month().day())
    }
}

struct NoteTarget: Identifiable {
    var ref: String?
    var title: String
    var tags: [FeedbackTag]
    var id: String { ref ?? "day" }
}

struct DaySummary: View {
    let state: DayState
    let hr: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(Int(state.completion * 100))% done").font(.headline)
                Spacer()
                if let hr { Label("\(hr)", systemImage: "heart.fill").foregroundStyle(.red).font(.subheadline.monospacedDigit()) }
            }
            ProgressView(value: state.completion)
            let n = state.nutrition
            if let target = n.targets.calories {
                Text("\(Int(n.eaten.calories ?? 0)) of \(Int(target)) kcal\(n.targets.proteinG.map { " · \(Int(n.eaten.proteinG ?? 0)) of \(Int($0)) g protein" } ?? "")")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
    }
}

struct WorkoutRow: View {
    let state: WorkoutState
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(state.workout.title).font(.headline)
                Text([state.workout.time, "\(state.workout.durationMin) min", "\(state.workout.exercises.count) exercises"].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            switch state.status {
            case "done": Label("Done", systemImage: "checkmark.circle.fill").labelStyle(.iconOnly).foregroundStyle(.green).font(.title2)
            case "skipped": Text("Skipped").font(.caption).foregroundStyle(.secondary)
            default: Text("\(state.setsDone)/\(state.setsTotal)").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
            }
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

struct MealRow: View {
    @Environment(AppModel.self) private var model
    let state: MealState
    let onNote: () -> Void
    @State private var swapping = false
    @State private var swapText = ""

    var body: some View {
        let m = state.meal
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text([m.time, m.name].compactMap { $0 }.joined(separator: " · ")).font(.headline)
                Spacer()
                statusBadge
            }
            Text(m.items.map { "\($0.name) \($0.amount)" }.joined(separator: ", ")).font(.subheadline)
            if let mac = m.macros { Text(mac.summary).font(.caption).foregroundStyle(.secondary) }
            if let prep = m.prep, !prep.isEmpty {
                DisclosureGroup("Prep") { ForEach(Array(prep.enumerated()), id: \.offset) { i, p in Text("\(i + 1). \(p)").font(.caption) } }.font(.caption)
            }
            HStack {
                Button("Ate it") { act("done", "as_planned") }.buttonStyle(.borderedProminent)
                Menu("Other") {
                    Button("Ate less") { act("done", "less") }
                    Button("Ate more") { act("done", "more") }
                    Button("Something else…") { swapping = true }
                    Button("Skipped it") { act("skipped", nil) }
                    Divider()
                    Button("Note for my agent…", action: onNote)
                }
                .buttonStyle(.bordered)
            }
            .controlSize(.small)
        }
        .padding(.vertical, 4)
        .alert("What did you eat instead?", isPresented: $swapping) {
            TextField("e.g. a burrito", text: $swapText)
            Button("Save") { Task { await model.checkin(NewCheckin(date: model.date, ref: state.ref, kind: "meal", status: "swapped", data: CheckinData(swappedFor: swapText))) } }
            Button("Cancel", role: .cancel) {}
        }
    }

    @ViewBuilder private var statusBadge: some View {
        switch state.status {
        case "done": Label(state.portion == "less" ? "Less" : state.portion == "more" ? "More" : "Done", systemImage: "checkmark.circle.fill").font(.caption).foregroundStyle(.green)
        case "swapped": Text("Swapped").font(.caption).foregroundStyle(.orange)
        case "skipped": Text("Skipped").font(.caption).foregroundStyle(.secondary)
        default: EmptyView()
        }
    }

    private func act(_ status: String, _ portion: String?) {
        Task { await model.checkin(NewCheckin(date: model.date, ref: state.ref, kind: "meal", status: status, data: portion.map { CheckinData(portion: $0) })) }
    }
}

/// A note for the agent: quick tags and words, tied to a plan item (or the day).
struct NoteSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let target: NoteTarget
    @State private var tags: Set<FeedbackTag> = []
    @State private var text = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Quick") {
                    ForEach(target.tags) { t in
                        Toggle(t.label, isOn: Binding(get: { tags.contains(t) }, set: { if $0 { tags.insert(t) } else { tags.remove(t) } }))
                    }
                    if tags.contains(.pain) {
                        Text("Stop if something hurts, you feel dizzy or have chest symptoms, and see a doctor or physio — your agent isn't a medical professional.")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
                Section("In your words") { TextField("What should your agent know?", text: $text, axis: .vertical).lineLimit(3...8) }
                Section { Text("Your agent reads this next time it looks at your plan, and replies in Feedback.").font(.footnote).foregroundStyle(.secondary) }
            }
            .navigationTitle(target.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") { Task { if await model.sendFeedback(ref: target.ref, text: text, tags: Array(tags)) { dismiss() } } }
                        .disabled(tags.isEmpty && text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
