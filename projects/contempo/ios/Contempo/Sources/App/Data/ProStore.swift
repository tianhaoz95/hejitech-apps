import ContempoCore
import Foundation
import Observation
import StoreKit

/// Unified Contempo Pro entitlement: combines StoreKit 2 (`Transaction.currentEntitlements`) with
/// the Worker's `GET /api/pro` (App Store, Google Play, Stripe, legacy subscriptions, and email
/// `pro_grants`), and syncs verified App Store JWS transactions to `POST /api/appstore/transactions`.
@Observable
@MainActor
final class ProStore {
    static let annualProductId = "com.hejitech.contempoapp.pro.annual"
    static let lifetimeProductId = "com.hejitech.contempoapp.pro.lifetime"
    static let productIds: [String] = [annualProductId, lifetimeProductId]

    private(set) var products: [Product] = []
    private(set) var loadingProducts = false
    private(set) var purchasing = false
    private(set) var storeKitPro = false
    private(set) var serverPro = false
    private(set) var source: String?
    private(set) var plan: String?
    private(set) var untilISO: String?
    private(set) var errorMessage: String?

    private var updatesTask: Task<Void, Never>?

    var hasPro: Bool {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-proUnlocked") { return true }
        #endif
        return storeKitPro || serverPro
    }

    var annualProduct: Product? { products.first { $0.id == Self.annualProductId } }
    var lifetimeProduct: Product? { products.first { $0.id == Self.lifetimeProductId } }

    init() {
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if case .verified(let tx) = result {
                    await tx.finish()
                    await self.syncEntitlementsAndServer(jwsList: [result.jwsRepresentation])
                }
            }
        }
        Task { [weak self] in
            await self?.refresh()
        }
    }

    func refresh() async {
        await loadProducts()
        await syncEntitlementsAndServer()
    }

    func loadProducts() async {
        loadingProducts = true
        defer { loadingProducts = false }
        do {
            let loaded = try await Product.products(for: Self.productIds)
            products = loaded.sorted { $0.price < $1.price }
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func purchase(_ product: Product) async {
        purchasing = true
        errorMessage = nil
        defer { purchasing = false }
        do {
            var options: Set<Product.PurchaseOption> = []
            if let uidString = ContempoBackend.uid, let uuid = UUID(uuidString: uidString) {
                options.insert(.appAccountToken(uuid))
            }
            let result = try await product.purchase(options: options)
            switch result {
            case .success(let verification):
                if case .verified(let tx) = verification {
                    await tx.finish()
                    await syncEntitlementsAndServer(jwsList: [verification.jwsRepresentation])
                } else {
                    errorMessage = "Purchase could not be verified."
                }
            case .userCancelled:
                break
            case .pending:
                errorMessage = "Purchase is pending approval."
            @unknown default:
                break
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func restorePurchases() async {
        errorMessage = nil
        do {
            try await AppStore.sync()
            await syncEntitlementsAndServer()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func syncEntitlementsAndServer(jwsList: [String]? = nil) async {
        var collectedJWS = jwsList ?? []
        var active = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, Self.productIds.contains(tx.productID) {
                if tx.revocationDate == nil, tx.expirationDate == nil || tx.expirationDate! > Date() {
                    active = true
                    if jwsList == nil { collectedJWS.append(result.jwsRepresentation) }
                }
            }
        }
        storeKitPro = active

        guard ContempoBackend.uid != nil else { return }
        if !collectedJWS.isEmpty {
            _ = try? await ContempoBackend.api("appstore/transactions", body: ["transactions": collectedJWS])
        }
        if let res = try? await ContempoBackend.getApi("pro") {
            serverPro = (res["pro"] as? Bool) ?? false
            source = res["source"] as? String
            plan = res["plan"] as? String
            untilISO = res["until"] as? String
        }
    }
}
