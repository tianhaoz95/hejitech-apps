import RoarlyKit
import SwiftUI

/// Every sound, by shelf. Tap to hear it; the pencil adds your own words for it ("Mister
/// Whiskers" for the cat). Locked ones open the storybook pass.
struct LibraryView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var editing: Cue?

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: 12)]

    var body: some View {
        NavigationStack {
            ZStack {
                NightSky()
                ScrollView {
                    VStack(alignment: .leading, spacing: 26) {
                        if !model.isPro {
                            Button { model.openPaywall(.browse) } label: {
                                StoryCard {
                                    HStack(spacing: 12) {
                                        Image(systemName: "lock.open.fill").font(.title2).foregroundStyle(Theme.lantern)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("\(SoundCatalog.freeCues.count) of \(SoundCatalog.all.count) sounds are open").font(Theme.label(16)).foregroundStyle(Theme.moon)
                                            Text("Open the whole storybook to hear them all.").font(Theme.body(14)).foregroundStyle(Theme.ink)
                                        }
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                        ForEach(Cue.Category.allCases, id: \.self) { category in
                            let cues = SoundCatalog.all.filter { $0.category == category }
                            if !cues.isEmpty {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text(category.title).font(Theme.title(20)).foregroundStyle(Theme.moon)
                                    LazyVGrid(columns: columns, spacing: 12) {
                                        ForEach(cues) { cue in tile(cue) }
                                    }
                                }
                            }
                        }
                        Text("Tap a sound to hear it. Hold one to add your own words for it.")
                            .font(Theme.body(14)).foregroundStyle(Theme.ink)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Sounds")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(item: $editing) { cue in CustomWordsView(cue: cue) }
        }
    }

    private func tile(_ cue: Cue) -> some View {
        let open = model.isUnlocked(cue)
        return Button {
            if open { AudioHub.shared.preview(cue, volume: 0.8) } else { model.openPaywall(.sound(cue.id)) }
        } label: {
            VStack(spacing: 4) {
                Text(cue.emoji).font(.system(size: 34)).opacity(open ? 1 : 0.45)
                Text(cue.name).font(Theme.label(13)).foregroundStyle(open ? Theme.moon : Theme.ink.opacity(0.6)).lineLimit(1)
                if cue.kind == .ambient {
                    Text("loops").font(.system(size: 10, weight: .semibold, design: .rounded)).foregroundStyle(Theme.lantern.opacity(0.8))
                }
            }
            .frame(maxWidth: .infinity, minHeight: 92)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(alignment: .topTrailing) {
                if !open {
                    Image(systemName: "lock.fill").font(.caption2).foregroundStyle(Theme.ink).padding(8)
                } else if !(model.customWords[cue.id] ?? []).isEmpty {
                    Image(systemName: "text.badge.plus").font(.caption2).foregroundStyle(Theme.lantern).padding(8)
                }
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            if open {
                Button("Play", systemImage: "play.fill") { AudioHub.shared.preview(cue, volume: 0.8) }
                Button("Your words for it…", systemImage: "pencil") {
                    if model.isPro { editing = cue } else { model.openPaywall(.customWords) }
                }
            }
        }
        .accessibilityIdentifier("tile-\(cue.id)")
    }
}

/// Extra trigger words for one sound (names of toys, pets, made-up creatures).
struct CustomWordsView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    let cue: Cue
    @State private var words: [String] = []
    @State private var draft = ""

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("\(cue.emoji)  Roarly already listens for: \(cue.triggers.prefix(5).joined(separator: ", ")).")
                        .font(Theme.body(15))
                }
                Section("Your words") {
                    ForEach(words, id: \.self) { Text($0) }
                        .onDelete { words.remove(atOffsets: $0) }
                    HStack {
                        TextField("e.g. Mister Whiskers", text: $draft)
                            .textInputAutocapitalization(.never)
                            .onSubmit(add)
                        Button("Add", action: add).disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }
            }
            .navigationTitle(cue.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        var all = model.customWords
                        all[cue.id] = words.isEmpty ? nil : words
                        model.customWords = all
                        dismiss()
                    }
                }
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .onAppear { words = model.customWords[cue.id] ?? [] }
        }
    }

    private func add() {
        let w = draft.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !w.isEmpty, !words.contains(w) else { return }
        words.append(w)
        draft = ""
    }
}
