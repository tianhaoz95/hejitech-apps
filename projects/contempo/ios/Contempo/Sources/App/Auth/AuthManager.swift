import ContempoCore
import Foundation
@preconcurrency import Supabase

/// Sign-in through Supabase Auth (the shared HEJI project). Apple: the native sheet's identity token
/// goes to Supabase (`signInWithIdToken`; its Apple provider lists this bundle id). Google, the
/// monorepo's way: ASWebAuthenticationSession to Supabase's /authorize (PKCE), back through
/// com.hejitech.contempoapp://login-callback. No Google SDK or client ids in the app; the session is
/// persisted in the Keychain and refreshed by the client.
@MainActor
final class AuthManager {
    func signIn() async throws {
        try await ContempoBackend.client.auth.signInWithOAuth(provider: .google, redirectTo: ContempoBackend.redirectURL)
    }

    /// `nonce` is the raw nonce whose SHA-256 went into the Apple request.
    func signInWithApple(idToken: String, nonce: String) async throws {
        try await ContempoBackend.client.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: idToken, nonce: nonce))
    }

    /// Email and password for accounts Contempo hands out (App Review's demo account): checked by the
    /// Worker (`/api/review-sign-in`), which returns a normal Supabase session. Not a sign-up.
    func signIn(email: String, password: String) async throws {
        var request = URLRequest(url: ContempoBackend.workerURL.appendingPathComponent("api/review-sign-in"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let (data, response) = try await URLSession.shared.data(for: request)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              let access = json["access_token"] as? String, let refresh = json["refresh_token"] as? String else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw ContempoBackendError.api(status == 401 ? "Wrong email or password." : (json["error"] as? String) ?? "Sign-in failed.")
        }
        try await ContempoBackend.client.auth.setSession(accessToken: access, refreshToken: refresh)
    }

    func signOut() throws {
        Task { try? await ContempoBackend.client.auth.signOut() }
    }
}
