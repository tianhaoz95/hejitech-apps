import ContempoCore
import Foundation
@preconcurrency import Supabase

/// Sign-in through Supabase Auth (the shared HEJI project). Google, the monorepo's way:
/// ASWebAuthenticationSession to Supabase's /authorize (PKCE), back through
/// com.hejitech.contempoapp://login-callback. No Google SDK or client ids in the app; the session is
/// persisted in the Keychain and refreshed by the client.
@MainActor
final class AuthManager {
    func signIn() async throws {
        try await ContempoBackend.client.auth.signInWithOAuth(provider: .google, redirectTo: ContempoBackend.redirectURL)
    }

    func signOut() throws {
        Task { try? await ContempoBackend.client.auth.signOut() }
    }
}
