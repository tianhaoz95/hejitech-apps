import AuthenticationServices
import CryptoKit
import SwiftUI

/// Sign-in through the shared Supabase project: Google in the browser (PKCE), Apple with the native
/// sheet, and email for local accounts in Debug builds. GitHub comes back once its provider is
/// enabled on the project (docs/DEPLOY.md §2).
struct SignInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuth
    @State private var error: String?
    @State private var busy = false
    @State private var email = ""
    @State private var password = ""
    @State private var nonce = ""

    static let redirect = "hq://login-callback"

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "building.columns.fill").font(.system(size: 54)).foregroundStyle(Color.accentColor)
            Text("HQ").font(.largeTitle.weight(.bold))
            Text("Your repo's autopilot: agents propose, your team decides.").multilineTextAlignment(.center).foregroundStyle(.secondary)
            Spacer()
            VStack(spacing: 10) {
                Button { Task { await browser("google") } } label: { Label("Continue with Google", systemImage: "globe").frame(maxWidth: .infinity) }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                SignInWithAppleButton(.continue) { req in
                    nonce = Backend.randomURLSafe(bytes: 24)
                    req.requestedScopes = [.email]
                    req.nonce = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
                } onCompletion: { result in Task { await apple(result) } }
                    .signInWithAppleButtonStyle(.whiteOutline).frame(height: 48)
            }.disabled(busy)
            #if DEBUG
            VStack(spacing: 8) {
                Text("Local development: email accounts on this Mac's Supabase").font(.caption).foregroundStyle(.secondary)
                TextField("Email", text: $email).textContentType(.username).textInputAutocapitalization(.never).keyboardType(.emailAddress)
                SecureField("Password", text: $password)
                Button("Sign in") { Task { await run { try await Backend.shared.signIn(email: email, password: password) } } }.disabled(email.isEmpty || password.isEmpty)
            }.textFieldStyle(.roundedBorder).padding(.top, 8)
            #endif
            if let error = error ?? model.error { Text(error).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center) }
            Spacer()
        }
        .padding(24)
    }

    private func run(_ fn: () async throws -> Void) async {
        busy = true; defer { busy = false }
        do {
            try await fn()
            await model.load()
            if let code = UserDefaults.standard.string(forKey: "hq.pending-join") {
                UserDefaults.standard.removeObject(forKey: "hq.pending-join")
                await model.join(code)
            }
        } catch let e as ASWebAuthenticationSessionError where e.code == .canceledLogin {
            return
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func browser(_ provider: String) async {
        await run {
            let (url, verifier) = Backend.shared.oauthStart(provider: provider, redirect: Self.redirect)
            let callback = try await webAuth.authenticate(using: url, callbackURLScheme: "hq")
            guard let code = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "code" })?.value else {
                throw APIError(status: 0, message: "Sign-in didn't return a code.")
            }
            try await Backend.shared.exchangeCode(code, verifier: verifier)
        }
    }

    private func apple(_ result: Result<ASAuthorization, Error>) async {
        await run {
            switch result {
            case .failure(let e):
                if (e as? ASAuthorizationError)?.code == .canceled { return }
                throw e
            case .success(let auth):
                guard let cred = auth.credential as? ASAuthorizationAppleIDCredential, let token = cred.identityToken.flatMap({ String(data: $0, encoding: .utf8) }) else {
                    throw APIError(status: 0, message: "Apple didn't return an identity token.")
                }
                try await Backend.shared.signIn(provider: "apple", idToken: token, nonce: nonce)
            }
        }
    }
}
