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
        if !groupSessions || !search.isEmpty {
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
                if search.isEmpty {
                    Section {
                        DayRhythmStrip(events: filteredEvents)
                    }
                }
                ForEach(days, id: \.0) { day, items in
                    Section(day.formatted(date: .complete, time: .omitted)) {
                        ForEach(items) { item in
                            switch item {
                            case .single(let e):
                                EventRow(event: e, status: model.log.status[e.id] ?? .active, who: model.household.caregiverName(e.loggedBy),
                                         ml: model.household.milliliters(e),
                                         child: several ? model.household.baby(e.babyId).map { ($0.name, Theme.color(for: $0, in: model.household)) } : nil)
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
            .searchable(text: $search, prompt: "Search medicines, notes, foods…")
            .overlay {
                if days.isEmpty {
                    ContentUnavailableView {
                        Label(search.isEmpty && categoryFilter == "all" ? "Nothing logged yet" : "No matching entries", systemImage: "list.bullet.rectangle")
                    } description: {
                        Text(showUndone
                             ? "There are no entries matching this view."
                             : "Feeds, diapers, sleep and measurements show up here as soon as they're logged: tap the mic and say it, or tap a button on Now.")
                    }
                }
            }
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

/// 24-hour visual rhythm strip comparing Today and Yesterday for feeds, sleep and diapers.
struct DayRhythmStrip: View {
    let events: [LogEvent]

    var body: some View {
        let cal = Calendar.current
        let todayStart = cal.startOfDay(for: Date())
        let yesterdayStart = cal.date(byAdding: .day, value: -1, to: todayStart) ?? todayStart
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("24h rhythm").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                HStack(spacing: 8) {
                    legendDot(color: Theme.sleep, label: "Sleep")
                    legendDot(color: Theme.feed, label: "Feed")
                    legendDot(color: Theme.diaper, label: "Diaper")
                }
            }
            rhythmBar(label: "Today", start: todayStart)
            rhythmBar(label: "Yest", start: yesterdayStart)
        }
        .padding(.vertical, 4)
    }

    private func legendDot(color: Color, label: String) -> some View {
        HStack(spacing: 3) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label).font(.system(size: 10)).foregroundStyle(.secondary)
        }
    }

    private func rhythmBar(label: String, start: Date) -> some View {
        let end = start.addingTimeInterval(86_400)
        let dayEvents = events.filter { $0.occurredAt >= start && $0.occurredAt < end }
        return HStack(spacing: 8) {
            Text(label).font(.caption2.monospacedDigit()).foregroundStyle(.secondary).frame(width: 34, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4).fill(Color(.tertiarySystemFill))
                    ForEach(dayEvents) { e in
                        let frac = max(0, min(1, e.occurredAt.timeIntervalSince(start) / 86_400))
                        let x = frac * geo.size.width
                        Circle()
                            .fill(Theme.color(for: e.type))
                            .frame(width: 7, height: 7)
                            .offset(x: max(0, min(geo.size.width - 7, x - 3.5)))
                    }
                }
            }
            .frame(height: 12)
        }
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
                    Picker("Kind", selection: $kind) { ForEach(["wet", "dirty", "both", "dry"], id: \.self) { Text($0) } }
                        .pickerStyle(.segmented)
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
                        if event.type == "diaper" { f["kind"] = .string(kind) }
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
