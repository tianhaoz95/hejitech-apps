import SwiftUI
import G2DigestKit

public struct NativeReaderView: View {
    @ObservedObject var appModel: AppModel
    @ObservedObject var player = AudioPlayerService.shared

    public init(appModel: AppModel) {
        self.appModel = appModel
    }

    public var body: some View {
        if let bundle = appModel.currentBundle, !bundle.cards.isEmpty {
            let total = bundle.cards.count
            let currentIdx = min(appModel.currentCardIndex, total - 1)
            let card = bundle.cards[currentIdx]
            let isTour = TourBuilder.isTour(bundle)

            VStack(spacing: 0) {
                // Card Progress & Indicators
                HStack(spacing: 8) {
                    Text("CARD \(currentIdx + 1) OF \(total)")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)

                    Spacer()

                    if card.alert == true {
                        Label("ALERT", systemImage: "exclamationmark.triangle.fill")
                            .font(.caption2.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.red.opacity(0.15))
                            .foregroundStyle(.red)
                            .clipShape(Capsule())
                    } else if card.kind == .tldr {
                        Text("TL;DR")
                            .font(.caption2.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.orange.opacity(0.15))
                            .foregroundStyle(.orange)
                            .clipShape(Capsule())
                    } else if card.kind == .cover {
                        Text("COVER")
                            .font(.caption2.bold())
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.accentColor.opacity(0.15))
                            .foregroundStyle(Color.accentColor)
                            .clipShape(Capsule())
                    }

                    if appModel.hasAccess && !isTour {
                        Button {
                            Task { await appModel.toggleBookmarkForCurrentCard() }
                        } label: {
                            Image(systemName: appModel.isCardBookmarked(card) ? "bookmark.fill" : "bookmark")
                                .font(.subheadline)
                                .foregroundStyle(appModel.isCardBookmarked(card) ? Color.accentColor : .secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(appModel.isCardBookmarked(card) ? "Remove bookmark" : "Bookmark card")
                    }
                }
                .padding(.horizontal)
                .padding(.top, 8)

                // Swipeable Card Pager
                TabView(selection: Binding(
                    get: { min(appModel.currentCardIndex, total - 1) },
                    set: { appModel.goToCard(index: $0) }
                )) {
                    ForEach(Array(bundle.cards.enumerated()), id: \.offset) { idx, c in
                        cardBody(bundle: bundle, card: c)
                            .tag(idx)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))

                // Bottom Pagination Controls
                HStack {
                    Button {
                        withAnimation { appModel.prevCard() }
                    } label: {
                        HStack {
                            Image(systemName: "chevron.left")
                            Text("Previous")
                        }
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(Capsule())
                    }
                    .disabled(currentIdx == 0)

                    Spacer()

                    // Windowed card indicator dots (stays centered for any edition length)
                    windowedDots(currentIdx: currentIdx, total: total)

                    Spacer()

                    Button {
                        withAnimation { appModel.nextCard() }
                    } label: {
                        HStack {
                            Text("Next")
                            Image(systemName: "chevron.right")
                        }
                        .font(.subheadline.weight(.medium))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(Capsule())
                    }
                    .disabled(currentIdx >= total - 1)
                }
                .padding(.horizontal)
                .padding(.vertical, 12)
                .background(Color(.systemBackground))
            }
        } else {
            ContentUnavailableView(
                "No Cards to Display",
                systemImage: "newspaper",
                description: Text("Connect an agent or load an edition.")
            )
        }
    }

    @ViewBuilder
    private func cardBody(bundle: BundleData, card: CardInput) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                // Title
                Text(card.title)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.primary)

                // Key Metric Callout
                if let keyNumber = card.keyNumber, !keyNumber.isEmpty {
                    HStack {
                        Text(keyNumber)
                            .font(.system(size: 32, weight: .black, design: .rounded))
                            .foregroundStyle(Color.accentColor)
                        Spacer()
                    }
                    .padding()
                    .background(Color.accentColor.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Metrics Grid
                if let metrics = card.metrics, !metrics.isEmpty {
                    HStack(spacing: 12) {
                        ForEach(metrics, id: \.label) { m in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(m.label.uppercased())
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                Text(m.value)
                                    .font(.subheadline.bold())
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        }
                    }
                }

                // Body text
                Text(card.body)
                    .font(.body)
                    .lineSpacing(4)
                    .foregroundStyle(.primary)

                // Audio Action Buttons
                VStack(spacing: 10) {
                    if card.glance != nil {
                        Button {
                            player.play(card: card, mode: .glance)
                        } label: {
                            HStack {
                                Image(systemName: isPlayingThis(card: card, mode: .glance) ? "pause.fill" : "play.fill")
                                Text("Glance Audio")
                                    .fontWeight(.semibold)
                                Spacer()
                                if let sec = card.glance?.durationSec {
                                    Text("\(Int(sec))s")
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(isPlayingThis(card: card, mode: .glance) ? Color.accentColor : Color(.secondarySystemBackground))
                            .foregroundStyle(isPlayingThis(card: card, mode: .glance) ? Color.black : Color.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }

                    if card.deepDive != nil {
                        Button {
                            player.play(card: card, mode: .deepDive)
                        } label: {
                            HStack {
                                Image(systemName: isPlayingThis(card: card, mode: .deepDive) ? "pause.fill" : "headphones")
                                Text("Deep Dive Audio")
                                    .fontWeight(.semibold)
                                Spacer()
                                if let sec = card.deepDive?.durationSec {
                                    let mins = Int(sec) / 60
                                    let remainder = Int(sec) % 60
                                    Text(String(format: "%d:%02d", mins, remainder))
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(isPlayingThis(card: card, mode: .deepDive) ? Color.accentColor : Color(.secondarySystemBackground))
                            .foregroundStyle(isPlayingThis(card: card, mode: .deepDive) ? Color.black : Color.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding(.vertical, 6)

                // Section details if available
                if let sectionId = card.sectionId,
                   let sec = bundle.edition.sections.first(where: { $0.sectionId == sectionId }) {
                    Divider()
                        .padding(.vertical, 4)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("SECTION OVERVIEW")
                            .font(.caption2.bold())
                            .foregroundStyle(.secondary)

                        Text(sec.title)
                            .font(.headline)

                        Text(sec.body)
                            .font(.footnote)
                            .foregroundStyle(.secondary)

                        if !sec.sources.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("SOURCES")
                                    .font(.caption2.bold())
                                    .foregroundStyle(.secondary)
                                    .padding(.top, 4)

                                ForEach(sec.sources, id: \.url) { src in
                                    if let url = URL(string: src.url) {
                                        Link(destination: url) {
                                            HStack(spacing: 6) {
                                                Image(systemName: "arrow.up.right.square")
                                                    .font(.caption)
                                                Text(src.title)
                                                    .font(.footnote)
                                                    .lineLimit(1)
                                            }
                                            .foregroundStyle(Color.accentColor)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .refreshable { await appModel.refreshAll() }
    }

    @ViewBuilder
    private func windowedDots(currentIdx: Int, total: Int) -> some View {
        let maxDots = 9
        let shown = min(total, maxDots)
        let start = max(0, min(currentIdx - shown / 2, total - shown))
        HStack(spacing: 5) {
            ForEach(0..<shown, id: \.self) { k in
                let cardPos = start + k
                let isEdgeOverflow = (k == 0 && start > 0) || (k == shown - 1 && start + shown < total)
                Circle()
                    .fill(cardPos == currentIdx ? Color.accentColor : Color.secondary.opacity(isEdgeOverflow ? 0.18 : 0.35))
                    .frame(width: cardPos == currentIdx ? 8 : (isEdgeOverflow ? 4.5 : 6.5),
                           height: cardPos == currentIdx ? 8 : (isEdgeOverflow ? 4.5 : 6.5))
            }
        }
        .animation(.easeInOut(duration: 0.15), value: currentIdx)
    }

    private func isPlayingThis(card: CardInput, mode: AudioTrackMode) -> Bool {
        player.currentCard?.slug == card.slug && player.currentMode == mode && player.isPlaying
    }
}
