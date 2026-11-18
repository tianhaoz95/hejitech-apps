import RoarlyKit
import StoreKit
import SwiftUI

/// "Open the whole storybook": Roarly Pro as a page of a picture book. Every sound, your own
/// words, the Apple Watch remote. Yearly (with a free week) or once for good.
struct PaywallView: View {
    @EnvironmentObject var store: ProStore
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
                    Text("📖").font(.system(size: 72))
                    Text("Open the whole storybook").font(Theme.title(30)).foregroundStyle(Theme.moon).multilineTextAlignment(.center)
                    Text(SoundCatalog.all.prefix(24).map(\.emoji).joined(separator: " "))
                        .font(.system(size: 26)).multilineTextAlignment(.center).lineSpacing(6)

                    VStack(alignment: .leading, spacing: 14) {
                        perk("All \(SoundCatalog.all.count) sounds", "Wolves, dragons, trains, the sea, the campfire and more")
                        perk("Your own words", "Teach it \"Mister Whiskers\" or \"the Gruffalo\"")
                        perk("Apple Watch remote", "Tap sounds from your wrist, or play them on the watch")
                        perk("Every sound we add later", "New shelves as they arrive")
                    }
                    .padding(18)
                    .background(Theme.moon.opacity(0.06), in: RoundedRectangle(cornerRadius: 24, style: .continuous))

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

    private func perk(_ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "star.fill").foregroundStyle(Theme.lantern).padding(.top, 3)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(Theme.label(16)).foregroundStyle(Theme.moon)
                Text(detail).font(Theme.body(14)).foregroundStyle(Theme.ink)
            }
        }
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
