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

    var isPro: Bool { plan != nil || grantActive || unlockedForScreenshots }

    // MARK: Pro given by email (scripts/grant_pro.sh)

    /// Asks the app's Worker `GET /api/pro` for the signed-in account; set by the app at launch.
    var grantChecker: (() async throws -> (pro: Bool, until: Date?, email: String?))?
    /// Hands this phone's App Store purchases to the signed-in account (POST /api/appstore/transactions),
    /// so the web, the glasses and every other app signed in to it have Pro too. Set by the app.
    var transactionUploader: (([String]) async throws -> Void)?
    /// The person tapped "Already have Pro? Sign in": the gate shows the sign-in instead of the paywall.
    var inviteSignIn = false
    private(set) var checkingGrant = false
    /// Shown on the paywall after an invite sign-in without a grant.
    private(set) var grantNote: String?
    /// The last grant the Worker confirmed, kept so a granted person isn't locked out offline.
    private var grantUntil: Date? = ProStore.storedGrant()
    private var grantActive: Bool { grantUntil.map { $0 > .now } ?? false }
    private static let grantKey = "pro_grant_until"

    private static func storedGrant() -> Date? {
        let t = UserDefaults.standard.double(forKey: grantKey)
        return t > 0 ? Date(timeIntervalSince1970: t) : nil
    }

    /// After a sign-in, at launch when signed in, and when the app comes back.
    func checkGrant() async {
        guard let check = grantChecker, !checkingGrant else { return }
        checkingGrant = true
        defer { checkingGrant = false }
        await uploadPurchases()
        do {
            let answer = try await check()
            // No end date = for good: store a far-future date.
            grantUntil = answer.pro ? (answer.until ?? .distantFuture) : nil
            UserDefaults.standard.set(grantUntil?.timeIntervalSince1970 ?? 0, forKey: Self.grantKey)
            grantNote = answer.pro ? nil : "There's no Headway Pro on \(answer.email ?? "this account") yet."
            if answer.pro { inviteSignIn = false }
        } catch is CancellationError {
            // Signed out: nothing to check.
        } catch {
            // Offline: keep the last answer, and say why the paywall is still up (the app checks again when it comes back).
            if !isPro { grantNote = "Couldn't check your account for Headway Pro: \(error.localizedDescription)" }
        }
    }

    /// Signing out forgets the grant (it belongs to the account, not the phone).
    func forgetGrant() {
        grantUntil = nil
        grantNote = nil
        UserDefaults.standard.removeObject(forKey: Self.grantKey)
    }
    private let unlockedForScreenshots: Bool
    private var updates: Task<Void, Never>?

    init() {
        #if DEBUG
        // Store screenshots and UI checks (`scripts/store_screenshots.sh` passes it).
        unlockedForScreenshots = ProcessInfo.processInfo.arguments.contains("-proUnlocked")
        // The Debug sign-in shortcuts start on the sign-in screen, as "Have a Pro invite? Sign in" does.
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-autoSignIn") || args.contains("-reviewSignIn") { inviteSignIn = true }
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

    /// Sends what this Apple Account owns to the signed-in account (after a purchase or restore, and
    /// before each account check). Signed out, or offline, it waits for the next time.
    func uploadPurchases() async {
        guard let upload = transactionUploader else { return }
        var signed: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, Self.ids.contains(t.productID) { signed.append(result.jwsRepresentation) }
        }
        if !signed.isEmpty { try? await upload(signed) }
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
                await uploadPurchases()
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
        await uploadPurchases()
        if plan == nil { error = "No Headway Pro purchase was found for this Apple Account." }
    }
}

/// `GET /api/pro`: whether the signed-in account has Pro given by email (scripts/grant_pro.sh).
struct ProGrantAnswer: Decodable {
    let pro: Bool
    let until: String?
    let email: String?

    var untilDate: Date? {
        guard let until else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: until) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: until)
    }
}
