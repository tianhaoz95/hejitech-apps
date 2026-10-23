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

/// Settings → Timeline: show a finished feed or sleep (start + finish, side switches) as one entry.
enum GroupSessions {
    static let key = "timelineGroupSessions"
}

struct TimelineView: View {
    @EnvironmentObject var model: AppModel
    @State private var editing: LogEvent?
    @State private var showUndone = false
    @AppStorage(GroupSessions.key) private var groupSessions = true
    @State private var search = ""
    @State private var categoryFilter = "all"
    /// Show one child's entries (nil: everyone's).
    @State private var child: UUID?
    /// How much each day shows: a 24-hour grid, the usual cards, or every detail (pinch to change).
    @AppStorage("timelineDensity") private var density = TimelineDensity.cards
    @State private var hourCell: HourCell?
    @State private var viewing: PhotoViewing?
    @State private var showingGallery = false
    /// The day on screen (search looks across every day instead).
    /// `-timelineDaysAgo <n>` opens on an earlier day (screenshots, checks).
    @State private var day = Calendar.current.date(byAdding: .day, value: -UserDefaults.standard.integer(forKey: "timelineDaysAgo"),
                                                    to: Calendar.current.startOfDay(for: Date())) ?? Date()

    private var several: Bool { model.household.babies.count > 1 }
    private var filtering: Bool { child != nil || categoryFilter != "all" }

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

    private var searching: Bool { !search.trimmingCharacters(in: .whitespaces).isEmpty }

    private var days: [(Date, [TimelineItem])] {
        let events = searching ? filteredEvents : filteredEvents.filter { Calendar.current.isDate($0.occurredAt, inSameDayAs: day) }
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

    /// What the filter menu narrowed to, with one tap to clear it.
    private var filterChip: some View {
        let parts = [child.flatMap { id in model.household.baby(id)?.name },
                     categoryFilter == "all" ? nil : Self.categories.first { $0.key == categoryFilter }?.label].compactMap { $0 }
        return Button {
            withAnimation(.snappy) { child = nil; categoryFilter = "all" }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "line.3.horizontal.decrease")
                Text("Showing \(parts.joined(separator: " · "))")
                Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
            }
            .font(.subheadline.weight(.medium))
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(Theme.accent.opacity(0.15), in: Capsule())
            .foregroundStyle(Theme.accent)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Clear filter: \(parts.joined(separator: ", "))")
    }

    var body: some View {
        NavigationStack {
            List {
                if !searching {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            DayBar(day: $day)
                            if filtering { filterChip }
                        }
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                    }
                    Section {
                        DayStrip(day: day, log: model.log, child: child, household: model.household) { editing = $0 }
                            .listRowInsets(EdgeInsets())
                        DaySummary(day: day, log: model.log, child: child, household: model.household,
                                   babies: child.flatMap { id in model.shown.filter { $0.id == id } } ?? model.shown)
                    }
                }
                if days.isEmpty, !searching, categoryFilter == "all", !model.log.all.isEmpty {
                    Section {
                        Text("Nothing logged \(Calendar.current.isDateInToday(day) ? "yet today" : "this day").")
                            .font(.subheadline).foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity).padding(.vertical, 8)
                            .listRowBackground(Color.clear)
                    }
                } else if days.isEmpty {
                    // a row under the filters and the day strip, not an overlay on top of them
                    Section {
                        ContentUnavailableView {
                            Label(searching || categoryFilter != "all" ? "No matching entries" : "Nothing logged yet", systemImage: "list.bullet.rectangle")
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
                        Section(searching ? day.formatted(date: .complete, time: .omitted) : "") {
                            HourGrid(day: day, events: filteredEvents.filter { Calendar.current.isDate($0.occurredAt, inSameDayAs: day) }) { hourCell = $0 }
                        }
                    }
                } else {
                ForEach(days, id: \.0) { day, items in
                    Section(searching ? day.formatted(date: .complete, time: .omitted) : "") {
                        ForEach(items) { item in
                            switch item {
                            case .single(let e):
                                EventRow(event: e, status: model.log.status[e.id] ?? .active, who: model.household.caregiverName(e.loggedBy),
                                         ml: model.household.milliliters(e),
                                         child: several ? model.household.baby(e.babyId).map { ($0.name, Theme.color(for: $0, in: model.household)) } : nil,
                                         audit: density == .audit ? audit(e) : nil,
                                         photos: model.log.photos(for: e)) { i in viewing = PhotoViewing(photos: model.log.photos(for: e), start: i) }
                                    .contentShape(Rectangle())
                                    .onTapGesture { editing = e }
                                    .swipeActions {
                                        if model.log.status[e.id] != .undone {
                                            Button("Undo", role: .destructive) { model.undo(e.id) }
                                        }
                                    }
                            case .session(let s, let members):
                                SessionRow(session: s, events: members, household: model.household, several: several,
                                           photos: model.log.photos(for: members),
                                           onPhoto: { i in viewing = PhotoViewing(photos: model.log.photos(for: members), start: i) }) { tapped in
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
            .listSectionSpacing(.compact)
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
                // Child, category and view live up here: as rows above the day they crowded it.
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Menu {
                        if several {
                            Picker("Child", selection: $child) {
                                Text("Every child").tag(UUID?.none)
                                ForEach(model.shown) { Text($0.name).tag(UUID?.some($0.id)) }
                            }
                            .pickerStyle(.inline)
                        }
                        Picker("Show", selection: $categoryFilter) {
                            ForEach(Self.categories, id: \.key) { Text($0.key == "all" ? "Everything" : $0.label).tag($0.key) }
                        }
                        .pickerStyle(.inline)
                    } label: {
                        Image(systemName: filtering ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                    }
                    .accessibilityLabel(filtering ? "Filter, on" : "Filter")
                    .accessibilityIdentifier("timelineFilter")
                    Menu {
                        Picker("View", selection: $density) {
                            ForEach(TimelineDensity.allCases) { Label($0.title, systemImage: $0.icon).tag($0) }
                        }
                        .pickerStyle(.inline)
                        Toggle(isOn: $showUndone) { Label("Show undone entries", systemImage: "arrow.uturn.backward.circle") }
                        Divider()
                        Button { showingGallery = true } label: { Label("Photos", systemImage: "photo.on.rectangle.angled") }
                    } label: {
                        Image(systemName: density.icon)
                    }
                    .accessibilityLabel("View: \(density.title)")
                    .accessibilityIdentifier("timelineDensity")
                }
            }
            .sheet(item: $editing) { e in EditEventView(event: e) }
            .fullScreenCover(item: $viewing) { PhotoViewer($0) }
            .navigationDestination(isPresented: $showingGallery) { PhotoGalleryView(child: child) }
        }
    }
}

/// Paired session row (start + switches + finish) as one entry: the time span, then what it was.
/// Tap opens the finish; press and hold to edit any single step.
struct SessionRow: View {
    let session: Session
    let events: [LogEvent]
    let household: Household
    let several: Bool
    var photos: [EntryPhoto] = []
    var onPhoto: (Int) -> Void = { _ in }
    let onSelect: (LogEvent) -> Void

    private var iconType: String {
        switch session.kind {
        case .bottle: return "feed.bottle.finish"
        case .breast: return "feed.breast.finish"
        case .sleep: return "sleep.start"
        }
    }

    private var what: String {
        switch session.kind {
        case .bottle:
            let ml = events.last.flatMap { household.milliliters($0) }.map { " · \(Int($0)) ml" } ?? ""
            return "Bottle\(ml)"
        case .breast:
            return "Nursed \(session.sides.map { $0.prefix(1).uppercased() }.joined(separator: " → "))"
        case .sleep:
            return "Sleep"
        }
    }

    var body: some View {
        let first = events.first!
        let last = events.last!
        let child = several ? household.baby(first.babyId).map { ($0.name, Theme.color(for: $0, in: household)) } : nil
        let from = first.occurredAt.formatted(date: .omitted, time: .shortened), to = last.occurredAt.formatted(date: .omitted, time: .shortened)
        let span = from == to ? from : "\(from) – \(to)"
        TimelineRowLayout(icon: Theme.icon(for: iconType), color: Theme.color(for: iconType), who: household.caregiverName(last.loggedBy), child: child) {
            Text(span).font(.body.weight(.semibold)).monospacedDigit()
            HStack(spacing: 10) {
                Text(what)
                if let d = session.duration, d >= 60 {
                    Label(StatusSnapshot.duration(d), systemImage: "timer").labelStyle(.titleAndIcon)
                }
            }
            .font(.subheadline).foregroundStyle(.secondary)
            if !photos.isEmpty { PhotoStrip(photos: photos, onOpen: onPhoto) }
        }
        .contentShape(Rectangle())
        .onTapGesture { onSelect(last) }
        .contextMenu {
            ForEach(events) { e in
                Button("Edit \(step(e).lowercased()) · \(e.occurredAt.formatted(date: .omitted, time: .shortened))") { onSelect(e) }
            }
        }
    }

    private func step(_ e: LogEvent) -> String {
        if e.type.hasSuffix(".start") { return "Start" }
        if e.type.hasSuffix(".switch") { return "Switch" }
        return "End"
    }
}

/// The shared shape of a timeline row: the kind's icon, the lines, then the child and who logged it.
struct TimelineRowLayout<Lines: View>: View {
    let icon: String
    let color: Color
    let who: String
    var child: (name: String, color: Color)?
    @ViewBuilder let lines: Lines

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon).font(.title3).foregroundStyle(color).frame(width: 30, height: 26)
            VStack(alignment: .leading, spacing: 3) { lines }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 6) {
                WhoBadge(name: who)
                if let child {
                    Text(child.name).font(.caption2.weight(.semibold)).foregroundStyle(child.color)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(child.color.opacity(0.15), in: Capsule())
                        .lineLimit(1)
                }
            }
            .fixedSize()
        }
        .padding(.vertical, 2)
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
    var photos: [EntryPhoto] = []
    var onPhoto: (Int) -> Void = { _ in }

    var body: some View {
        TimelineRowLayout(icon: Theme.icon(for: event.type), color: Theme.color(for: event.type), who: who, child: child) {
            Text(event.occurredAt.formatted(date: .omitted, time: .shortened))
                .font(.body.weight(.semibold)).monospacedDigit()
                .strikethrough(status == .undone)
            HStack(spacing: 6) {
                Text(event.type == "note" ? "Note" : VoiceInterpreter.label(type: event.type, fields: event.fields))
                if let ml, event.type.hasPrefix("feed.bottle") { Label("\(Int(ml)) ml", systemImage: "drop").labelStyle(.titleAndIcon) }
            }
            .font(.subheadline).foregroundStyle(.secondary)
            if let t = event.provenance.rawTranscript {
                Text("“\(t)”").font(.caption).foregroundStyle(.tertiary).lineLimit(2)
            }
            if !photos.isEmpty { PhotoStrip(photos: photos, onOpen: onPhoto) }
            if status == .duplicateUnresolved || status == .undone {
                Text(status == .undone ? "undone" : "duplicate?").font(.caption2.weight(.semibold))
                    .foregroundStyle(status == .undone ? .red : .orange)
            }
            if let audit {
                HStack(spacing: 4) {
                    Image(systemName: Self.surfaceIcon(event.provenance.surface))
                    if let tier = event.provenance.confidenceTier { Text(tier.rawValue.replacingOccurrences(of: "_", with: " ")) }
                }
                .font(.caption2).foregroundStyle(.tertiary)
                Text(audit).font(.caption2.monospaced()).foregroundStyle(.tertiary).lineLimit(3)
                if !event.provenance.confidence.isEmpty {
                    Text(event.provenance.confidence.sorted { $0.key < $1.key }.map { "\($0.key) \(Int($0.value * 100))%" }.joined(separator: " · "))
                        .font(.caption2.monospaced()).foregroundStyle(.tertiary).lineLimit(2)
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
                if !SystemType.all.contains(event.type) || event.type == SystemType.note {
                    EntryPhotosSection(entry: event)
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
