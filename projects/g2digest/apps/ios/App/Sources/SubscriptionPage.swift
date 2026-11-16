import StoreKit
import SwiftUI

/// Shows the app once G2 Digest Pro is active (bought, or given by email), and the purchase screen
/// until then. `invite` is the sign-in for "Have a Pro invite? Sign in".
struct ReaderGate<Content: View, Invite: View>: View {
    @State private var pro = ReaderAccess.shared
    var signedIn: Bool
    @ViewBuilder var invite: () -> Invite
    @ViewBuilder var content: () -> Content

    var body: some View {
        Group {
            if pro.canRead {
                content()
            } else if pro.presentSignIn && !signedIn {
                invite()
                    .safeAreaInset(edge: .bottom) {
                        Button("Back to subscriptions") { pro.presentSignIn = false }
                            .font(.footnote).padding(.bottom, 8)
                    }
            } else if pro.checked && !pro.queryingAccount {
                SubscriptionScreen(signedIn: signedIn)
            } else {
                ProgressView().controlSize(.large)
            }
        }
        .task {
            await pro.start()
            if signedIn { await pro.queryAccount() }
        }
        .onChange(of: signedIn) { _, now in
            if now { Task { await pro.queryAccount() } } else { pro.clearAccountAccess() }
        }
    }
}

/// G2 Digest's subscription page, set like a newspaper's: a masthead, today's front page as the sample,
/// what each edition carries as an index, and the two subscriptions as rate lines. It states what
/// guideline 3.1.2 asks for: each subscription's billed price and term (the trial only when it's still
/// offered), renewal and cancellation, Restore, the license and the privacy policy.
struct SubscriptionScreen: View {
    @State private var access = ReaderAccess.shared
    @State private var pick = ReaderAccess.annualSubscription
    var signedIn = false
    static let license = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    static let privacy = URL(string: "https://g2digest.hejitech.workers.dev/privacy/")!
    private static let index: [(String, String)] = [
        ("Cards", "Your brief, a card per story"),
        ("Audio", "Read-alouds and deep dives"),
        ("Editor", "Sections, sources, agents, podcast"),
        ("Glasses", "Every card on Even G2"),
    ]
    private func serif(_ style: Font.TextStyle) -> Font { .system(style, design: .serif) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(spacing: 6) {
                    Rectangle().frame(height: 3)
                    Text("The G2 Digest").font(.system(size: 34, weight: .black, design: .serif))
                    HStack {
                        Text("YOUR EDITION").font(.caption2.weight(.semibold)).tracking(1.2)
                        Spacer()
                        Text(Date.now.formatted(date: .abbreviated, time: .omitted).uppercased()).font(.caption2.weight(.semibold)).tracking(1.2)
                    }
                    Rectangle().frame(height: 1)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text("Your brief, ready before you are.").font(serif(.title2).weight(.bold))
                    Text("Written overnight by the agent you choose, from the sources you trust, and waiting on your phone and glasses when you wake.")
                        .font(serif(.body)).foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 0) {
                    Text("IN EVERY EDITION").font(.caption.weight(.bold)).tracking(1.2).padding(.bottom, 6)
                    ForEach(Self.index, id: \.0) { section, line in
                        HStack(alignment: .firstTextBaseline) {
                            Text(section).font(serif(.headline))
                            Text(line).font(serif(.subheadline)).foregroundStyle(.secondary)
                            Spacer()
                        }
                        .padding(.vertical, 8)
                        .overlay(alignment: .bottom) { Rectangle().fill(.separator).frame(height: 0.5) }
                    }
                }
                if access.loadingCatalog && access.catalog.isEmpty { ProgressView().frame(maxWidth: .infinity) }
                VStack(alignment: .leading, spacing: 0) {
                    if !access.catalog.isEmpty { Text("SUBSCRIPTION RATES").font(.caption.weight(.bold)).tracking(1.2).padding(.bottom, 6) }
                    if let annual = access.catalog[ReaderAccess.annualSubscription] { rate(annual) }
                    if let once = access.catalog[ReaderAccess.permanentSubscription] { rate(once) }
                }
                if let chosen = access.catalog[pick] {
                    Button { Task { await access.buy(chosen.id) } } label: {
                        Text(access.busy == chosen.id ? "Opening the App Store…" : chosen.id == ReaderAccess.permanentSubscription ? "Subscribe for good · \(chosen.displayPrice)" : access.hasTrialOffer ? "Start reading free" : "Subscribe · \(chosen.displayPrice) a year")
                            .font(serif(.headline)).frame(maxWidth: .infinity).padding(.vertical, 12)
                    }
                    .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: 4))
                    .accessibilityIdentifier("buy-pro")
                }
                colophon
            }
            .padding(22)
        }
        .background(Color(.systemBackground))
    }

    private func rate(_ product: Product) -> some View {
        let annual = product.id == ReaderAccess.annualSubscription
        let on = pick == product.id
        return Button { pick = product.id } label: {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: on ? "checkmark.square.fill" : "square").foregroundStyle(on ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                VStack(alignment: .leading, spacing: 2) {
                    Text(annual ? "Annual subscription" : "Permanent subscription").font(serif(.headline))
                    Text(annual ? (access.hasTrialOffer ? "First 7 days free" : "Billed yearly") : "One payment, no renewals").font(serif(.footnote)).foregroundStyle(.secondary)
                }
                Spacer()
                Text(annual ? "\(product.displayPrice)/yr" : product.displayPrice).font(serif(.headline))
            }
            .padding(.vertical, 10)
            .overlay(alignment: .bottom) { Rectangle().fill(.separator).frame(height: 0.5) }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier(annual ? "plan-annual" : "plan-lifetime")
    }

    private var colophon: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let annual = access.catalog[ReaderAccess.annualSubscription] {
                Text("The annual subscription costs \(annual.displayPrice) a year\(access.hasTrialOffer ? " after a 7-day free trial" : ""), charged to your Apple Account. It renews each year unless cancelled no later than 24 hours before the term ends, under Settings › your name › Subscriptions. The permanent subscription is a single payment.")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            if let error = access.error { Text(error).font(.footnote).foregroundStyle(.red) }
            if access.catalog.isEmpty && !access.loadingCatalog { Button("Try Again") { Task { await access.loadCatalog() } } }
            if let note = access.accountStatusNote { Text(note).font(.footnote).foregroundStyle(.secondary) }
            HStack(spacing: 16) {
                Button(access.busy == "restore" ? "Restoring…" : "Restore") { Task { await access.restore() } }
                    .accessibilityIdentifier("restore-purchases")
                Link("License", destination: Self.license)
                Link("Privacy", destination: Self.privacy)
            }
            .font(.footnote).disabled(access.busy != nil)
            if !signedIn {
                Button("Subscribed on the web? Pair this iPhone") { access.presentSignIn = true }
                    .font(.footnote).accessibilityIdentifier("invite-sign-in")
            }
        }
    }
}

/// Settings: the entitlement, Manage Subscription and Restore.
struct ReaderAccessSection: View {
    @State private var pro = ReaderAccess.shared
    @State private var manage = false

    var body: some View {
        Section("G2 Digest Pro") {
            switch pro.entitlement {
            case .lifetime:
                Label("Permanent subscriber", systemImage: "newspaper.fill")
            case .annual(let expires):
                Label(expires.map { "Annual subscriber · renews or ends \($0.formatted(date: .abbreviated, time: .omitted))" } ?? "Annual subscriber", systemImage: "newspaper.fill")
                Button("Manage Subscription") { manage = true }
            case nil where pro.canRead:
                Label("Given to your account", systemImage: "gift.fill")
            case nil:
                Label("Not subscribed", systemImage: "newspaper")
            }
            Button(pro.busy == "restore" ? "Restoring…" : "Restore Purchases") { Task { await pro.restore() } }
                .disabled(pro.busy != nil)
            if let error = pro.error, pro.entitlement == nil {
                Text(error).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .manageSubscriptionsSheet(isPresented: $manage)
    }
}
