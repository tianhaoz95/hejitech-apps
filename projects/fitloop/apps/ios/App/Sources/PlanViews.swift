import FitLoopKit
import PhotosUI
import SwiftUI

/// The Plan tab: what the agent planned and why, goals, limits, targets, the week, versions.
struct PlanView: View {
    @Environment(AppModel.self) private var model
    private let names = ["mon": "Monday", "tue": "Tuesday", "wed": "Wednesday", "thu": "Thursday", "fri": "Friday", "sat": "Saturday", "sun": "Sunday"]

    var body: some View {
        NavigationStack {
            List {
                if let cur = model.plan?.current {
                    let p = cur.plan
                    Section {
                        Text(p.summary)
                        if !cur.changeNote.isEmpty { Label(cur.changeNote, systemImage: "sparkles").font(.footnote).foregroundStyle(.secondary) }
                    } header: { Text("Version \(cur.version) · from \(p.startsOn)") }
                    Section("Goals") { ForEach(p.goals) { g in Text(g.text) } }
                    if !p.constraints.isEmpty { Section("Planned around") { ForEach(p.constraints, id: \.self) { Text($0) } } }
                    if let t = p.targets { Section("Daily targets") { Text(t.summary) } }
                    Section("The week") {
                        ForEach(Plan.weekdays, id: \.self) { d in
                            if let day = p.week[d] {
                                DisclosureGroup {
                                    ForEach(day.workouts) { w in
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("\(w.time.map { "\($0) · " } ?? "")\(w.title) (\(w.durationMin) min)").font(.subheadline.bold())
                                            ForEach(w.exercises) { e in Text("\(e.name): \(e.sets) × \(e.target)").font(.caption) }
                                        }
                                    }
                                    ForEach(day.meals) { m in
                                        Text("\(m.time.map { "\($0) · " } ?? "")\(m.name): \(m.items.map(\.name).joined(separator: ", "))").font(.caption)
                                    }
                                } label: { LabeledContent(names[d] ?? d, value: day.title) }
                            }
                        }
                    }
                    Section {
                        ForEach(model.plan?.versions ?? []) { v in
                            VStack(alignment: .leading) {
                                Text("v\(v.version) · from \(v.startsOn)").font(.subheadline.bold())
                                Text(v.changeNote.isEmpty ? v.title : v.changeNote).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    } header: { Text("Versions") } footer: { Text("Plans and targets are written by the AI agent you connected — not medical or clinical nutrition advice. Talk to a doctor before starting a new exercise or diet program, and stop if anything hurts, you feel dizzy or have chest symptoms.") }
                } else {
                    ContentUnavailableView("No plan yet", systemImage: "calendar.badge.plus", description: Text("Your AI agent publishes plans to FitLoop over MCP. Connect it in Settings → Agents."))
                }
            }
            .navigationTitle(model.plan?.current?.plan.title ?? "Plan")
            .refreshable { await model.refresh() }
        }
    }
}

/// The Progress tab: adherence over four weeks, vitals, manual entries and progress photos (each
/// shown only when its option is on).
struct ProgressScreen: View {
    @Environment(AppModel.self) private var model
    @State private var progress: ProgressResponse?
    @State private var photos: [Photo] = []
    @State private var metric = "weight"
    @State private var value = ""
    @State private var pick: PhotosPickerItem?
    @State private var error: String?

    private let labels = ["weight": "Weight (kg)", "waist": "Waist (cm)", "body_fat": "Body fat (%)", "energy": "Energy (1-5)", "mood": "Mood (1-5)", "soreness": "Soreness (1-5)", "sleep_hours": "Sleep (h)",
                          "resting_hr": "Resting HR", "hrv": "HRV (ms)", "steps": "Steps", "active_energy": "Active energy (kcal)"]

    var body: some View {
        NavigationStack {
            List {
                if let a = progress?.adherence {
                    Section("Last 4 weeks") {
                        LabeledContent("Plan done", value: "\(Int(a.average * 100))%")
                        LabeledContent("Workouts", value: "\(a.workouts.done)/\(a.workouts.planned)")
                        LabeledContent("Meals", value: "\(a.meals.done)/\(a.meals.planned)")
                        LabeledContent("Streak", value: "\(a.streak) day\(a.streak == 1 ? "" : "s")")
                        HStack(alignment: .bottom, spacing: 3) {
                            ForEach(a.days) { d in
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(d.workoutsPlanned + d.mealsPlanned == 0 ? Color.secondary.opacity(0.2) : Color.accentColor)
                                    .frame(height: max(4, 50 * d.completion))
                                    .accessibilityLabel("\(d.date): \(Int(d.completion * 100))%")
                            }
                        }
                        .frame(height: 54)
                    }
                }
                Section("Vitals") {
                    let latest = Dictionary(grouping: progress?.vitals ?? [], by: \.metric)
                    if latest.isEmpty { Text("Nothing yet.").foregroundStyle(.secondary) }
                    ForEach(latest.keys.sorted(), id: \.self) { k in
                        if let last = latest[k]?.last {
                            LabeledContent(labels[k] ?? k, value: last.value.formatted(.number.precision(.fractionLength(0...1))))
                        }
                    }
                    if model.settings.vitals.manual {
                        HStack {
                            Picker("Metric", selection: $metric) {
                                ForEach(["weight", "waist", "body_fat", "energy", "mood", "soreness", "sleep_hours"], id: \.self) { Text(labels[$0] ?? $0).tag($0) }
                            }
                            .labelsHidden()
                            TextField("Value", text: $value).keyboardType(.decimalPad).frame(width: 70)
                            Button("Add") { Task { await addVital() } }.disabled(Double(value) == nil)
                        }
                    }
                    if model.settings.vitals.healthDaily {
                        Button("Sync Apple Health now") { Task { await model.syncHealth(); await load() } }
                    }
                }
                if model.settings.vitals.photos {
                    Section("Progress photos") {
                        PhotosPicker("Add a photo", selection: $pick, matching: .images)
                        ScrollView(.horizontal) {
                            HStack {
                                ForEach(photos) { p in
                                    VStack {
                                        AsyncImage(url: p.url.flatMap(URL.init(string:))) { $0.resizable().scaledToFill() } placeholder: { Color.secondary.opacity(0.2) }
                                            .frame(width: 90, height: 120).clipShape(RoundedRectangle(cornerRadius: 8))
                                        Text(p.takenOn).font(.caption2)
                                    }
                                    .contextMenu { Button("Delete", role: .destructive) { Task { try? await model.backend.deletePhoto(p.id); await load() } } }
                                }
                            }
                        }
                    }
                }
                if let error { Text(error).foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("Progress")
            .task { await load() }
            .refreshable { await load() }
            .onChange(of: pick) { _, item in Task { await upload(item) } }
        }
    }

    private func load() async {
        do {
            progress = try await model.backend.progress(from: Day.adding(-27, to: Day.string()), to: Day.string())
            photos = model.settings.vitals.photos ? try await model.backend.photos() : []
        } catch { self.error = error.localizedDescription }
    }

    private func addVital() async {
        guard let v = Double(value) else { return }
        do {
            try await model.backend.sendVitals([Vital(date: Day.string(), metric: metric, value: v, source: "manual")])
            value = ""
            await load()
        } catch { self.error = error.localizedDescription }
    }

    private func upload(_ item: PhotosPickerItem?) async {
        guard let item, let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data),
              let jpeg = image.jpegData(compressionQuality: 0.8) else { return }
        do {
            try await model.backend.uploadPhoto(jpeg, takenOn: Day.string())
            await load()
        } catch { self.error = error.localizedDescription }
    }
}

/// The Feedback tab: every note left for the agent, with its replies; a new note.
struct FeedbackView: View {
    @Environment(AppModel.self) private var model
    @State private var items: [Feedback] = []
    @State private var writing = false

    var body: some View {
        NavigationStack {
            List {
                if items.isEmpty {
                    ContentUnavailableView("No notes yet", systemImage: "bubble.left.and.text.bubble.right", description: Text("Leave one from any workout or meal, on your glasses or here. Your agent reads them before it changes your plan."))
                }
                ForEach(items) { f in
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text([f.ref, f.date].compactMap { $0 }.first ?? "General").font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text(f.status == "addressed" ? "Answered" : "Open").font(.caption).foregroundStyle(f.status == "addressed" ? .green : .orange)
                        }
                        if !f.tags.isEmpty { Text(f.tags.compactMap { FeedbackTag(rawValue: $0)?.label }.joined(separator: " · ")).font(.subheadline.bold()) }
                        if !f.text.isEmpty { Text(f.text) }
                        if let r = f.agentReply { Label(r, systemImage: "sparkles").font(.callout).foregroundStyle(Color.accentColor) }
                    }
                    .swipeActions { Button("Delete", role: .destructive) { Task { try? await model.backend.deleteFeedback(f.id); await load() } } }
                }
            }
            .navigationTitle("Feedback")
            .toolbar { Button("New note", systemImage: "square.and.pencil") { writing = true } }
            .sheet(isPresented: $writing, onDismiss: { Task { await load() } }) { NoteSheet(target: NoteTarget(ref: nil, title: "Note for my agent", tags: FeedbackTag.allCases)) }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async { items = (try? await model.backend.feedback()) ?? items }
}
