import LogCore
import SwiftUI

// The Timeline shows one day at a time: a date bar, the day as a 24-hour strip of icons (night
// hours shaded), a summary of the day's counts that opens into a comparison with the day before,
// then the day's entries. Search looks across every day instead.

/// ‹ Fri, Oct 23 › with a calendar behind the date and a way back to today.
struct DayBar: View {
    @Binding var day: Date
    @State private var picking = false
    private var cal: Calendar { Calendar.current }
    private var isToday: Bool { cal.isDateInToday(day) }

    var body: some View {
        HStack(spacing: 4) {
            Button { shift(-1) } label: { Image(systemName: "chevron.left").frame(width: 36, height: 36) }
                .accessibilityLabel("Previous day")
            Button { picking = true } label: {
                Text(title).font(.headline).foregroundStyle(.primary)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color(.tertiarySystemFill), in: Capsule())
            }
            .accessibilityIdentifier("timelineDay")
            Button { shift(1) } label: { Image(systemName: "chevron.right").frame(width: 36, height: 36) }
                .disabled(isToday)
                .accessibilityLabel("Next day")
            Spacer()
            if !isToday {
                Button("Today") { withAnimation(.snappy) { day = cal.startOfDay(for: Date()) } }
                    .font(.subheadline.weight(.semibold))
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(Theme.accent)
        .sheet(isPresented: $picking) {
            DatePicker("Day", selection: Binding(get: { day }, set: { day = cal.startOfDay(for: $0); picking = false }),
                       in: ...Date(), displayedComponents: .date)
                .datePickerStyle(.graphical)
                .padding()
                .presentationDetents([.medium])
        }
    }

    private var title: String {
        let date = day.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
        if isToday { return "Today · \(date)" }
        if cal.isDateInYesterday(day) { return "Yesterday · \(date)" }
        return date
    }

    private func shift(_ by: Int) {
        guard let d = cal.date(byAdding: .day, value: by, to: day), d <= Date() else { return }
        withAnimation(.snappy) { day = cal.startOfDay(for: d) }
    }
}

/// One day as a horizontally scrolling 24-hour strip: feeds, diapers and everything else as icons at
/// their time, sleep as bars, night hours shaded with a moon (a sun for the day), and a line at now.
/// Tap an icon or bar to open its entry.
struct DayStrip: View {
    let day: Date
    let log: DerivedLog
    let child: UUID?
    let household: Household
    let onSelect: (LogEvent) -> Void
    @State private var now = Date()
    @State private var position = ScrollPosition(edge: .leading)
    private let tick = Timer.publish(every: 60, on: .main, in: .common).autoconnect()

    static let hourWidth: CGFloat = 34
    private static let laneHeight: CGFloat = 26
    private var cal: Calendar { Calendar.current }

    enum Lane: Int, CaseIterable { case feed, diaper, sleep, other }
    struct Mark: Identifiable {
        let id: String
        let lane: Lane
        let from: Double
        let to: Double
        let icon: String
        let color: Color
        let event: UUID?
    }

    var body: some View {
        let marks = self.marks
        let lanes = Lane.allCases.filter { l in l == .feed || l == .diaper || marks.contains { $0.lane == l } }
        let width = Self.hourWidth * 24
        ScrollView(.horizontal, showsIndicators: false) {
                ZStack(alignment: .topLeading) {
                    background(width: width, lanes: lanes.count)
                    ForEach(marks) { m in
                        if let row = lanes.firstIndex(of: m.lane) { mark(m, row: row, width: width) }
                    }
                    if cal.isDate(now, inSameDayAs: day) {
                        Capsule().fill(Theme.accent).frame(width: 2, height: CGFloat(lanes.count) * Self.laneHeight + 8)
                            .offset(x: frac(now) * width - 1, y: 34)
                    }
                }
                .frame(width: width, height: 44 + CGFloat(lanes.count) * Self.laneHeight)
        }
        .scrollPosition($position)
        .onAppear { scroll(marks: marks, animated: false) }
        .onChange(of: day) { scroll(marks: self.marks, animated: true) }
        .onReceive(tick) { now = $0 }
        .accessibilityIdentifier("dayStrip")
    }

    // MARK: drawing

    private func background(width: CGFloat, lanes: Int) -> some View {
        let height = 44 + CGFloat(lanes) * Self.laneHeight
        return ZStack(alignment: .topLeading) {
            // night hours shaded
            ForEach(nightSpans, id: \.0) { span in
                Rectangle().fill(Self.nightShade)
                    .frame(width: CGFloat(span.1 - span.0) * Self.hourWidth, height: height)
                    .offset(x: CGFloat(span.0) * Self.hourWidth)
                Image(systemName: "moon.fill").font(.system(size: 10)).foregroundStyle(.secondary)
                    .frame(width: CGFloat(span.1 - span.0) * Self.hourWidth).offset(y: 3)
                    .offset(x: CGFloat(span.0) * Self.hourWidth)
            }
            ForEach(daySpans, id: \.0) { span in
                Image(systemName: "sun.max").font(.system(size: 10)).foregroundStyle(.secondary)
                    .frame(width: CGFloat(span.1 - span.0) * Self.hourWidth).offset(y: 3)
                    .offset(x: CGFloat(span.0) * Self.hourWidth)
            }
            ForEach(0..<25, id: \.self) { h in
                Rectangle().fill(Color.primary.opacity(h % 2 == 0 ? 0.10 : 0.05)).frame(width: 1, height: height - 34)
                    .offset(x: CGFloat(h) * Self.hourWidth, y: 34)
            }
            ForEach(Array(stride(from: 0, through: 22, by: 2)), id: \.self) { h in
                Text(Self.hourLabel(h)).font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
                    .frame(width: 30).offset(x: CGFloat(h) * Self.hourWidth - 15 + (h == 0 ? 15 : 0), y: 16)
            }
        }
        .frame(width: width, height: height, alignment: .topLeading)
    }

    @ViewBuilder
    private func mark(_ m: Mark, row: Int, width: CGFloat) -> some View {
        let y = 40 + CGFloat(row) * Self.laneHeight
        if m.lane == .sleep {
            Capsule().fill(m.color.opacity(0.85))
                .frame(width: max(6, CGFloat(m.to - m.from) * width), height: 12)
                .offset(x: CGFloat(m.from) * width, y: y + 6)
                .onTapGesture { select(m.event) }
        } else {
            Image(systemName: m.icon).font(.system(size: 15, weight: .semibold)).foregroundStyle(m.color)
                .frame(width: 22, height: 22)
                .contentShape(Rectangle())
                .offset(x: min(width - 22, max(0, CGFloat(m.from) * width - 11)), y: y)
                .onTapGesture { select(m.event) }
                .accessibilityLabel(m.icon)
        }
    }

    /// Night hours: grey on a light background, darker than the card in dark mode.
    static let nightShade = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor.black.withAlphaComponent(0.4) : UIColor.systemGray5 })

    static func hourLabel(_ h: Int) -> String {
        h == 0 ? "12a" : h == 12 ? "12p" : "\(h % 12)"
    }

    // MARK: data

    private var next: Date { cal.date(byAdding: .day, value: 1, to: day) ?? day }

    private func frac(_ d: Date) -> Double {
        if d <= day { return 0 }
        if d >= next { return 1 }
        let c = cal.dateComponents([.hour, .minute], from: d)
        return Double((c.hour ?? 0) * 60 + (c.minute ?? 0)) / 1440
    }

    /// Whole hours that are night, as [from, to) runs.
    private var nightSpans: [(Int, Int)] { spans { household.isNight(cal.date(bySettingHour: $0, minute: 30, second: 0, of: day) ?? day) } }
    private var daySpans: [(Int, Int)] { spans { !household.isNight(cal.date(bySettingHour: $0, minute: 30, second: 0, of: day) ?? day) } }

    private func spans(_ include: (Int) -> Bool) -> [(Int, Int)] {
        var out: [(Int, Int)] = []
        var start: Int?
        for h in 0...24 {
            if h < 24, include(h) { if start == nil { start = h } } else if let s = start { out.append((s, h)); start = nil }
        }
        return out
    }

    var marks: [Mark] {
        var out: [Mark] = []
        let sessions = log.sessions.filter { child == nil || $0.babyId == child }
        for s in sessions {
            guard let start = s.start ?? Optional(s.anchor) else { continue }
            if s.kind == .sleep {
                let end = s.end ?? (s.isOpen ? now : start)
                guard end > day, start < next else { continue }
                out.append(Mark(id: "s\(s.startEvent?.uuidString ?? "")\(start.timeIntervalSince1970)", lane: .sleep, from: frac(max(start, day)), to: frac(min(end, next)),
                                icon: "moon.zzz.fill", color: Theme.sleep, event: s.startEvent ?? s.endEvent))
            } else if s.anchor >= day, s.anchor < next {
                let type = s.kind == .bottle ? "feed.bottle.start" : "feed.breast.start"
                out.append(Mark(id: "f\(s.anchor.timeIntervalSince1970)\(s.babyId?.uuidString ?? "")", lane: .feed, from: frac(s.anchor), to: frac(s.anchor),
                                icon: Theme.icon(for: type), color: Theme.color(for: type), event: s.startEvent ?? s.endEvent))
            }
        }
        for e in log.counted where (child == nil || e.babyId == child) && e.occurredAt >= day && e.occurredAt < next {
            let t = e.type
            if t.hasPrefix("feed.bottle") || t.hasPrefix("feed.breast") || t.hasPrefix("sleep.") || SystemType.all.contains(t) && t != SystemType.note { continue }
            let lane: Lane = t == "diaper" || t == "potty" ? .diaper : t.hasPrefix("feed") || t == "pump" ? .feed : .other
            out.append(Mark(id: e.id.uuidString, lane: lane, from: frac(e.occurredAt), to: frac(e.occurredAt),
                            icon: Theme.icon(for: t), color: Theme.color(for: t), event: e.id))
        }
        return out
    }

    private func select(_ id: UUID?) {
        if let id, let e = log.all.first(where: { $0.id == id }) { onSelect(e) }
    }

    /// Today: a few hours before now. Another day: just before its first entry.
    private func scroll(marks: [Mark], animated: Bool) {
        let hour: Int
        if cal.isDate(now, inSameDayAs: day) { hour = max(0, cal.component(.hour, from: now) - 7) }
        else { hour = max(0, Int((marks.map(\.from).min() ?? 0.25) * 24) - 1) }
        let x = CGFloat(min(hour, 14)) * Self.hourWidth
        if animated { withAnimation(.snappy) { position.scrollTo(x: x) } } else { position.scrollTo(x: x) }
    }
}

/// The day in numbers: age, then counts by kind (feeds and ml, diapers, sleep, and each other kind
/// logged). Opens into the comparison with the day before, up to the same time of day for today.
struct DaySummary: View {
    let day: Date
    let log: DerivedLog
    let child: UUID?
    let household: Household
    let babies: [Baby]
    @AppStorage("timelineSummaryOpen") private var open = false
    @State private var now = Date()
    private var cal: Calendar { Calendar.current }

    var body: some View {
        let isToday = cal.isDate(now, inSameDayAs: day)
        let end = isToday ? now : (cal.date(byAdding: .day, value: 1, to: day) ?? day)
        let before = cal.date(byAdding: .day, value: -1, to: day) ?? day
        let cutoff = before.addingTimeInterval(end.timeIntervalSince(day))
        let t = totals(from: day, to: end), y = totals(from: before, to: cutoff)
        VStack(alignment: .leading, spacing: 10) {
            Button { withAnimation(.snappy) { open.toggle() } } label: {
                HStack {
                    Text(heading).font(.subheadline).foregroundStyle(.secondary)
                    Spacer()
                    Image(systemName: "chevron.down").rotationEffect(.degrees(open ? 180 : 0)).foregroundStyle(.secondary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("daySummary")
            FlowRow(spacing: 14) {
                count("waterbottle.fill", Theme.feed, "\(t.feeds)")
                if t.ml > 0 { count("drop.fill", Theme.feed, "\(Int(t.ml)) ml") }
                count("humidity.fill", Theme.diaper, "\(t.diapers)")
                count("moon.zzz.fill", Theme.sleep, StatusSnapshot.duration(t.sleep))
                ForEach(t.others, id: \.type) { o in count(Theme.icon(for: o.type), Theme.color(for: o.type), "\(o.count)") }
            }
            if open {
                Divider()
                Text(isToday ? "Compared with yesterday up to \(now.formatted(date: .omitted, time: .shortened))" : "Compared with the day before")
                    .font(.caption).foregroundStyle(.secondary)
                FlowRow(spacing: 6) {
                    chip("moon.zzz.fill", Theme.sleep, "Sleep \(StatusSnapshot.duration(t.sleep))", delta(t.sleep - y.sleep, minutes: true))
                    chip("waterbottle.fill", Theme.feed, "\(t.feeds) feed\(t.feeds == 1 ? "" : "s")", delta(Double(t.feeds - y.feeds)))
                    if t.ml > 0 || y.ml > 0 { chip("drop.fill", Theme.feed, "\(Int(t.ml)) ml", delta(t.ml - y.ml, unit: " ml")) }
                    chip("humidity.fill", Theme.diaper, "\(t.diapers) diaper\(t.diapers == 1 ? "" : "s")", delta(Double(t.diapers - y.diapers)))
                }
                if let c = clusterFeeding(from: day, to: end) {
                    Label("Cluster feeding \(c.0.formatted(date: .omitted, time: .shortened))–\(c.1.formatted(date: .omitted, time: .shortened))", systemImage: "bolt.heart.fill")
                        .font(.caption.weight(.medium)).foregroundStyle(.red)
                }
            }
        }
        .padding(.vertical, 4)
    }

    /// "Age 1m (week 5)" for one born child, else the day's name.
    private var heading: String {
        if babies.count == 1, let birth = babies[0].birthDate, birth <= day {
            let days = cal.dateComponents([.day], from: cal.startOfDay(for: birth), to: day).day ?? 0
            let months = days / 30
            let age = days < 30 ? "\(days) day\(days == 1 ? "" : "s")" : "\(months)m"
            return "Age \(age) (week \(days / 7 + 1))"
        }
        return cal.isDateInToday(day) ? "Today so far" : day.formatted(.dateTime.weekday(.wide))
    }

    private struct Totals { var sleep = 0.0, feeds = 0, ml = 0.0, diapers = 0, others: [(type: String, count: Int)] = [] }

    private func totals(from: Date, to: Date) -> Totals {
        var t = Totals()
        for s in log.sessions where child == nil || s.babyId == child {
            if s.kind == .sleep, let start = s.start {
                let end = s.end ?? (s.isOpen ? now : start)
                t.sleep += max(0, min(end, to).timeIntervalSince(max(start, from)))
            } else if s.kind != .sleep, s.anchor >= from, s.anchor < to {
                t.feeds += 1
                if s.kind == .bottle { t.ml += s.consumedMl ?? (s.consumedFraction.map { $0 * household.bottleMl(for: s.babyId) } ?? 0) }
            }
        }
        var others: [String: Int] = [:]
        for e in log.counted where (child == nil || e.babyId == child) && e.occurredAt >= from && e.occurredAt < to {
            let ty = e.type
            if ty == "diaper" { t.diapers += 1; continue }
            if ty.hasPrefix("feed.bottle") || ty.hasPrefix("feed.breast") || ty.hasPrefix("sleep.") || SystemType.all.contains(ty) && ty != SystemType.note { continue }
            others[ty, default: 0] += 1
        }
        t.others = others.sorted { ($0.value, $1.key) > ($1.value, $0.key) }.map { (type: $0.key, count: $0.value) }
        return t
    }

    /// Four or more feeds starting within three hours: the stretch they cover.
    private func clusterFeeding(from: Date, to: Date) -> (Date, Date)? {
        let starts = log.sessions.filter { (child == nil || $0.babyId == child) && $0.kind != .sleep && $0.anchor >= from && $0.anchor < to }.map(\.anchor).sorted()
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

    private func count(_ icon: String, _ color: Color, _ text: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.subheadline).foregroundStyle(color)
            Text(text).font(.subheadline.weight(.medium)).monospacedDigit()
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

/// Lays children out left to right, wrapping onto new lines.
struct FlowRow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, line: CGFloat = 0, widest: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x > 0, x + size.width > width { y += line + spacing; x = 0; line = 0 }
            x += size.width + spacing
            line = max(line, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: min(widest, width), height: y + line)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, line: CGFloat = 0
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX { y += line + spacing; x = bounds.minX; line = 0 }
            s.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            line = max(line, size.height)
        }
    }
}

/// The caregiver who logged an entry, as an initial in a circle (the reference's avatar).
struct WhoBadge: View {
    let name: String

    var body: some View {
        Text(String(name.first ?? "?").uppercased())
            .font(.caption2.weight(.bold))
            .foregroundStyle(Theme.accent)
            .frame(width: 24, height: 24)
            .background(Theme.accent.opacity(0.15), in: Circle())
            .accessibilityLabel("Logged by \(name)")
    }
}
