import StoreKit
import SwiftUI

/// Shows the app once Headway Pro is active (bought, or given by email), and the purchase screen
/// until then. `invite` is the sign-in for "Have a Pro invite? Sign in".
struct ProGate<Content: View, Invite: View>: View {
    @State private var pro = ProStore.shared
    @Environment(\.scenePhase) private var scenePhase
    var signedIn: Bool
    @ViewBuilder var invite: () -> Invite
    @ViewBuilder var content: () -> Content

    var body: some View {
        Group {
            if pro.isPro {
                content()
            } else if pro.inviteSignIn && !signedIn {
                invite()
                    .safeAreaInset(edge: .bottom) {
                        Button("Back to Headway Pro") { pro.inviteSignIn = false }
                            .font(.footnote).padding(.bottom, 8)
                    }
            } else if pro.checked && !pro.checkingGrant {
                PeekPaywall(signedIn: signedIn)
            } else {
                ProgressView().controlSize(.large)
            }
        }
        .task {
            await pro.start()
            if signedIn { await pro.checkGrant() }
        }
        .onChange(of: signedIn) { _, now in
            if now { Task { await pro.checkGrant() } } else { pro.forgetGrant() }
        }
        // A grant made while the app was open (or in the background) shows up when it comes back.
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, signedIn, !pro.isPro { Task { await pro.checkGrant() } }
        }
    }
}

/// The paywall as a sheet over Headway itself ("Peek", reports/2026-11-16-pro-paywall-redesign): a
/// blurred sample of the home screen behind, so Pro reads as opening the app rather than a store page.
/// The backdrop is a fixed picture, not the live app: nothing loads or asks for permissions before Pro.
struct PeekPaywall: View {
    var signedIn = false

    var body: some View {
        ZStack(alignment: .bottom) {
            PaywallBackdrop()
                .blur(radius: 6)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            LinearGradient(colors: [.clear, Color(.systemBackground).opacity(0.55)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .allowsHitTesting(false)
            // Hugs its content; scrolls only when it can't fit (large text, small phones).
            ViewThatFits(in: .vertical) {
                sheet
                ScrollView { sheet }.scrollBounceBehavior(.basedOnSize)
            }
        }
    }

    private var sheet: some View {
        VStack(spacing: 0) {
            Capsule().fill(.secondary.opacity(0.4)).frame(width: 36, height: 5).padding(.top, 8)
            PaywallView(signedIn: signedIn)
        }
        .background(
            Color(.secondarySystemGroupedBackground)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 30, topTrailingRadius: 30))
                .shadow(color: .black.opacity(0.18), radius: 20, y: -6)
                .ignoresSafeArea(edges: .bottom)
        )
    }
}

/// A sample of Headway's home screen, only ever shown blurred behind the paywall.
struct PaywallBackdrop: View {
    static let title = "Departures"
    static let rows: [(String, String, String)] = [
        ("7:42", "Train 151", "Local · leave in 6 min"),
        ("8:12", "Train 153", "Limited · 8 min late"),
        ("8:42", "Train 155", "Express · on time"),
        ("9:12", "Train 157", "Local · on time"),
        ("9:42", "Train 159", "Limited · on time"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(Self.title).font(.largeTitle.bold()).padding(.bottom, 4)
            ForEach(Self.rows, id: \.1) { lead, title, detail in
                HStack(alignment: .firstTextBaseline, spacing: 14) {
                    Text(lead).font(.headline).foregroundStyle(.tint).frame(width: 76, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title).font(.headline)
                        Text(detail).font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(14)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

/// What Pro costs and includes, with what guideline 3.1.2 asks for: the price per period (the billed
/// amount is the biggest price; the monthly figure stays small), the free week only when the person can
/// still get it, renewal terms, Restore, Terms and Privacy.
struct PaywallView: View {
    @State private var pro = ProStore.shared
    @State private var selected = ProStore.annualID
    var signedIn = false
    static let eula = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    static let privacy = URL(string: "https://headway.hejitech.workers.dev/privacy/")!
    static let hook = "Never run for a train again."
    static let perks: [(String, String)] = [
        ("tram.fill", "Live departures"),
        ("bell.badge.fill", "Delay alerts"),
        ("applewatch", "Watch & widgets"),
        ("person.3.fill", "Family & glasses"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Unlock Headway", systemImage: "lock.fill")
                .font(.footnote.weight(.bold)).textCase(.uppercase).foregroundStyle(.tint)
            Text(Self.hook).font(.title2.bold()).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 6) {
                ForEach(Self.perks, id: \.1) { icon, text in
                    VStack(spacing: 6) {
                        Image(systemName: icon).font(.body.weight(.semibold)).foregroundStyle(.tint)
                        Text(text).font(.caption2.weight(.semibold)).foregroundStyle(Color.primary)
                            .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.vertical, 10).padding(.horizontal, 2)
                    .background(Color.accentColor.opacity(0.13), in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityElement(children: .combine)
                }
            }
            .fixedSize(horizontal: false, vertical: true)

            if pro.loadingProducts && pro.products.isEmpty {
                ProgressView().frame(maxWidth: .infinity)
            }
            VStack(spacing: 8) {
                if let annual = pro.products[ProStore.annualID] { planRow(annual) }
                if let lifetime = pro.products[ProStore.lifetimeID] { planRow(lifetime) }
            }
            if let product = pro.products[selected] {
                Button {
                    Task { await pro.buy(product.id) }
                } label: {
                    Text(pro.busy == product.id ? "Opening the App Store…" : cta(product))
                        .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 16))
                .accessibilityIdentifier("buy-pro")
                Text(ctaNote(product)).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity)
            }
            if let annual = pro.products[ProStore.annualID] {
                Text("\(pro.introEligible ? "Free for 1 week, then " : "")\(annual.displayPrice) a year, charged to your Apple Account. Renews automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel it in your Apple Account settings.")
                    .font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            if let error = pro.error {
                Text(error).font(.footnote).foregroundStyle(.red).frame(maxWidth: .infinity)
            }
            if pro.products.isEmpty && !pro.loadingProducts {
                Button("Try Again") { Task { await pro.loadProducts() } }
                    .buttonStyle(.bordered).frame(maxWidth: .infinity)
            }
            if let note = pro.grantNote {
                Text(note).font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity)
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
            if !signedIn {
                Button("Have a Pro invite? Sign in") { pro.inviteSignIn = true }
                    .font(.footnote).frame(maxWidth: .infinity)
                    .accessibilityIdentifier("invite-sign-in")
            }
        }
        .padding(.horizontal, 20).padding(.top, 12).padding(.bottom, 16)
        .disabled(pro.busy != nil && pro.busy != "restore")
    }

    private func planRow(_ product: Product) -> some View {
        let on = selected == product.id
        let annual = product.id == ProStore.annualID
        return Button { selected = product.id } label: {
            HStack(spacing: 12) {
                Image(systemName: on ? "largecircle.fill.circle" : "circle")
                    .font(.title3).foregroundStyle(on ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                VStack(alignment: .leading, spacing: 2) {
                    Text(annual ? "Yearly" : "Lifetime").font(.headline)
                    Text(annual ? (pro.introEligible ? "1 week free, then \(product.displayPrice)/year" : "\(product.displayPrice) every year")
                                : "Pay once, keep it for good")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(annual ? "\(product.displayPrice)/year" : "\(product.displayPrice) once").font(.headline)
                    if annual {
                        Text("\((product.price / 12).formatted(product.priceFormatStyle))/mo").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .foregroundStyle(.primary)
            .padding(.horizontal, 14).padding(.top, 18).padding(.bottom, 14)
            .background(on ? Color.accentColor.opacity(0.12) : Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(on ? Color.accentColor : .clear, lineWidth: 2))
            .overlay(alignment: .topTrailing) {
                if annual && pro.introEligible {
                    Text("1 WEEK FREE").font(.caption2.weight(.heavy))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.accentColor, in: Capsule()).foregroundStyle(.background)
                        .offset(x: -12, y: -10)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier(annual ? "plan-annual" : "plan-lifetime")
    }

    private func cta(_ product: Product) -> String {
        if product.id == ProStore.lifetimeID { return "Unlock for life · \(product.displayPrice)" }
        return pro.introEligible ? "Try 1 week free" : "Continue · \(product.displayPrice)/year"
    }

    private func ctaNote(_ product: Product) -> String {
        if product.id == ProStore.lifetimeID { return "One payment. Yours for good." }
        return pro.introEligible ? "Then \(product.displayPrice) a year. Cancel anytime." : "Renews every year. Cancel anytime."
    }
}

/// Settings: the plan, Manage Subscription and Restore.
struct ProSettingsSection: View {
    @State private var pro = ProStore.shared
    @State private var manage = false

    var body: some View {
        Section("Headway Pro") {
            switch pro.plan {
            case .lifetime:
                Label("Lifetime", systemImage: "checkmark.seal.fill")
            case .annual(let expires):
                Label(expires.map { "Annual · renews or ends \($0.formatted(date: .abbreviated, time: .omitted))" } ?? "Annual", systemImage: "checkmark.seal.fill")
                Button("Manage Subscription") { manage = true }
            case nil where pro.isPro:
                Label("Given to your account", systemImage: "gift.fill")
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
