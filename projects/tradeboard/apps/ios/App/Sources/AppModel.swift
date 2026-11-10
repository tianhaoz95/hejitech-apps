import AuthenticationServices
import Foundation
import SwiftUI
import TradeboardKit

public enum AuthPhase: Equatable {
    case checking
    case unauthenticated
    case totpRequired(session: SupabaseSession, enroll: Bool, secret: String?, otpauth: String?)
    case authenticated(email: String?)
}

public enum PlanFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case pendingApproval = "Needs Approval"
    case discussion = "Discussion"
    case active = "Active"
    case executed = "Executed"
    case closed = "Closed"

    public var id: String { rawValue }
}

@Observable
public final class AppModel {
    public static let shared = AppModel()

    public var config: BackendConfig {
        didSet {
            backend = TradeboardBackend(config: config, sessionCookie: backend.sessionCookie)
            setupBackendCallbacks()
        }
    }

    public var backend: TradeboardBackend
    public var authPhase: AuthPhase = .checking
    public var board: BoardSummary?
    public var selectedPlan: PlanDetail?
    public var strategy: StrategyResponse?
    public var selectedFilter: PlanFilter = .all
    public var isLoading: Bool = false
    public var error: String?

    public init(config: BackendConfig = .production) {
        #if DEBUG
        // Default to local stack in debug unless specified
        let defaultConf: BackendConfig = ProcessInfo.processInfo.arguments.contains("-production") ? .production : .local
        #else
        let defaultConf: BackendConfig = .production
        #endif
        self.config = defaultConf
        self.backend = TradeboardBackend(config: defaultConf)
        setupBackendCallbacks()
    }

    private func setupBackendCallbacks() {
        backend.onSessionChange = { [weak self] cookie in
            Task { @MainActor in
                if cookie == nil {
                    self?.authPhase = .unauthenticated
                    self?.board = nil
                    self?.selectedPlan = nil
                }
            }
        }
    }

    // MARK: - Lifecycle

    @MainActor
    public func start() async {
        isLoading = true
        defer { isLoading = false }

        // If we have a session cookie, verify with /api/me
        if backend.isSignedIn {
            do {
                let me = try await backend.getMe()
                if me.signed_in {
                    authPhase = .authenticated(email: me.email)
                    await refresh()
                    return
                }
            } catch {
                backend.setSessionCookie(nil)
            }
        }

        authPhase = .unauthenticated
    }

    @MainActor
    public func refresh() async {
        guard case .authenticated = authPhase else { return }
        // Its own task: a caller's view task (the sign-in screen's) is cancelled when the board
        // replaces it, and the load must not fail with "cancelled" then.
        await Task { @MainActor in
            do {
                board = try await backend.getBoard()
                error = nil
            } catch {
                self.error = error.localizedDescription
                if (error as? BackendError)?.isUnauthorized == true {
                    authPhase = .unauthenticated
                }
            }
        }.value
    }

    // MARK: - Authentication Flow

    @MainActor
    public func signInWithApple(_ result: Result<ASAuthorization, Error>) async {
        isLoading = true
        defer { isLoading = false }
        do {
            guard case .success(let auth) = result,
                  let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                  let token = cred.identityToken.flatMap({ String(data: $0, encoding: .utf8) }) else {
                if case .failure(let e) = result, (e as? ASAuthorizationError)?.code == .canceled { return }
                if case .failure(let e) = result { throw e }
                return
            }

            let session = try await backend.signInWithApple(idToken: token)
            await proceedToTOTP(session: session)
        } catch {
            self.error = "Apple sign-in failed: \(error.localizedDescription)"
        }
    }

    /// Where Supabase sends the browser back after Google sign-in (allow-listed in the shared project).
    public static let authRedirect = "tradeboard://login-callback"

    @MainActor
    public func signInWithGoogle(using webAuth: WebAuthenticationSession) async {
        error = nil
        do {
            let (url, verifier) = backend.oauthStart(provider: "google", redirect: Self.authRedirect)
            let callback = try await webAuth.authenticate(using: url, callbackURLScheme: "tradeboard")
            let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
            guard let code = items.first(where: { $0.name == "code" })?.value else {
                let reason = items.first(where: { $0.name == "error_description" })?.value ?? "no code in the callback"
                throw NSError(domain: "Tradeboard", code: 1, userInfo: [NSLocalizedDescriptionKey: reason.replacingOccurrences(of: "+", with: " ")])
            }
            isLoading = true
            defer { isLoading = false }
            let session = try await backend.exchangeCode(code, verifier: verifier)
            await proceedToTOTP(session: session)
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            return
        } catch {
            self.error = "Google sign-in failed: \(error.localizedDescription)"
        }
    }

    @MainActor
    public func signInWithEmail(_ email: String, _ pass: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let session = try await backend.signInWithEmail(email: email.trimmingCharacters(in: .whitespaces), password: pass)
            await proceedToTOTP(session: session)
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    private func proceedToTOTP(session: SupabaseSession) async {
        do {
            let begin = try await backend.authBegin(supabaseAccessToken: session.accessToken)
            authPhase = .totpRequired(
                session: session,
                enroll: begin.enroll,
                secret: begin.secret,
                otpauth: begin.otpauth
            )
            error = nil
        } catch {
            self.error = "Two-factor verification initialization failed: \(error.localizedDescription)"
        }
    }

    @MainActor
    public func verifyTOTP(code: String) async {
        guard case .totpRequired(let session, _, _, _) = authPhase else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            try await backend.authVerify(supabaseAccessToken: session.accessToken, code: code)
            let me = try await backend.getMe()
            authPhase = .authenticated(email: me.email ?? session.email)
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }

    /// Email sign-in for accounts Tradeboard hands out (App Review's demo account). No TOTP step: the
    /// Worker only accepts its own demo account here, and that board is DEMO plans in dry-run.
    @MainActor
    public func signInWithEmailAccount(_ email: String, _ password: String) async -> Bool {
        isLoading = true
        defer { isLoading = false }
        do {
            try await backend.reviewSignIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
            let me = try await backend.getMe()
            authPhase = .authenticated(email: me.email ?? email)
            error = nil
            await refresh()
            return true
        } catch {
            if case .http(let code, _) = error as? BackendError, code == 401 {
                self.error = "Wrong email or password."
            } else if case .http(429, _) = error as? BackendError {
                self.error = "Too many attempts. Wait ten minutes and try again."
            } else {
                self.error = error.localizedDescription
            }
            return false
        }
    }

    /// Deletes the board and everything on it, then signs out.
    @MainActor
    public func deleteAccount() async -> Bool {
        do {
            try await backend.deleteAccount()
            authPhase = .unauthenticated
            board = nil
            selectedPlan = nil
            strategy = nil
            error = nil
            return true
        } catch {
            self.error = "Couldn't delete your board: \(error.localizedDescription)"
            return false
        }
    }

    @MainActor
    public func signOut() async {
        await backend.logout()
        authPhase = .unauthenticated
        board = nil
        selectedPlan = nil
    }

    // MARK: - Plan Operations

    @MainActor
    public func loadPlan(id: String) async {
        do {
            selectedPlan = try await backend.getPlan(id: id)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    public func approvePlan(planId: String, version: Int, note: String = "") async -> Bool {
        do {
            _ = try await backend.approvePlan(planId: planId, version: version, note: note)
            await loadPlan(id: planId)
            await refresh()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    @MainActor
    public func rejectPlan(planId: String, reason: String) async -> Bool {
        do {
            _ = try await backend.rejectPlan(planId: planId, reason: reason)
            await loadPlan(id: planId)
            await refresh()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    @MainActor
    public func cancelPlan(planId: String, reason: String = "") async -> Bool {
        do {
            _ = try await backend.cancelPlan(planId: planId, reason: reason)
            await loadPlan(id: planId)
            await refresh()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    @MainActor
    public func requestChanges(planId: String, body: String) async -> Bool {
        do {
            _ = try await backend.requestChanges(planId: planId, body: body)
            await loadPlan(id: planId)
            await refresh()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    @MainActor
    public func markReady(planId: String) async -> Bool {
        do {
            _ = try await backend.markReady(planId: planId)
            await loadPlan(id: planId)
            await refresh()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    @MainActor
    public func addComment(planId: String, body: String, isQuestion: Bool = false) async -> Bool {
        do {
            _ = try await backend.addComment(planId: planId, body: body, isQuestion: isQuestion)
            await loadPlan(id: planId)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    // MARK: - Board Controls

    @MainActor
    public func toggleDryRun(enabled: Bool) async {
        do {
            _ = try await backend.toggleDryRun(enabled: enabled)
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    public func pauseBoard(paused: Bool) async {
        do {
            _ = try await backend.pauseBoard(paused: paused)
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    public func emergencyKill() async {
        do {
            _ = try await backend.killBoard()
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Strategy

    @MainActor
    public func loadStrategy() async {
        do {
            strategy = try await backend.getStrategy()
        } catch {
            self.error = error.localizedDescription
        }
    }

    @MainActor
    public func updateStrategy(content: String) async -> Bool {
        do {
            _ = try await backend.updateStrategy(content: content)
            await loadStrategy()
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }
}
