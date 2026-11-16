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
/// trial. Drawn as a sheet over a blurred sample of the log ("Peek", reports/2026-11-16-pro-paywall-redesign).
/// Shows what guideline 3.1.2 asks for: price per period, renewal terms, Restore, Terms, Privacy.
struct PaywallView: View {
    @EnvironmentObject var model: AppModel
    @ObservedObject private var store = ProPurchases.shared
    @State private var manage = false
    @State private var selected: Plan = .yearly

    private static let eula = URL(string: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")!
    private static let privacy = URL(string: "https://weehours.hejitech.workers.dev/privacy/")!
    private static let perks: [(String, String)] = [
        ("mic.fill", "Voice logging"),
        ("bell.fill", "Duty reminders"),
        ("eyeglasses", "Glasses & ring"),
        ("sparkles", "AI assistant"),
    ]
    /// A sample night, only ever shown blurred behind the sheet.
    private static let backdrop: [(String, String, String)] = [
        ("3:12 AM", "Feed", "Bottle 120 ml · logged by voice"),
        ("2:40 AM", "Diaper", "Wet"),
        ("11:05 PM", "Sleep", "3 h 25 min"),
        ("10:30 PM", "Feed", "Left side · 14 min"),
        ("9:50 PM", "Diaper", "Dirty"),
    ]

    var body: some View {
        ZStack(alignment: .top) {
            backdropView
                .blur(radius: 6)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            LinearGradient(colors: [.clear, Color(.systemBackground).opacity(0.55)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
                .allowsHitTesting(false)
            // The sheet starts low enough for the log to show above it and scrolls up over it.
            ScrollView {
                VStack(spacing: 0) {
                    Color.clear.frame(height: 120)
                    sheet
                }
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .navigationTitle("Wee Hours Pro")
        .navigationBarTitleDisplayMode(.inline)
        .manageSubscriptionsSheet(isPresented: $manage)
        .task { await store.load() }
    }

    private var backdropView: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Last night").font(.largeTitle.bold()).padding(.bottom, 4)
            ForEach(Self.backdrop, id: \.0) { time, kind, detail in
                HStack(alignment: .firstTextBaseline, spacing: 14) {
                    Text(time).font(.headline).foregroundStyle(.tint).frame(width: 88, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(kind).font(.headline)
                        Text(detail).font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(14)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var sheet: some View {
        VStack(alignment: .leading, spacing: 14) {
            Capsule().fill(.secondary.opacity(0.4)).frame(width: 36, height: 5).frame(maxWidth: .infinity)
            Label("Unlock all of Wee Hours", systemImage: "lock.fill")
                .font(.footnote.weight(.bold)).textCase(.uppercase).foregroundStyle(.tint)
            Text("Log the night without opening your eyes.").font(.title2.bold()).fixedSize(horizontal: false, vertical: true)
            Label(statusLine, systemImage: "calendar")
                .font(.footnote.weight(.semibold)).foregroundStyle(.tint)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Color.accentColor.opacity(0.14), in: Capsule())
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
            Text("Also photos on entries and CSV export. One purchase covers everyone in your household.")
                .font(.footnote).foregroundStyle(.secondary)
            Label("Logging by tap, the Watch and your whole log stay free, always.", systemImage: "checkmark")
                .font(.footnote).foregroundStyle(.secondary)

            if model.entitlement?.access(now: Date()) == .lifetime || isSubscribed {
                if isSubscribed {
                    Button("Manage Subscription") { manage = true }
                        .buttonStyle(.bordered).frame(maxWidth: .infinity)
                }
            } else {
                if store.loading && store.products.isEmpty { ProgressView().frame(maxWidth: .infinity) }
                VStack(spacing: 8) {
                    ForEach([Plan.yearly, .monthly, .lifetime], id: \.self) { plan in
                        if let p = store.products[plan] { planRow(plan, p) }
                    }
                }
                if let p = store.products[selected] {
                    Button { Task { await store.buy(selected) } } label: {
                        Text(store.busy == selected.rawValue ? "Opening the App Store…" : cta(selected, p))
                            .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 8)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.roundedRectangle(radius: 16))
                    .accessibilityIdentifier("buy-pro")
                    Text(selected == .lifetime ? "One payment, for your whole household." : "Renews every \(selected == .monthly ? "month" : "year"). Cancel anytime.")
                        .font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                }
                if let m = store.products[.monthly], let y = store.products[.yearly] {
                    Text("Subscriptions (\(m.displayPrice) a month or \(y.displayPrice) a year) are charged to your Apple Account and renew automatically unless you cancel at least 24 hours before the end of the current period. Manage or cancel them in your Apple Account settings. Lifetime is a one-time purchase.")
                        .font(.caption2).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                }
                if store.products.isEmpty && !store.loading {
                    Button("Try Again") { Task { await store.load() } }.buttonStyle(.bordered).frame(maxWidth: .infinity)
                }
            }
            if let e = store.error { Text(e).font(.footnote).foregroundStyle(.red) }

            DisclosureGroup {
                Text("In the future, baby data that is inactive for more than a year might be archived. If that happens, we will provide a way to download your complete archive and re-import it anytime.")
                    .font(.footnote).foregroundStyle(.secondary).padding(.top, 4)
            } label: {
                Label("Data Retention Notice", systemImage: "archivebox.fill").font(.footnote.weight(.semibold))
            }

            HStack {
                Button(store.busy == "restore" ? "Restoring…" : "Restore Purchases") { Task { await store.restore() } }
                    .accessibilityIdentifier("restore-purchases")
                Spacer()
                Link("Terms of Use", destination: Self.eula)
                Spacer()
                Link("Privacy Policy", destination: Self.privacy)
            }
            .font(.footnote)
        }
        .padding(.horizontal, 20).padding(.top, 8)
        .padding(.bottom, VoiceButton.size + 40)   // clear of the floating tab bar and voice button
        .background(
            Color(.secondarySystemGroupedBackground)
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 30, topTrailingRadius: 30))
                .shadow(color: .black.opacity(0.18), radius: 20, y: -6)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func planRow(_ plan: Plan, _ p: Product) -> some View {
        let on = selected == plan
        return Button { selected = plan } label: {
            HStack(spacing: 12) {
                Image(systemName: on ? "largecircle.fill.circle" : "circle")
                    .font(.title3).foregroundStyle(on ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
                VStack(alignment: .leading, spacing: 2) {
                    Text(plan == .yearly ? "Yearly" : plan == .monthly ? "Monthly" : "Lifetime").font(.headline)
                    Text(plan == .lifetime ? "Pay once, keep it for good" : "\(p.displayPrice) every \(plan == .monthly ? "month" : "year")")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    Text(title(plan, p)).font(.headline)
                    if plan == .yearly {
                        Text("\((p.price / 12).formatted(p.priceFormatStyle))/mo").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .foregroundStyle(.primary)
            .padding(.horizontal, 14).padding(.top, 18).padding(.bottom, 14)
            .background(on ? Color.accentColor.opacity(0.12) : Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(on ? Color.accentColor : .clear, lineWidth: 2))
            .overlay(alignment: .topTrailing) {
                if plan == .yearly {
                    Text("BEST VALUE").font(.caption2.weight(.heavy))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.accentColor, in: Capsule()).foregroundStyle(.black.opacity(0.8))
                        .offset(x: -12, y: -10)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
        .accessibilityIdentifier("buy-\(plan.rawValue)")
    }

    private func cta(_ plan: Plan, _ p: Product) -> String {
        switch plan {
        case .lifetime: return "Unlock for life · \(p.displayPrice)"
        case .monthly: return "Get Pro · \(p.displayPrice)/month"
        case .yearly: return "Get Pro · \(p.displayPrice)/year"
        }
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
        case .monthly: return "\(p.displayPrice)/month"
        case .yearly: return "\(p.displayPrice)/year"
        case .lifetime: return "\(p.displayPrice) once"
        }
    }
}
