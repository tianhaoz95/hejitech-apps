import RoarlyKit
import SwiftUI

private let lantern = Color(red: 1.0, green: 0.78, blue: 0.34)
private let night = Color(red: 0.05, green: 0.05, blue: 0.16)

struct WatchRootView: View {
    @EnvironmentObject var model: WatchModel

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    if !model.state.isPro && model.state.listening {
                        Text("The watch remote is part of Roarly Pro. Open it on your iPhone.")
                            .font(.footnote).multilineTextAlignment(.center).foregroundStyle(.secondary)
                    }
                    listenButton
                    if model.state.isPro {
                        if !model.state.suggestions.isEmpty {
                            section("Tap to add")
                            ForEach(model.state.suggestions, id: \.self) { id in cueButton(id, highlighted: true) }
                        }
                        if !model.state.ambients.isEmpty {
                            section("Playing now")
                            ForEach(model.state.ambients, id: \.self) { id in cueButton(id, trailing: "xmark") }
                        }
                        if !model.state.recent.isEmpty {
                            section("Again")
                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]) {
                                ForEach(model.state.recent.prefix(6), id: \.self) { id in
                                    if let cue = SoundCatalog.cue(id) {
                                        Button { model.tap(id) } label: { Text(cue.emoji).font(.title2) }
                                            .buttonStyle(.bordered)
                                    }
                                }
                            }
                        }
                    }
                    if model.state.soundsOnWatch {
                        Label("Sounds play on this watch", systemImage: "applewatch.radiowaves.left.and.right")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal, 4)
            }
            .navigationTitle("Roarly")
            .containerBackground(night.gradient, for: .navigation)
        }
        .onAppear { model.hello() }
    }

    private var listenButton: some View {
        Button { model.toggleListening() } label: {
            VStack(spacing: 4) {
                Image(systemName: model.state.listening ? "ear.fill" : "book.pages.fill").font(.title)
                Text(model.state.listening ? "Listening · tap to stop" : "Start a story").font(.footnote.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .tint(model.state.listening ? lantern : .gray)
        .disabled(!model.reachable)
        .overlay(alignment: .bottom) {
            if !model.reachable {
                Text("Open Roarly on your iPhone").font(.caption2).foregroundStyle(.secondary).offset(y: 22)
            }
        }
        .padding(.bottom, model.reachable ? 0 : 18)
    }

    private func section(_ title: String) -> some View {
        Text(title).font(.caption.weight(.semibold)).foregroundStyle(lantern).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4)
    }

    @ViewBuilder
    private func cueButton(_ id: String, highlighted: Bool = false, trailing: String? = nil) -> some View {
        if let cue = SoundCatalog.cue(id) {
            Button { model.tap(id) } label: {
                HStack {
                    Text(cue.emoji).font(.title3)
                    Text(cue.name).font(.body.weight(.semibold))
                    Spacer()
                    if let trailing { Image(systemName: trailing).foregroundStyle(.secondary) }
                }
            }
            .tint(highlighted ? lantern : nil)
        }
    }
}
