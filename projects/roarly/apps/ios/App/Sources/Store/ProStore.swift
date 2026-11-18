import Foundation
import StoreKit

/// Roarly Pro ("the whole storybook"): a yearly subscription with a free week, or a one-time
/// lifetime unlock. StoreKit 2 checks it on the device; there is no account and no server.
@MainActor
final class ProStore: ObservableObject {
    static let shared = ProStore()

    static let yearlyID = "com.hejitech.roarly.pro.yearly"
    static let lifetimeID = "com.hejitech.roarly.pro.lifetime"

    @Published private(set) var isPro = false
    @Published private(set) var products: [Product] = []
    @Published private(set) var loadFailed = false
    @Published private(set) var purchasing = false
    @Published private(set) var eligibleForTrial = true

    private var updates: Task<Void, Never>?

    private init() {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-proUnlocked") { isPro = true }
        #endif
        updates = Task { @MainActor [weak self] in
            for await update in Transaction.updates {
                if case .verified(let t) = update { await t.finish() }
                await self?.refresh()
            }
        }
        Task { await refresh(); await load() }
    }

    var yearly: Product? { products.first { $0.id == Self.yearlyID } }
    var lifetime: Product? { products.first { $0.id == Self.lifetimeID } }

    func load() async {
        do {
            products = try await Product.products(for: [Self.yearlyID, Self.lifetimeID]).sorted { $0.price > $1.price }
            loadFailed = products.isEmpty
            if let sub = yearly?.subscription {
                eligibleForTrial = await sub.isEligibleForIntroOffer
            }
        } catch {
            loadFailed = true
            log("store products failed: \(error)")
        }
    }

    func refresh() async {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-proUnlocked") { isPro = true; return }
        #endif
        var pro = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, t.revocationDate == nil,
               t.productID == Self.yearlyID || t.productID == Self.lifetimeID {
                pro = true
            }
        }
        isPro = pro
    }

    @discardableResult
    func buy(_ product: Product) async -> Bool {
        purchasing = true
        defer { purchasing = false }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                if case .verified(let t) = verification {
                    await t.finish()
                    await refresh()
                    return true
                }
            case .pending, .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            log("purchase failed: \(error)")
        }
        return false
    }

    func restore() async {
        try? await AppStore.sync()
        await refresh()
    }
}
