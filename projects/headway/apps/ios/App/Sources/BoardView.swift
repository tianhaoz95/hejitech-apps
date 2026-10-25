import HeadwayKit
import SwiftUI

/// The Trains tab: the commute for the time of day (or a pair picked here), the next trains with
/// live delays, Caltrain's alerts, and the tracked train. Swipe a train to track it.
struct BoardView: View {
    @Environment(AppModel.self) private var model
    @State private var picking = false
    @State private var now = Date()
    private let tick = Timer.publish(every: 20, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            List {
                if let t = model.tracked {
                    Section("Tracking") { TrackedRow(tracked: t, now: now) }
                }
                if let b = model.board {
                    Section {
                        ForEach(b.trains) { train in
                            TrainRow(train: train, now: now, tracked: model.tracked?.tripId == train.tripId)
                                .swipeActions(edge: .trailing) {
                                    if train.status != .cancelled {
                                        Button("Track", systemImage: "location.fill") { Task { await model.track(train) } }.tint(.accentColor)
                                    }
                                }
                                .contextMenu {
                                    if train.status != .cancelled {
                                        Button("Track this train", systemImage: "location.fill") { Task { await model.track(train) } }
                                    }
                                }
                        }
                        if b.trains.isEmpty { Text("No more trains today.").foregroundStyle(.secondary) }
                    } header: {
                        BoardHeader(board: b)
                    } footer: {
                        Text(b.live ? "Live predictions from Caltrain's feed. Swipe a train to track it: your iPhone alerts you before your stop." : "No fresh live data: these are timetable times.")
                    }
                    if !b.alerts.isEmpty {
                        Section("Caltrain alerts") {
                            ForEach(b.alerts) { a in
                                VStack(alignment: .leading, spacing: 4) {
                                    Label(a.header, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.orange).font(.subheadline.weight(.semibold))
                                    if !a.description.isEmpty, a.description != a.header { Text(a.description).font(.footnote).foregroundStyle(.secondary) }
                                }
                            }
                        }
                    }
                } else if !model.hasCommute {
                    ContentUnavailableView {
                        Label("No commute yet", systemImage: "tram")
                    } description: {
                        Text("Save your morning and evening stations in the Commute tab, or pick two stations to see their trains.")
                    } actions: {
                        Button("Pick stations") { picking = true }.buttonStyle(.borderedProminent)
                    }
                } else if model.loading {
                    ProgressView()
                }
                if let e = model.error {
                    Text(e).font(.footnote).foregroundStyle(.red)
                }
            }
            .navigationTitle(model.board.map { "\($0.from.name) → \($0.to.name)" } ?? "Trains")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable { await model.refresh() }
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Flip", systemImage: "arrow.up.arrow.down") { Task { await model.flip() } }.disabled(model.board == nil)
                    Menu {
                        if model.customPair != nil, model.hasCommute {
                            Button("My commute", systemImage: "house") { Task { await model.showCommute() } }
                        }
                        Button("Pick stations", systemImage: "mappin.and.ellipse") { picking = true }
                    } label: { Label("Stations", systemImage: "ellipsis.circle") }
                }
            }
            .sheet(isPresented: $picking) { PairPicker() }
            .onReceive(tick) { now = $0; Task { await model.refresh() } }
        }
    }
}

struct BoardHeader: View {
    let board: Board
    var body: some View {
        HStack {
            Text(board.leg == "custom" ? "Next trains" : board.leg == "morning" ? "Morning commute" : "Evening commute")
            Spacer()
            Text(board.live ? "LIVE" : "TIMETABLE")
                .font(.caption2.weight(.bold))
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(board.live ? Color.green.opacity(0.18) : Color.secondary.opacity(0.15), in: Capsule())
                .foregroundStyle(board.live ? .green : .secondary)
        }
    }
}

struct TrainRow: View {
    let train: BoardTrain
    let now: Date
    var tracked = false

    private var statusText: String {
        switch train.status {
        case .cancelled: "Cancelled"
        case .late: "\(train.delayMin ?? 0) min late"
        case .early: "\(-(train.delayMin ?? 0)) min early"
        case .onTime: "On time"
        case .scheduled: "Scheduled"
        }
    }
    private var color: Color {
        switch train.status {
        case .cancelled: .red
        case .late: .orange
        case .onTime: .green
        default: .secondary
        }
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(train.train).font(.headline.monospacedDigit())
                Text(train.kindName).font(.caption).foregroundStyle(.secondary)
            }
            .frame(width: 70, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(Clock.time(train.predDep)).font(.title3.weight(.semibold).monospacedDigit())
                        .strikethrough(train.status == .cancelled)
                    if train.predDep != train.dep {
                        Text(Clock.time(train.dep)).font(.subheadline.monospacedDigit()).strikethrough().foregroundStyle(.secondary)
                    }
                    Text("→ \(Clock.time(train.predArr))").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary)
                }
                HStack(spacing: 4) {
                    Text(statusText).foregroundStyle(color)
                    Text("· \(train.stopsBetween == 0 ? "nonstop" : "\(train.stopsBetween) stop\(train.stopsBetween == 1 ? "" : "s")")").foregroundStyle(.secondary)
                    if tracked { Image(systemName: "location.fill").foregroundStyle(Color.accentColor).accessibilityLabel("Tracking") }
                }
                .font(.caption)
            }
            Spacer()
            if train.status != .cancelled {
                Text(Clock.until(train.predDep, now: now)).font(.headline.monospacedDigit())
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct TrackedRow: View {
    @Environment(AppModel.self) private var model
    let tracked: TrackedWithProgress
    let now: Date

    var body: some View {
        let p = tracked.progress
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Train \(p.train) to \(p.to.name)").font(.headline)
                Spacer()
                if let d = p.delayMin, d >= 2 { Text("+\(d) min").foregroundStyle(.orange).font(.subheadline.weight(.semibold)) }
            }
            if let next = p.next, next.id != p.to.id {
                Text("Next stop \(next.name) at \(Clock.time(next.pred))").font(.subheadline)
            }
            Text("Arrives \(Clock.time(p.predArr)) · in \(Clock.until(p.predArr, now: now)) · \(max(0, p.stopsLeft - 1)) stops to go")
                .font(.subheadline).foregroundStyle(.secondary)
            Button("Stop tracking", role: .destructive) { Task { await model.untrack() } }.font(.subheadline)
        }
    }
}

/// Picks any two stations for the Trains tab (not saved; the Commute tab saves).
struct PairPicker: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var from = "mountain_view"
    @State private var to = "san_francisco"

    var body: some View {
        NavigationStack {
            Form {
                StationPickerRow(title: "From", selection: $from)
                StationPickerRow(title: "To", selection: $to)
            }
            .navigationTitle("Pick stations")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Show") { Task { await model.show(from: from, to: to); dismiss() } }.disabled(from == to)
                }
            }
            .onAppear {
                if let b = model.board { from = b.from.id; to = b.to.id }
            }
        }
        .presentationDetents([.medium])
    }
}

struct StationPickerRow: View {
    @Environment(AppModel.self) private var model
    let title: String
    @Binding var selection: String

    var body: some View {
        Picker(title, selection: $selection) {
            ForEach(model.stations) { s in Text(s.name).tag(s.id) }
        }
    }
}
