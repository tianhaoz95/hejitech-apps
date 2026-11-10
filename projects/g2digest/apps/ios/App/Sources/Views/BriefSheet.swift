import SwiftUI
import G2DigestKit

/// The brief editor, as on the web (`services/web/src/brief.ts`): every field of the brief, checked
/// live with the same rules the Worker applies before it saves. Saving bumps the brief's version and
/// the next edition follows it.
public struct BriefSheet: View {
    @ObservedObject var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var draft: Brief?
    @State private var saving = false
    @State private var message: String?
    @State private var serverIssues: [BriefIssue] = []
    @State private var conflict = false
    @State private var confirmDiscard = false

    public init(appModel: AppModel) {
        self.appModel = appModel
    }

    private var dirty: Bool { draft != nil && draft != appModel.userBrief }
    private var issues: [BriefIssue] { draft.map(checkBrief) ?? [] }

    public var body: some View {
        NavigationStack {
            Group {
                if draft != nil {
                    BriefForm(brief: Binding(get: { draft! }, set: { draft = $0 }), issues: issues + serverIssues, message: message)
                } else {
                    ProgressView("Loading your brief…").frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .navigationTitle("Your Brief")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(dirty ? "Cancel" : "Done") { dirty ? (confirmDiscard = true) : dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if saving { ProgressView() } else {
                        Button("Save") { Task { await save() } }
                            .fontWeight(.semibold)
                            .disabled(!dirty || !issues.isEmpty)
                    }
                }
            }
            .interactiveDismissDisabled(dirty)
            .confirmationDialog("Discard your changes to the brief?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                Button("Discard Changes", role: .destructive) { dismiss() }
                Button("Keep Editing", role: .cancel) {}
            }
            .alert("The brief changed elsewhere", isPresented: $conflict) {
                Button("Load the Latest") { Task { await appModel.reloadBrief(); draft = appModel.userBrief; message = nil } }
                Button("Keep Mine", role: .cancel) {}
            } message: {
                Text("It was saved on the web (or another device) since you opened it. Load the latest, then make your changes again.")
            }
            .task {
                if appModel.userBrief == nil { await appModel.reloadBrief() }
                if draft == nil { draft = appModel.userBrief }
            }
            .onChange(of: draft) { _ in serverIssues = [] }
        }
    }

    private func save() async {
        guard let d = draft else { return }
        saving = true
        defer { saving = false }
        do {
            let changed = try await appModel.saveBrief(d)
            message = changed ? "Saved · version \(appModel.briefVersion). The next edition follows it." : "No changes · version \(appModel.briefVersion)"
        } catch BriefSaveError.conflict {
            conflict = true
        } catch BriefSaveError.issues(let m, let list) {
            serverIssues = list.isEmpty ? [BriefIssue(code: "SERVER", message: m)] : list
        } catch {
            message = error.localizedDescription
        }
    }
}

/// The brief's fields. `issues` are shown on top; Save stays off while there are any.
struct BriefForm: View {
    @Binding var brief: Brief
    let issues: [BriefIssue]
    let message: String?
    @State private var reordering = false

    var body: some View {
        Form {
            if !issues.isEmpty {
                Section {
                    ForEach(issues, id: \.self) { i in
                        Label(i.message, systemImage: "exclamationmark.triangle.fill")
                            .font(.footnote)
                            .foregroundStyle(.orange)
                    }
                }
            } else if let message {
                Section { Label(message, systemImage: "checkmark.circle.fill").font(.footnote).foregroundStyle(.green) }
            }

            Section {
                LabeledContent("Name") {
                    TextField("My brief", text: $brief.title).multilineTextAlignment(.trailing)
                }
                Stepper(value: $brief.totalCardBudget, in: 3...40) {
                    LabeledContent("Card budget", value: "\(brief.totalCardBudget) cards")
                }
                Stepper(value: Binding(get: { brief.totalAudioBudgetSec / 60 }, set: { brief.totalAudioBudgetSec = $0 * 60 }), in: 0...120) {
                    LabeledContent("Audio budget", value: "\(brief.totalAudioBudgetSec / 60) min")
                }
                Toggle("TL;DR card", isOn: $brief.tldr)
            } header: {
                Text("Edition")
            } footer: {
                Text("The name goes on the Cover card. Cover, TL;DR and End count toward the card budget. The TL;DR card is the one thing to know.")
            }

            Section("Delivery and Language") {
                DatePicker("Ready by", selection: timeBinding, displayedComponents: .hourAndMinute)
                NavigationLink {
                    TimeZonePicker(selection: $brief.delivery.timezone)
                } label: {
                    LabeledContent("Time zone", value: brief.delivery.timezone.replacingOccurrences(of: "_", with: " "))
                }
                DaysPicker(days: $brief.delivery.days)
                LabeledContent("Language") {
                    TextField("en", text: $brief.language)
                        .multilineTextAlignment(.trailing)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }
                Picker("Temperature", selection: $brief.units.temperature) {
                    Text("°C").tag("C"); Text("°F").tag("F")
                }
                Picker("Distance", selection: $brief.units.distance) {
                    Text("km").tag("km"); Text("mi").tag("mi")
                }
            }

            Section {
                ForEach(brief.sections.indices, id: \.self) { i in
                    NavigationLink {
                        SectionEditor(section: $brief.sections[i], brief: $brief)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(i + 1). \(brief.sections[i].title.isEmpty ? "Untitled" : brief.sections[i].title)")
                            Text("\(brief.sections[i].template.rawValue) · up to \(brief.sections[i].maxCards) cards · \(brief.sections[i].source.kind.label)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .onMove { brief.sections.move(fromOffsets: $0, toOffset: $1) }
                .onDelete { brief.sections.remove(atOffsets: $0) }
                Button {
                    brief.sections.append(.starter(brief.nextSectionNumber()))
                } label: {
                    Label("Add Section", systemImage: "plus")
                }
            } header: {
                HStack {
                    Text("Sections")
                    Spacer()
                    Button(reordering ? "Done" : "Reorder") { withAnimation { reordering.toggle() } }
                        .font(.footnote)
                        .textCase(nil)
                        .disabled(brief.sections.count < 2 && !reordering)
                }
            } footer: {
                Text("In edition order. When there's more than the budget allows, later sections lose cards first; alerts are never cut.")
            }
            .environment(\.editMode, .constant(reordering ? .active : .inactive))

            Section {
                ForEach(brief.glossary.indices, id: \.self) { i in
                    VStack(alignment: .leading, spacing: 6) {
                        TextField("Term", text: $brief.glossary[i].term).font(.body.weight(.semibold))
                        TextField("How to explain it", text: $brief.glossary[i].gloss, axis: .vertical)
                            .foregroundStyle(.secondary)
                    }
                }
                .onDelete { brief.glossary.remove(atOffsets: $0) }
                Button {
                    brief.glossary.append(BriefGlossaryItem(term: "", gloss: ""))
                } label: {
                    Label("Add Term", systemImage: "plus")
                }
                LabeledContent("Never explain") {
                    TextField("terms you know", text: commaBinding($brief.noGloss))
                        .multilineTextAlignment(.trailing)
                }
            } header: {
                Text("Glossary")
            } footer: {
                Text("Terms the audio always explains your way. \"Never explain\" takes comma-separated terms. Swipe a term to remove it.")
            }

            Section {
                NavigationLink("Edit as JSON") { BriefJSONEditor(brief: $brief) }
            } footer: {
                Text("Paste a whole brief to import it.")
            }
        }
    }

    private var timeBinding: Binding<Date> {
        Binding {
            let parts = brief.delivery.time.split(separator: ":").compactMap { Int($0) }
            return Calendar.current.date(bySettingHour: parts.first ?? 7, minute: parts.count > 1 ? parts[1] : 0, second: 0, of: Date()) ?? Date()
        } set: { d in
            let c = Calendar.current.dateComponents([.hour, .minute], from: d)
            brief.delivery.time = String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
        }
    }
}

/// One section of the brief, every field the web editor has.
struct SectionEditor: View {
    @Binding var section: BriefSection
    @Binding var brief: Brief

    var body: some View {
        Form {
            Section {
                LabeledContent("Title") {
                    TextField("Section", text: $section.title)
                        .multilineTextAlignment(.trailing)
                        .onChange(of: section.title) { t in if t.count > 18 { section.title = String(t.prefix(18)) } }
                }
                LabeledContent("Id") {
                    TextField("kebab-case", text: $section.id)
                        .multilineTextAlignment(.trailing)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.body.monospaced())
                }
            } footer: {
                Text("The title is the card kicker (\(section.title.count)/18). The id is lowercase-kebab-case and unique in the brief.")
            }

            Section {
                Picker("Template", selection: $section.template) {
                    ForEach(CardTemplate.allCases, id: \.self) { Text($0.rawValue.capitalized).tag($0) }
                }
                Stepper(value: $section.maxCards, in: 1...10) {
                    LabeledContent("Max cards", value: "\(section.maxCards)")
                }
                Picker("Quiet day", selection: $section.quietBehavior) {
                    ForEach(QuietBehavior.allCases, id: \.self) { Text($0.label).tag($0) }
                }
            } header: {
                Text("Cards")
            } footer: {
                Text("\(section.template.rawValue.capitalized): \(section.template.help). Max cards is a ceiling, not a quota.")
            }

            Section {
                Toggle("Glance audio", isOn: $section.audio.glance)
                Picker("Deep dive", selection: $section.audio.deepDive) {
                    ForEach(DeepDivePolicy.allCases, id: \.self) { Text($0.label).tag($0) }
                }
            } header: {
                Text("Audio")
            } footer: {
                Text("A glance is about 30 seconds on every card; a deep dive tells the method behind it.")
            }

            Section {
                Picker("Source", selection: $section.source.kind) {
                    ForEach(SourceKind.allCases, id: \.self) { Text($0.label).tag($0) }
                }
                LabeledContent("Entities") {
                    TextField("comma-separated", text: commaBinding(Binding(get: { section.source.entities ?? [] }, set: { section.source.entities = $0 })))
                        .multilineTextAlignment(.trailing)
                }
                LabeledContent("Query") {
                    TextField("optional", text: Binding(get: { section.source.query ?? "" }, set: { section.source.query = $0.isEmpty ? nil : $0 }))
                        .multilineTextAlignment(.trailing)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Feed URLs").font(.subheadline)
                    TextField("one per line (rss, feed)", text: Binding(
                        get: { (section.source.urls ?? []).joined(separator: "\n") },
                        set: { v in
                            let l = v.split(separator: "\n").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                            section.source.urls = l.isEmpty ? nil : l
                        }), axis: .vertical)
                        .lineLimit(2...6)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .font(.callout.monospaced())
                }
            } header: {
                Text("Source")
            } footer: {
                Text("\(section.source.kind.label): \(section.source.kind.help).\(section.source.kind.needsURLs ? " Needs at least one URL." : "")")
            }

            Section {
                TextField("What counts, how to rank, what a quiet day looks like", text: $section.instructions, axis: .vertical)
                    .lineLimit(4...14)
            } header: {
                Text("Instructions")
            }

            let issues = checkBrief(brief).filter { $0.message.hasPrefix("sections[\(brief.sections.firstIndex(where: { $0 == section }) ?? -1)]") }
            if !issues.isEmpty {
                Section {
                    ForEach(issues, id: \.self) { Label($0.message, systemImage: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(.orange) }
                }
            }
        }
        .navigationTitle(section.title.isEmpty ? "Section" : section.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Weekday chips (at least one).
struct DaysPicker: View {
    @Binding var days: [Weekday]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Days")
            HStack(spacing: 6) {
                ForEach(Weekday.allCases, id: \.self) { d in
                    let on = days.contains(d)
                    Button {
                        days = Weekday.allCases.filter { $0 == d ? !on : days.contains($0) }
                    } label: {
                        Text(d.short.prefix(2))
                            .font(.footnote.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 34)
                            .background(on ? Color.accentColor : Color(.tertiarySystemFill), in: Capsule())
                            .foregroundStyle(on ? Color.black : Color.primary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(d.rawValue)
                    .accessibilityAddTraits(on ? .isSelected : [])
                }
            }
        }
        .padding(.vertical, 4)
    }
}

/// A searchable list of IANA time zones.
struct TimeZonePicker: View {
    @Binding var selection: String
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    var body: some View {
        let all = TimeZone.knownTimeZoneIdentifiers
        let shown = query.isEmpty ? all : all.filter { $0.localizedCaseInsensitiveContains(query.replacingOccurrences(of: " ", with: "_")) }
        List(shown, id: \.self) { tz in
            Button {
                selection = tz
                dismiss()
            } label: {
                HStack {
                    Text(tz.replacingOccurrences(of: "_", with: " ")).foregroundStyle(.primary)
                    Spacer()
                    if tz == selection { Image(systemName: "checkmark").foregroundStyle(Color.accentColor) }
                }
            }
        }
        .searchable(text: $query, prompt: "City or region")
        .navigationTitle("Time Zone")
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The whole brief as JSON, to copy out or paste a brief in (checked before it's applied).
struct BriefJSONEditor: View {
    @Binding var brief: Brief
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var note: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextEditor(text: $text)
                .font(.footnote.monospaced())
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
            if let note { Text(note).font(.footnote).foregroundStyle(.orange) }
        }
        .padding()
        .navigationTitle("Brief JSON")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Apply") {
                    do {
                        let next = try JSONDecoder().decode(Brief.self, from: Data(text.utf8))
                        let problems = checkBrief(next)
                        if !problems.isEmpty { note = "Not applied: " + problems.map(\.message).joined(separator: "; "); return }
                        brief = next
                        dismiss()
                    } catch {
                        note = "Not a brief: \(error.localizedDescription)"
                    }
                }
            }
            ToolbarItem(placement: .secondaryAction) {
                Button("Copy", systemImage: "doc.on.doc") { UIPasteboard.general.string = text }
            }
        }
        .onAppear {
            let enc = JSONEncoder()
            enc.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
            text = (try? enc.encode(brief)).flatMap { String(data: $0, encoding: .utf8) } ?? ""
        }
    }
}

/// A comma-separated text field over a list of strings.
func commaBinding(_ list: Binding<[String]>) -> Binding<String> {
    Binding(
        get: { list.wrappedValue.joined(separator: ", ") },
        set: { list.wrappedValue = $0.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty } }
    )
}
