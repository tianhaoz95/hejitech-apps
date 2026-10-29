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
