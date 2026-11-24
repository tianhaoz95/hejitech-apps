import SwiftUI
import WatchConnectivity

struct WatchCard: Identifiable, Hashable {
    var id: String { slug }
    let slug: String
    let kind: String
    let title: String
    let body: String
    let alert: Bool
    let hasGlance: Bool
    let hasDeepDive: Bool
}

@MainActor
final class WatchStore: NSObject, ObservableObject, WCSessionDelegate {
    @Published var date: String = ""
    @Published var title: String = "G2 Digest"
    @Published var cards: [WatchCard] = []
    @Published var isPlaying: Bool = false
    @Published var playingTitle: String = ""

    override init() {
        super.init()
        if WCSession.isSupported() {
            let s = WCSession.default
            s.delegate = self
            s.activate()
            apply(context: s.receivedApplicationContext)
        }
    }

    func sendCommand(_ command: String) {
        guard WCSession.isSupported(), WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["command": command], replyHandler: nil, errorHandler: nil)
    }

    private func apply(context: [String: Any]) {
        if let d = context["date"] as? String { date = d }
        if let t = context["title"] as? String, !t.isEmpty { title = t }
        if let p = context["isPlaying"] as? Bool { isPlaying = p }
        if let pt = context["playingTitle"] as? String { playingTitle = pt }
        if let rawCards = context["cards"] as? [[String: Any]] {
            cards = rawCards.compactMap { dict in
                guard let slug = dict["slug"] as? String,
                      let title = dict["title"] as? String,
                      let body = dict["body"] as? String else { return nil }
                return WatchCard(
                    slug: slug,
                    kind: (dict["kind"] as? String) ?? "section",
                    title: title,
                    body: body,
                    alert: (dict["alert"] as? Bool) ?? false,
                    hasGlance: (dict["hasGlance"] as? Bool) ?? false,
                    hasDeepDive: (dict["hasDeepDive"] as? Bool) ?? false
                )
            }
        }
    }

    nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        let ctx = session.receivedApplicationContext
        Task { @MainActor in self.apply(context: ctx) }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in self.apply(context: applicationContext) }
    }
}

@main
struct G2DigestWatchApp: App {
    @StateObject private var store = WatchStore()

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                WatchHomeView(store: store)
            }
        }
    }
}

struct WatchHomeView: View {
    @ObservedObject var store: WatchStore

    var alerts: [WatchCard] { store.cards.filter(\.alert) }
    var tldr: WatchCard? { store.cards.first(where: { $0.kind == "tldr" }) }

    var body: some View {
        List {
            if store.cards.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("No edition synced")
                        .font(.headline)
                    Text("Open G2 Digest on your iPhone to sync today's briefing to your wrist.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            } else {
                Section {
                    HStack(spacing: 8) {
                        Button {
                            store.sendCommand("playGlances")
                        } label: {
                            Label("Glances", systemImage: "headphones")
                                .font(.caption2)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)

                        Button {
                            store.sendCommand(store.isPlaying ? "togglePlayPause" : "playDeepDives")
                        } label: {
                            Image(systemName: store.isPlaying ? "pause.fill" : "waveform")
                        }
                        .buttonStyle(.bordered)
                    }
                    if !store.playingTitle.isEmpty {
                        HStack {
                            Text(store.playingTitle)
                                .font(.caption2)
                                .lineLimit(1)
                            Spacer()
                            Button { store.sendCommand("nextCard") } label: {
                                Image(systemName: "forward.fill")
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } header: {
                    Text(store.date.isEmpty ? store.title : store.date)
                }

                if !alerts.isEmpty {
                    Section("Alerts") {
                        ForEach(alerts) { card in
                            NavigationLink(value: card) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(card.title)
                                        .font(.headline)
                                        .foregroundStyle(.orange)
                                        .lineLimit(2)
                                    Text(card.body)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                }
                            }
                        }
                    }
                }

                if let tldr {
                    Section("TL;DR") {
                        NavigationLink(value: tldr) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(tldr.title).font(.headline).lineLimit(2)
                                Text(tldr.body).font(.caption2).foregroundStyle(.secondary).lineLimit(3)
                            }
                        }
                    }
                }

                Section("Cards") {
                    ForEach(store.cards.filter { $0.kind == "section" && !$0.alert }) { card in
                        NavigationLink(value: card) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(card.title).font(.subheadline).bold().lineLimit(2)
                                Text(card.body).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(store.title)
        .navigationDestination(for: WatchCard.self) { card in
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    if card.alert {
                        Text("ALERT")
                            .font(.caption2.bold())
                            .foregroundStyle(.orange)
                    }
                    Text(card.title)
                        .font(.headline)
                    Text(card.body)
                        .font(.body)
                }
                .padding(.horizontal, 4)
            }
            .navigationTitle("Card")
        }
    }
}
