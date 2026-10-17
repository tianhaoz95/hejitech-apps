import ContempoCore
import FirebaseAuth
import FirebaseCore
import Foundation
import GoogleSignIn
#if canImport(UIKit)
import UIKit
#endif

/// Google Sign-In, with two entirely separate code paths selected by the
/// `USE_FIREBASE_EMULATOR` compilation condition — both end at the same
/// `Auth.auth().signIn(with:)` call, but they get the credential very
/// differently. Mirrors Android's `AuthManager` 1:1 (see its kdoc):
///
///  - Emulator path: the Firebase Auth emulator does not verify federated
///    (Google/etc.) ID tokens against the real provider — it decodes
///    whatever string is passed as the token and, if it parses as JSON,
///    takes fields like `sub`/`email`/`name` as the resulting user's claims.
///    This skips GoogleSignIn entirely and hands the emulator a small fixed
///    fake-identity JSON. No real Firebase project or OAuth client is
///    needed to exercise this.
///  - Real path: an actual `GIDSignIn` flow using the iOS app's own OAuth
///    client (`FirebaseApp.app()?.options.clientID`, from
///    `GoogleService-Info.plist`) — unlike Android's Credential Manager
///    flow, iOS's GoogleSignIn SDK needs no separate "web client id".
@MainActor
final class AuthManager {
    private static let fakeEmulatorIdToken =
        #"{"sub":"emulator-pilot-user","email":"pilot@example.test","email_verified":true,"name":"Pilot Host"}"#

    func signIn() async throws {
        let credential: AuthCredential
        #if USE_FIREBASE_EMULATOR
        credential = GoogleAuthProvider.credential(withIDToken: Self.fakeEmulatorIdToken, accessToken: "")
        #else
        credential = try await realGoogleCredential()
        #endif
        try await Auth.auth().signIn(with: credential)
    }

    func signOut() throws {
        try Auth.auth().signOut()
    }

    #if !USE_FIREBASE_EMULATOR
    private func realGoogleCredential() async throws -> AuthCredential {
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            throw AuthManagerError.missingClientID
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)

        guard let presentingViewController = Self.topViewController() else {
            throw AuthManagerError.noPresentingViewController
        }
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presentingViewController)
        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthManagerError.missingIdToken
        }
        return GoogleAuthProvider.credential(withIDToken: idToken, accessToken: result.user.accessToken.tokenString)
    }

    private static func topViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .rootViewController
    }
    #endif
}

enum AuthManagerError: Error {
    case missingClientID
    case noPresentingViewController
    case missingIdToken
}
