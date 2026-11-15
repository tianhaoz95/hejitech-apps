import LogCore
import StoreKit
import SwiftUI

/// Wee Hours Pro (docs/decisions.md "Wee Hours Pro"): a 14-day trial per household, then a monthly
/// or yearly subscription or a lifetime unlock. Logging by tap, the Watch and reading the log stay
/// free for good; voice, glasses pairing, reminders, AI agents, export and photos need Pro after the
/// trial (`Entitlement.allows`). StoreKit 2 does the purchase with the signed-in user's id as
/// `appAccountToken`; for an account household the Worker verifies the signed transaction and records
/// it for the whole household (both parents), for a local-only household the phone keeps it.
@MainActor
final class ProPurchases: ObservableObject {
    static let shared = ProPurchases()
    static let ids: [Plan: String] = [
        .monthly: "com.hejitech.weehours.pro.monthly",
        .yearly: "com.hejitech.weehours.pro.yearly",
        .lifetime: "com.hejitech.weehours.pro.lifetime",
    ]
    static func plan(for productId: String) -> Plan? { ids.first { $0.value == productId }?.key }

    @Published private(set) var products: [Plan: Product] = [:]
    @Published private(set) var loading = false
    /// The plan being bought, or "restore"; nil when idle.
    @Published var busy: String?
    @Published var error: String?
    /// What this Apple Account owns right now (verified by StoreKit on the phone).
    @Published private(set) var owned: (plan: Plan, expires: Date?)?

    /// Set by the app: the signed-in user (appAccountToken) and how to hand transactions to the Worker.
    var userId: () -> UUID? = { nil }
    var sendToServer: (([String]) async throws -> Void)?
    var onChange: () async -> Void = {}

    private var updates: Task<Void, Never>?

    private init() {
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if case .verified(let t) = result {
                    try? await self.sendToServer?([result.jwsRepresentation])
                    await t.finish()
                }
                await self.refreshOwned()
                await self.onChange()
            }
        }
    }

    func load() async {
        guard products.isEmpty, !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let found = try await Product.products(for: Array(Self.ids.values))
            products = Dictionary(uniqueKeysWithValues: found.compactMap { p in Self.plan(for: p.id).map { ($0, p) } })
            if products.isEmpty { error = "Wee Hours Pro isn't available from the App Store right now. Try again in a moment." }
        } catch {
            self.error = "Couldn't reach the App Store: \(error.localizedDescription)"
        }
    }

    /// Reads the Apple Account's current Wee Hours Pro (lifetime beats a subscription).
    func refreshOwned() async {
        var best: (plan: Plan, expires: Date?)?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, t.revocationDate == nil, let plan = Self.plan(for: t.productID) else { continue }
            if plan == .lifetime { best = (.lifetime, nil); break }
            if best == nil || (t.expirationDate ?? .distantPast) > (best?.expires ?? .distantPast) { best = (plan, t.expirationDate) }
        }
        owned = best
    }

    func buy(_ plan: Plan) async {
        guard let product = products[plan], busy == nil else { return }
        busy = plan.rawValue
        error = nil
        defer { busy = nil }
        do {
            var options: Set<Product.PurchaseOption> = []
            if let id = userId() { options.insert(.appAccountToken(id)) }
            switch try await product.purchase(options: options) {
            case .success(let verification):
                guard case .verified(let t) = verification else { error = "The App Store couldn't verify this purchase."; return }
                do {
                    try await sendToServer?([verification.jwsRepresentation])
                } catch {
                    // Kept on this phone anyway; the next launch or Restore sends it again.
                    self.error = "Bought. Sharing it with your household didn't work yet: \(error.localizedDescription)"
                }
                await t.finish()
                await refreshOwned()
                await onChange()
            case .pending:
                error = "The purchase is waiting for approval. Wee Hours unlocks as soon as it's approved."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Restore: syncs with the App Store and hands every current purchase to the household again.
    func restore() async {
        guard busy == nil else { return }
        busy = "restore"
        error = nil
        defer { busy = nil }
        do { try await AppStore.sync() } catch { self.error = error.localizedDescription; return }
        var signed: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, Self.plan(for: t.productID) != nil { signed.append(result.jwsRepresentation) }
        }
        if !signed.isEmpty { try? await sendToServer?(signed) }
        await refreshOwned()
        await onChange()
        if owned == nil { error = "No Wee Hours Pro purchase was found for this Apple Account." }
    }

    /// Sends what this phone owns to the household's server record (at launch: a purchase whose
    /// upload failed, or one made before the parent joined the household).
    func syncToServer() async {
        var signed: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, Self.plan(for: t.productID) != nil { signed.append(result.jwsRepresentation) }
        }
        if !signed.isEmpty { try? await sendToServer?(signed) }
    }
}

/// What Pro costs and includes; opened from Settings and whenever a Pro feature is tapped after the
/// trial. Shows what guideline 3.1.2 asks for: price per period, renewal terms, Restore, Terms, Privacy.
struct PaywallView: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject private var store = ProPurchases.shared
    @State private var manage = false

    private static let eula = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Wee Hours Pro").font(.largeTitle.bold())
                    Text(statusLine).font(.subheadline).foregroundStyle(.secondary)
                }
                VStack(alignment: .leading, spacing: 12) {
                    Label("Log by voice, hands-free, with the on-device AI", systemImage: "mic.fill")
                    Label("Reminders for whoever is on duty", systemImage: "bell.fill")
                    Label("Even G2 glasses and R1 ring", systemImage: "eyeglasses")
                    Label("Your AI assistant over MCP", systemImage: "sparkles")
                    Label("Photos on entries and CSV export", systemImage: "photo.on.rectangle")
                    Label("One purchase covers everyone in your household", systemImage: "person.2.fill")
                }
                .font(.subheadline)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                Text("Logging by tap, the Watch and your whole log stay free, always.")
                    .font(.footnote).foregroundStyle(.secondary)

                if model.entitlement?.access(now: Date()) == .lifetime || isSubscribed {
                    if isSubscribed { Button("Manage Subscription") { manage = true } }
                } else {
                    if store.loading && store.products.isEmpty { ProgressView().frame(maxWidth: .infinity) }
                    ForEach([Plan.yearly, .monthly, .lifetime], id: \.self) { plan in
                        if let p = store.products[plan] {
                            Button { Task { await store.buy(plan) } } label: {
                                VStack(spacing: 2) {
                                    Text(store.busy == plan.rawValue ? "Opening the App Store…" : title(plan, p)).font(.headline)
                                    if plan == .yearly { Text("Best value").font(.caption) }
                                }
                                .frame(maxWidth: .infinity).padding(.vertical, 6)
                            }
                            .modifier(PlanButtonStyle(prominent: plan == .yearly))
                            .accessibilityIdentifier("buy-\(plan.rawValue)")
                        }
                    }
                    if let m = store.products[.monthly], let y = store.products[.yearly] {
                        Text("Subscriptions (\(m.displayPrice) a month or \(y.displayPrice) a year) are charged to your Apple Account and renew automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel them in your Apple Account settings. Lifetime is a one-time purchase.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    if store.products.isEmpty && !store.loading {
                        Button("Try Again") { Task { await store.load() } }.buttonStyle(.bordered).frame(maxWidth: .infinity)
                    }
                }
                if let e = store.error { Text(e).font(.footnote).foregroundStyle(.red) }

                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        Image(systemName: "archivebox.fill").foregroundStyle(.orange)
                        Text("Data Retention Notice").font(.headline)
                    }
                    Text("In the future, baby data that is inactive for more than a year might be archived. If that happens, we will provide a way to download your complete archive and re-import it anytime.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))

                HStack(spacing: 16) {
                    Button(store.busy == "restore" ? "Restoring…" : "Restore Purchases") { Task { await store.restore() } }
                        .accessibilityIdentifier("restore-purchases")
                    Link("Terms of Use", destination: Self.eula)
                    Link("Privacy Policy", destination: URL(string: "https://weehours.hejitech.workers.dev/privacy/")!)
                }
                .font(.footnote)
            }
            .padding()
        }
        .navigationTitle("Wee Hours Pro")
        .navigationBarTitleDisplayMode(.inline)
        .manageSubscriptionsSheet(isPresented: $manage)
        .task { await store.load() }
    }

    private var isSubscribed: Bool {
        if case .subscribed = model.entitlement?.access(now: Date()) { return true }
        return false
    }

    private var statusLine: String {
        switch model.entitlement?.access(now: Date()) {
        case .trial(let d): return "Free trial: \(d) day\(d == 1 ? "" : "s") left, everything included"
        case .subscribed(let p, let until): return "\(p.rawValue.capitalized) plan" + (until.map { " · renews or ends \($0.formatted(date: .abbreviated, time: .omitted))" } ?? "")
        case .lifetime: return "Lifetime · thank you!"
        case .expired: return "Your trial has ended. Logging by tap stays free."
        case nil: return "Everything for your household, on every phone in it."
        }
    }

    private func title(_ plan: Plan, _ p: Product) -> String {
        switch plan {
        case .monthly: return "\(p.displayPrice) per month"
        case .yearly: return "\(p.displayPrice) per year"
        case .lifetime: return "Lifetime · \(p.displayPrice) once"
        }
    }
}

private struct PlanButtonStyle: ViewModifier {
    let prominent: Bool
    func body(content: Content) -> some View {
        if prominent { content.buttonStyle(.borderedProminent) } else { content.buttonStyle(.bordered) }
    }
}
