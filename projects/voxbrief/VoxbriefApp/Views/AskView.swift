import SwiftUI

/// Ask Voxbrief: questions about the user's own notes, answered on the device by the same model
/// that writes the notes (see `AskService`). The conversation lives only as long as the sheet.
struct AskView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var repository: NoteRepository
    @State private var exchanges: [Exchange] = []
    @State private var draft = ""
    @State private var currentTask: Task<Void, Never>?
    @FocusState private var isInputFocused: Bool

    private struct Exchange: Identifiable {
        let id = UUID()
        let question: String
        var answer: AskAnswer?
        var error: String?
    }

    static let suggestions = [
        "What are my open action items?",
        "What did I record yesterday?",
        "What ideas did I have last week?",
    ]

    private var isAsking: Bool { currentTask != nil }

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
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: exchanges.count) { _, _ in
                    if let last = exchanges.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .top) }
                    }
                }
            }
            .safeAreaInset(edge: .bottom) { inputBar }
            .background(AppPageBackground())
            .navigationTitle("Ask Voxbrief")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onDisappear { currentTask?.cancel() }
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Ask about your notes", systemImage: "sparkles")
                .font(.headline)
            Text("Answers come from your own notes, written on this iPhone by the same model that writes them. Nothing leaves the device.")
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
                Text(exchange.question)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .foregroundStyle(.white)
                    .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }

            if let answer = exchange.answer {
                if !answer.keywords.isEmpty {
                    Label("Searched \(answer.notesSearched) notes for \(answer.keywords.prefix(6).joined(separator: ", "))", systemImage: "magnifyingglass")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
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
                    Text("Reading your notes…")
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
                .foregroundStyle(answer.notFound ? .secondary : .primary)

            if !answer.points.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(answer.points) { point in
                        pointRow(point, quoted: answer.kind == .excerpts)
                    }
                }
            }

            if !answer.citations.isEmpty {
                FlowLayout(spacing: 6) {
                    ForEach(answer.citations) { citation in
                        citationChip(citation)
                    }
                }
            }

            Divider()
            Label(footer(for: answer), systemImage: answer.engine == nil ? "doc.text.magnifyingglass" : "cpu")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func pointRow(_ point: AskAnswer.Point, quoted: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: quoted ? "quote.opening" : "circle.fill")
                .font(.system(size: quoted ? 11 : 5))
                .foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 4) {
                Text(point.text)
                    .font(.subheadline)
                    .italic(quoted)
                    .textSelection(.enabled)
                HStack(spacing: 6) {
                    citationChip(point.citation)
                    if let detail = point.detail {
                        Text(detail)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(detail == "High" ? .red : .secondary)
                    }
                }
            }
        }
    }

    private func footer(for answer: AskAnswer) -> String {
        switch answer.kind {
        case .answered:
            return "Answered on this iPhone · \(CleanupEngineLabel.displayName(for: answer.engine ?? ""))"
        case .listed:
            return "Listed from your notes"
        case .excerpts:
            return "Quoted from your notes"
        case .notFound:
            return answer.notesSearched > 0 ? "Searched \(answer.notesSearched) note\(answer.notesSearched == 1 ? "" : "s")" : "Searched your notes"
        }
    }

    /// The answer with inline Markdown (bold, italics) applied; plain text if it doesn't parse.
    static func rendered(_ text: String) -> AttributedString {
        (try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text)
    }

    @ViewBuilder
    private func citationChip(_ citation: AskAnswer.Citation) -> some View {
        if let note = repository.note(withId: citation.noteId) {
            HStack(spacing: 4) {
                NavigationLink {
                    NoteDetailView(note: note)
                } label: {
                    Label(citation.noteTitle, systemImage: "doc.text")
                        .lineLimit(1)
                }
                if let time = citation.startTime, let fileName = note.audioFileName {
                    Button {
                        AudioPlaybackService.shared.play(fileName: fileName, startingAt: time)
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

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("Ask about your notes…", text: $draft, axis: .vertical)
                .lineLimit(1...4)
                .focused($isInputFocused)
                .submitLabel(.send)
                .onSubmit { send(draft) }
            Button {
                send(draft)
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 30))
            }
            .disabled(isAsking || draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Ask")
        }
        .padding(.leading, 16)
        .padding(.trailing, 6)
        .padding(.vertical, 6)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .padding(.horizontal)
        .padding(.bottom, 8)
    }

    private func send(_ text: String) {
        let question = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !question.isEmpty, !isAsking else { return }
        draft = ""
        isInputFocused = false
        let exchange = Exchange(question: question)
        exchanges.append(exchange)
        currentTask = Task {
            do {
                let answer = try await AskService.shared.ask(question)
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
