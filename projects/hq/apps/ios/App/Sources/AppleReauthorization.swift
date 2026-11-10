import AuthenticationServices
import UIKit

/// Asks Apple for a fresh authorization code before account deletion: the Worker trades it for the
/// app's Sign in with Apple token and revokes it (App Store guideline 5.1.1(v)). Nil when the
/// person cancels or Apple fails; the deletion goes ahead without the revocation then.
@MainActor
final class AppleReauthorization: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var continuation: CheckedContinuation<String?, Never>?
    private var controller: ASAuthorizationController?

    func authorizationCode() async -> String? {
        await withCheckedContinuation { c in
            continuation = c
            let controller = ASAuthorizationController(authorizationRequests: [ASAuthorizationAppleIDProvider().createRequest()])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.controller = controller   // the controller doesn't keep itself alive
            controller.performRequests()
        }
    }

    private func finish(_ code: String?) {
        continuation?.resume(returning: code)
        continuation = nil
        controller = nil
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        let code = (authorization.credential as? ASAuthorizationAppleIDCredential)?.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        MainActor.assumeIsolated { finish(code) }
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        MainActor.assumeIsolated { finish(nil) }
    }

    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
        }
    }
}
