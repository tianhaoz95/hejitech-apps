import LogCore
import SwiftUI

/// Settings → Timeline: "Today vs yesterday" at the top of Now (on by default).
enum NowRhythm {
    static let key = "nowRhythmCompare"
}

/// Today and yesterday as two 24-hour ribbons aligned by clock time: sleep as bars, feeds as
/// ticks, diapers as dots, with how today compares to yesterday at the same time of day. Tap a
/// mark to open its entry. Shown on Now when the setting is on (the Timeline has the day strip).
struct RhythmCompare: View {
    let log: DerivedLog
    let child: UUID?
    let household: Household
    let onSelect: (LogEvent) -> Void
    @State private var now = Date()
    private let tick = Timer.publish(every: 60, on: .main, in: .common).autoconnect()

    struct Mark { let kind: Kind; let from: Double; let to: Double; let event: UUID? }
    enum Kind { case sleep, feed, diaper, cluster }

    private var cal: Calendar { Calendar.current }

    var body: some View {
        let today = cal.startOfDay(for: now)
        let yesterday = cal.date(byAdding: .day, value: -1, to: today) ?? today
        let cutoff = yesterday.addingTimeInterval(now.timeIntervalSince(today))
        let t = totals(from: today, to: now), y = totals(from: yesterday, to: cutoff)
        let cluster = clusterFeeding(today)
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Today vs yesterday").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                HStack(spacing: 8) {
                    legend(Theme.sleep, "Sleep"); legend(Theme.feed, "Feed"); legend(Theme.diaper, "Diaper")
                }
            }
            ribbon("Today", start: today, extra: cluster.map { [Mark(kind: .cluster, from: frac($0.0, in: today), to: frac($0.1, in: today), event: nil)] } ?? [], nowMark: frac(now, in: today))
            ribbon("Yest", start: yesterday, extra: [], nowMark: frac(cutoff, in: yesterday))
            HStack(spacing: 0) {
                Spacer().frame(width: 42)
                ForEach(Array(["12a", "6a", "12p", "6p", "12a"].enumerated()), id: \.offset) { i, h in
                    Text(h).font(.system(size: 9)).foregroundStyle(.tertiary)
                    if i < 4 { Spacer(minLength: 0) }
                }
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    chip("moon.zzz.fill", Theme.sleep, "Sleep \(StatusSnapshot.duration(t.sleep))", delta(t.sleep - y.sleep, minutes: true))
                    chip("waterbottle.fill", Theme.feed, "\(t.feeds) feed\(t.feeds == 1 ? "" : "s")", delta(Double(t.feeds - y.feeds)))
                    if t.ml > 0 || y.ml > 0 { chip("drop.fill", Theme.feed, "\(Int(t.ml)) ml", delta(t.ml - y.ml, unit: " ml")) }
                    chip("humidity.fill", Theme.diaper, "\(t.diapers) diaper\(t.diapers == 1 ? "" : "s")", delta(Double(t.diapers - y.diapers)))
                    if let cluster {
                        chip("bolt.heart.fill", .red, "Cluster feeding \(cluster.0.formatted(date: .omitted, time: .shortened))–\(cluster.1.formatted(date: .omitted, time: .shortened))", nil)
                    }
                }
            }
            Text("Compared with yesterday up to \(now.formatted(date: .omitted, time: .shortened))").font(.system(size: 10)).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 4)
        .onReceive(tick) { now = $0 }
        .accessibilityIdentifier("rhythmCompare")
    }

    // MARK: data

    private var sessions: [Session] { log.sessions.filter { child == nil || $0.babyId == child } }
    private var events: [LogEvent] { log.counted.filter { child == nil || $0.babyId == child } }

    /// Position in the day by clock time (so both ribbons line up even across a DST change).
    private func frac(_ d: Date, in dayStart: Date) -> Double {
        guard let next = cal.date(byAdding: .day, value: 1, to: dayStart) else { return 0 }
        if d <= dayStart { return 0 }
        if d >= next { return 1 }
        let c = cal.dateComponents([.hour, .minute], from: d)
        return Double((c.hour ?? 0) * 60 + (c.minute ?? 0)) / 1440
    }

    private func marks(_ dayStart: Date) -> [Mark] {
        guard let next = cal.date(byAdding: .day, value: 1, to: dayStart) else { return [] }
        var out: [Mark] = []
        for s in sessions where s.kind == .sleep {
            guard let start = s.start else { continue }
            let end = s.end ?? (s.isOpen ? now : start)
            guard end > dayStart, start < next else { continue }
            out.append(Mark(kind: .sleep, from: frac(max(start, dayStart), in: dayStart), to: frac(min(end, next), in: dayStart), event: s.startEvent))
        }
        for s in sessions where s.kind != .sleep && s.anchor >= dayStart && s.anchor < next {
            let f = frac(s.anchor, in: dayStart)
            out.append(Mark(kind: .feed, from: f, to: f, event: s.startEvent ?? s.endEvent))
        }
        for e in events where (e.type == "diaper" || e.type == "feed.solids") && e.occurredAt >= dayStart && e.occurredAt < next {
            let f = frac(e.occurredAt, in: dayStart)
            out.append(Mark(kind: e.type == "diaper" ? .diaper : .feed, from: f, to: f, event: e.id))
        }
        return out
    }

    private func totals(from: Date, to: Date) -> (sleep: Double, feeds: Int, ml: Double, diapers: Int) {
        var sleep = 0.0, feeds = 0, ml = 0.0
        for s in sessions {
            if s.kind == .sleep, let start = s.start {
                let end = s.end ?? (s.isOpen ? now : start)
                sleep += max(0, min(end, to).timeIntervalSince(max(start, from)))
            } else if s.kind != .sleep, s.anchor >= from, s.anchor < to {
                feeds += 1
                if s.kind == .bottle {
                    ml += s.consumedMl ?? (s.consumedFraction.map { $0 * household.bottleMl(for: s.babyId) } ?? 0)
                }
            }
        }
        let diapers = events.filter { $0.type == "diaper" && $0.occurredAt >= from && $0.occurredAt < to }.count
        return (sleep, feeds, ml, diapers)
    }

    /// Four or more feeds starting within three hours today: the stretch they cover.
    private func clusterFeeding(_ today: Date) -> (Date, Date)? {
        let starts = sessions.filter { $0.kind != .sleep && $0.anchor >= today }.map(\.anchor).sorted()
        guard starts.count >= 4 else { return nil }
        var best: (Date, Date)?
        for i in 0...(starts.count - 4) {
            var j = i + 3
            guard starts[j].timeIntervalSince(starts[i]) <= 3 * 3600 else { continue }
            while j + 1 < starts.count, starts[j + 1].timeIntervalSince(starts[i]) <= 3 * 3600 { j += 1 }
            if best == nil || starts[j] > best!.1 { best = (starts[i], starts[j]) }
        }
        return best
    }

    // MARK: views

    private func ribbon(_ label: String, start: Date, extra: [Mark], nowMark: Double) -> some View {
        let items = extra + marks(start)
        return HStack(spacing: 8) {
            Text(label).font(.caption2.weight(.semibold)).foregroundStyle(.secondary).frame(width: 34, alignment: .leading)
            GeometryReader { geo in
                let w = geo.size.width
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 5).fill(Color(.tertiarySystemFill))
                    ForEach(Array(items.enumerated()), id: \.offset) { _, m in
                        switch m.kind {
                        case .cluster:
                            RoundedRectangle(cornerRadius: 5).fill(Color.red.opacity(0.18))
                                .frame(width: max(6, (m.to - m.from) * w)).offset(x: m.from * w)
                        case .sleep:
                            RoundedRectangle(cornerRadius: 3).fill(Theme.sleep.opacity(0.85))
                                .frame(width: max(3, (m.to - m.from) * w), height: 14).offset(x: m.from * w)
                        case .feed:
                            Capsule().fill(Theme.feed).frame(width: 3, height: 22).offset(x: min(w - 3, m.from * w - 1.5))
                        case .diaper:
                            Circle().fill(Theme.diaper).frame(width: 6, height: 6).offset(x: min(w - 6, max(0, m.from * w - 3)), y: 8)
                        }
                    }
                    if nowMark > 0, nowMark < 1 {
                        Rectangle().fill(Color.primary.opacity(0.35)).frame(width: 1, height: 26).offset(x: nowMark * w)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture { p in
                    let x = p.x / max(1, w)
                    // nearest tick or dot within ~12pt, else a sleep bar under the finger
                    let points = items.filter { $0.kind == .feed || $0.kind == .diaper }
                    if let hit = points.min(by: { abs($0.from - x) < abs($1.from - x) }), abs(hit.from - x) * w < 12, let id = hit.event {
                        select(id)
                    } else if let bar = items.first(where: { $0.kind == .sleep && x >= $0.from && x <= $0.to }), let id = bar.event {
                        select(id)
                    }
                }
            }
            .frame(height: 26)
        }
    }

    private func select(_ id: UUID) {
        if let e = log.all.first(where: { $0.id == id }) { onSelect(e) }
    }

    private func legend(_ color: Color, _ label: String) -> some View {
        HStack(spacing: 3) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label).font(.system(size: 10)).foregroundStyle(.secondary)
        }
    }

    private func delta(_ d: Double, minutes: Bool = false, unit: String = "") -> String? {
        if minutes {
            guard abs(d) >= 60 else { return "same" }
            return (d > 0 ? "+" : "−") + StatusSnapshot.duration(abs(d))
        }
        guard d != 0 else { return "same" }
        return (d > 0 ? "+" : "−") + "\(Int(abs(d).rounded()))\(unit)"
    }

    private func chip(_ icon: String, _ color: Color, _ text: String, _ delta: String?) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.caption2).foregroundStyle(color)
            Text(text).font(.caption.weight(.medium))
            if let delta { Text(delta).font(.caption).foregroundStyle(.secondary) }
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background(Color(.tertiarySystemFill), in: Capsule())
    }
}

