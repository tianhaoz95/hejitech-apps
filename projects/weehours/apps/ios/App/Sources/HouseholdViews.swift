import LogCore
import SwiftUI

// MARK: - Offline outbox badge and drawer

/// "3 on this iPhone": entries waiting to upload. Shown only once it's more than a blip (a sync
/// error, or something waiting over a minute), so a brief dropout doesn't alarm anyone.
struct SyncBadge: View {
    @EnvironmentObject var model: AppModel
    /// Decided by the screen (`SyncBadge.wanted`), which holds it still during a pull to refresh.
    let visible: Bool
    let open: () -> Void

    /// Entries waiting on this iPhone, with a failed sync or for over a minute.
    @MainActor static func wanted(_ model: AppModel, now: Date) -> Bool {
        let stale = model.pending.first.map { now.timeIntervalSince($0.loggedAt) > 60 } ?? false
        return !model.localOnly && !model.pending.isEmpty && (model.syncError != nil || stale)
    }

    var body: some View {
        let waiting = model.pending.count
        if visible, waiting > 0 {
            Button(action: open) {
                Label("\(waiting) on this iPhone", systemImage: "icloud.slash")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .foregroundStyle(.white)
                    .background(Color.orange, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("syncBadge")
        }
    }
}

/// What's waiting to upload, why that's safe, and a retry.
struct SyncSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var syncing = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label {
                        Text("Saved on this iPhone. Entries are kept in the app's own database on this phone and upload by themselves when there's a connection. Closing the app or restarting the phone doesn't lose them.")
                            .font(.subheadline)
                    } icon: { Image(systemName: "lock.iphone").foregroundStyle(.green) }
                    if let last = model.lastSync {
                        LabeledContent("Last sync", value: last.formatted(date: .abbreviated, time: .shortened))
                    }
                    if let e = model.syncError {
                        Text(e).font(.caption).foregroundStyle(.orange).lineLimit(3)
                    }
                }
                Section(model.pending.isEmpty ? "Everything is uploaded" : "Waiting to upload (\(model.pending.count))") {
                    ForEach(model.pending.reversed()) { e in
                        HStack(spacing: 10) {
                            Image(systemName: Theme.icon(for: e.type)).foregroundStyle(Theme.color(for: e.type)).frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(SystemType.all.contains(e.type) && e.type != SystemType.note ? Self.systemLabel(e) : model.label([e]))
                                Text(e.occurredAt.formatted(date: .omitted, time: .shortened)).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "clock.arrow.circlepath").foregroundStyle(.orange).font(.caption)
                        }
                    }
                }
            }
            .navigationTitle("Sync")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if syncing { ProgressView() } else {
                        Button("Sync now") {
                            syncing = true
                            Task { await model.syncNow(); syncing = false }
                        }
                        .accessibilityIdentifier("syncNow")
                    }
                }
            }
        }
    }

    static func systemLabel(_ e: LogEvent) -> String {
        switch e.type {
        case SystemType.undo: return "Undo"
        case SystemType.duty: return "Duty change"
        case SystemType.resolve: return "Duplicate resolved"
        default: return "Settings"
        }
    }
}

// MARK: - Shift note

/// The note the last caregiver left for whoever's up next, pinned above the status.
struct ShiftNoteCard: View {
    @EnvironmentObject var model: AppModel
    let note: LogEvent
    let now: Date

    var body: some View {
        let mine = note.loggedBy == model.me
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(mine ? "Your note for the next shift" : "From \(model.household.caregiverName(note.loggedBy))", systemImage: "note.text")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(StatusSnapshot.ago(now.timeIntervalSince(note.loggedAt))).font(.caption).foregroundStyle(.secondary)
            }
            Text(note.string("transcript") ?? "").font(.body).fixedSize(horizontal: false, vertical: true)
            HStack {
                if mine {
                    Button("Remove", role: .destructive) { model.undo(note.id) }
                }
                Spacer()
                Button(mine ? "Hide" : "Got it") { withAnimation(.snappy) { model.dismissShiftNote(note) } }
                    .buttonStyle(.borderedProminent).tint(Color(red: 0.80, green: 0.60, blue: 0.10))
            }
            .controlSize(.small)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 1.0, green: 0.86, blue: 0.40).opacity(0.28), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Color(red: 0.90, green: 0.72, blue: 0.20).opacity(0.5), lineWidth: 1))
        .accessibilityIdentifier("shiftNoteCard")
    }
}

/// Type or dictate a short note for the next shift. Optional: nothing asks for one.
struct ShiftNoteSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var dictating = false
    @State private var transcribing = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Fussy at 1am, extra wipes in the top drawer…", text: $text, axis: .vertical)
                        .lineLimit(3...6)
                        .accessibilityIdentifier("shiftNoteText")
                    Button {
                        if dictating { stop() } else { start() }
                    } label: {
                        if transcribing {
                            HStack { ProgressView(); Text("Writing it down…") }
                        } else {
                            Label(dictating ? "Stop" : "Say it instead", systemImage: dictating ? "stop.circle.fill" : "mic.fill")
                        }
                    }
                    .disabled(transcribing)
                } footer: {
                    Text("Shown at the top of Now on everyone's phone until the next hand-off after this one, or for 12 hours. Dictation is transcribed on this iPhone; the audio isn't kept.")
                }
            }
            .navigationTitle("Note for the next shift")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { if dictating { _ = Task { await model.finishDictation() } }; dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Pin") { model.leaveShiftNote(text); dismiss() }
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || dictating)
                }
            }
        }
    }

    private func start() {
        do { try model.startDictation(); dictating = true } catch { model.error = "Microphone unavailable: \(error.localizedDescription)" }
    }

    private func stop() {
        dictating = false
        transcribing = true
        Task {
            if let said = await model.finishDictation(), !said.isEmpty {
                text = text.isEmpty ? said : text + " " + said
            }
            transcribing = false
        }
    }
}

// MARK: - Partner pulse

/// What the other caregivers are doing: "Alex is making a bottle" (a heads-up from their phone),
/// or a feed or sleep someone else started that's still open.
struct PartnerPulse: View {
    @EnvironmentObject var model: AppModel
    let now: Date
    @State private var pulse = false

    var body: some View {
        let lines = self.lines
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(lines, id: \.self) { line in
                    HStack(spacing: 10) {
                        Circle().fill(Theme.accent).frame(width: 9, height: 9)
                            .scaleEffect(pulse ? 1.35 : 0.8).opacity(pulse ? 0.55 : 1)
                        Text(line).font(.subheadline.weight(.medium))
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.accent.opacity(0.10), in: RoundedRectangle(cornerRadius: 14))
            .onAppear { withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) { pulse = true } }
            .accessibilityIdentifier("partnerPulse")
        }
    }

    private var lines: [String] {
        let h = model.household
        let several = model.shown.count > 1
        var out: [String] = model.partnerActivity.filter { $0.until > now }.map { a in
            let who = h.caregiverName(a.caregiver)
            let forWhom = several && !a.babies.isEmpty ? " for \(Household.names(a.babies.compactMap { h.baby($0) }))" : ""
            return "\(who) is making a bottle\(forWhom) · \(StatusSnapshot.ago(now.timeIntervalSince(a.at)))"
        }
        for b in model.shown {
            guard let log = model.logs[b.id] else { continue }
            for s in [log.openFeedSession(), log.openSession(.sleep)].compactMap({ $0 }) {
                guard let id = s.startEvent, let start = s.start, now.timeIntervalSince(start) < 3 * 3600,
                      let e = log.all.first(where: { $0.id == id }), e.loggedBy != model.me else { continue }
                let what = s.kind == .bottle ? "started a bottle" : s.kind == .breast ? "started nursing" : "put \(several ? b.name : "the baby") down"
                let forWhom = several && s.kind != .sleep ? " for \(b.name)" : ""
                out.append("\(h.caregiverName(e.loggedBy)) \(what)\(forWhom) · \(StatusSnapshot.ago(now.timeIntervalSince(start)))")
            }
        }
        return out
    }
}
