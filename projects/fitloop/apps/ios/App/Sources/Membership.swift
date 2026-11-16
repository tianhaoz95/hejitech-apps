import StoreKit
import SwiftUI

/// FitLoop Pro (decisions: "FitLoop Pro"): a free download that needs Pro after a 1-week free trial, either
/// the annual subscription (the trial is its introductory offer) or the lifetime unlock. StoreKit 2
/// checks the purchase on the phone (`Transaction.currentEntitlements`, signed by the App Store), so
/// no server is involved: only this iPhone app is gated; the web app, glasses and Android aren't.
@MainActor @Observable
final class Membership {
    static let shared = Membership()
    static let yearlyOption = "com.hejitech.fitloop.pro.annual"
    static let lifetimeOption = "com.hejitech.fitloop.pro.lifetime"
    static let ids: Set<String> = [yearlyOption, lifetimeOption]

    enum Tier: Equatable { case annual(expires: Date?), lifetime }

    private(set) var options: [String: Product] = [:]
    private(set) var tier: Tier?
    /// False until the first entitlement check finished: the gate waits for it instead of flashing the paywall.
    private(set) var checked = false
    private(set) var trialAvailable = false
    private(set) var loadingOptions = false
    /// The product being bought, or "restore"; nil when idle.
    var busy: String?
    var error: String?

    var isMember: Bool { tier != nil || accountMember || demoMember }

    // MARK: Pro given by email (scripts/grant_pro.sh)

    /// Asks the app's Worker `GET /api/pro` for the signed-in account; set by the app at launch.
    var accountLookup: (() async throws -> (pro: Bool, until: Date?, email: String?))?
    /// Hands this phone's App Store purchases to the signed-in account (POST /api/appstore/transactions),
    /// so the web, the glasses and every other app signed in to it have Pro too. Set by the app.
    var receiptSender: (([String]) async throws -> Void)?
    /// The person tapped "Already have Pro? Sign in": the gate shows the sign-in instead of the paywall.
    var showSignIn = false
    private(set) var lookingUp = false
    /// Shown on the paywall after an invite sign-in without a grant.
    private(set) var accountMessage: String?
    /// The last grant the Worker confirmed, kept so a granted person isn't locked out offline.
    private var accountMemberUntil: Date? = Membership.savedAccountMember()
    private var accountMember: Bool { accountMemberUntil.map { $0 > .now } ?? false }
    private static let accountMemberKey = "pro_grant_until"

    private static func savedAccountMember() -> Date? {
        let t = UserDefaults.standard.double(forKey: accountMemberKey)
        return t > 0 ? Date(timeIntervalSince1970: t) : nil
    }

    /// After a sign-in, at launch when signed in, and when the app comes back.
    func lookUpAccount() async {
        guard let check = accountLookup, !lookingUp else { return }
        lookingUp = true
        defer { lookingUp = false }
        await shareReceipts()
        do {
            let answer = try await check()
            // No end date = for good: store a far-future date.
            accountMemberUntil = answer.pro ? (answer.until ?? .distantFuture) : nil
            UserDefaults.standard.set(accountMemberUntil?.timeIntervalSince1970 ?? 0, forKey: Self.accountMemberKey)
            accountMessage = answer.pro ? nil : "There's no FitLoop Pro on \(answer.email ?? "this account") yet."
            if answer.pro { showSignIn = false }
        } catch {
            // Offline or signed out: keep the last answer.
        }
    }

    /// Signing out forgets the grant (it belongs to the account, not the phone).
    func dropAccountMembership() {
        accountMemberUntil = nil
        accountMessage = nil
        UserDefaults.standard.removeObject(forKey: Self.accountMemberKey)
    }
    private let demoMember: Bool
    private var updates: Task<Void, Never>?

    init() {
        #if DEBUG
        // Store screenshots and UI checks (`scripts/store_screenshots.sh` passes it).
        demoMember = ProcessInfo.processInfo.arguments.contains("-proUnlocked")
        // The Debug sign-in shortcuts start on the sign-in screen, as "Have a Pro invite? Sign in" does.
        let args = ProcessInfo.processInfo.arguments
        if args.contains("-autoSignIn") || args.contains("-reviewSignIn") { showSignIn = true }
        #else
        demoMember = false
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
        await loadOptions()
    }

    func loadOptions() async {
        guard !loadingOptions else { return }
        loadingOptions = true
        error = nil
        defer { loadingOptions = false }
        do {
            let found = try await Product.products(for: Self.ids)
            options = Dictionary(uniqueKeysWithValues: found.map { ($0.id, $0) })
            if let sub = options[Self.yearlyOption]?.subscription {
                trialAvailable = await sub.isEligibleForIntroOffer
            }
            if options.isEmpty { error = "FitLoop Pro isn't available from the App Store right now. Try again in a moment." }
        } catch {
            self.error = "Couldn't reach the App Store: \(error.localizedDescription)"
        }
    }

    /// Reads what this Apple Account owns right now (verified by StoreKit; works offline from its cache).
    func refresh() async {
        var best: Tier?
        for await result in Transaction.currentEntitlements {
            guard case .verified(let t) = result, Self.ids.contains(t.productID), t.revocationDate == nil else { continue }
            if t.productID == Self.lifetimeOption {
                best = .lifetime
            } else if best == nil {
                best = .annual(expires: t.expirationDate)
            }
        }
        tier = best
        checked = true
    }

    /// Sends what this Apple Account owns to the signed-in account (after a purchase or restore, and
    /// before each account check). Signed out, or offline, it waits for the next time.
    func shareReceipts() async {
        guard let upload = receiptSender else { return }
        var signed: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let t) = result, Self.ids.contains(t.productID) { signed.append(result.jwsRepresentation) }
        }
        if !signed.isEmpty { try? await upload(signed) }
    }

    func buy(_ id: String) async {
        guard let product = options[id], busy == nil else { return }
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
                await shareReceipts()
            case .pending:
                error = "The purchase is waiting for approval. FitLoop unlocks as soon as it's approved."
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
        await shareReceipts()
        if tier == nil { error = "No FitLoop Pro purchase was found for this Apple Account." }
    }
}

/// `GET /api/pro`: whether the signed-in account has Pro given by email (scripts/grant_pro.sh).
struct MembershipAnswer: Decodable {
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
