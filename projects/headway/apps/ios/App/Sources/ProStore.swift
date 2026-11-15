import StoreKit
import SwiftUI

/// Headway Pro (decisions: "Headway Pro"): a free download that needs Pro after a 1-week free trial, either
/// the annual subscription (the trial is its introductory offer) or the lifetime unlock. StoreKit 2
/// checks the purchase on the phone (`Transaction.currentEntitlements`, signed by the App Store), so
/// no server is involved: only this iPhone app is gated; the web app, glasses and Android aren't.
@MainActor @Observable
final class ProStore {
    static let shared = ProStore()
    static let annualID = "com.hejitech.headway.pro.annual"
    static let lifetimeID = "com.hejitech.headway.pro.lifetime"
    static let ids: Set<String> = [annualID, lifetimeID]

    enum Plan: Equatable { case annual(expires: Date?), lifetime }

    private(set) var products: [String: Product] = [:]
    private(set) var plan: Plan?
    /// False until the first entitlement check finished: the gate waits for it instead of flashing the paywall.
    private(set) var checked = false
    private(set) var introEligible = false
    private(set) var loadingProducts = false
    /// The product being bought, or "restore"; nil when idle.
    var busy: String?
    var error: String?

    var isPro: Bool { plan != nil || unlockedForScreenshots }
    private let unlockedForScreenshots: Bool
    private var updates: Task<Void, Never>?

    init() {
        #if DEBUG
        // Store screenshots and UI checks (`scripts/store_screenshots.sh` passes it).
        unlockedForScreenshots = ProcessInfo.processInfo.arguments.contains("-proUnlocked")
        #else
        unlockedForScreenshots = false
        #endif
        // Renewals, refunds, Ask to Buy approvals and purchases made on another device arrive here.
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let t) = result { await t.finish() }
                await self?.refresh()
            }
        }
    }

    func start() async {
        await refresh()
        await loadProducts()
    }

    func loadProducts() async {
        guard !loadingProducts else { return }
        loadingProducts = true
        error = nil
        defer { loadingProducts = false }
        do {
            let found = try await Product.products(for: Self.ids)
            products = Dictionary(uniqueKeysWithValues: found.map { ($0.id, $0) })
            if let sub = products[Self.annualID]?.subscription {
                introEligible = await sub.isEligibleForIntroOffer
            }
            if products.isEmpty { error = "Headway Pro isn't available from the App Store right now. Try again in a moment." }
        } catch {
            self.error = "Couldn't reach the App Store: \(error.localizedDescription)"
        }
    }

    /// Reads what this Apple Account owns right now (verified by StoreKit; works offline from its cache).
    func refresh() async {
        var best: Plan?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, Self.ids.contains(t.productID), t.revocationDate == nil else { continue }
            if t.productID == Self.lifetimeID {
                best = .lifetime
            } else if best == nil {
                best = .annual(expires: t.expirationDate)
            }
        }
        plan = best
        checked = true
    }

    func buy(_ id: String) async {
        guard let product = products[id], busy == nil else { return }
        busy = id
        error = nil
        defer { busy = nil }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                if case .verified(let t) = verification {
                    await t.finish()
                } else {
                    error = "The App Store couldn't verify this purchase."
                }
                await refresh()
            case .pending:
                error = "The purchase is waiting for approval. Headway unlocks as soon as it's approved."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func restore() async {
        guard busy == nil else { return }
        busy = "restore"
        error = nil
        defer { busy = nil }
        do {
            try await AppStore.sync()
        } catch {
            self.error = error.localizedDescription
            return
        }
        await refresh()
        if plan == nil { error = "No Headway Pro purchase was found for this Apple Account." }
    }
}
