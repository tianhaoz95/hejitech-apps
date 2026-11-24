import SwiftUI

/// Ask Voxbrief: a chat about the user's own notes with the on-device model, which searches
/// them itself (see `AskConversation`). The conversation lives only as long as the sheet.
struct AskView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var repository: NoteRepository
    @State private var exchanges: [Exchange] = []
    @State private var draft = ""
    @State private var currentTask: Task<Void, Never>?
    /// The chat: the model sees the earlier questions and answers, so follow-ups work.
    /// Created lazily on first use with `repository.notes` so macOS's non-shared repository works.
    @State private var conversation: AskConversation?
    @FocusState private var isInputFocused: Bool
    /// The note the next question is about (the paperclip); cleared once it's sent.
    @State private var attached: VoiceNote?
    @State private var showingNotePicker = false
    #if os(iOS)
    /// Asking by voice: its own live transcriber (`shared` belongs to recordings).
    @StateObject private var dictation = LiveTranscriber()
    @State private var isStartingDictation = false
    @State private var isFinishingDictation = false
    @State private var dictationError: String?
    #endif

    private struct Exchange: Identifiable {
        let id = UUID()
        let question: String
        var attachedTitle: String?
        var answer: AskAnswer?
        var error: String?
    }

    static let suggestions = [
        "What are my open action items?",
        "What did I record yesterday?",
        "What ideas did I have last week?",
    ]

    private var isAsking: Bool { currentTask != nil }

    /// A question from Siri or Shortcuts (`AskVoxbriefIntent`), asked as soon as the sheet opens.
    var initialQuestion: String? = nil
    /// Optional audio playback service override (macOS passes its own instance).
    var playbackService: AudioPlaybackService = .shared
    /// Optional callback when a citation is tapped (macOS selects the note in `NotesBrowserView`).
    var onSelectNote: ((UUID) -> Void)? = nil
    @State private var askedInitial = false

    private func activeConversation() -> AskConversation {
        if let conversation { return conversation }
        let repo = repository
        let created = AskConversation(notes: { repo.notes })
        conversation = created
        return created
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if exchanges.isEmpty {
                            intro
                        }
                        ForEach(exchanges) { exchange in
                            exchangeView(exchange)
                                .id(exchange.id)
                        }
                    }
                    .padding()
                }
                #if os(iOS)
                .scrollDismissesKeyboard(.interactively)
                #endif
                .onAppear {
                    if let q = initialQuestion, !askedInitial {
                        askedInitial = true
                        send(q)
                    }
                }
                .onChange(of: exchanges.count) { _, _ in
                    if let last = exchanges.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .top) }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) { inputBar }
            .background(AppPageBackground())
            .navigationTitle("Ask Voxbrief")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onDisappear {
                currentTask?.cancel()
                #if os(iOS)
                dictation.cancelDictation()
                #endif
            }
            .sheet(isPresented: $showingNotePicker) {
                AskNotePicker(notes: Self.attachableNotes(repository.notes)) { note in
                    attached = note
                }
            }
            #if os(iOS)
            .alert("Ask by Voice", isPresented: Binding(get: { dictationError != nil }, set: { if !$0 { dictationError = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(dictationError ?? "")
            }
            #endif
        }
    }

    /// Notes the model may read: what search sees (ready, not archived, not locked), newest first.
    static func attachableNotes(_ notes: [VoiceNote]) -> [VoiceNote] {
        notes
            .filter { !$0.isArchived && !$0.isLocked && $0.status == .ready }
            .sorted { $0.createdAt > $1.createdAt }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Ask about your notes", systemImage: "sparkles")
                .font(.headline)
            Text("The on-device model searches your notes and answers from what it finds. Ask follow-ups; it remembers the conversation until you close it. Tap the microphone to ask out loud, or the paperclip to ask about one note. Nothing leaves the device.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Self.suggestions, id: \.self) { suggestion in
                    Button {
                        send(suggestion)
                    } label: {
                        Text(suggestion)
                            .font(.subheadline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color.secondary.opacity(0.12), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.top, 8)
    }

    @ViewBuilder
    private func exchangeView(_ exchange: Exchange) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Spacer(minLength: 48)
                VStack(alignment: .trailing, spacing: 4) {
                    if let title = exchange.attachedTitle {
                        Label(title, systemImage: "paperclip")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Text(exchange.question)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 9)
                        .foregroundStyle(.white)
                        .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
            }

            if let answer = exchange.answer {
                ForEach(Array(answer.searches.enumerated()), id: \.offset) { _, search in
                    searchLine(search)
                }
                answerCard(answer)
            } else if let error = exchange.error {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.subheadline)
                    .foregroundStyle(.orange)
                    .padding(14)
                    .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            } else {
                HStack(spacing: 8) {
                    ProgressView()
                    Text("Searching your notes…")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(14)
                .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
    }

    private func answerCard(_ answer: AskAnswer) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(Self.rendered(answer.text))
                .textSelection(.enabled)

            if !answer.citations.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(answer.citations) { citation in
                        citationChip(citation)
                    }
                }
            }

            Divider()
            #if os(macOS)
            Label("Answered on this Mac · \(CleanupEngineLabel.displayName(for: answer.engine))", systemImage: "cpu")
                .font(.caption2)
                .foregroundStyle(.secondary)
            #else
            Label("Answered on this iPhone · \(CleanupEngineLabel.displayName(for: answer.engine))", systemImage: "cpu")
                .font(.caption2)
                .foregroundStyle(.secondary)
            #endif
        }
        .padding(14)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    /// One line per search the model ran for the answer: what it looked for and what it found.
    private func searchLine(_ search: AskAnswer.Search) -> some View {
        let query = search.query.isEmpty ? "your latest notes" : "\u{201C}\(search.query)\u{201D}"
        let days = search.daysBack.map { " from the last \($0) day\($0 == 1 ? "" : "s")" } ?? ""
        let found = search.resultCount == 0 ? "nothing found" : "\(search.resultCount) passage\(search.resultCount == 1 ? "" : "s")"
        return Label("Searched \(query)\(days) · \(found)", systemImage: "magnifyingglass")
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(2)
    }

    /// The answer with inline Markdown (bold, italics) applied; plain text if it doesn't parse.
    static func rendered(_ text: String) -> AttributedString {
        (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text)
    }

    @ViewBuilder
    private func citationChip(_ citation: AskAnswer.Citation) -> some View {
        if let note = repository.note(withId: citation.noteId) {
            HStack(spacing: 4) {
                if let onSelectNote {
                    Button {
                        onSelectNote(note.id)
                        dismiss()
                    } label: {
                        Label(citation.noteTitle, systemImage: "doc.text")
                            .lineLimit(1)
                    }
                } else {
                    NavigationLink {
                        NoteDetailView(note: note, repository: repository, playbackService: playbackService)
                    } label: {
                        Label(citation.noteTitle, systemImage: "doc.text")
                            .lineLimit(1)
                    }
                }
                if let time = citation.startTime, let fileName = note.audioFileName {
                    Button {
                        playbackService.play(fileName: fileName, startingAt: time)
                    } label: {
                        Label(time.formattedDuration, systemImage: "play.fill")
                    }
                    .accessibilityLabel("Play from \(time.formattedDuration)")
                }
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(Color.accentColor)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Color.accentColor.opacity(0.12), in: Capsule())
            .buttonStyle(.plain)
        }
    }

    private var isListening: Bool {
        #if os(iOS)
        return dictation.isActive || isStartingDictation || isFinishingDictation
        #else
        return false
        #endif
    }

    private var inputBar: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let attached {
                attachmentChip(attached)
            }
            HStack(alignment: .bottom, spacing: 4) {
                Button {
                    showingNotePicker = true
                } label: {
                    Image(systemName: "paperclip")
                        .font(.system(size: 19, weight: .medium))
                        .frame(width: 34, height: 34)
                }
                .disabled(isListening)
                .accessibilityLabel(attached == nil ? "Attach a note" : "Attach a different note")

                #if os(iOS)
                if isListening {
                    listeningText
                        .frame(maxWidth: .infinity, minHeight: 34, alignment: .leading)
                } else {
                    TextField(attached == nil ? "Ask about your notes…" : "Ask about this note…", text: $draft, axis: .vertical)
                        .lineLimit(1...4)
                        .focused($isInputFocused)
                        .submitLabel(.send)
                        .onSubmit { send(draft) }
                        .frame(minHeight: 34)
                }

                Button {
                    toggleDictation()
                } label: {
                    Image(systemName: dictation.isActive ? "stop.circle.fill" : "mic.fill")
                        .font(.system(size: dictation.isActive ? 30 : 19, weight: .medium))
                        .foregroundStyle(dictation.isActive ? Color.red : Color.accentColor)
                        .frame(width: 34, height: 34)
                }
                .disabled(isAsking || isStartingDictation || isFinishingDictation)
                .accessibilityLabel(dictation.isActive ? "Stop listening" : "Ask by voice")
                #else
                TextField(attached == nil ? "Ask about your notes…" : "Ask about this note…", text: $draft, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...4)
                    .focused($isInputFocused)
                    .onSubmit { send(draft) }
                    .frame(minHeight: 28)
                #endif

                if !isListening {
                    Button {
                        send(draft)
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 30))
                    }
                    .disabled(isAsking || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityLabel("Ask")
                }
            }
        }
        .padding(.leading, 8)
        .padding(.trailing, 6)
        .padding(.vertical, 6)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .padding(.horizontal)
        .padding(.bottom, 8)
    }

    #if os(iOS)
    /// What's been heard so far: confirmed words solid, the still-changing tail grey.
    private var listeningText: some View {
        Group {
            if isFinishingDictation {
                HStack(spacing: 6) {
                    ProgressView()
                    Text("Transcribing…").foregroundStyle(.secondary)
                }
            } else if dictation.confirmedText.isEmpty && dictation.tentativeText.isEmpty {
                Label("Listening…", systemImage: "waveform")
                    .symbolEffect(.variableColor.iterative, isActive: dictation.isActive)
                    .foregroundStyle(.secondary)
            } else {
                (Text(dictation.confirmedText) + Text(dictation.confirmedText.isEmpty ? "" : " ")
                    + Text(dictation.tentativeText).foregroundColor(.secondary))
                    .lineLimit(4)
            }
        }
        .font(.body)
    }
    #endif

    private func attachmentChip(_ note: VoiceNote) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "doc.text")
            Text(note.title.isEmpty ? "Untitled note" : note.title)
                .lineLimit(1)
            Button {
                attached = nil
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove attached note")
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(Color.accentColor)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color.accentColor.opacity(0.12), in: Capsule())
        .padding(.leading, 4)
        .padding(.top, 2)
    }

    #if os(iOS)
    private func toggleDictation() {
        if dictation.isActive {
            isFinishingDictation = true
            Task {
                let heard = await dictation.finishDictation()
                isFinishingDictation = false
                guard let heard, !heard.isEmpty else {
                    dictationError = "Didn't catch anything. Tap the microphone and try again."
                    return
                }
                let current = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                draft = current.isEmpty ? heard : current + " " + heard
            }
        } else {
            isInputFocused = false
            isStartingDictation = true
            Task {
                do {
                    try await dictation.startDictation()
                } catch {
                    dictationError = error.localizedDescription
                }
                isStartingDictation = false
            }
        }
    }
    #endif

    private func send(_ text: String) {
        let question = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !isAsking, !isListening else { return }
        draft = ""
        isInputFocused = false
        let note = attached
        attached = nil
        let exchange = Exchange(question: question, attachedTitle: note.map { $0.title.isEmpty ? "Untitled note" : $0.title })
        exchanges.append(exchange)
        let conv = activeConversation()
        currentTask = Task {
            do {
                let answer = try await conv.ask(question, attached: note)
                update(exchange.id) { $0.answer = answer }
            } catch is CancellationError {
                // Sheet closed.
            } catch {
                update(exchange.id) { $0.error = error.localizedDescription }
            }
            currentTask = nil
        }
    }

    private func update(_ id: UUID, _ change: (inout Exchange) -> Void) {
        guard let index = exchanges.firstIndex(where: { $0.id == id }) else { return }
        change(&exchanges[index])
    }
}

/// Wraps its children onto as many lines as they need (citation chips).
private struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews: subviews)
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(rows.count - 1, 0))
        let width = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(width: bounds.width, subviews: subviews) {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.init(width: bounds.width, height: nil))
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: .init(width: min(size.width, bounds.width), height: size.height))
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    private func arrange(width: CGFloat, subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.init(width: width, height: nil))
            if !rows[rows.count - 1].indices.isEmpty && rows[rows.count - 1].width + spacing + size.width > width {
                rows.append(Row())
            }
            var row = rows[rows.count - 1]
            row.width += (row.indices.isEmpty ? 0 : spacing) + size.width
            row.height = max(row.height, size.height)
            row.indices.append(index)
            rows[rows.count - 1] = row
        }
        return rows
    }
}

/// Picks the note a question is about: newest first, searchable by title and summary.
struct AskNotePicker: View {
    @Environment(\.dismiss) private var dismiss
    let notes: [VoiceNote]
    let onPick: (VoiceNote) -> Void
    @State private var query = ""

    private var filtered: [VoiceNote] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return notes }
        return notes.filter { $0.title.localizedCaseInsensitiveContains(q) || $0.summary.localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { note in
                Button {
                    onPick(note)
                    dismiss()
                } label: {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(note.title.isEmpty ? "Untitled note" : note.title)
                            .font(.body.weight(.medium))
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                        if !note.summary.isEmpty {
                            Text(note.summary)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        Text(note.createdAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .overlay {
                if filtered.isEmpty {
                    ContentUnavailableView(
                        notes.isEmpty ? "No Notes Yet" : "No Matches",
                        systemImage: "doc.text.magnifyingglass",
                        description: Text(notes.isEmpty ? "Notes appear here once they're processed." : "Try another word.")
                    )
                }
            }
            .searchable(text: $query, prompt: "Search notes")
            .navigationTitle("Attach a Note")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        #if os(iOS)
        .presentationDetents([.medium, .large])
        #else
        .frame(minWidth: 380, minHeight: 420)
        #endif
    }
}
