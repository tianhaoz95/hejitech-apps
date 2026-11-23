import AppIntents
import Foundation

// Voxbrief's notes in Siri, Spotlight and the Shortcuts app: each note is an `AppEntity` that
// shortcuts can find (by words, with the same keyword index Ask uses), open, and read; open to-dos
// and Ask Voxbrief are intents of their own. Locked notes never leave the app this way, archived
// and unfinished ones aren't offered. Everything except Ask runs without opening the app and
// without a model; Ask opens the app, because the on-device model can't run in the background.
// (No "Apple" in any title, description or phrase: App Store processing rejects it, ITMS-90626.)

/// A note as Siri and Shortcuts see it.
struct NoteEntity: AppEntity, Identifiable {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Voice Note"
    static var defaultQuery = NoteEntityQuery()

    let id: UUID
    @Property(title: "Title") var title: String
    @Property(title: "Recorded") var recorded: Date
    @Property(title: "Summary") var summary: String

    init(note: VoiceNote) {
        id = note.id
        title = note.title.isEmpty ? "Untitled note" : note.title
        recorded = note.createdAt
        summary = note.summary
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(title)",
            subtitle: "\(recorded.formatted(date: .abbreviated, time: .shortened))",
            image: .init(systemName: "waveform")
        )
    }
}

/// The notes a shortcut may see: ready, not locked, not archived.
@MainActor
enum IntentNotes {
    static func visible() -> [VoiceNote] {
        NoteRepository.shared.notes.filter { $0.status == .ready && !$0.isLocked && !$0.isArchived }
    }

    /// Notes matching the words, best first (Ask's keyword index), or the latest ones.
    static func search(_ text: String, limit: Int = 10) -> [VoiceNote] {
        let notes = visible()
        guard !NoteSearchIndex.terms(in: text).isEmpty else {
            return Array(notes.sorted { $0.createdAt > $1.createdAt }.prefix(limit))
        }
        var seen: Set<UUID> = []
        let ids = NoteSearchIndex(notes: notes).search([text], limit: limit * 4)
            .map(\.passage.noteId)
            .filter { seen.insert($0).inserted }
        let byId = Dictionary(uniqueKeysWithValues: notes.map { ($0.id, $0) })
        return ids.prefix(limit).compactMap { byId[$0] }
    }
}

struct NoteEntityQuery: EntityStringQuery {
    init() {}

    @MainActor
    func entities(for identifiers: [UUID]) async throws -> [NoteEntity] {
        let wanted = Set(identifiers)
        return IntentNotes.visible().filter { wanted.contains($0.id) }.map(NoteEntity.init(note:))
    }

    @MainActor
    func entities(matching string: String) async throws -> [NoteEntity] {
        IntentNotes.search(string).map(NoteEntity.init(note:))
    }

    @MainActor
    func suggestedEntities() async throws -> [NoteEntity] {
        Array(IntentNotes.visible().sorted { $0.createdAt > $1.createdAt }.prefix(10)).map(NoteEntity.init(note:))
    }
}

/// Finds notes by words in them (titles, summaries, transcripts), for Siri and Shortcuts.
struct FindNotesIntent: AppIntent {
    static var title: LocalizedStringResource = "Find Voice Notes"
    static var description = IntentDescription("Finds your Voxbrief notes that mention some words, best match first.")

    @Parameter(title: "Words", requestValueDialog: "What should I look for in your notes?")
    var words: String

    static var parameterSummary: some ParameterSummary {
        Summary("Find notes about \(\.$words)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<[NoteEntity]> & ProvidesDialog {
        let found = IntentNotes.search(words, limit: 5)
        let dialog: IntentDialog = found.isEmpty
            ? "No notes mention \(words)."
            : "\(found.count == 1 ? "One note" : "\(found.count) notes"): \(found.map { $0.title.isEmpty ? "Untitled note" : $0.title }.joined(separator: ", "))."
        return .result(value: found.map(NoteEntity.init(note:)), dialog: dialog)
    }
}

/// A note's text (the cleaned note, else its transcript), for shortcuts that pass it on.
struct GetNoteTextIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Note Text"
    static var description = IntentDescription("Gives the cleaned-up text of a Voxbrief note, or its transcript.")

    @Parameter(title: "Note")
    var note: NoteEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Get the text of \(\.$note)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        guard let n = IntentNotes.visible().first(where: { $0.id == note.id }) else {
            throw $note.needsValueError("That note isn't available. Pick another one.")
        }
        let text = n.cleanedNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? n.rawTranscript : n.cleanedNote
        return .result(value: text)
    }
}

/// Opens a note in the app.
struct OpenNoteIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Voice Note"
    static var description = IntentDescription("Opens a note in Voxbrief.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Note")
    var note: NoteEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$note)")
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        NotificationCenter.default.post(name: .voxbriefNavigate, object: nil, userInfo: ["screen": "note", "id": note.id.uuidString])
        return .result()
    }
}

/// The to-dos in the notes that aren't checked off yet, newest note first. No model, so Siri can
/// read them out without opening the app.
struct OpenTodosIntent: AppIntent {
    static var title: LocalizedStringResource = "Open To-Dos"
    static var description = IntentDescription("Lists the to-dos from your Voxbrief notes that aren't checked off yet.")

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<[String]> & ProvidesDialog {
        let open = Self.openTodos(IntentNotes.visible())
        guard !open.isEmpty else { return .result(value: [], dialog: "Nothing left to do in your notes.") }
        let spoken = open.prefix(5).map(\.item).joined(separator: "; ")
        let more = open.count > 5 ? ", and \(open.count - 5) more" : ""
        return .result(value: open.map(\.item), dialog: "\(open.count == 1 ? "One open to-do" : "\(open.count) open to-dos"): \(spoken)\(more).")
    }

    /// Open items, newest note first.
    static func openTodos(_ notes: [VoiceNote]) -> [(item: String, note: String)] {
        notes.sorted { $0.createdAt > $1.createdAt }.flatMap { note in
            note.actionItems.filter { !note.completedActionItems.contains($0) }.map { ($0, note.title) }
        }
    }
}

/// Ask Voxbrief a question about your notes: opens the app with the question asked (the on-device
/// model only runs while Voxbrief is open).
struct AskVoxbriefIntent: AppIntent {
    static var title: LocalizedStringResource = "Ask Voxbrief"
    static var description = IntentDescription("Asks a question about your notes. Voxbrief opens and answers from what you recorded.")
    static var openAppWhenRun: Bool = true

    @Parameter(title: "Question", requestValueDialog: "What do you want to know from your notes?")
    var question: String

    static var parameterSummary: some ParameterSummary {
        Summary("Ask Voxbrief \(\.$question)")
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        // The list may not be on screen yet when the app was closed: it reads this on appear too.
        AskVoxbriefIntent.pending = question
        NotificationCenter.default.post(name: .voxbriefNavigate, object: nil, userInfo: ["screen": "ask", "question": question])
        return .result()
    }

    /// A question from Siri or Shortcuts waiting for the Ask sheet.
    @MainActor static var pending: String?
}
