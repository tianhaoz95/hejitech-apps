import StoreKit
import SwiftUI

/// G2 Digest Pro (decisions: "G2 Digest Pro"): a free download that needs Pro after a 1-week free trial, either
/// the annual subscription (the trial is its introductory offer) or the lifetime unlock. StoreKit 2
/// checks the purchase on the phone (`Transaction.currentEntitlements`, signed by the App Store), so
/// no server is involved: only this iPhone app is gated; the web app, glasses and Android aren't.
@MainActor @Observable
final class ReaderAccess {
    static let shared = ReaderAccess()
    static let annualSubscription = "com.hejitech.g2digest.pro.annual"
    static let permanentSubscription = "com.hejitech.g2digest.pro.lifetime"
    static let ids: Set<String> = [annualSubscription, permanentSubscription]

    enum Entitlement: Equatable { case annual(expires: Date?), lifetime }

    private(set) var catalog: [String: Product] = [:]
    private(set) var entitlement: Entitlement?
    /// False until the first entitlement check finished: the gate waits for it instead of flashing the paywall.
    private(set) var checked = false
    private(set) var hasTrialOffer = false
    private(set) var loadingCatalog = false
    /// The product being bought, or "restore"; nil when idle.
    var busy: String?
    var error: String?

    var canRead: Bool { entitlement != nil || accountAccess || screenshotAccess }

    // MARK: Pro given by email (scripts/grant_pro.sh)

    /// Asks the app's Worker `GET /api/pro` for the signed-in account; set by the app at launch.
    var accountQuery: (() async throws -> (pro: Bool, until: Date?, email: String?))?
    /// Hands this phone's App Store purchases to the signed-in account (POST /api/appstore/transactions),
    /// so the web, the glasses and every other app signed in to it have Pro too. Set by the app.
    var receiptPoster: (([String]) async throws -> Void)?
    /// The person tapped "Already have Pro? Sign in": the gate shows the sign-in instead of the paywall.
    var presentSignIn = false
    private(set) var queryingAccount = false
    /// Shown on the paywall after an invite sign-in without a grant.
    private(set) var accountStatusNote: String?
    /// The last grant the Worker confirmed, kept so a granted person isn't locked out offline.
    private var accountAccessUntil: Date? = ReaderAccess.savedAccountAccess()
    private var accountAccess: Bool { accountAccessUntil.map { $0 > .now } ?? false }
    private static let accountAccessKey = "pro_grant_until"

    private static func savedAccountAccess() -> Date? {
        let t = UserDefaults.standard.double(forKey: accountAccessKey)
        return t > 0 ? Date(timeIntervalSince1970: t) : nil
    }

    /// After a sign-in, at launch when signed in, and when the app comes back.
    func queryAccount() async {
        guard let check = accountQuery, !queryingAccount else { return }
        queryingAccount = true
        defer { queryingAccount = false }
        await postReceipts()
        do {
            let answer = try await check()
            // No end date = for good: store a far-future date.
            accountAccessUntil = answer.pro ? (answer.until ?? .distantFuture) : nil
            UserDefaults.standard.set(accountAccessUntil?.timeIntervalSince1970 ?? 0, forKey: Self.accountAccessKey)
            accountStatusNote = answer.pro ? nil : "There's no G2 Digest Pro on \(answer.email ?? "this account") yet."
            if answer.pro { presentSignIn = false }
        } catch {
            // Offline or signed out: keep the last answer.
        }
    }

    /// Signing out forgets the grant (it belongs to the account, not the phone).
    func clearAccountAccess() {
        accountAccessUntil = nil
        accountStatusNote = nil
        UserDefaults.standard.removeObject(forKey: Self.accountAccessKey)
    }
    private let screenshotAccess: Bool
    private var updates: Task<Void, Never>?

    init() {
        #if DEBUG
        // Store screenshots and UI checks (`scripts/store_screenshots.sh` passes it).
        screenshotAccess = ProcessInfo.processInfo.arguments.contains("-proUnlocked")
        // The Debug sign-in shortcuts start on the sign-in screen, as "Have a Pro invite? Sign in" does.
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-autoSignIn") || args.contains("-reviewSignIn") { presentSignIn = true }
        #else
        screenshotAccess = false
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
        await loadCatalog()
    }

    func loadCatalog() async {
        guard !loadingCatalog else { return }
        loadingCatalog = true
        error = nil
        defer { loadingCatalog = false }
        do {
            let found = try await Product.products(for: Self.ids)
            catalog = Dictionary(uniqueKeysWithValues: found.map { ($0.id, $0) })
            if let sub = catalog[Self.annualSubscription]?.subscription {
                hasTrialOffer = await sub.isEligibleForIntroOffer
            }
            if catalog.isEmpty { error = "G2 Digest Pro isn't available from the App Store right now. Try again in a moment." }
        } catch {
            self.error = "Couldn't reach the App Store: \(error.localizedDescription)"
        }
    }

    /// Reads what this Apple Account owns right now (verified by StoreKit; works offline from its cache).
    func refresh() async {
        var best: Entitlement?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, Self.ids.contains(t.productID), t.revocationDate == nil else { continue }
            if t.productID == Self.permanentSubscription {
                best = .lifetime
            } else if best == nil {
                best = .annual(expires: t.expirationDate)
            }
        }
        entitlement = best
        checked = true
    }

    /// Sends what this Apple Account owns to the signed-in account (after a purchase or restore, and
    /// before each account check). Signed out, or offline, it waits for the next time.
    func postReceipts() async {
        guard let upload = receiptPoster else { return }
        var signed: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, Self.ids.contains(t.productID) { signed.append(result.jwsRepresentation) }
        }
        if !signed.isEmpty { try? await upload(signed) }
    }

    func buy(_ id: String) async {
        guard let product = catalog[id], busy == nil else { return }
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
                await postReceipts()
            case .pending:
                error = "The purchase is waiting for approval. G2 Digest unlocks as soon as it's approved."
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
        await postReceipts()
        if entitlement == nil { error = "No G2 Digest Pro purchase was found for this Apple Account." }
    }
}

/// `GET /api/pro`: whether the signed-in account has Pro given by email (scripts/grant_pro.sh).
struct ReaderAccessAnswer: Decodable {
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
