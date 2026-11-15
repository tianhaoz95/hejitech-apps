import StoreKit
import SwiftUI

/// Shows the app once FitLoop Pro is active, and the purchase screen until then.
struct ProGate<Content: View>: View {
    @State private var pro = ProStore.shared
    @ViewBuilder var content: () -> Content

    var body: some View {
        Group {
            if pro.isPro {
                content()
            } else if pro.checked {
                ScrollView { PaywallView() }
            } else {
                ProgressView().controlSize(.large)
            }
        }
        .task { await pro.start() }
    }
}

/// What Pro costs and includes, with what guideline 3.1.2 asks for: the price per period, the
/// free week only when the person can still get it, renewal terms, Restore, Terms and Privacy.
struct PaywallView: View {
    @State private var pro = ProStore.shared
    static let eula = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    static let privacy = URL(string: "https://fitloop.hejitech.workers.dev/privacy/")!
    static let perks: [(String, String)] = [
        ("list.bullet.clipboard", "Your agent's plan, day by day: workouts and meals"),
        ("figure.strengthtraining.traditional", "The workout player: sets, rest timer and demos"),
        ("heart.fill", "Heart rate from your watch, saved to Health"),
        ("bubble.left.and.text.bubble.right.fill", "Check-ins and feedback your agent reads"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("FitLoop Pro").font(.largeTitle.bold())
            Text("Everything in FitLoop, on your iPhone.").foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Self.perks, id: \.1) { icon, text in
                    Label { Text(text) } icon: { Image(systemName: icon).foregroundStyle(.tint) }
                }
            }
            if pro.loadingProducts && pro.products.isEmpty {
                ProgressView().frame(maxWidth: .infinity)
            }
            if let annual = pro.products[ProStore.annualID] {
                Button {
                    Task { await pro.buy(ProStore.annualID) }
                } label: {
                    Text(pro.busy == ProStore.annualID ? "Opening the App Store…"
                         : pro.introEligible ? "Try 1 week free, then \(annual.displayPrice)/year"
                         : "\(annual.displayPrice) per year")
                        .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("buy-annual")
                Text("\(pro.introEligible ? "Free for 1 week, then " : "")\(annual.displayPrice) a year, charged to your Apple Account. Renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel it in your Apple Account settings.")
                    .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            if let lifetime = pro.products[ProStore.lifetimeID] {
                Button {
                    Task { await pro.buy(ProStore.lifetimeID) }
                } label: {
                    Text(pro.busy == ProStore.lifetimeID ? "Opening the App Store…" : "Lifetime · \(lifetime.displayPrice) once")
                        .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("buy-lifetime")
            }
            if let error = pro.error {
                Text(error).font(.footnote).foregroundStyle(.red).frame(maxWidth: .infinity)
            }
            if pro.products.isEmpty && !pro.loadingProducts {
                Button("Try Again") { Task { await pro.loadProducts() } }
                    .buttonStyle(.bordered).frame(maxWidth: .infinity)
            }
            HStack {
                Button(pro.busy == "restore" ? "Restoring…" : "Restore Purchases") { Task { await pro.restore() } }
                    .accessibilityIdentifier("restore-purchases")
                Spacer()
                Link("Terms of Use", destination: Self.eula)
                Spacer()
                Link("Privacy Policy", destination: Self.privacy)
            }
            .font(.footnote)
            .disabled(pro.busy != nil)
        }
        .padding(24)
        .disabled(pro.busy != nil && pro.busy != "restore")
    }
}

/// Settings: the plan, Manage Subscription and Restore.
struct ProSettingsSection: View {
    @State private var pro = ProStore.shared
    @State private var manage = false

    var body: some View {
        Section("FitLoop Pro") {
            switch pro.plan {
            case .lifetime:
                Label("Lifetime", systemImage: "checkmark.seal.fill")
            case .annual(let expires):
                Label(expires.map { "Annual · renews or ends \($0.formatted(date: .abbreviated, time: .omitted))" } ?? "Annual", systemImage: "checkmark.seal.fill")
                Button("Manage Subscription") { manage = true }
            case nil:
                Label("Not active", systemImage: "xmark.seal")
            }
            Button(pro.busy == "restore" ? "Restoring…" : "Restore Purchases") { Task { await pro.restore() } }
                .disabled(pro.busy != nil)
            if let error = pro.error, pro.plan == nil {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .manageSubscriptionsSheet(isPresented: $manage)
    }
}
