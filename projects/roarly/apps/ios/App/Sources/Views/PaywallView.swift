import RoarlyKit
import StoreKit
import SwiftUI

/// "Open the whole storybook": Roarly Pro as a page of a picture book. Every sound, your own
/// words, the Apple Watch remote. Yearly (with a free week) or once for good.
struct PaywallView: View {
    @EnvironmentObject var store: ProStore
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var choice: String = ProStore.yearlyID

    var body: some View {
        ZStack {
            NightSky()
            ScrollView {
                VStack(spacing: 22) {
                    HStack {
                        Spacer()
                        Button { dismiss() } label: {
                            Image(systemName: "xmark").font(.headline).foregroundStyle(Theme.ink)
                                .padding(10).background(Theme.card, in: Circle())
                        }
                        .accessibilityLabel("Close")
                    }
                    Text(reasonEmoji).font(.system(size: 64))
                    Text(headline).font(Theme.title(28)).foregroundStyle(Theme.moon).multilineTextAlignment(.center)
                    Text("Roarly is free to use for good. Pro is optional: buy it only if you want more sounds.")
                        .font(Theme.body(15)).foregroundStyle(Theme.ink).multilineTextAlignment(.center)

                    plan("Free, for good", already: true, lines: [
                        "\(SoundCatalog.freeCues.count) sounds: " + SoundCatalog.freeCues.map(\.emoji).joined(separator: " "),
                        "As many stories as you like, no time limit",
                        "Listening, Bedtime and Playtime, tap-to-play cards",
                    ])
                    plan("Roarly Pro", already: false, lines: [
                        "+\(SoundCatalog.all.count - SoundCatalog.freeCues.count) more sounds: " + SoundCatalog.all.filter { !$0.isFree }.prefix(14).map(\.emoji).joined(separator: " ") + " …",
                        "Your own words (\"Mister Whiskers\" plays the cat)",
                        "Apple Watch remote: tap sounds or play them on the watch",
                        "Every sound we add later",
                    ])

                    if store.products.isEmpty {
                        if store.loadFailed {
                            VStack(spacing: 10) {
                                Text("The App Store didn't answer. Check your connection and try again.").font(Theme.body(15)).foregroundStyle(Theme.ink).multilineTextAlignment(.center)
                                Button("Try again") { Task { await store.load() } }.buttonStyle(LanternButtonStyle())
                            }
                        } else {
                            ProgressView().tint(Theme.lantern)
                        }
                    } else {
                        VStack(spacing: 12) {
                            if let y = store.yearly { option(y, title: "Yearly", detail: yearlyDetail(y)) }
                            if let l = store.lifetime { option(l, title: "Forever", detail: "\(l.displayPrice) once. Yours for good.") }
                        }
                        Button(buttonTitle) {
                            Task {
                                if let p = store.products.first(where: { $0.id == choice }), await store.buy(p) { dismiss() }
                            }
                        }
                        .buttonStyle(LanternButtonStyle())
                        .disabled(store.purchasing)
                        .accessibilityIdentifier("buy")
                    }

                    Text(terms).font(.caption).foregroundStyle(Theme.ink.opacity(0.75)).multilineTextAlignment(.center)
                    HStack(spacing: 18) {
                        Button("Restore") { Task { await store.restore(); if store.isPro { dismiss() } } }
                        Link("Terms", destination: URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!)
                        Link("Privacy", destination: URL(string: "https://tianhaoz95.github.io/hejitech-apps/roarly/privacy.html")!)
                    }
                    .font(Theme.label(14))
                }
                .padding(22)
            }
        }
        .preferredColorScheme(.dark)
    }

    private var reasonCue: Cue? {
        if case .sound(let id) = model.paywallReason { return SoundCatalog.cue(id) }
        return nil
    }

    private var reasonEmoji: String {
        if let c = reasonCue { return c.emoji }
        switch model.paywallReason {
        case .customWords: return "✍️"
        case .watch: return "⌚️"
        default: return "📖"
        }
    }

    private var headline: String {
        if let c = reasonCue { return "\(c.name) is a Pro sound" }
        switch model.paywallReason {
        case .customWords: return "Your own words are part of Pro"
        case .watch: return "The watch remote is part of Pro"
        default: return "Open the whole storybook"
        }
    }

    private func plan(_ title: String, already: Bool, lines: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title).font(Theme.label(17)).foregroundStyle(Theme.moon)
                Spacer()
                if already {
                    Text("You have this").font(Theme.label(12)).foregroundStyle(Theme.ink)
                        .padding(.horizontal, 8).padding(.vertical, 3).background(Theme.card, in: Capsule())
                }
            }
            ForEach(lines, id: \.self) { line in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: already ? "checkmark" : "star.fill").font(.caption)
                        .foregroundStyle(already ? Theme.ink : Theme.lantern).padding(.top, 4)
                    Text(line).font(Theme.body(14)).foregroundStyle(already ? Theme.ink : Theme.moon)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(already ? Theme.card : Theme.lantern.opacity(0.08), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(already ? Theme.cardStroke : Theme.lantern.opacity(0.5)))
    }

    private func option(_ product: Product, title: String, detail: String) -> some View {
        let on = choice == product.id
        return Button { choice = product.id } label: {
            HStack {
                Image(systemName: on ? "largecircle.fill.circle" : "circle").foregroundStyle(on ? Theme.lantern : Theme.ink)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(Theme.label(17)).foregroundStyle(Theme.moon)
                    Text(detail).font(Theme.body(14)).foregroundStyle(Theme.ink)
                }
                Spacer()
            }
            .padding(16)
            .background(on ? Theme.lantern.opacity(0.14) : Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(on ? Theme.lantern : Theme.cardStroke))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("option-\(title.lowercased())")
    }

    private var trialText: String? {
        guard store.eligibleForTrial, let offer = store.yearly?.subscription?.introductoryOffer, offer.paymentMode == .freeTrial else { return nil }
        let p = offer.period
        let unit = p.unit == .week ? "week" : p.unit == .day ? "day" : p.unit == .month ? "month" : "year"
        if p.unit == .day && p.value == 7 { return "1 week" }
        return "\(p.value) \(unit)\(p.value == 1 ? "" : "s")"
    }

    private func yearlyDetail(_ y: Product) -> String {
        if let t = trialText { return "\(t) free, then \(y.displayPrice) a year" }
        return "\(y.displayPrice) a year"
    }

    private var buttonTitle: String {
        if choice == ProStore.yearlyID, trialText != nil { return "Start the free week" }
        return "Continue"
    }

    private var terms: String {
        if choice == ProStore.yearlyID, let y = store.yearly {
            let lead = trialText.map { "Free for \($0), then " } ?? ""
            return "\(lead)\(y.displayPrice) per year, renewing automatically until you cancel in Settings › Apple Account › Subscriptions at least 24 hours before the period ends. Payment is charged to your Apple Account."
        }
        return "A one-time purchase. No subscription."
    }
}
