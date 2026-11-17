// Robinhood on this iPhone (preview): sign in to the official Robinhood MCP and run a read-only check.
// It never places, cancels or changes anything (TradeboardKit's RobinhoodMCP refuses every tool outside
// its read-only list) and reports nothing to the board: it only proves the phone can connect.
import AuthenticationServices
import Network
import SwiftUI
import TradeboardKit
import UIKit

struct RobinhoodCheck {
    var at = Date()
    var toolCount = 0
    var orderToolCount = 0
    var accounts: [RobinhoodParse.AccountRow] = []
    var chosenMask: String?
    var approvals: String?
    var quoteSymbol = "SPY"
    var quote: Double?
    var problems: [String] = []
}

/// What the "Sign in on a computer" screen shows while the computer signs in.
struct RobinhoodHandoff: Equatable {
    var link: String
    var short: String
    var expiresAt: Date
}

@Observable
@MainActor
final class RobinhoodLink {
    static let shared = RobinhoodLink()

    var redirect: RobinhoodRedirect = .computer
    var busy = false
    var log: [String] = []
    var error: String?
    var check: RobinhoodCheck?
    /// Set while waiting for the computer's sign-in.
    var handoff: RobinhoodHandoff?
    private(set) var stored = RobinhoodStore.load()

    private let auth = RobinhoodAuthClient()
    private var meta: AuthServerMetadata?
    private let web = WebAuthRunner()
    private var cancelled = false

    var signedIn: Bool { stored.tokens != nil }
    private var backend: TradeboardBackend { AppModel.shared.backend }

    func redirectURI(_ r: RobinhoodRedirect) -> String { r.uri(site: backend.config.site) }

    init() {
        if let r = stored.redirect { redirect = r }
    }

    private func note(_ s: String) {
        log.append(s)
    }

    private func metadata() async throws -> AuthServerMetadata {
        if let meta { return meta }
        note("Reading Robinhood's sign-in settings…")
        let m = try await auth.discover()
        note("Authorization server: \(URL(string: m.authorization_endpoint)?.host ?? m.authorization_endpoint)")
        meta = m
        return m
    }

    private func clientId(meta m: AuthServerMetadata, uri: String) async throws -> String {
        if let id = stored.clients[uri] {
            note("Using the client already registered for \(uri).")
            return id
        }
        note("Registering Tradeboard for iPhone with redirect \(uri)…")
        let id = try await auth.register(meta: m, redirectURI: uri)
        stored.clients[uri] = id
        RobinhoodStore.save(stored)
        note("Registered.")
        return id
    }

    func cancelHandoff() {
        cancelled = true
        handoff = nil
    }

    func signIn() async {
        guard !busy else { return }
        busy = true
        cancelled = false
        error = nil
        check = nil
        log = []
        defer { busy = false; handoff = nil }
        let redirect = self.redirect
        let uri = redirectURI(redirect)
        do {
            let m = try await metadata()
            let id = try await clientId(meta: m, uri: uri)
            let verifier = PKCE.verifier()
            let state = PKCE.verifier()
            guard let url = RobinhoodOAuth.authorizationURL(meta: m, clientId: id, redirectURI: uri, challenge: PKCE.challenge(for: verifier), state: state) else {
                throw RobinhoodError("couldn't build the sign-in address")
            }
            let code: String
            if redirect == .computer {
                guard let c = try await viaComputer(url: url, state: state, issuer: m.issuer) else { return }
                code = c
            } else {
                note("Opening Robinhood's sign-in…")
                let callback = try await web.authenticate(url: url, redirect: redirect)
                switch RobinhoodOAuth.parseCallback(callback, expectedState: state, issuer: m.issuer) {
                case .failure(let why): throw RobinhoodError("Robinhood sent back an error: \(why)")
                case .code(let c): code = c
                }
            }
            note("Got the one-time code. Exchanging it for tokens on this iPhone…")
            let tokens = try await auth.exchange(meta: m, code: code, verifier: verifier, clientId: id, redirectURI: uri)
            stored.tokens = tokens
            stored.redirect = redirect
            stored.redirectURI = uri
            stored.signedInAt = Date()
            RobinhoodStore.save(stored)
            note("Signed in\(tokens.refreshToken == nil ? " (no refresh token: sign-in won't renew)" : ""). Tokens are in this iPhone's Keychain.")
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            note("Sign-in cancelled.")
            return
        } catch {
            self.error = error.localizedDescription
            note("Failed: \(error.localizedDescription)")
            return
        }
        handoff = nil
        await runCheck(clearLog: false)
    }

    /// Registers the sign-in with the board, shows the link for the computer, and waits for the
    /// board to relay Robinhood's one-time code (useless without the verifier, which stays here).
    private func viaComputer(url: URL, state: String, issuer: String) async throws -> String? {
        note("Starting a sign-in for your computer…")
        let start = try await backend.startRobinhoodHandoff(state: state, authorizeURL: url)
        let expires = ISO8601DateFormatter.full.date(from: start.expires_at) ?? ISO8601DateFormatter().date(from: start.expires_at) ?? Date().addingTimeInterval(600)
        handoff = RobinhoodHandoff(link: start.link, short: start.short, expiresAt: expires)
        note("Open \(start.link) on your computer and sign in to Robinhood there.")
        while !cancelled {
            if Date() > expires { throw RobinhoodError("the sign-in link expired: start again") }
            try await Task.sleep(for: .seconds(2))
            if cancelled { break }
            let st: RobinhoodHandoffStatus
            do {
                st = try await backend.robinhoodHandoffStatus(state: state)
            } catch let e as BackendError {
                if case .http(404, _) = e { throw RobinhoodError("this sign-in expired or was already used: start again") }
                continue // a dropped request while waiting; keep waiting
            } catch {
                continue
            }
            switch st.status {
            case "done":
                if let iss = st.iss, iss != issuer { throw RobinhoodError("the reply came from an unexpected issuer (\(iss))") }
                guard let code = st.code, !code.isEmpty else { throw RobinhoodError("the board relayed no code") }
                return code
            case "error":
                throw RobinhoodError("Robinhood sent back an error: \(st.error ?? "unknown")")
            default:
                continue
            }
        }
        note("Sign-in cancelled.")
        return nil
    }

    /// A token that's valid for at least another minute, refreshing it when needed.
    private func freshToken(force: Bool = false) async throws -> String {
        guard var tokens = stored.tokens else { throw RobinhoodError("not signed in to Robinhood") }
        if force || (tokens.expiresAt.map { $0 < Date().addingTimeInterval(60) } ?? false) {
            guard let uri = stored.redirectURI ?? stored.redirect.map({ redirectURI($0) }), let clientId = stored.clients[uri] else { throw RobinhoodError("sign in to Robinhood again") }
            note("Refreshing the Robinhood token…")
            tokens = try await auth.refresh(meta: try await metadata(), tokens: tokens, clientId: clientId)
            stored.tokens = tokens
            RobinhoodStore.save(stored)
        }
        return tokens.accessToken
    }

    func runCheck(clearLog: Bool = true) async {
        if clearLog { log = [] }
        busy = true
        error = nil
        defer { busy = false }
        do {
            check = try await readOnlyCheck(token: try await freshToken())
        } catch is Unauthorized {
            do {
                check = try await readOnlyCheck(token: try await freshToken(force: true))
            } catch {
                self.error = "Robinhood didn't accept the sign-in: \(error.localizedDescription). Sign in again."
                note("Failed: \(error.localizedDescription)")
            }
        } catch {
            self.error = error.localizedDescription
            note("Failed: \(error.localizedDescription)")
        }
    }

    private func readOnlyCheck(token: String) async throws -> RobinhoodCheck {
        var c = RobinhoodCheck()
        let mcp = RobinhoodMCP(accessToken: token)
        note("Connecting to the Robinhood MCP…")
        try await mcp.initialize()
        let tools = try await mcp.listTools()
        c.toolCount = tools.count
        c.orderToolCount = tools.filter { $0.contains("order") }.count
        note("Connected: \(tools.count) tools offered (this app calls only \(RobinhoodMCP.readOnlyTools.count) read-only ones).")

        note("Reading accounts…")
        c.accounts = RobinhoodParse.accounts(try await mcp.call("get_accounts"))
        note(c.accounts.isEmpty ? "No accounts in the reply." : "Accounts: " + c.accounts.map { "\($0.masked)\($0.agenticAllowed ? " (agent trading on)" : "")" }.joined(separator: ", "))
        let chosen = c.accounts.first(where: \.agenticAllowed) ?? c.accounts.first
        c.chosenMask = chosen?.masked
        if c.accounts.isEmpty { c.problems.append("Robinhood returned no accounts.") }
        if !c.accounts.isEmpty && !c.accounts.contains(where: \.agenticAllowed) { c.problems.append("No account has agent trading turned on in Robinhood.") }

        if let chosen {
            do {
                c.approvals = RobinhoodParse.approvals(try await mcp.call("get_trade_approval_setting", ["account_number": chosen.number]))
                note("Trade approvals on \(chosen.masked): \(c.approvals!).")
            } catch {
                c.problems.append("Trade approval setting: \(error.localizedDescription)")
            }
        }

        do {
            c.quote = try RobinhoodParse.quotePrice(try await mcp.call("get_equity_quotes", ["symbols": [c.quoteSymbol]]), symbol: c.quoteSymbol)
            note("Quote: \(c.quoteSymbol) \(String(format: "$%.2f", c.quote!)).")
        } catch {
            c.problems.append("Quote: \(error.localizedDescription)")
        }
        note(c.problems.isEmpty ? "Read-only check passed." : "Read-only check finished with \(c.problems.count) problem(s).")
        return c
    }

    func signOut() {
        RobinhoodStore.clear()
        stored = RobinhoodStored()
        check = nil
        error = nil
        log = ["Signed out of Robinhood on this iPhone. Tokens and registered clients were removed from the Keychain."]
    }

    /// The log and settings, for a bug report. Never includes tokens or codes.
    var diagnostics: String {
        var lines = [
            "Tradeboard \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?") (\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?")), iOS \(UIDevice.current.systemVersion)",
            "Redirect: \(redirect.title) — \(redirectURI(redirect))",
            "Signed in: \(signedIn ? "yes" : "no")",
        ]
        lines += log.map { "· \($0)" }
        if let error { lines.append("Error: \(error)") }
        return lines.joined(separator: "\n")
    }
}

// MARK: - The browser sheet

/// Runs ASWebAuthenticationSession for each kind of redirect. The loopback one is caught by a listener
/// on 127.0.0.1 in the app (the sheet loads that address on the phone itself), which then closes the sheet.
@MainActor
final class WebAuthRunner: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    nonisolated func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
        }
    }

    func authenticate(url: URL, redirect: RobinhoodRedirect) async throws -> URL {
        let catcher = redirect == .loopback ? LoopbackCatcher(port: RobinhoodConstants.loopbackPort) : nil
        try catcher?.start()
        defer { catcher?.stop() }
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<URL, Error>) in
            let once = Once(cont)
            let done: (URL?, Error?) -> Void = { url, err in
                if let url { once.resume(.success(url)) } else { once.resume(.failure(err ?? RobinhoodError("the sign-in ended without a reply"))) }
            }
            let s: ASWebAuthenticationSession
            switch redirect {
            case .computer:
                once.resume(.failure(RobinhoodError("sign-in on a computer doesn't use this sheet")))
                return
            case .appScheme:
                s = ASWebAuthenticationSession(url: url, callbackURLScheme: RobinhoodConstants.appScheme, completionHandler: done)
            case .appLink:
                if #available(iOS 17.4, *) {
                    s = ASWebAuthenticationSession(url: url, callback: .https(host: RobinhoodConstants.appLinkHost, path: RobinhoodConstants.appLinkPath), completionHandler: done)
                } else {
                    once.resume(.failure(RobinhoodError("App link sign-in needs iOS 17.4 or later")))
                    return
                }
            case .loopback:
                // The scheme is never used: the listener catches the redirect and closes the sheet.
                s = ASWebAuthenticationSession(url: url, callbackURLScheme: "tradeboard-loopback", completionHandler: done)
                catcher?.onCallback = { [weak self] u in
                    once.resume(.success(u))
                    Task { @MainActor in self?.session?.cancel() }
                }
            }
            s.presentationContextProvider = self
            s.prefersEphemeralWebBrowserSession = false
            session = s
            if !s.start() { once.resume(.failure(RobinhoodError("couldn't open the sign-in sheet"))) }
        }
    }
}

/// Resumes a continuation at most once (the sheet and the listener can both report).
final class Once: @unchecked Sendable {
    private var cont: CheckedContinuation<URL, Error>?
    private let lock = NSLock()
    init(_ c: CheckedContinuation<URL, Error>) { cont = c }
    func resume(_ r: Result<URL, Error>) {
        lock.lock()
        let c = cont
        cont = nil
        lock.unlock()
        c?.resume(with: r)
    }
}

/// A one-shot HTTP listener on 127.0.0.1:<port> for the loopback redirect, like the executor's.
final class LoopbackCatcher: @unchecked Sendable {
    private let port: UInt16
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "tradeboard.loopback")
    var onCallback: ((URL) -> Void)?

    init(port: UInt16) { self.port = port }

    func start() throws {
        let params = NWParameters.tcp
        params.allowLocalEndpointReuse = true
        params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
        let l = try NWListener(using: params)
        l.newConnectionHandler = { [weak self] conn in self?.handle(conn) }
        l.start(queue: queue)
        listener = l
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    private func handle(_ conn: NWConnection) {
        conn.start(queue: queue)
        conn.receive(minimumIncompleteLength: 1, maximumLength: 65_536) { [weak self] data, _, _, _ in
            let head = data.flatMap { String(data: $0, encoding: .utf8) }?.split(separator: "\r\n").first.map(String.init) ?? ""
            let parts = head.split(separator: " ")
            let target = parts.count >= 2 ? String(parts[1]) : ""
            let isCallback = target.hasPrefix("/oauth/callback")
            let body = isCallback ? "<!doctype html><meta name=viewport content='width=device-width'><p style='font:17px -apple-system;padding:24px'>Robinhood answered. Returning to Tradeboard…</p>" : "not found"
            let resp = "HTTP/1.1 \(isCallback ? "200 OK" : "404 Not Found")\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: \(body.utf8.count)\r\nConnection: close\r\n\r\n\(body)"
            conn.send(content: resp.data(using: .utf8), completion: .contentProcessed { _ in conn.cancel() })
            if isCallback, let url = URL(string: "http://127.0.0.1:\(self?.port ?? 0)\(target)") {
                self?.onCallback?(url)
            }
        }
    }
}

extension ISO8601DateFormatter {
    static let full: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}
