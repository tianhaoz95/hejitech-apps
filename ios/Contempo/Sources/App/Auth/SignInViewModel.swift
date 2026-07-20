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
}
