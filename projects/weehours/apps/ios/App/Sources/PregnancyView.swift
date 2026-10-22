import LogCore
import SwiftUI

/// Now's tiles for a child not born yet: "Baby moved" (one tap) and "Count kicks" (a timed count
/// to ten). Both log for every expected child in the Log-for target.
struct PregnancyTiles: View {
    @EnvironmentObject var model: AppModel
    let babies: [UUID]
    @State private var counting = false

    var body: some View {
        ActionTile(title: "Baby moved", subtitle: movedText, icon: "hand.point.up.left.fill", color: Theme.bump,
                   action: { model.log("movement", for: babies) },
                   backdate: { at in model.log("movement", at: at, for: babies) })
            .accessibilityIdentifier("babyMoved")
        Button { counting = true } label: {
            Tile(title: "Count kicks", subtitle: lastCountText, icon: "timer", color: Theme.bump)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("countKicks")
        .sheet(isPresented: $counting) {
            KickCountSheet(babies: babies).presentationDetents([.large])
        }
    }

    private var entries: [LogEvent] { babies.flatMap { model.logs[$0]?.counted ?? [] } }

    private var movedText: String {
        let today = entries.filter { $0.type == "movement" && Calendar.current.isDateInToday($0.occurredAt) }.count
        return today == 0 ? "tap when you feel one" : "\(today) today"
    }

    private var lastCountText: String {
        guard let last = entries.filter({ $0.type == "kick_count" }).max(by: { $0.occurredAt < $1.occurredAt }),
              let count = last.number("count") else { return "time ten movements" }
        let minutes = last.number("minutes").map { " in \(Int($0))m" } ?? ""
        return "\(Int(count))\(minutes) · \(StatusSnapshot.ago(Date().timeIntervalSince(last.occurredAt)))"
    }
}

/// Counting movements: tap each one you feel; at ten the count is saved with how long it took.
/// Every tap is also a "Baby moved" entry, so a count stopped early still leaves its movements in
/// the log. Stopping early saves the count so far.
struct KickCountSheet: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let babies: [UUID]
    static let goal = 10

    @State private var start: Date?
    @State private var count = 0
    @State private var saved: (count: Int, minutes: Int)?

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                if let saved {
                    VStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill").font(.system(size: 56)).foregroundStyle(Theme.bump)
                        Text("\(saved.count) movements in \(saved.minutes) min").font(.title2.weight(.semibold))
                        Text("Saved to the log").foregroundStyle(.secondary)
                    }
                    .padding(.top, 32)
                } else {
                    SwiftUI.TimelineView(.periodic(from: .now, by: 1)) { context in
                        VStack(spacing: 6) {
                            Text("\(count) of \(Self.goal)").font(.system(size: 44, weight: .bold, design: .rounded)).monospacedDigit()
                            Text(start.map { Self.clock(context.date.timeIntervalSince($0)) } ?? "Tap when you feel a movement")
                                .font(.headline).foregroundStyle(.secondary).monospacedDigit()
                        }
                    }
                    .padding(.top, 24)
                    Button(action: tap) {
                        Label("Moved", systemImage: "hand.point.up.left.fill")
                            .font(.title.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 180)
                            .background(Theme.bump.opacity(0.22), in: RoundedRectangle(cornerRadius: 28))
                            .foregroundStyle(.primary)
                    }
                    .buttonStyle(.plain)
                    .sensoryFeedback(.impact, trigger: count)
                    .accessibilityIdentifier("kickCountTap")
                }
                RecentCounts(babies: babies)
                Spacer(minLength: 0)
                Text("Count when your baby is usually active. Every baby has their own pattern, and this count doesn't replace your midwife or doctor. If your baby is moving less than usual, or their pattern changes, contact your maternity unit or midwife straight away. Don't wait until the next day.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            .padding()
            .navigationTitle("Count kicks")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    if saved == nil && count > 0 {
                        Button("Stop") { finish(); dismiss() }
                    } else {
                        Button(saved == nil ? "Cancel" : "Done") { dismiss() }
                    }
                }
            }
        }
        .interactiveDismissDisabled(saved == nil && count > 0)
    }

    private func tap() {
        let now = Date()
        if start == nil { start = now }
        model.log("movement", at: now, for: babies)
        count += 1
        if count >= Self.goal { finish() }
    }

    /// Saves the count (from its first movement) once: at ten, or when stopped early.
    private func finish() {
        guard saved == nil, let start, count > 0 else { return }
        let minutes = max(1, Int((Date().timeIntervalSince(start) / 60).rounded()))
        model.log("kick_count", ["count": .number(Double(count)), "minutes": .number(Double(minutes))], at: start, for: babies)
        saved = (count, minutes)
    }

    static func clock(_ seconds: TimeInterval) -> String {
        let s = max(0, Int(seconds))
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}

/// The last few kick counts, newest first: how long ten movements took, day by day.
struct RecentCounts: View {
    @EnvironmentObject var model: AppModel
    let babies: [UUID]

    var body: some View {
        let counts = babies.flatMap { model.logs[$0]?.counted ?? [] }
            .filter { $0.type == "kick_count" }
            .sorted { $0.occurredAt > $1.occurredAt }
            .prefix(5)
        if !counts.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Recent counts").font(.subheadline.weight(.semibold))
                ForEach(Array(counts), id: \.id) { e in
                    HStack {
                        Text(e.occurredAt.formatted(.dateTime.weekday(.abbreviated).hour().minute()))
                        Spacer()
                        Text("\(Int(e.number("count") ?? 0)) in \(Int(e.number("minutes") ?? 0)) min").monospacedDigit()
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
        }
    }
}
