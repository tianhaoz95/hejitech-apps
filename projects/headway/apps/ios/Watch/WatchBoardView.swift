import Combine
import HeadwayKit
import SwiftUI
import WatchKit

/// Main watchOS departure board for Caltrain commuters.
struct WatchBoardView: View {
    @Environment(WatchModel.self) private var model
    @State private var now = Date()
    @State private var selectedTrainForAction: BoardTrain?
    private let tick = Timer.publish(every: 15, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            List {
                if let t = model.tracked {
                    Section {
                        WatchTrackedCard(tracked: t, now: now)
                    } header: {
                        Text("Active Trip").font(.footnote).foregroundStyle(.secondary)
                    }
                }

                if let b = model.board {
                    Section {
                        ForEach(b.trains) { train in
                            Button {
                                selectedTrainForAction = train
                            } label: {
                                WatchTrainRow(
                                    train: train,
                                    now: now,
                                    isTracked: model.tracked?.tripId == train.tripId
                                )
                            }
                            .buttonStyle(.plain)
                        }

                        if b.trains.isEmpty {
                            Text(model.expressPreference == .expressOnly ? "No express trains today." : "No more trains today.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .padding(.vertical, 8)
                        }
                    } header: {
                        WatchBoardHeader(board: b)
                    }

                    if !b.alerts.isEmpty {
                        Section("Alerts") {
                            ForEach(b.alerts) { alert in
                                VStack(alignment: .leading, spacing: 2) {
                                    Label(alert.header, systemImage: "exclamationmark.triangle.fill")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(.orange)
                                    if !alert.description.isEmpty && alert.description != alert.header {
                                        Text(alert.description)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                            .lineLimit(3)
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                        }
                    }
                } else if !model.hasCommute && !model.loading {
                    VStack(spacing: 8) {
                        Image(systemName: "tram.fill")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("No Commute Set")
                            .font(.headline)
                        Text("Open Headway on your phone to configure your commute stations.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.vertical, 16)
                    .listRowBackground(Color.clear)
                }

                if let error = model.error {
                    Text(error)
                        .font(.caption2)
                        .foregroundStyle(.red)
                        .padding(.vertical, 4)
                }
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        Task { await model.flip() }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down")
                    }
                    .disabled(model.board == nil)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await model.cycleExpressPreference() }
                    } label: {
                        Image(systemName: model.expressPreference == .all ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                    }
                    .accessibilityLabel("Filter: \(model.expressPreference.rawValue)")
                }
            }
            .refreshable {
                await model.refresh()
            }
            .confirmationDialog("Train \(selectedTrainForAction?.train ?? "")", isPresented: Binding(
                get: { selectedTrainForAction != nil },
                set: { if !$0 { selectedTrainForAction = nil } }
            )) {
                if let train = selectedTrainForAction {
                    if model.tracked?.tripId == train.tripId {
                        Button("Stop tracking", role: .destructive) {
                            Task { await model.untrack() }
                        }
                    } else if train.status != .cancelled {
                        Button("Track train \(train.train)") {
                            Task { await model.track(train) }
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                }
            }
            .onReceive(tick) { date in
                now = date
            }
        }
    }

    private var navigationTitle: String {
        guard let b = model.board else { return "Headway" }
        return "\(b.from.short) → \(b.to.short)"
    }
}

// MARK: - Subviews

struct WatchBoardHeader: View {
    let board: Board

    var body: some View {
        HStack {
            Text(board.leg == "morning" ? "Morning" : board.leg == "evening" ? "Evening" : "Trains")
                .font(.caption2.weight(.medium))
            Spacer()
            Text(board.live ? "LIVE" : "TIMETABLE")
                .font(.system(size: 9, weight: .bold))
                .padding(.horizontal, 4)
                .padding(.vertical, 1)
                .background(board.live ? Color.green.opacity(0.2) : Color.secondary.opacity(0.2), in: Capsule())
                .foregroundStyle(board.live ? .green : .secondary)
        }
    }
}

struct WatchTrainRow: View {
    let train: BoardTrain
    let now: Date
    let isTracked: Bool

    private var statusColor: Color {
        switch train.status {
        case .cancelled: return .red
        case .late: return .orange
        case .onTime: return .green
        default: return .secondary
        }
    }

    private var statusBadge: String {
        switch train.status {
        case .cancelled: return "Cancelled"
        case .late: return "+\(train.delayMin ?? 0)m"
        case .early: return "-\(-(train.delayMin ?? 0))m"
        case .onTime: return "On time"
        case .scheduled: return "Sched"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .center) {
                // Train number and kind
                Text(train.train)
                    .font(.headline.monospacedDigit())
                Text(train.kind)
                    .font(.system(size: 9, weight: .bold))
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(Color.secondary.opacity(0.2), in: RoundedRectangle(cornerRadius: 3))
                    .foregroundStyle(.secondary)

                if isTracked {
                    Image(systemName: "location.fill")
                        .font(.caption2)
                        .foregroundStyle(Color.accentColor)
                }

                Spacer()

                // Countdown until departure
                if train.status != .cancelled {
                    Text(Clock.until(train.predDep, now: now))
                        .font(.headline.monospacedDigit())
                        .foregroundStyle(Color.accentColor)
                }
            }

            HStack(alignment: .firstTextBaseline) {
                // Departure time
                Text(Clock.time(train.predDep))
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .strikethrough(train.status == .cancelled)

                if train.predDep != train.dep {
                    Text(Clock.time(train.dep))
                        .font(.caption2.monospacedDigit())
                        .strikethrough()
                        .foregroundStyle(.secondary)
                }

                Text("→ \(Clock.time(train.predArr))")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)

                Spacer()

                // Delay / status indicator
                Text(statusBadge)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(statusColor)
            }
        }
        .padding(.vertical, 2)
    }
}

struct WatchTrackedCard: View {
    @Environment(WatchModel.self) private var model
    let tracked: TrackedWithProgress
    let now: Date

    var body: some View {
        let p = tracked.progress
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Label("Train \(p.train)", systemImage: "location.fill")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(Color.accentColor)
                Spacer()
                if let d = p.delayMin, d >= 2 {
                    Text("+\(d)m")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.orange)
                }
            }

            if let next = p.next, next.id != p.to.id {
                Text("Next: \(next.name) (\(Clock.time(next.pred)))")
                    .font(.caption2)
                    .foregroundStyle(.primary)
            }

            Text("Arrives \(Clock.time(p.predArr)) · in \(Clock.until(p.predArr, now: now))")
                .font(.caption2)
                .foregroundStyle(.secondary)

            Button("Stop tracking", role: .destructive) {
                Task { await model.untrack() }
            }
            .font(.caption2)
            .padding(.top, 2)
        }
        .padding(.vertical, 4)
    }
}
