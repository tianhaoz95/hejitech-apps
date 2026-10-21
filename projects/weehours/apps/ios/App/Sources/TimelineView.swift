import LogCore
import SwiftUI

enum TimelineItem: Identifiable {
    case single(LogEvent)
    case session(Session, [LogEvent])

    var id: String {
        switch self {
        case .single(let e): return e.id.uuidString
        case .session(let s, _): return "session-" + s.eventIds.map(\.uuidString).joined(separator: "-")
        }
    }

    var occurredAt: Date {
        switch self {
        case .single(let e): return e.occurredAt
        case .session(let s, let evs): return s.end ?? s.start ?? evs.last?.occurredAt ?? Date()
        }
    }
}

struct TimelineView: View {
    @EnvironmentObject var model: AppModel
    @State private var editing: LogEvent?
    @State private var showUndone = false
    @State private var groupSessions = true
    @State private var search = ""
    @State private var categoryFilter = "all"
    /// Show one child's entries (nil: everyone's).
    @State private var child: UUID?
    /// How much each day shows: a 24-hour grid, the usual cards, or every detail (pinch to change).
    @AppStorage("timelineDensity") private var density = TimelineDensity.cards
    @State private var hourCell: HourCell?

    private var several: Bool { model.household.babies.count > 1 }

    static let categories: [(key: String, label: String)] = [
        ("all", "All"),
        ("feeds", "Feeds"),
        ("diaper", "Diapers"),
        ("sleep", "Sleep"),
        ("health", "Health"),
        ("care", "Care"),
        ("notes", "Notes"),
    ]

    private func matchesCategory(_ e: LogEvent) -> Bool {
        switch categoryFilter {
        case "all": return true
        case "feeds": return e.type.hasPrefix("feed.") || e.type == "pump"
        case "diaper": return e.type == "diaper" || e.type == "potty"
        case "sleep": return e.type.hasPrefix("sleep.")
        case "health": return ["medication", "temperature", "symptom", "doctor_visit", "vaccination", "teething"].contains(e.type)
        case "care": return ["bath", "lotion", "tooth_brushing", "tummy_time", "play_time", "outdoor_walk"].contains(e.type)
        case "notes": return e.type == "note"
        default: return true
        }
    }

    private func matchesSearch(_ e: LogEvent) -> Bool {
        let q = search.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return true }
        let label = VoiceInterpreter.label(type: e.type, fields: e.fields).lowercased()
        if label.contains(q) { return true }
        if let t = e.provenance.rawTranscript?.lowercased(), t.contains(q) { return true }
        for (_, v) in e.fields {
            if let s = v.string?.lowercased(), s.contains(q) { return true }
        }
        return false
    }

    /// Audit mode's line: id, when it was logged, where from, and whether it has uploaded.
    private func audit(_ e: LogEvent) -> String {
        var parts = ["#" + e.id.uuidString.prefix(8).lowercased()]
        parts.append("logged \(e.loggedAt.formatted(date: .omitted, time: .standard))")
        parts.append("\(e.provenance.input.rawValue) on \(e.provenance.surface.rawValue)")
        if let s = e.supersedes { parts.append("edits #" + s.uuidString.prefix(8).lowercased()) }
        if model.localOnly { parts.append("this iPhone only") }
        else { parts.append(model.pending.contains { $0.id == e.id } ? "waiting to upload" : "synced") }
        return parts.joined(separator: " · ")
    }

    private var filteredEvents: [LogEvent] {
        model.log.all
            .filter { !SystemType.all.contains($0.type) || $0.type == SystemType.note }
            .filter { child == nil || $0.babyId == child }
            .filter { showUndone || model.log.status[$0.id] != .undone }
            .filter { model.log.status[$0.id] != .superseded }
            .filter { matchesCategory($0) && matchesSearch($0) }
            .sorted { $0.occurredAt > $1.occurredAt }
    }

    private var days: [(Date, [TimelineItem])] {
        let events = filteredEvents
        if !groupSessions || !search.isEmpty || density == .audit {
            let groups = Dictionary(grouping: events.map { TimelineItem.single($0) }) { Calendar.current.startOfDay(for: $0.occurredAt) }
            return groups.keys.sorted(by: >).map { ($0, groups[$0]!) }
        }
        // Pair completed sessions when grouping is enabled
        var items: [TimelineItem] = []
        var consumedIds: Set<UUID> = []
        let sessions = model.log.sessions.filter { !$0.isOpen && $0.eventIds.count >= 2 }
        let eventsById = Dictionary(uniqueKeysWithValues: events.map { ($0.id, $0) })
        for s in sessions {
            let members = s.eventIds.compactMap { eventsById[$0] }
            if members.count == s.eventIds.count {
                items.append(.session(s, members))
                consumedIds.formUnion(s.eventIds)
            }
        }
        for e in events where !consumedIds.contains(e.id) {
            items.append(.single(e))
        }
        items.sort { $0.occurredAt > $1.occurredAt }
        let groups = Dictionary(grouping: items) { Calendar.current.startOfDay(for: $0.occurredAt) }
        return groups.keys.sorted(by: >).map { ($0, groups[$0]!) }
    }

    var body: some View {
        NavigationStack {
            List {
                if several {
                    Picker("Child", selection: $child) {
                        Text("All").tag(UUID?.none)
                        ForEach(model.shown) { Text($0.name).tag(UUID?.some($0.id)) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(Self.categories, id: \.key) { cat in
                                let on = categoryFilter == cat.key
                                Button {
                                    withAnimation(.snappy) { categoryFilter = cat.key }
                                } label: {
                                    Text(cat.label)
                                        .font(.caption.weight(.semibold))
                                        .padding(.horizontal, 12).padding(.vertical, 6)
                                        .foregroundStyle(on ? .white : .primary)
                                        .background(on ? Theme.accent : Color(.tertiarySystemFill), in: Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                Section {
                    Picker("Detail", selection: $density) {
                        ForEach(TimelineDensity.allCases) { Label($0.title, systemImage: $0.icon).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("timelineDensity")
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }
                if search.isEmpty {
                    Section {
                        RhythmCompare(log: model.log, child: child, household: model.household) { editing = $0 }
                    }
                }
                if days.isEmpty {
                    // a row under the filters and the rhythm card, not an overlay on top of them
                    Section {
                        ContentUnavailableView {
                            Label(search.isEmpty && categoryFilter == "all" ? "Nothing logged yet" : "No matching entries", systemImage: "list.bullet.rectangle")
                        } description: {
                            Text(showUndone
                                 ? "There are no entries matching this view."
                                 : "Feeds, diapers, sleep and measurements show up here as soon as they're logged: tap the mic and say it, or tap a button on Now.")
                        }
                        .listRowBackground(Color.clear)
                    }
                }
                if density == .grid {
                    ForEach(days, id: \.0) { day, _ in
                        Section(day.formatted(date: .complete, time: .omitted)) {
                            HourGrid(day: day, events: filteredEvents.filter { Calendar.current.isDate($0.occurredAt, inSameDayAs: day) }) { hourCell = $0 }
                        }
                    }
                } else {
                ForEach(days, id: \.0) { day, items in
                    Section(day.formatted(date: .complete, time: .omitted)) {
                        ForEach(items) { item in
                            switch item {
                            case .single(let e):
                                EventRow(event: e, status: model.log.status[e.id] ?? .active, who: model.household.caregiverName(e.loggedBy),
                                         ml: model.household.milliliters(e),
                                         child: several ? model.household.baby(e.babyId).map { ($0.name, Theme.color(for: $0, in: model.household)) } : nil,
                                         audit: density == .audit ? audit(e) : nil)
                                    .contentShape(Rectangle())
                                    .onTapGesture { editing = e }
                                    .swipeActions {
                                        if model.log.status[e.id] != .undone {
                                            Button("Undo", role: .destructive) { model.undo(e.id) }
                                        }
                                    }
                            case .session(let s, let members):
                                SessionRow(session: s, events: members, household: model.household, several: several) { tapped in
                                    editing = tapped
                                }
                                .swipeActions {
                                    Button("Undo session", role: .destructive) {
                                        for m in members { model.undo(m.id) }
                                    }
                                }
                            }
                        }
                    }
                }
                }
            }
            .simultaneousGesture(MagnifyGesture().onEnded { v in
                // pinch out for more detail, in for the whole day at a glance
                withAnimation(.snappy) {
                    if v.magnification > 1.25 { density = density.more } else if v.magnification < 0.8 { density = density.less }
                }
            })
            .sheet(item: $hourCell) { cell in
                HourSheet(cell: cell) { e in
                    hourCell = nil
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { editing = e }
                }
                .presentationDetents([.medium, .large])
            }
            .searchable(text: $search, prompt: "Search medicines, notes, foods…")
            .navigationTitle("Timeline")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Toggle(isOn: $groupSessions) { Image(systemName: "rectangle.compress.vertical") }
                        .toggleStyle(.button)
                        .accessibilityLabel("Group paired sessions")
                    Toggle(isOn: $showUndone) { Image(systemName: "arrow.uturn.backward.circle") }
                        .toggleStyle(.button)
                        .accessibilityLabel("Show undone entries")
                }
            }
            .sheet(item: $editing) { e in EditEventView(event: e) }
        }
    }
}

/// Today and yesterday as two 24-hour ribbons aligned by clock time: sleep as bars, feeds as
/// ticks, diapers as dots, with how today compares to yesterday at the same time of day. Tap a
/// mark to open its entry.
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

/// Paired session row (start + switch + finish) rendered as one scannable row.
struct SessionRow: View {
    let session: Session
    let events: [LogEvent]
    let household: Household
    let several: Bool
    let onSelect: (LogEvent) -> Void

    private var iconType: String {
        switch session.kind {
        case .bottle: return "feed.bottle.finish"
        case .breast: return "feed.breast.finish"
        case .sleep: return "sleep.end"
        }
    }

    private var title: String {
        let dur = session.duration.map { StatusSnapshot.duration($0) } ?? ""
        switch session.kind {
        case .bottle:
            let finish = events.last
            let ml = finish.flatMap { household.milliliters($0) }.map { " · \(Int($0)) ml" } ?? ""
            return "Bottle feed · \(dur)\(ml)"
        case .breast:
            let sides = session.sides.joined(separator: " → ")
            return "Nursed (\(sides)) · \(dur)"
        case .sleep:
            return "Slept · \(dur)"
        }
    }

    var body: some View {
        let first = events.first!
        let last = events.last!
        let child = several ? household.baby(first.babyId).map { ($0.name, Theme.color(for: $0, in: household)) } : nil
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: Theme.icon(for: iconType))
                .foregroundStyle(Theme.color(for: iconType))
                .frame(width: 28, height: 28)
                .background(Theme.color(for: iconType).opacity(0.15), in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(title).font(.body.weight(.medium))
                    if let child {
                        Spacer(minLength: 4)
                        Text(child.0).font(.caption.weight(.semibold)).foregroundStyle(child.1)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(child.1.opacity(0.15), in: Capsule())
                    }
                }
                HStack(spacing: 6) {
                    ForEach(events) { e in
                        Button { onSelect(e) } label: {
                            Text("\(shortStep(e)) \(e.occurredAt.formatted(date: .omitted, time: .shortened))")
                                .font(.caption2)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(Color(.tertiarySystemFill), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { onSelect(last) }
    }

    private func shortStep(_ e: LogEvent) -> String {
        if e.type.hasSuffix(".start") { return "Start" }
        if e.type.hasSuffix(".switch") { return "Switch" }
        return "End"
    }
}

struct EventRow: View {
    let event: LogEvent
    let status: EventStatus
    let who: String
    let ml: Double?
    /// The child's name and colour, when the household has several.
    var child: (name: String, color: Color)? = nil
    /// Audit mode: id, provenance and sync state.
    var audit: String? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: Theme.icon(for: event.type))
                .foregroundStyle(Theme.color(for: event.type))
                .frame(width: 28, height: 28)
                .background(Theme.color(for: event.type).opacity(0.15), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(event.type == "note" ? "Note" : VoiceInterpreter.label(type: event.type, fields: event.fields))
                        .strikethrough(status == .undone)
                    if let ml, event.type.hasPrefix("feed.bottle") { Text("\(Int(ml)) ml").foregroundStyle(.secondary) }
                    if let child {
                        Spacer(minLength: 4)
                        Text(child.name).font(.caption.weight(.semibold)).foregroundStyle(child.color)
                            .padding(.horizontal, 8).padding(.vertical, 2)
                            .background(child.color.opacity(0.15), in: Capsule())
                    }
                }
                if let t = event.provenance.rawTranscript {
                    Text("“\(t)”").font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
                HStack(spacing: 6) {
                    Text(event.occurredAt.formatted(date: .omitted, time: .shortened))
                    Text("·")
                    Text(who)
                    Text("·")
                    Image(systemName: Self.surfaceIcon(event.provenance.surface))
                    if let tier = event.provenance.confidenceTier { Text(tier.rawValue.replacingOccurrences(of: "_", with: " ")) }
                    if status == .duplicateUnresolved { Text("duplicate?").foregroundStyle(.orange) }
                    if status == .undone { Text("undone").foregroundStyle(.red) }
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
                if let audit {
                    Text(audit).font(.caption2.monospaced()).foregroundStyle(.tertiary).lineLimit(3)
                    if !event.provenance.confidence.isEmpty {
                        Text(event.provenance.confidence.sorted { $0.key < $1.key }.map { "\($0.key) \(Int($0.value * 100))%" }.joined(separator: " · "))
                            .font(.caption2.monospaced()).foregroundStyle(.tertiary).lineLimit(2)
                    }
                }
            }
        }
        .opacity(status == .undone || status == .merged ? 0.5 : 1)
    }

    static func surfaceIcon(_ s: Surface) -> String {
        switch s {
        case .phone: return "iphone"
        case .watch: return "applewatch"
        case .glasses: return "eyeglasses"
        case .ring: return "circle.circle"
        case .mcp: return "sparkles"
        case .widget: return "square.grid.2x2"
        case .siri: return "waveform"
        }
    }
}

struct EditEventView: View {
    /// Growth entries edit their one number (stored in grams or centimeters).
    static let measureField = ["weight": "grams", "height": "height_cm", "head": "head_cm"]
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let event: LogEvent
    @State private var at = Date()
    @State private var fraction = 0.5
    @State private var consumedMlText = ""
    @State private var kind = "wet"
    @State private var stoolColor: StoolColor?
    @State private var side = "left"
    @State private var measure = ""
    @State private var baby = UUID()
    // Extended fields for complete editor
    @State private var specValues: [String: String] = [:]
    @State private var pumpMl = ""
    @State private var pumpStorage = "fridge"
    @State private var solidsAmount = "some"
    @State private var solidsFoods = ""
    @State private var solidsReaction = "none"
    @State private var noteText = ""
    @State private var noteForDoctor = false
    @State private var repairEndAt = Date()

    private var specFields: [EventRegistry.FieldSpec] {
        EventRegistry.shared.type(event.type)?.fields ?? []
    }

    private var isUnpairedStart: Bool {
        guard ["feed.bottle.start", "feed.breast.start", "sleep.start"].contains(event.type) else { return false }
        return model.log.sessions.contains(where: { $0.startEvent == event.id && $0.isOpen })
    }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("When", selection: $at)
                if model.household.babies.count > 1, !SystemType.all.contains(event.type) {
                    Picker("Child", selection: $baby) {
                        ForEach(model.household.babies.filter { !$0.archived || $0.id == event.babyId }) { Text($0.name).tag($0.id) }
                    }
                }
                if event.type == "feed.bottle.finish" || event.type == "feed.bottle.single" {
                    Picker("Drank", selection: $fraction) {
                        Text("¼").tag(0.25); Text("½").tag(0.5); Text("¾").tag(0.75); Text("All").tag(1.0)
                    }
                    .pickerStyle(.segmented)
                    LabeledContent("Exact ml (optional)") {
                        TextField("—", text: $consumedMlText)
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                }
                if event.type == "diaper" {
                    DiaperDetails(kind: $kind, color: $stoolColor, ageDays: model.household.baby(event.babyId)?.birthDate.map {
                        Calendar.current.dateComponents([.day], from: $0, to: event.occurredAt).day ?? 0
                    })
                }
                if event.fields["side"] != nil {
                    Picker("Side", selection: $side) {
                        Text("Left").tag("left")
                        Text("Right").tag("right")
                        if event.type == "pump" { Text("Both").tag("both") }
                    }
                    .pickerStyle(.segmented)
                }
                if event.type == "pump" {
                    LabeledContent("Amount (ml)") {
                        TextField("120", text: $pumpMl)
                            .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                    }
                    if model.household.trackMilkStash {
                        Picker("Storage", selection: $pumpStorage) {
                            Text("Fridge").tag("fridge")
                            Text("Freezer").tag("freezer")
                            Text("Fed").tag("fed")
                        }
                        .pickerStyle(.segmented)
                    }
                }
                if event.type == "feed.solids" {
                    Picker("Amount", selection: $solidsAmount) {
                        Text("Taste").tag("taste"); Text("Some").tag("some"); Text("Most").tag("most"); Text("All").tag("all")
                    }
                    .pickerStyle(.segmented)
                    TextField("Foods (comma-separated)", text: $solidsFoods)
                    Picker("Reaction", selection: $solidsReaction) {
                        ForEach(SolidsSheet.reactions, id: \.key) { r in Text(r.label).tag(r.key) }
                    }
                }
                if event.type == "note" {
                    TextField("Note", text: $noteText, axis: .vertical).lineLimit(2...5)
                    Toggle("Ask pediatrician at next visit", isOn: $noteForDoctor)
                }
                if !specFields.isEmpty {
                    Section("Details") {
                        ForEach(specFields, id: \.key) { f in
                            let binding = Binding(get: { specValues[f.key] ?? "" }, set: { specValues[f.key] = $0 })
                            if f.kind == "choice", let options = f.options {
                                Picker(f.label ?? f.key.capitalized, selection: binding) {
                                    Text("—").tag("")
                                    ForEach(options, id: \.key) { Text($0.label).tag($0.key) }
                                }
                            } else {
                                LabeledContent(f.label ?? f.key.capitalized) {
                                    TextField("—", text: binding).multilineTextAlignment(.trailing)
                                }
                            }
                        }
                    }
                }
                if let field = Self.measureField[event.type] {
                    LabeledContent(field == "grams" ? "Weight" : "Length") {
                        HStack(spacing: 6) {
                            TextField("—", text: $measure)
                                .keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                            Text(field == "grams" ? "kg" : "cm").foregroundStyle(.secondary)
                        }
                    }
                }
                if isUnpairedStart {
                    Section("Session repair") {
                        DatePicker("Finish time", selection: $repairEndAt, in: at...Date())
                        Button("Add finish entry at this time") {
                            let finishType: String = switch event.type {
                            case "feed.bottle.start": "feed.bottle.finish"
                            case "feed.breast.start": "feed.breast.finish"
                            default: "sleep.end"
                            }
                            var fields: [String: FieldValue] = [:]
                            if finishType == "feed.bottle.finish" { fields["consumed_fraction"] = .number(1.0) }
                            model.log(finishType, fields, at: repairEndAt, for: [event.babyId])
                            dismiss()
                        }
                        if event.type == "feed.bottle.start" {
                            Button("Convert to one-entry bottle (All)") {
                                model.undo(event.id)
                                model.log("feed.bottle.single", ["consumed_fraction": .number(1.0)], at: at, for: [event.babyId])
                                dismiss()
                            }
                        }
                    }
                }
                Section("Provenance") {
                    LabeledContent("Logged by", value: model.household.caregiverName(event.loggedBy))
                    LabeledContent("From", value: "\(event.provenance.surface.rawValue) · \(event.provenance.input.rawValue)")
                    if let m = event.provenance.modelVersion { LabeledContent("Model", value: m) }
                    ForEach(event.provenance.confidence.sorted(by: { $0.key < $1.key }), id: \.key) { k, v in
                        LabeledContent(k, value: String(format: "%.0f%%", v * 100))
                    }
                }
                Section {
                    Button("Undo this entry", role: .destructive) { model.undo(event.id); dismiss() }
                }
            }
            .navigationTitle(VoiceInterpreter.label(type: event.type, fields: [:]))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        var f = event.fields
                        if f["consumed_fraction"] != nil || event.type.hasPrefix("feed.bottle.finish") || event.type == "feed.bottle.single" {
                            if let exact = Growth.number(consumedMlText), exact > 0 {
                                f["consumed_ml"] = .number(exact)
                                f["consumed_fraction"] = nil
                            } else {
                                f["consumed_fraction"] = .number(fraction)
                                f["consumed_ml"] = nil
                            }
                        }
                        if event.type == "diaper" {
                            f["kind"] = .string(kind)
                            f["stool_color"] = kind == "dirty" || kind == "both" ? stoolColor.map { .string($0.rawValue) } : nil
                        }
                        if f["side"] != nil { f["side"] = .string(side) }
                        if event.type == "pump" {
                            if let ml = Growth.number(pumpMl), ml > 0 { f["amount_ml"] = .number(ml) }
                            if model.household.trackMilkStash { f["storage"] = .string(pumpStorage) }
                        }
                        if event.type == "feed.solids" {
                            f["amount"] = .string(solidsAmount)
                            let cleanFoods = solidsFoods.trimmingCharacters(in: .whitespacesAndNewlines)
                            f["foods"] = cleanFoods.isEmpty ? nil : .string(cleanFoods)
                            f["reaction"] = solidsReaction == "none" ? nil : .string(solidsReaction)
                        }
                        if event.type == "note" {
                            f["transcript"] = .string(noteText)
                            f["for_doctor"] = noteForDoctor ? .bool(true) : nil
                        }
                        for spec in specFields {
                            let raw = (specValues[spec.key] ?? "").trimmingCharacters(in: .whitespaces)
                            if raw.isEmpty {
                                f[spec.key] = nil
                            } else if spec.kind == "number", let n = Growth.number(raw) {
                                f[spec.key] = .number(n)
                            } else {
                                f[spec.key] = .string(raw)
                            }
                        }
                        if let field = Self.measureField[event.type], let m = Growth.number(measure), m > 0 {
                            f[field] = .number(field == "grams" ? (m * 1000).rounded() : (m * 10).rounded() / 10)
                        }
                        model.edit(event, fields: f, at: at, baby: baby == event.babyId ? nil : baby)
                        dismiss()
                    }
                }
            }
            .onAppear {
                at = event.occurredAt
                repairEndAt = min(Date(), event.occurredAt.addingTimeInterval(20 * 60))
                baby = event.babyId
                fraction = event.number("consumed_fraction") ?? 0.5
                if let ml = event.number("consumed_ml") {
                    consumedMlText = "\(Int(ml))"
                }
                kind = event.string("kind") ?? "wet"
                stoolColor = event.string("stool_color").flatMap(StoolColor.init(rawValue:))
                side = event.string("side") ?? "left"
                if let ml = event.number("amount_ml") { pumpMl = "\(Int(ml))" }
                pumpStorage = event.string("storage") ?? "fridge"
                solidsAmount = event.string("amount") ?? "some"
                solidsFoods = event.string("foods") ?? ""
                solidsReaction = event.string("reaction") ?? "none"
                noteText = event.string("transcript") ?? ""
                noteForDoctor = event.fields["for_doctor"] == .bool(true)
                for spec in specFields {
                    if let s = event.string(spec.key) { specValues[spec.key] = s }
                    else if let n = event.number(spec.key) { specValues[spec.key] = "\(n)" }
                }
                if let field = Self.measureField[event.type], let v = event.number(field) {
                    measure = (field == "grams" ? v / 1000 : v).formatted(.number.precision(.fractionLength(0...2)).grouping(.never))
                }
            }
        }
    }
}

/// A diaper entry's details: the kind as four big buttons and, for a dirty one, the colour.
/// Only here, in the entry's details: logging a diaper never asks for more than its kind.
struct DiaperDetails: View {
    @Binding var kind: String
    @Binding var color: StoolColor?
    let ageDays: Int?

    static func swatch(_ c: StoolColor) -> Color {
        switch c {
        case .yellow: return Color(red: 0.86, green: 0.70, blue: 0.20)
        case .brown: return Color(red: 0.52, green: 0.34, blue: 0.18)
        case .green: return Color(red: 0.40, green: 0.52, blue: 0.22)
        case .black: return Color(red: 0.12, green: 0.10, blue: 0.08)
        case .red: return Color(red: 0.78, green: 0.16, blue: 0.14)
        case .white: return Color(red: 0.93, green: 0.91, blue: 0.84)
        }
    }

    var body: some View {
        Section("Diaper") {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach([("wet", "Wet", "drop.fill"), ("dirty", "Dirty", "circle.fill"), ("both", "Both", "circle.lefthalf.filled"), ("dry", "Dry", "sun.max")], id: \.0) { key, label, icon in
                    let on = kind == key
                    Button { kind = key } label: {
                        Label(label, systemImage: icon).font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .foregroundStyle(on ? .white : .primary)
                            .background(on ? Theme.diaper : Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("diaperKind-\(key)")
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
            .padding(.vertical, 4)
            if kind == "dirty" || kind == "both" {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Colour (optional)").font(.subheadline).foregroundStyle(.secondary)
                    HStack(spacing: 0) {
                        ForEach(StoolColor.allCases, id: \.self) { c in
                            let on = color == c
                            Button { color = on ? nil : c } label: {
                                VStack(spacing: 4) {
                                    Circle().fill(Self.swatch(c)).frame(width: 34, height: 34)
                                        .overlay(Circle().strokeBorder(on ? Theme.accent : Color.secondary.opacity(0.3), lineWidth: on ? 3 : 1))
                                    Text(c.label).font(.system(size: 10)).lineLimit(1).minimumScaleFactor(0.8)
                                }
                                .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("stool-\(c.rawValue)")
                        }
                    }
                    if let color, color.isFlagged(ageDays: ageDays) {
                        Label("\(color.label) stool is on the stool colour cards pediatricians give out as a colour to call them about.",
                              systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote).foregroundStyle(.orange)
                            .accessibilityIdentifier("stoolFlag")
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }
}

enum TimelineDensity: String, CaseIterable, Identifiable {
    case grid, cards, audit
    var id: String { rawValue }
    var title: String { [.grid: "Day grid", .cards: "Cards", .audit: "Audit"][self]! }
    var icon: String { [.grid: "square.grid.3x3", .cards: "list.bullet", .audit: "doc.text.magnifyingglass"][self]! }
    var more: TimelineDensity { self == .grid ? .cards : .audit }
    var less: TimelineDensity { self == .audit ? .cards : .grid }
}

struct HourCell: Identifiable {
    let day: Date
    let hour: Int
    let events: [LogEvent]
    var id: String { "\(day.timeIntervalSince1970)-\(hour)" }
}

/// A whole day on one screen: 24 hour cells, each with a dot per entry. Tap an hour to see it.
struct HourGrid: View {
    let day: Date
    let events: [LogEvent]
    let open: (HourCell) -> Void

    var body: some View {
        let byHour = Dictionary(grouping: events) { Calendar.current.component(.hour, from: $0.occurredAt) }
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 6), spacing: 4) {
            ForEach(0..<24, id: \.self) { h in
                let list = (byHour[h] ?? []).sorted { $0.occurredAt < $1.occurredAt }
                Button { if !list.isEmpty { open(HourCell(day: day, hour: h, events: list)) } } label: {
                    VStack(spacing: 3) {
                        Text(Self.hourLabel(h)).font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
                        HStack(spacing: 2) {
                            ForEach(Array(list.prefix(4).enumerated()), id: \.offset) { _, e in
                                Circle().fill(Theme.color(for: e.type)).frame(width: 7, height: 7)
                            }
                            if list.count > 4 { Text("+\(list.count - 4)").font(.system(size: 8)).foregroundStyle(.secondary) }
                        }
                        .frame(height: 9)
                    }
                    .frame(maxWidth: .infinity, minHeight: 38)
                    .background(list.isEmpty ? Color(.tertiarySystemFill).opacity(0.5) : Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 7))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
        .accessibilityIdentifier("hourGrid")
    }

    static func hourLabel(_ h: Int) -> String {
        h == 0 ? "12a" : h < 12 ? "\(h)a" : h == 12 ? "12p" : "\(h - 12)p"
    }
}

struct HourSheet: View {
    @EnvironmentObject var model: AppModel
    let cell: HourCell
    let select: (LogEvent) -> Void

    var body: some View {
        NavigationStack {
            List(cell.events) { e in
                EventRow(event: e, status: model.log.status[e.id] ?? .active, who: model.household.caregiverName(e.loggedBy),
                         ml: model.household.milliliters(e))
                    .contentShape(Rectangle())
                    .onTapGesture { select(e) }
            }
            .navigationTitle("\(HourGrid.hourLabel(cell.hour)) · \(cell.day.formatted(date: .abbreviated, time: .omitted))")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
