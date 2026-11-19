import Foundation
import Security

/// The signed-in session, in the Keychain group the app and its Share extension both list
/// (`$(AppIdentifierPrefix)com.hejitech.folio.shared`, from Info.plist's `FolioKeychainGroup`). A
/// Keychain access group needs no App Group, which CI signing can't register.
public struct SessionVault: Sendable {
    public let service: String
    public let group: String?

    public init(service: String = "com.hejitech.folio.session", group: String? = SessionVault.bundleGroup) {
        self.service = service
        self.group = group
    }

    /// The shared group named in the running bundle's Info.plist (app or extension).
    public static var bundleGroup: String? {
        guard let g = Bundle.main.object(forInfoDictionaryKey: "FolioKeychainGroup") as? String, !g.isEmpty, !g.hasPrefix("$(") else { return nil }
        return g
    }

    private func query(shared: Bool = true) -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "session",
        ]
        if shared, let group { q[kSecAttrAccessGroup as String] = group }
        return q
    }

    /// Runs `op` on the shared group, or on the app's own Keychain when the build has no
    /// keychain-access-groups entitlement (unsigned simulator builds, `swift test`).
    private func withGroup(_ op: ([String: Any]) -> OSStatus) -> OSStatus {
        let status = op(query())
        return status == errSecMissingEntitlement && group != nil ? op(query(shared: false)) : status
    }

    public func load() -> AuthSession? {
        var out: CFTypeRef?
        let status = withGroup { q in
            var q = q
            q[kSecReturnData as String] = true
            q[kSecMatchLimit as String] = kSecMatchLimitOne
            return SecItemCopyMatching(q as CFDictionary, &out)
        }
        guard status == errSecSuccess, let data = out as? Data else { return nil }
        return try? JSONDecoder().decode(AuthSession.self, from: data)
    }

    public func save(_ s: AuthSession) {
        guard let data = try? JSONEncoder().encode(s) else { return }
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            // The extension and notification actions run while the phone may be locked.
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        _ = withGroup { q in
            let status = SecItemUpdate(q as CFDictionary, attrs as CFDictionary)
            return status == errSecItemNotFound ? SecItemAdd(q.merging(attrs) { $1 } as CFDictionary, nil) : status
        }
    }

    public func clear() {
        _ = withGroup { SecItemDelete($0 as CFDictionary) }
    }
}
