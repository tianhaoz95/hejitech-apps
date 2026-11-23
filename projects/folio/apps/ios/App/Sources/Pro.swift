import FolioKit
import StoreKit
import SwiftUI

/// Folio Pro (docs/decisions.md #17). Folio stays free for everything people do with their agents;
/// Pro raises the account's limits (25 → 1,000 artifacts, 10 → 25 MB per version) and adds
/// webhooks. Limits live on the server, so a purchase here is handed to the account: StoreKit 2 buys
/// with the signed-in user's id as `appAccountToken`, the Worker verifies the signed transaction
/// and Pro then holds on the web and for every agent too. The web sells the same plan with Stripe.
@MainActor
final class ProPurchases: ObservableObject {
    static let shared = ProPurchases()
    enum Plan: String, CaseIterable { case annual, lifetime }
    static let ids: [Plan: String] = [
        .annual: "com.hejitech.folio.pro.annual",
        .lifetime: "com.hejitech.folio.pro.lifetime",
    ]
    static func plan(for productId: String) -> Plan? { ids.first { $0.value == productId }?.key }

    @Published private(set) var products: [Plan: Product] = [:]
    @Published private(set) var loading = false
    @Published private(set) var trialEligible = false
    /// The plan being bought, or "restore"; nil when idle.
    @Published var busy: String?
    @Published var error: String?

    /// Set by the app: the signed-in user (appAccountToken) and how to hand transactions to the account.
    var userId: () -> UUID? = { nil }
    var sendToServer: (([String]) async throws -> Void)?

    private var updates: Task<Void, Never>?

    private init() {
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if case .verified(let t) = result {
                    try? await self.sendToServer?([result.jwsRepresentation])
                    await t.finish()
                }
            }
        }
    }

    func load() async {
        guard products.isEmpty, !loading else { return }
        loading = true
        error = nil
        defer { loading = false }
        do {
            let found = try await Product.products(for: Array(Self.ids.values))
            products = Dictionary(uniqueKeysWithValues: found.compactMap { p in Self.plan(for: p.id).map { ($0, p) } })
            if let sub = products[.annual]?.subscription { trialEligible = await sub.isEligibleForIntroOffer }
            if products.isEmpty { error = "Folio Pro isn't available from the App Store right now. Try again in a moment." }
        } catch {
            self.error = "Couldn't reach the App Store: \(error.localizedDescription)"
        }
    }

    /// Buys a plan; true when it went through and the account has it.
    @discardableResult
    func buy(_ plan: Plan) async -> Bool {
        guard let product = products[plan], busy == nil else { return false }
        busy = plan.rawValue
        error = nil
        defer { busy = nil }
        do {
            var options: Set<Product.PurchaseOption> = []
            if let id = userId() { options.insert(.appAccountToken(id)) }
            switch try await product.purchase(options: options) {
            case .success(let verification):
                guard case .verified(let t) = verification else { error = "The App Store couldn't verify this purchase."; return false }
                do {
                    try await sendToServer?([verification.jwsRepresentation])
                } catch {
                    // Finished anyway: Restore (or the next launch) sends it again.
                    self.error = "Bought, but Folio couldn't record it yet: \(error.localizedDescription). Tap Restore in a moment."
                }
                await t.finish()
                return true
            case .pending:
                error = "The purchase is waiting for approval. Pro turns on as soon as it's approved."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            self.error = error.localizedDescription
        }
        return false
    }

    /// Restore: syncs with the App Store and hands every current purchase to the account again.
    func restore() async -> Bool {
        guard busy == nil else { return false }
        busy = "restore"
        error = nil
        defer { busy = nil }
        do { try await AppStore.sync() } catch { self.error = error.localizedDescription; return false }
        let signed = await currentJWS()
        if signed.isEmpty { error = "No Folio Pro purchase was found for this Apple Account."; return false }
        do { try await sendToServer?(signed) } catch { self.error = error.localizedDescription; return false }
        return true
    }

    /// At launch: what this Apple Account owns goes to the account (a purchase whose upload failed).
    func syncToServer() async {
        let signed = await currentJWS()
        if !signed.isEmpty { try? await sendToServer?(signed) }
    }

    private func currentJWS() async -> [String] {
        var signed: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, Self.plan(for: t.productID) != nil { signed.append(result.jwsRepresentation) }
        }
        return signed
    }
}

/// Your plan, opened from Settings. Free people see what Pro adds side by side with their usage
/// and the two ways to buy it; Pro people see where it comes from and how to manage it. Shows what
/// guideline 3.1.2 asks for: price per period, the trial only when eligible, renewal and cancel
/// terms, Restore, Terms of Use and Privacy.
struct ProView: View {
    @Environment(AppModel.self) private var model
    @ObservedObject private var store = ProPurchases.shared
    @State private var selected: ProPurchases.Plan = .annual
    @State private var manage = false

    private static let eula = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if let p = model.pro, p.pro {
                    owned(p)
                } else {
                    intro
                    usage
                    compare
                    plans
                    buyButton
                    fineprint
                }
            }
            .padding(20)
        }
        .paperBackground()
        .navigationTitle("Folio Pro")
        .navigationBarTitleDisplayMode(.inline)
        .manageSubscriptionsSheet(isPresented: $manage)
        .task {
            await model.refreshPro()
            if !(model.pro?.pro ?? false) { await store.load() }
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("When Folio becomes your workspace")
                .font(.title2.weight(.bold))
            Text("Everything you do with your agents stays free. Pro is for keeping more of it, larger pages, and routines that answer comments the moment they land.")
                .foregroundStyle(.secondary)
        }
    }

    /// How much of the free plan this account uses.
    private var usage: some View {
        let used = model.pro?.artifacts ?? model.artifacts.filter { $0.role == .owner }.count
        let cap = model.pro?.free?.artifacts ?? 25
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Your artifacts").font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(used) of \(cap) free").font(.subheadline).monospacedDigit().foregroundStyle(.secondary)
            }
            ProgressView(value: Double(min(used, cap)), total: Double(cap))
                .tint(used >= cap ? .coral : .accentColor)
        }
        .padding(14)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var compare: some View {
        let free = model.pro?.free
        let pro = model.pro?.pro_limits
        let mb = { (n: Int?) in n.map { "\($0 / 1_048_576) MB" } ?? "–" }
        return VStack(spacing: 0) {
            compareRow("", "Free", "Pro", header: true)
            compareRow("Artifacts you own", "\(free?.artifacts ?? 25)", (pro?.artifacts ?? 1000).formatted())
            compareRow("Largest version", mb(free?.versionBytes ?? 10_485_760), mb(pro?.versionBytes ?? 26_214_400))
            compareRow("Webhooks", "–", "\(pro?.webhooks ?? 10)")
            compareRow("Agents, review, search", "✓", "✓")
        }
        .padding(.horizontal, 14).padding(.vertical, 4)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func compareRow(_ what: String, _ free: String, _ pro: String, header: Bool = false) -> some View {
        HStack {
            Text(what).frame(maxWidth: .infinity, alignment: .leading)
            Text(free).frame(width: 64, alignment: .trailing).foregroundStyle(.secondary)
            Text(pro).frame(width: 64, alignment: .trailing).fontWeight(header ? .regular : .semibold)
        }
        .font(header ? .caption.weight(.semibold) : .subheadline)
        .foregroundStyle(header ? .secondary : .primary)
        .padding(.vertical, 9)
        .overlay(alignment: .bottom) { if !header { Divider() } }
    }

    @ViewBuilder
    private var plans: some View {
        if store.loading {
            ProgressView().frame(maxWidth: .infinity)
        } else if store.products.isEmpty {
            VStack(spacing: 10) {
                Text(store.error ?? "Folio Pro isn't available from the App Store right now.")
                    .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                Button("Try Again") { Task { await store.load() } }.buttonStyle(.bordered)
            }
            .frame(maxWidth: .infinity)
        } else {
            VStack(spacing: 10) {
                ForEach(ProPurchases.Plan.allCases, id: \.self) { plan in
                    if let product = store.products[plan] { planCard(plan, product) }
                }
            }
        }
    }

    private func planCard(_ plan: ProPurchases.Plan, _ product: Product) -> some View {
        let on = selected == plan
        return Button { selected = plan } label: {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: on ? "largecircle.fill.circle" : "circle")
                    .font(.title3)
                    .foregroundStyle(on ? Color.accentColor : .secondary)
                VStack(alignment: .leading, spacing: 3) {
                    Text(plan == .annual ? "Yearly" : "Lifetime").font(.headline)
                    Text(plan == .annual
                        ? (store.trialEligible ? "1 week free, then \(product.displayPrice) a year" : "\(product.displayPrice) a year")
                        : "\(product.displayPrice) once, Pro for good")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                Text(product.displayPrice).font(.headline).monospacedDigit()
            }
            .padding(14)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(on ? Color.accentColor : .clear, lineWidth: 2))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }

    private var buyButton: some View {
        VStack(spacing: 10) {
            Button {
                Task {
                    if await store.buy(selected) { await model.refreshPro(); model.flash("Folio Pro is on for your account.") }
                }
            } label: {
                Group {
                    if store.busy == selected.rawValue { ProgressView() } else {
                        Text(selected == .annual && store.trialEligible ? "Start the free week" : "Get Folio Pro")
                    }
                }
                .frame(maxWidth: .infinity).padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .disabled(store.products[selected] == nil || store.busy != nil)
            if let e = store.error, !store.products.isEmpty {
                Text(e).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center)
            }
            Button {
                Task { if await store.restore() { await model.refreshPro() } }
            } label: {
                if store.busy == "restore" { ProgressView() } else { Text("Restore Purchases") }
            }
            .font(.subheadline)
            .disabled(store.busy != nil)
        }
    }

    private var fineprint: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Yearly renews automatically at the price shown unless you cancel at least 24 hours before the end of the period; your Apple Account is charged within 24 hours before renewal. Cancel any time in Settings › your name › Subscriptions. The free week, when offered, is once per Apple Account; it ends when you buy. Lifetime is a one-time purchase. Pro applies to your Folio account on every device and on the web.")
            HStack(spacing: 14) {
                Link("Terms of Use", destination: Self.eula)
                Link("Privacy Policy", destination: model.config.site.appendingPathComponent("privacy/"))
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private func owned(_ p: ProStatus) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("You have Folio Pro", systemImage: "checkmark.seal.fill")
                .font(.title2.weight(.bold))
                .foregroundStyle(Color.accentColor)
            Text(ownedLine(p)).foregroundStyle(.secondary)
            compare
            if p.manage == "app_store" {
                Button("Manage Subscription") { manage = true }.buttonStyle(.bordered)
            } else if p.manage == "stripe" {
                Text("Bought on the web: manage it at Folio's site, Settings › Plan.").font(.footnote).foregroundStyle(.secondary)
            }
        }
    }

    private func ownedLine(_ p: ProStatus) -> String {
        let from = p.source == "app_store" ? "the App Store" : p.source == "stripe" ? "the web" : "an invite"
        if p.plan == "lifetime" { return "From \(from), for good." }
        if let until = p.until { return "From \(from), until \(until.formatted(date: .long, time: .omitted)) (renews unless cancelled)." }
        return "From \(from)."
    }
}
