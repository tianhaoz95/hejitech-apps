import CarPlay
import Foundation
import G2DigestKit

/// CarPlay audio scene (`CPListTemplate`) backed by `OfflineStore` and `AudioPlayerService`.
/// Gives drivers one-tap access to Latest Glances, Latest Deep Dives, individual cards, and cached past editions.
@MainActor
public final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    private var interfaceController: CPInterfaceController?

    public func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didConnect interfaceController: CPInterfaceController
    ) {
        self.interfaceController = interfaceController
        Task {
            let root = await buildRootTemplate()
            try? await interfaceController.setRootTemplate(root, animated: true)
        }
    }

    public func templateApplicationScene(
        _ templateApplicationScene: CPTemplateApplicationScene,
        didDisconnectInterfaceController interfaceController: CPInterfaceController
    ) {
        self.interfaceController = nil
    }

    private func buildRootTemplate() async -> CPListTemplate {
        let cached = await OfflineStore.shared.loadAllCachedEditions()
        let latest = cached.first

        var sections: [CPListSection] = []

        if let latest {
            let playGlances = CPListItem(text: "Play Latest Glances", detailText: "\(latest.date) · \(latest.edition.title)")
            playGlances.handler = { [weak self] _, completion in
                Task { @MainActor in
                    AudioPlayerService.shared.playQueue(cards: latest.cards, mode: .glance, editionTitle: latest.edition.title, editionDate: latest.date)
                    self?.pushNowPlaying()
                    completion()
                }
            }

            let playDeepDives = CPListItem(text: "Play Latest Deep Dives", detailText: "\(latest.date) · Full audio briefings")
            playDeepDives.handler = { [weak self] _, completion in
                Task { @MainActor in
                    AudioPlayerService.shared.playQueue(cards: latest.cards, mode: .deepDive, editionTitle: latest.edition.title, editionDate: latest.date)
                    self?.pushNowPlaying()
                    completion()
                }
            }

            sections.append(CPListSection(items: [playGlances, playDeepDives], header: "Today's Briefing", sectionIndexTitle: nil))

            let audioCards = latest.cards.filter { $0.glance != nil || $0.deepDive != nil }
            let cardItems: [CPListItem] = audioCards.prefix(12).map { card in
                let detail = card.deepDive != nil ? "Deep Dive · \(Int(card.deepDive!.durationSec / 60)) min" : "Glance · \(Int(card.glance?.durationSec ?? 30))s"
                let item = CPListItem(text: card.title, detailText: detail)
                item.handler = { [weak self] _, completion in
                    Task { @MainActor in
                        let mode: AudioTrackMode = card.glance != nil ? .glance : .deepDive
                        AudioPlayerService.shared.playQueue(cards: [card], mode: mode, editionTitle: latest.edition.title, editionDate: latest.date)
                        self?.pushNowPlaying()
                        completion()
                    }
                }
                return item
            }
            if !cardItems.isEmpty {
                sections.append(CPListSection(items: cardItems, header: "Cards", sectionIndexTitle: nil))
            }
        } else {
            let empty = CPListItem(text: "No cached edition yet", detailText: "Open G2 Digest on your iPhone to sync")
            sections.append(CPListSection(items: [empty], header: "G2 Digest", sectionIndexTitle: nil))
        }

        if cached.count > 1 {
            let pastItems: [CPListItem] = cached.dropFirst().map { bundle in
                let item = CPListItem(text: bundle.edition.title, detailText: "\(bundle.date) · \(bundle.cards.count) cards")
                item.handler = { [weak self] _, completion in
                    Task { @MainActor in
                        AudioPlayerService.shared.playQueue(cards: bundle.cards, mode: .glance, editionTitle: bundle.edition.title, editionDate: bundle.date)
                        self?.pushNowPlaying()
                        completion()
                    }
                }
                return item
            }
            sections.append(CPListSection(items: pastItems, header: "Past Editions", sectionIndexTitle: nil))
        }

        return CPListTemplate(title: "G2 Digest", sections: sections)
    }

    private func pushNowPlaying() {
        guard let ic = interfaceController else { return }
        if ic.topTemplate !== CPNowPlayingTemplate.shared {
            ic.pushTemplate(CPNowPlayingTemplate.shared, animated: true, completion: nil)
        }
    }
}
