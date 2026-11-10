import AuthenticationServices
import SwiftUI

/// The sign-in buttons' shared size and shape: Apple's button and Google's sit together as a pair.
enum SocialButton {
    static let height: CGFloat = 52
}

/// Sign in with Apple, filled (black in light mode, white in dark), as a capsule.
struct AppleSignInButton: View {
    @Environment(\.colorScheme) private var colorScheme
    let onCompletion: (Result<ASAuthorization, Error>) -> Void

    var body: some View {
        SignInWithAppleButton(.continue) { request in
            request.requestedScopes = [.email]
        } onCompletion: { result in
            onCompletion(result)
        }
        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
        // Apple redraws the button per style; the id makes the switch take effect live.
        .id(colorScheme)
        .frame(height: SocialButton.height)
        .clipShape(Capsule())
    }
}

/// Continue with Google: Google's neutral button (its "G" on a plain surface with a thin outline),
/// matched to the Apple button's size and type.
struct GoogleSignInButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image("GoogleG")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 19, height: 19)
                Text("Continue with Google")
                    .font(.system(size: 19, weight: .medium))
            }
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity)
            .frame(height: SocialButton.height)
            .background(Color(.systemBackground), in: Capsule())
            .overlay(Capsule().strokeBorder(Color.primary.opacity(0.22), lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("google-signin")
    }
}
