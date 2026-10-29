import HeadwayKit
import SwiftUI

/// The Trains tab: the commute for the time of day (or a pair picked here), the next trains with
/// live delays, Caltrain's alerts, and the tracked train. Swipe a train to track it.
struct BoardView: View {
    @Environment(AppModel.self) private var model
    enum BoardSort: String, CaseIterable, Identifiable {
        case leaving = "Leaving"
        case arriving = "Arriving"
        var id: String { rawValue }
    }

    @State private var picking = false
    @State private var now = Date()
    @State private var sort: BoardSort = .leaving
    private let tick = Timer.publish(every: 20, on: .main, in: .common).autoconnect()

    private func displayedTrains(_ trains: [BoardTrain]) -> [BoardTrain] {
        switch sort {
        case .leaving:
            return trains
        case .arriving:
            return trains.sorted { x, y in
                if x.status == .cancelled && y.status != .cancelled { return false }
                if y.status == .cancelled && x.status != .cancelled { return true }
                return x.predArr < y.predArr
            }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                if let t = model.tracked {
                    Section("Tracking") { TrackedRow(tracked: t, now: now) }
                }
                if let b = model.board {
                    if let tip = b.tip {
                        Section {
                            InsightBanner(tip: tip)
                        }
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                        .listRowBackground(Color.clear)
                    }

                    if let walk = b.walkMinutes {
                        Section {
                            CatchCard(board: b, walkMinutes: walk, now: now)
                        }
                        .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 4, trailing: 0))
                        .listRowBackground(Color.clear)
                    }

                    Section {
                        ForEach(displayedTrains(b.trains)) { train in
                            TrainRow(train: train, destinationShort: b.to.short, now: now, tracked: model.tracked?.tripId == train.tripId)
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
                        if b.trains.isEmpty {
                            VStack(spacing: 6) {
                                Text(model.expressPreference == .expressOnly ? "No express trains scheduled today for this route." : "No more trains today.")
                                    .foregroundStyle(.secondary)
                                if model.expressPreference == .expressOnly {
                                    Button("Show all trains") { Task { await model.setExpressPreference(.all) } }
                                        .font(.subheadline)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 8)
                        }
                    } header: {
                        VStack(alignment: .leading, spacing: 8) {
                            BoardHeader(board: b)
                            HStack(spacing: 8) {
                                Picker("Sort", selection: $sort) {
                                    ForEach(BoardSort.allCases) { s in Text(s.rawValue).tag(s) }
                                }
                                .pickerStyle(.segmented)

                                Picker("", selection: Binding(get: { model.expressPreference }, set: { pref in Task { await model.setExpressPreference(pref) } })) {
                                    ForEach(ExpressPreference.allCases, id: \.self) { pref in
                                        Text(pref.title).tag(pref)
                                    }
                                }
                                .labelsHidden()
                                .pickerStyle(.menu)
                                .buttonStyle(.bordered)
                            }
                            .padding(.top, 2)
                        }
                        .textCase(nil)
                    } footer: {
                        Text(b.live ? "Ride times and leave-by use live Caltrain feeds. A train is overtaken when a later departure reaches your destination first." : "No fresh live data: these are timetable times.")
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

struct InsightBanner: View {
    let tip: BoardTip

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "bolt.fill")
                .font(.body.weight(.bold))
                .foregroundStyle(.red)
                .frame(width: 32, height: 32)
                .background(Color.red.opacity(0.15), in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                Text("Wait for \(tip.waitFor) \(tip.waitForKind == "EXP" ? "Express" : tip.waitForKind)")
                    .font(.subheadline.weight(.bold))
                Text("\(tip.insteadOf) is delayed. \(tip.waitFor) leaves after it and gets to your stop \(tip.savesMin) min sooner: \(Clock.time(tip.waitForArr)) instead of \(Clock.time(tip.insteadOfArr)).")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct CatchCard: View {
    let board: Board
    let walkMinutes: Int
    let now: Date

    private var leaveTrain: BoardTrain? {
        board.trains.first(where: { $0.catchState == "leave" && $0.status != .cancelled })
    }

    private var runTrain: BoardTrain? {
        board.trains.first(where: { $0.catchState == "run" && $0.status != .cancelled })
    }

    var body: some View {
        let targetTrain = leaveTrain ?? runTrain
        if let train = targetTrain, let leaveBy = train.leaveBy {
            let isRun = train.catchState == "run"
            let minutesLeft = max(0, Int(round((leaveBy - now.timeIntervalSince1970 * 1000) / 60_000)))
            let depMinutesLeft = max(0, Int(round((train.predDep - now.timeIntervalSince1970 * 1000) / 60_000)))

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Label("\(walkMinutes) min walk to \(board.from.short)", systemImage: "figure.walk")
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.secondary)
                    Spacer()
                }

                HStack(alignment: .center, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        if isRun {
                            HStack(spacing: 6) {
                                Text("RUN")
                                    .font(.caption.weight(.heavy))
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.orange.opacity(0.2), in: Capsule())
                                    .foregroundStyle(.orange)
                                Text("for \(train.train)")
                                    .font(.title2.weight(.bold))
                            }
                        } else {
                            HStack(alignment: .firstTextBaseline, spacing: 4) {
                                Text("Leave in")
                                    .font(.title2)
                                Text(Clock.until(leaveBy, now: now))
                                    .font(.title2.weight(.bold))
                                    .foregroundStyle(Color.accentColor)
                            }
                        }

                        let delayText = (train.delayMin ?? 0) > 0 ? " (\(train.delayMin!) min late)" : ""
                        Text("for \(train.train) at \(Clock.time(train.predDep))\(delayText) · leave by \(Clock.time(leaveBy))")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    // Ring timer
                    ZStack {
                        Circle()
                            .stroke(Color.secondary.opacity(0.2), lineWidth: 4)
                        Circle()
                            .trim(from: 0, to: isRun ? 1.0 : min(1.0, max(0.05, Double(minutesLeft) / Double(max(1, walkMinutes + 15)))))
                            .stroke(isRun ? Color.orange : Color.accentColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                        Text("\(isRun ? depMinutesLeft : minutesLeft)")
                            .font(.system(size: 15, weight: .bold).monospacedDigit())
                            .foregroundStyle(isRun ? .orange : .primary)
                    }
                    .frame(width: 44, height: 44)
                }

                if let run = runTrain, run.tripId != train.tripId {
                    let runDepLeft = max(0, Int(round((run.predDep - now.timeIntervalSince1970 * 1000) / 60_000)))
                    HStack(spacing: 6) {
                        Image(systemName: "bolt.fill")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                        Text("\(run.train) at \(Clock.time(run.predDep)) needs a run: \(runDepLeft) min left, your walk is \(walkMinutes)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 2)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}

struct TrainRow: View {
    let train: BoardTrain
    var destinationShort: String? = nil
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
            VStack(alignment: .leading, spacing: 3) {
                Text(train.train).font(.headline.monospacedDigit())
                if train.isExpress {
                    HStack(spacing: 3) {
                        Image(systemName: "bolt.fill").font(.system(size: 8, weight: .bold))
                        Text("EXPRESS").font(.system(size: 9, weight: .bold))
                    }
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Color.red.opacity(0.18), in: Capsule())
                    .foregroundStyle(.red)
                } else if train.kind == "LTD" {
                    Text(train.kindName)
                        .font(.system(size: 10, weight: .medium))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1.5)
                        .background(Color.orange.opacity(0.15), in: Capsule())
                        .foregroundStyle(.orange)
                } else {
                    Text(train.kindName).font(.caption).foregroundStyle(.secondary)
                }
            }
            .frame(width: 78, alignment: .leading)
            VStack(alignment: .leading, spacing: 3) {
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
                    if train.isExpress {
                        Text("·").foregroundStyle(.secondary)
                        Text("⚡ Faster").foregroundStyle(.red).font(.caption.weight(.semibold))
                    }
                    if tracked { Image(systemName: "location.fill").foregroundStyle(Color.accentColor).accessibilityLabel("Tracking") }
                }
                .font(.caption)

                if train.status != .cancelled && (train.firstIn == true || train.shortest == true || train.overtakenByTrain != nil || (train.rideMin ?? 0) > 0) {
                    HStack(spacing: 5) {
                        if train.firstIn == true {
                            Text("First to \(destinationShort ?? "SF")")
                                .font(.system(size: 10, weight: .semibold))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1.5)
                                .background(Color.blue.opacity(0.15), in: Capsule())
                                .foregroundStyle(.blue)
                        }
                        if train.shortest == true {
                            Text("Shortest ride")
                                .font(.system(size: 10, weight: .semibold))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1.5)
                                .background(Color.green.opacity(0.18), in: Capsule())
                                .foregroundStyle(.green)
                        }
                        if let overtaker = train.overtakenByTrain {
                            Text("Overtaken by \(overtaker)")
                                .font(.system(size: 10, weight: .medium))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1.5)
                                .background(Color.secondary.opacity(0.15), in: Capsule())
                                .foregroundStyle(.secondary)
                        }
                        if let r = train.rideMin, r > 0 {
                            Text("\(r)m ride")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.top, 1)
                }
            }
            Spacer()
            if train.status != .cancelled {
                if let catchState = train.catchState, let leaveBy = train.leaveBy {
                    VStack(alignment: .trailing, spacing: 2) {
                        if catchState == "run" {
                            Text("RUN")
                                .font(.caption.weight(.heavy))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.orange.opacity(0.2), in: Capsule())
                                .foregroundStyle(.orange)
                            let leftM = max(0, Int(round((train.predDep - now.timeIntervalSince1970 * 1000) / 60_000)))
                            Text("\(leftM) min left")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        } else if catchState == "missed" {
                            Text("Missed")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        } else {
                            Text("Leave \(Clock.time(leaveBy))")
                                .font(.subheadline.weight(.semibold).monospacedDigit())
                                .foregroundStyle(catchState == "leave" ? Color.accentColor : Color.primary)
                            Text("in \(Clock.until(leaveBy, now: now))")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                } else {
                    Text(Clock.until(train.predDep, now: now)).font(.headline.monospacedDigit())
                }
            }
        }
        .opacity(train.overtakenByTrain != nil ? 0.7 : 1.0)
        .accessibilityElement(children: .combine)
    }
}

struct ShareItem: Identifiable {
    let id = UUID()
    let url: URL
    let message: String
}

#if os(iOS)
struct ActivityViewController: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
#endif

struct TrackedRow: View {
    @Environment(AppModel.self) private var model
    let tracked: TrackedWithProgress
    let now: Date
    @State private var shareItem: ShareItem?
    @State private var sharing = false

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
            HStack {
                Label("Lock Screen & Dynamic Island", systemImage: "dot.radiowaves.left.and.right")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("Active")
                    .font(.caption.bold())
                    .foregroundStyle(Color.accentColor)
            }
            .padding(.top, 2)
            HStack(spacing: 16) {
                Button {
                    Task {
                        sharing = true
                        defer { sharing = false }
                        do {
                            let res = try await model.shareEta()
                            if let url = URL(string: res.url) {
                                let msg = "On Caltrain \(p.train), arriving \(p.to.name) at \(Clock.time(p.predArr)). Follow it live: \(res.url)"
                                shareItem = ShareItem(url: url, message: msg)
                            }
                        } catch {
                            model.error = "Couldn't create share link: \(error.localizedDescription)"
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Label("Share live ETA", systemImage: "square.and.arrow.up")
                        if sharing {
                            ProgressView().controlSize(.small)
                        }
                    }
                }
                .font(.subheadline)
                .disabled(sharing)

                Spacer()

                Button("Stop tracking", role: .destructive) { Task { await model.untrack() } }.font(.subheadline)
            }
            .padding(.top, 4)
        }
        #if os(iOS)
        .sheet(item: $shareItem) { item in
            ActivityViewController(activityItems: [item.message, item.url])
        }
        #endif
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
