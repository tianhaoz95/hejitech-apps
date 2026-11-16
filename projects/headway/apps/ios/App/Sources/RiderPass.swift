import StoreKit
import SwiftUI

/// A rider's Headway Pro pass (docs/decisions.md: "Headway Pro", "Headway Pro on every platform"). The
/// iPhone sells two fares through StoreKit 2, a yearly pass whose first week is free (its introductory
/// offer) and a lifetime pass, and also honours a pass the rider's account holds from the web, Android or
/// a grant (GET /api/pro). Fares bought here are handed to the account so every other Headway has them.
@MainActor @Observable
final class RiderPass {
    static let shared = RiderPass()
    static let annualFare = "com.hejitech.headway.pro.annual"
    static let lifetimeFare = "com.hejitech.headway.pro.lifetime"
    static let ids: Set<String> = [annualFare, lifetimeFare]

    enum Ticket: Equatable { case annual(expires: Date?), lifetime }

    private(set) var fares: [String: Product] = [:]
    private(set) var ticket: Ticket?
    /// False until the first entitlement check finished: the gate waits for it instead of flashing the paywall.
    private(set) var checked = false
    private(set) var freeWeekAvailable = false
    private(set) var loadingFares = false
    /// The product being bought, or "restore"; nil when idle.
    var busy: String?
    var error: String?

    var hasPass: Bool { ticket != nil || accountPassActive || screenshotPass }

    // MARK: Pro given by email (scripts/grant_pro.sh)

    /// Asks the app's Worker `GET /api/pro` for the signed-in account; set by the app at launch.
    var accountCheck: (() async throws -> (pro: Bool, until: Date?, email: String?))?
    /// Hands this phone's App Store purchases to the signed-in account (POST /api/appstore/transactions),
    /// so the web, the glasses and every other app signed in to it have Pro too. Set by the app.
    var purchaseUploader: (([String]) async throws -> Void)?
    /// The person tapped "Already have Pro? Sign in": the gate shows the sign-in instead of the paywall.
    var wantsSignIn = false
    private(set) var checkingAccount = false
    /// Shown on the paywall after an invite sign-in without a grant.
    private(set) var accountNote: String?
    /// The last grant the Worker confirmed, kept so a granted person isn't locked out offline.
    private var accountPassUntil: Date? = RiderPass.storedAccountPass()
    private var accountPassActive: Bool { accountPassUntil.map { $0 > .now } ?? false }
    private static let accountPassKey = "pro_grant_until"

    private static func storedAccountPass() -> Date? {
        let t = UserDefaults.standard.double(forKey: accountPassKey)
        return t > 0 ? Date(timeIntervalSince1970: t) : nil
    }

    /// After a sign-in, at launch when signed in, and when the app comes back.
    func checkAccount() async {
        guard let check = accountCheck, !checkingAccount else { return }
        checkingAccount = true
        defer { checkingAccount = false }
        await sendPurchases()
        do {
            let answer = try await check()
            // No end date = for good: store a far-future date.
            accountPassUntil = answer.pro ? (answer.until ?? .distantFuture) : nil
            UserDefaults.standard.set(accountPassUntil?.timeIntervalSince1970 ?? 0, forKey: Self.accountPassKey)
            accountNote = answer.pro ? nil : "There's no Headway Pro on \(answer.email ?? "this account") yet."
            if answer.pro { wantsSignIn = false }
        } catch is CancellationError {
            // Signed out: nothing to check.
        } catch {
            // Offline: keep the last answer, and say why the paywall is still up (the app checks again when it comes back).
            if !hasPass { accountNote = "Couldn't check your account for Headway Pro: \(error.localizedDescription)" }
        }
    }

    /// Signing out forgets the grant (it belongs to the account, not the phone).
    func forgetAccountPass() {
        accountPassUntil = nil
        accountNote = nil
        UserDefaults.standard.removeObject(forKey: Self.accountPassKey)
    }
    private let screenshotPass: Bool
    private var updates: Task<Void, Never>?

    init() {
        #if DEBUG
        // Store screenshots and UI checks (`scripts/store_screenshots.sh` passes it).
        screenshotPass = ProcessInfo.processInfo.arguments.contains("-proUnlocked")
        // The Debug sign-in shortcuts start on the sign-in screen, as "Have a Pro invite? Sign in" does.
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-autoSignIn") || args.contains("-reviewSignIn") { wantsSignIn = true }
        #else
        screenshotPass = false
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
        await loadFares()
    }

    func loadFares() async {
        guard !loadingFares else { return }
        loadingFares = true
        error = nil
        defer { loadingFares = false }
        do {
            let found = try await Product.products(for: Self.ids)
            fares = Dictionary(uniqueKeysWithValues: found.map { ($0.id, $0) })
            if let sub = fares[Self.annualFare]?.subscription {
                freeWeekAvailable = await sub.isEligibleForIntroOffer
            }
            if fares.isEmpty { error = "Headway Pro isn't available from the App Store right now. Try again in a moment." }
        } catch {
            self.error = "Couldn't reach the App Store: \(error.localizedDescription)"
        }
    }

    /// Reads what this Apple Account owns right now (verified by StoreKit; works offline from its cache).
    func refresh() async {
        var best: Ticket?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, Self.ids.contains(t.productID), t.revocationDate == nil else { continue }
            if t.productID == Self.lifetimeFare {
                best = .lifetime
            } else if best == nil {
                best = .annual(expires: t.expirationDate)
            }
        }
        ticket = best
        checked = true
    }

    /// Sends what this Apple Account owns to the signed-in account (after a purchase or restore, and
    /// before each account check). Signed out, or offline, it waits for the next time.
    func sendPurchases() async {
        guard let upload = purchaseUploader else { return }
        var signed: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, Self.ids.contains(t.productID) { signed.append(result.jwsRepresentation) }
        }
        if !signed.isEmpty { try? await upload(signed) }
    }

    func buy(_ id: String) async {
        guard let product = fares[id], busy == nil else { return }
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
                await sendPurchases()
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
        await sendPurchases()
        if ticket == nil { error = "No Headway Pro purchase was found for this Apple Account." }
    }
}

/// `GET /api/pro`: whether the signed-in account has Pro given by email (scripts/grant_pro.sh).
struct AccountPassAnswer: Decodable {
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
