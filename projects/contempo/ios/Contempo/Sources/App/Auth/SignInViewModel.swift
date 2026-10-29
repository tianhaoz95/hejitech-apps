import AuthenticationServices
import CryptoKit
import Foundation
import Observation

@Observable
@MainActor
final class SignInViewModel {
    private let authManager = ServiceLocator.authManager

    var isSigningIn = false
    var errorMessage: String?

    func signIn() {
        isSigningIn = true
        errorMessage = nil
        Task {
            do {
                try await authManager.signIn()
                isSigningIn = false
            } catch {
                isSigningIn = false
                errorMessage = error.localizedDescription
            }
        }
    }

    /// The raw nonce of the Apple request in flight; Apple gets its SHA-256, Supabase the raw value.
    private var appleNonce = ""

    func prepareAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        appleNonce = Self.randomNonce()
        request.requestedScopes = [.email]
        request.nonce = SHA256.hash(data: Data(appleNonce.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    func signInWithApple(_ result: Result<ASAuthorization, Error>) {
        errorMessage = nil
        switch result {
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code != .canceled { errorMessage = error.localizedDescription }
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let token = credential.identityToken.flatMap({ String(data: $0, encoding: .utf8) }) else {
                errorMessage = "Apple sign-in returned no identity token."
                return
            }
            isSigningIn = true
            Task {
                do {
                    try await authManager.signInWithApple(idToken: token, nonce: appleNonce)
                } catch {
                    errorMessage = error.localizedDescription
                }
                isSigningIn = false
            }
        }
    }

    private static func randomNonce() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    /// The "Sign in with email" sheet (accounts Contempo hands out, such as App Review's).
    func signIn(email: String, password: String) async -> Bool {
        errorMessage = nil
        do {
            try await authManager.signIn(email: email.trimmingCharacters(in: .whitespaces), password: password)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
