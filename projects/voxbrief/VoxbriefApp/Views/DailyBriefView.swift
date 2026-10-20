import SwiftUI

/// The Daily Brief screen: open action items across notes (high priority first, ticked off right
/// here), a recap of what was recorded since the last look, and the morning-notification setting.
struct DailyBriefView: View {
    @EnvironmentObject private var repository: NoteRepository
    /// Items ticked while the screen is open stay visible (struck through) until it closes, so a
    /// mis-tap can be undone in place.
    @State private var tickedThisVisit: Set<String> = []
    @State private var since = DailyBrief.sinceDate()
    @State private var recap: (text: String, engine: String)?
    @State private var isLoadingRecap = false
    @State private var showAllOthers = false
    @State private var notificationsOn = DailyBriefNotifier.isEnabled
    @State private var notificationTime = DailyBriefView.storedTime()

    private var brief: DailyBrief { DailyBrief.build(notes: repository.notes, since: since) }

    var body: some View {
        let brief = self.brief
        let display = displayBrief
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()).uppercased())
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Color.accentColor)
                    Text("Your brief")
                        .font(.largeTitle.weight(.bold))
                    Text(headline(for: brief))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 4, bottom: 4, trailing: 4))
            }

            let high = display.highPriority
            if !high.isEmpty {
                Section("High priority") {
                    ForEach(high) { itemRow($0) }
                }
            }

            let others = display.otherItems
            if !others.isEmpty {
                Section(high.isEmpty ? "Open action items" : "Also open") {
                    ForEach(showAllOthers ? others : Array(others.prefix(6))) { itemRow($0) }
                    if others.count > 6 && !showAllOthers {
                        Button("Show \(others.count - 6) more") { showAllOthers = true }
                    }
                }
            }

            if high.isEmpty && others.isEmpty {
                Section {
                    Label("No open action items. Nice.", systemImage: "checkmark.seal")
                        .foregroundStyle(.secondary)
                }
            }

            if !brief.newNotes.isEmpty {
                Section("Since \(sinceLabel)") {
                    recapRow
                    ForEach(brief.newNotes.prefix(8)) { note in
                        NavigationLink {
                            NoteDetailView(note: note)
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(note.title).lineLimit(1)
                                Text(note.createdAt.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            Section {
                Toggle("Morning notification", isOn: $notificationsOn)
                if notificationsOn {
                    DatePicker("Time", selection: $notificationTime, displayedComponents: .hourAndMinute)
                }
            } footer: {
                Text("A local notification with your open items, scheduled on this iPhone.")
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadRecap(for: brief.newNotes) }
        .onDisappear { DailyBrief.markOpened() }
        .onChange(of: notificationsOn) { _, on in
            Task {
                let result = await DailyBriefNotifier.setEnabled(on, notes: repository.notes)
                if result != on { notificationsOn = result }
            }
        }
        .onChange(of: notificationTime) { _, time in
            let parts = Calendar.current.dateComponents([.hour, .minute], from: time)
            DailyBriefNotifier.setTime(hour: parts.hour ?? 8, minute: parts.minute ?? 0, notes: repository.notes)
        }
    }

    /// The brief with this visit's ticked items still listed (shown struck through).
    private var displayBrief: DailyBrief {
        guard !tickedThisVisit.isEmpty else { return brief }
        let notes = repository.notes.map { note -> VoiceNote in
            var copy = note
            copy.completedActionItems.removeAll { tickedThisVisit.contains("\(note.id)|\($0)") }
            return copy
        }
        return DailyBrief.build(notes: notes, since: since)
    }

    private func itemRow(_ item: DailyBrief.Item) -> some View {
        let done = tickedThisVisit.contains(item.id)
        return HStack(alignment: .top, spacing: 12) {
            Button {
                repository.toggleActionItem(id: item.noteId, item: item.text)
                if done { tickedThisVisit.remove(item.id) } else { tickedThisVisit.insert(item.id) }
            } label: {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(done ? .green : .secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(done ? "Mark not done" : "Mark done")

            VStack(alignment: .leading, spacing: 2) {
                Text(item.text)
                    .strikethrough(done)
                    .foregroundStyle(done ? .secondary : .primary)
                if let note = repository.note(withId: item.noteId) {
                    NavigationLink {
                        NoteDetailView(note: note)
                    } label: {
                        Text(item.noteTitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 0)
            if let priority = item.priority, !done {
                Text(priority.capitalized)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 2)
                    .foregroundStyle(priority == "high" ? .red : .secondary)
                    .background((priority == "high" ? Color.red : Color.secondary).opacity(0.14), in: Capsule())
            }
        }
    }

    @ViewBuilder
    private var recapRow: some View {
        if let recap {
            VStack(alignment: .leading, spacing: 6) {
                Text(recap.text)
                Label("Written on this iPhone · \(CleanupEngineLabel.displayName(for: recap.engine))", systemImage: "sparkles")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        } else if isLoadingRecap {
            HStack(spacing: 8) {
                ProgressView()
                Text("Writing a recap…").foregroundStyle(.secondary)
            }
        }
    }

    private func loadRecap(for notes: [VoiceNote]) async {
        guard recap == nil, !notes.isEmpty else { return }
        isLoadingRecap = true
        recap = await DailyBrief.recap(for: Array(notes.prefix(12)))
        isLoadingRecap = false
    }

    private func headline(for brief: DailyBrief) -> String {
        let newCount = brief.newNotes.count
        let open = brief.openItems.count
        let high = brief.highPriority.count
        var parts = ["\(newCount) new note\(newCount == 1 ? "" : "s")", "\(open) open action item\(open == 1 ? "" : "s")"]
        if high > 0 { parts.append("\(high) high priority") }
        return parts.joined(separator: " · ")
    }

    private var sinceLabel: String {
        Calendar.current.isDateInYesterday(since) || Date().timeIntervalSince(since) <= 86_400 + 60
            ? "yesterday"
            : since.formatted(.dateTime.weekday(.wide))
    }

    private static func storedTime() -> Date {
        Calendar.current.date(bySettingHour: DailyBriefNotifier.hour, minute: DailyBriefNotifier.minute, second: 0, of: Date()) ?? Date()
    }
}

/// The card at the top of the notes list that opens the brief.
struct DailyBriefCard: View {
    let brief: DailyBrief

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "sun.horizon.fill")
                .font(.title2)
                .foregroundStyle(.orange)
            VStack(alignment: .leading, spacing: 2) {
                Text("Your brief")
                    .font(.headline)
                Text(summary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 4)
    }

    private var summary: String {
        let open = brief.openItems.count
        let high = brief.highPriority.count
        if high > 0 { return "\(open) open · \(high) high priority" }
        return "\(open) open action item\(open == 1 ? "" : "s")"
    }
}
