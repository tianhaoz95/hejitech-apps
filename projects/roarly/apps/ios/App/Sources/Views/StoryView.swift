import RoarlyKit
import SwiftUI

/// The story screen: one big lantern to start listening, the sounds the story brings, and the
/// "tap to add" suggestions the listener isn't sure about.
struct StoryView: View {
    @EnvironmentObject var model: AppModel
    @State private var showLibrary = false
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            ZStack {
                NightSky()
                ScrollView {
                    VStack(spacing: 22) {
                        ModePicker()
                        Lantern()
                        if let error = model.errorMessage {
                            StoryCard {
                                Label(error, systemImage: "exclamationmark.triangle.fill")
                                    .font(Theme.body(15))
                                    .foregroundStyle(Theme.ember)
                            }
                            .accessibilityIdentifier("error")
                        }
                        SuggestionRow()
                        AmbientRow()
                        if model.showWords && model.isListening { TranscriptCard() }
                        if model.isListening { RecentStrip() } else { Hints() }
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                }
                .scrollIndicators(.hidden)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showLibrary = true } label: { Image(systemName: "books.vertical.fill") }
                        .accessibilityLabel("Sound library")
                        .accessibilityIdentifier("library")
                }
                ToolbarItem(placement: .principal) {
                    Text("Roarly").font(Theme.title(22)).foregroundStyle(Theme.moon)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showSettings = true } label: { Image(systemName: "gearshape.fill") }
                        .accessibilityLabel("Settings")
                        .accessibilityIdentifier("settings")
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
            .sheet(isPresented: $showLibrary) { LibraryView() }
            .sheet(isPresented: $showSettings) { SettingsView() }
        }
    }
}

private struct ModePicker: View {
    @EnvironmentObject var model: AppModel
    var body: some View {
        HStack(spacing: 10) {
            ForEach(StoryMode.allCases, id: \.self) { mode in
                let on = model.mode == mode
                Button {
                    withAnimation(.snappy) { model.mode = mode }
                } label: {
                    Label(mode.title, systemImage: mode == .bedtime ? "moon.stars.fill" : "sun.max.fill")
                        .font(Theme.label(15))
                        .padding(.vertical, 9)
                        .padding(.horizontal, 16)
                        .foregroundStyle(on ? Theme.skyDeep : Theme.ink)
                        .background(on ? Theme.lantern : Theme.card, in: Capsule())
                }
                .accessibilityIdentifier("mode-\(mode.rawValue)")
            }
        }
        .padding(.top, 4)
    }
}

/// The big round button. Idle: a sleeping lantern. Listening: it glows with your voice, and the
/// sound that just played pops up inside it.
private struct Lantern: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        VStack(spacing: 14) {
            Button {
                Task { await model.toggle() }
            } label: {
                ZStack {
                    Circle()
                        .fill(RadialGradient(colors: [Theme.lantern.opacity(model.isListening ? 0.55 : 0.18), .clear], center: .center, startRadius: 10, endRadius: 150))
                        .scaleEffect(model.isListening ? 1 + CGFloat(model.level) * 0.35 : 0.9)
                        .animation(.easeOut(duration: 0.25), value: model.level)
                    Circle()
                        .strokeBorder(Theme.lantern.opacity(model.isListening ? 0.9 : 0.35), lineWidth: 3)
                        .background(Circle().fill(Theme.skyDeep.opacity(0.75)))
                        .frame(width: 180, height: 180)
                    centerContent
                }
                .frame(width: 240, height: 240)
                .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(model.isListening ? "Stop listening" : "Start listening")
            .accessibilityIdentifier("lantern")

            Text(caption)
                .font(Theme.body(16))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .animation(.default, value: caption)
        }
    }

    @ViewBuilder private var centerContent: some View {
        if model.isStarting {
            ProgressView().controlSize(.large).tint(Theme.lantern)
        } else if model.isListening {
            TimelineView(.periodic(from: .now, by: 0.2)) { context in
                if let last = model.lastPlayed, context.date.timeIntervalSince(last.at) < 2.5, let cue = SoundCatalog.cue(last.id) {
                    VStack(spacing: 4) {
                        Text(cue.emoji).font(.system(size: 84))
                        Text(cue.name).font(Theme.label(16)).foregroundStyle(Theme.lantern)
                    }
                    .transition(.scale.combined(with: .opacity))
                    .id(last.at)
                } else {
                    VStack(spacing: 8) {
                        Image(systemName: "ear.fill").font(.system(size: 52)).foregroundStyle(Theme.lantern)
                        Text("Listening").font(Theme.label(15)).foregroundStyle(Theme.moon.opacity(0.8))
                    }
                }
            }
            .animation(.spring(response: 0.35, dampingFraction: 0.55), value: model.lastPlayed?.at)
        } else {
            VStack(spacing: 8) {
                Image(systemName: "book.pages.fill").font(.system(size: 54)).foregroundStyle(Theme.lantern)
                Text("Start a story").font(Theme.label(17)).foregroundStyle(Theme.moon)
            }
        }
    }

    private var caption: String {
        if model.isStarting { return model.status }
        if model.isListening {
            return model.mode == .bedtime ? "Tell your story. Soft sounds will follow along." : "Tell your story. Lions roar, rain falls, doors knock."
        }
        return "Tap the lantern, then tell any story out loud."
    }
}

private struct SuggestionRow: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        if !model.suggestions.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Tap to add").font(Theme.label(14)).foregroundStyle(Theme.ink).textCase(.uppercase)
                HStack(spacing: 12) {
                    ForEach(model.suggestions.prefix(3)) { s in
                        if let cue = SoundCatalog.cue(s.cueID) {
                            SuggestionCard(cue: cue, suggestion: s) { model.tap(cue.id) }
                        }
                    }
                }
            }
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .animation(.snappy, value: model.suggestions.map(\.id))
        }
    }
}

private struct SuggestionCard: View {
    let cue: Cue
    let suggestion: Suggestion
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Text(cue.emoji).font(.system(size: 40))
                Text(cue.name).font(Theme.label(15)).foregroundStyle(Theme.moon).lineLimit(1)
                TimelineView(.periodic(from: .now, by: 0.1)) { context in
                    let left = max(0, 1 - context.date.timeIntervalSince(suggestion.createdAt) / 9)
                    Capsule().fill(Theme.lantern.opacity(0.8)).frame(width: 60 * left, height: 3)
                        .frame(width: 60, alignment: .leading)
                }
            }
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(Theme.lantern.opacity(0.14), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Theme.lantern.opacity(0.5)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Play \(cue.name)")
        .accessibilityIdentifier("suggestion-\(cue.id)")
    }
}

private struct AmbientRow: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        if !model.ambients.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Playing now").font(Theme.label(14)).foregroundStyle(Theme.ink).textCase(.uppercase)
                FlowRow(model.ambients) { id in
                    if let cue = SoundCatalog.cue(id) {
                        Button { model.stopAmbient(id) } label: {
                            HStack(spacing: 6) {
                                Text(cue.emoji)
                                Text(cue.name).font(Theme.label(15))
                                Image(systemName: "xmark.circle.fill").foregroundStyle(Theme.ink)
                            }
                            .padding(.vertical, 8).padding(.horizontal, 14)
                            .background(Theme.card, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Stop \(cue.name)")
                        .accessibilityIdentifier("ambient-\(id)")
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct TranscriptCard: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        StoryCard {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(Array(model.finishedLines.suffix(2).enumerated()), id: \.offset) { _, line in
                    Text(line).font(Theme.body(15)).foregroundStyle(Theme.ink.opacity(0.65))
                }
                if !model.liveLine.isEmpty {
                    Text(model.liveLine).font(Theme.body(17)).foregroundStyle(Theme.moon)
                } else if model.finishedLines.isEmpty {
                    Text("Your words will show here…").font(Theme.body(15)).foregroundStyle(Theme.ink.opacity(0.5))
                }
            }
        }
        .accessibilityIdentifier("transcript")
    }
}

private struct RecentStrip: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        if !model.recent.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Again!").font(Theme.label(14)).foregroundStyle(Theme.ink).textCase(.uppercase)
                ScrollView(.horizontal) {
                    HStack(spacing: 10) {
                        ForEach(model.recent, id: \.self) { id in
                            if let cue = SoundCatalog.cue(id) {
                                Button { model.tap(id) } label: {
                                    VStack(spacing: 2) {
                                        Text(cue.emoji).font(.system(size: 30))
                                        Text(cue.name).font(Theme.label(12)).foregroundStyle(Theme.ink)
                                    }
                                    .frame(width: 76, height: 76)
                                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                                    .overlay(alignment: .topTrailing) {
                                        if !model.isUnlocked(cue) {
                                            Image(systemName: "lock.fill").font(.caption2).foregroundStyle(Theme.ink).padding(6)
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                                .accessibilityIdentifier("again-\(id)")
                            }
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct Hints: View {
    @EnvironmentObject var model: AppModel
    private let lines = [
        ("🦁", "“Suddenly, a lion roared!”"),
        ("🌧️", "“And then it started to rain…”"),
        ("🚪", "“Knock knock! Who's there?”"),
        ("🐯", "“A tiger is chasing you!”"),
    ]

    var body: some View {
        StoryCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Try saying").font(Theme.label(14)).foregroundStyle(Theme.ink).textCase(.uppercase)
                ForEach(lines, id: \.1) { emoji, line in
                    HStack(spacing: 12) {
                        Text(emoji).font(.system(size: 26))
                        Text(line).font(Theme.body(17)).foregroundStyle(Theme.moon)
                    }
                }
                Text("If the tiger is running away, Roarly stays quiet. When it isn't sure, it offers a sound for you to tap.")
                    .font(Theme.body(14))
                    .foregroundStyle(Theme.ink.opacity(0.8))
                    .padding(.top, 4)
            }
        }
    }
}

/// Wraps chips onto new lines.
struct FlowRow<Item: Hashable, Content: View>: View {
    let items: [Item]
    let content: (Item) -> Content

    init(_ items: [Item], @ViewBuilder content: @escaping (Item) -> Content) {
        self.items = items
        self.content = content
    }

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(items, id: \.self) { content($0) }
        }
    }
}

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 360
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > width, x > 0 { x = 0; y += rowHeight + spacing; rowHeight = 0 }
            x += s.width + spacing
            rowHeight = max(rowHeight, s.height)
        }
        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for v in subviews {
            let s = v.sizeThatFits(.unspecified)
            if x + s.width > bounds.maxX, x > bounds.minX { x = bounds.minX; y += rowHeight + spacing; rowHeight = 0 }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing
            rowHeight = max(rowHeight, s.height)
        }
    }
}
