import CryptoKit
import Foundation
import Security

/// Metadata + PEM material for an SSH keypair stored exclusively in the iOS Keychain (PRD §10.2, §14).
public struct StoredSshKey: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var label: String
    public var algorithm: String // "ed25519" or "rsa"
    public var publicKeyOpenSSH: String
    public var privateKeyPEM: String
    public var hasPassphrase: Bool
    public var createdAt: String

    public init(
        id: String = "key-\(UUID().uuidString.lowercased().prefix(8))",
        label: String,
        algorithm: String = "ed25519",
        publicKeyOpenSSH: String,
        privateKeyPEM: String,
        hasPassphrase: Bool = false,
        createdAt: String = ISO8601DateFormatter().string(from: Date())
    ) {
        self.id = id
        self.label = label
        self.algorithm = algorithm
        self.publicKeyOpenSSH = publicKeyOpenSSH
        self.privateKeyPEM = privateKeyPEM
        self.hasPassphrase = hasPassphrase
        self.createdAt = createdAt
    }

    /// SHA-256 fingerprint of the public key in `SHA256:<base64>` format.
    public var fingerprintSHA256: String {
        SshKeyGenerator.computeSHA256Fingerprint(fromOpenSSHPublicKey: publicKeyOpenSSH)
    }
}

/// Generates Ed25519 SSH keys and computes OpenSSH SHA-256 fingerprints using CryptoKit.
public enum SshKeyGenerator {
    public static func generateEd25519Key(
        id: String = "key-\(UUID().uuidString.lowercased().prefix(8))",
        label: String
    ) -> StoredSshKey {
        let priv = Curve25519.Signing.PrivateKey()
        let pubBytes = Data(priv.publicKey.rawRepresentation)
        let privBytes = Data(priv.rawRepresentation)

        // Format OpenSSH wire format for ssh-ed25519 public key:
        // string "ssh-ed25519" + string <32-byte pubkey>
        var wire = Data()
        wire.appendSSHString("ssh-ed25519")
        wire.appendSSHData(pubBytes)
        let pubOpenSSH = "ssh-ed25519 \(wire.base64EncodedString()) \(label)"

        // Format OpenSSH private key PEM block
        var privBlob = Data("openssh-key-v1\0".utf8)
        privBlob.appendSSHString("none") // ciphername
        privBlob.appendSSHString("none") // kdfname
        privBlob.appendSSHString("")     // kdfoptions
        privBlob.appendUInt32BE(1)       // number of keys
        privBlob.appendSSHData(wire)     // public key blob

        var secretSection = Data()
        let checkInt = UInt32.random(in: .min ... .max)
        secretSection.appendUInt32BE(checkInt)
        secretSection.appendUInt32BE(checkInt)
        secretSection.appendSSHString("ssh-ed25519")
        secretSection.appendSSHData(pubBytes)
        var combinedPrivPub = Data(privBytes)
        combinedPrivPub.append(pubBytes)
        secretSection.appendSSHData(combinedPrivPub)
        secretSection.appendSSHString(label)
        // Padding 1, 2, 3... to 8-byte block size
        var padByte: UInt8 = 1
        while secretSection.count % 8 != 0 {
            secretSection.append(padByte)
            padByte &+= 1
        }
        privBlob.appendSSHData(secretSection)

        let base64Lines = stride(from: 0, to: privBlob.base64EncodedString().count, by: 70).map { start -> String in
            let str = privBlob.base64EncodedString()
            let sIdx = str.index(str.startIndex, offsetBy: start)
            let eIdx = str.index(sIdx, offsetBy: min(70, str.count - start))
            return String(str[sIdx..<eIdx])
        }.joined(separator: "\n")

        let pem = """
        -----BEGIN OPENSSH PRIVATE KEY-----
        \(base64Lines)
        -----END OPENSSH PRIVATE KEY-----
        """

        return StoredSshKey(
            id: id,
            label: label,
            algorithm: "ed25519",
            publicKeyOpenSSH: pubOpenSSH,
            privateKeyPEM: pem,
            hasPassphrase: false
        )
    }

    /// Computes a canonical `SHA256:<base64-no-padding>` fingerprint from raw public key bytes.
    public static func computeSHA256Fingerprint(fromRawKeyData data: Data) -> String {
        let digest = Data(SHA256.hash(data: data))
        let b64 = digest.base64EncodedString().replacingOccurrences(of: "=", with: "")
        return "SHA256:\(b64)"
    }

    /// Computes a canonical `SHA256:<base64-no-padding>` fingerprint from an OpenSSH public key line.
    public static func computeSHA256Fingerprint(fromOpenSSHPublicKey pubKey: String) -> String {
        let parts = pubKey.trimmingCharacters(in: .whitespacesAndNewlines).split(separator: " ")
        if parts.count >= 2, let decoded = Data(base64Encoded: String(parts[1])) {
            return computeSHA256Fingerprint(fromRawKeyData: decoded)
        }
        return computeSHA256Fingerprint(fromRawKeyData: Data(pubKey.utf8))
    }
}

private extension Data {
    mutating func appendUInt32BE(_ value: UInt32) {
        var be = value.bigEndian
        Swift.withUnsafeBytes(of: &be) { append(contentsOf: $0) }
    }

    mutating func appendSSHData(_ data: Data) {
        appendUInt32BE(UInt32(data.count))
        append(data)
    }

    mutating func appendSSHString(_ string: String) {
        appendSSHData(Data(string.utf8))
    }
}

/// Keychain-backed store for auth sessions, SSH private keys, host passwords, key passphrases,
/// and known_hosts fingerprints (PRD §10.2, §10.3, §14).
/// Also supports an in-memory fallback for unit tests on macOS without entitlement prompts.
public final class SecureStore: @unchecked Sendable {
    public let service: String
    private let useInMemoryFallback: Bool
    private let lock = NSLock()
    private var memoryStore: [String: Data] = [:]

    private static let installFlagKey = "com.hejitech.tether.installed"
    private static let sessionAccount = "auth.session"
    private static let sshKeysAccount = "ssh.keys"
    private static let knownHostsAccount = "ssh.known_hosts"

    public init(service: String = "com.hejitech.tether", useInMemoryFallback: Bool = false) {
        self.service = service
        self.useInMemoryFallback = useInMemoryFallback

        if !useInMemoryFallback {
            let defaults = UserDefaults.standard
            if !defaults.bool(forKey: Self.installFlagKey) {
                // iOS Keychain survives app deletion; clear leftover auth sessions on first launch after install.
                deleteRaw(account: Self.sessionAccount)
                defaults.set(true, forKey: Self.installFlagKey)
            }
        }
    }

    // MARK: - Auth Session

    public func loadSession() -> AuthSession? {
        guard let data = readRaw(account: Self.sessionAccount) else { return nil }
        return try? JSONDecoder().decode(AuthSession.self, from: data)
    }

    public func saveSession(_ session: AuthSession?) {
        guard let session, let data = try? JSONEncoder().encode(session) else {
            deleteRaw(account: Self.sessionAccount)
            return
        }
        writeRaw(account: Self.sessionAccount, data: data)
    }

    // MARK: - SSH Keys (Keychain-only, PRD §10.2 & §14)

    public func listSshKeys() -> [StoredSshKey] {
        guard let data = readRaw(account: Self.sshKeysAccount),
              let keys = try? JSONDecoder().decode([StoredSshKey].self, from: data) else {
            return []
        }
        return keys
    }

    public func getSshKey(id: String) -> StoredSshKey? {
        listSshKeys().first(where: { $0.id == id })
    }

    public func saveSshKey(_ key: StoredSshKey, passphrase: String? = nil) {
        var keys = listSshKeys().filter { $0.id != key.id }
        var updated = key
        if let passphrase, !passphrase.isEmpty {
            updated.hasPassphrase = true
            saveKeyPassphrase(passphrase, forKeyId: key.id)
        }
        keys.insert(updated, at: 0)
        if let data = try? JSONEncoder().encode(keys) {
            writeRaw(account: Self.sshKeysAccount, data: data)
        }
    }

    public func deleteSshKey(id: String) {
        let keys = listSshKeys().filter { $0.id != id }
        if let data = try? JSONEncoder().encode(keys) {
            writeRaw(account: Self.sshKeysAccount, data: data)
        }
        deleteKeyPassphrase(forKeyId: id)
    }

    // MARK: - Host Passwords & Key Passphrases (Keychain-only, PRD §14)

    public func saveHostPassword(_ password: String, forHostId hostId: String) {
        writeRaw(account: "ssh.host_password.\(hostId)", data: Data(password.utf8))
    }

    public func loadHostPassword(forHostId hostId: String) -> String? {
        guard let data = readRaw(account: "ssh.host_password.\(hostId)") else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func deleteHostPassword(forHostId hostId: String) {
        deleteRaw(account: "ssh.host_password.\(hostId)")
    }

    public func saveKeyPassphrase(_ passphrase: String, forKeyId keyId: String) {
        writeRaw(account: "ssh.key_passphrase.\(keyId)", data: Data(passphrase.utf8))
    }

    public func loadKeyPassphrase(forKeyId keyId: String) -> String? {
        guard let data = readRaw(account: "ssh.key_passphrase.\(keyId)") else { return nil }
        return String(data: data, encoding: .utf8)
    }

    public func deleteKeyPassphrase(forKeyId keyId: String) {
        deleteRaw(account: "ssh.key_passphrase.\(keyId)")
    }

    // MARK: - Known Host Keys & Mandatory Verification (PRD §6.4 & §10.3)

    public func listKnownHostKeys() -> [KnownHostKey] {
        guard let data = readRaw(account: Self.knownHostsAccount),
              let list = try? JSONDecoder().decode([KnownHostKey].self, from: data) else {
            return []
        }
        return list
    }

    /// Evaluates a server's presented host key against stored `known_hosts` (PRD §10.3):
    /// - First connect -> `.firstConnect` (caller MUST prompt user to Trust & Save or Cancel)
    /// - Subsequent connect with matching key -> `.matched` (proceeds silently)
    /// - Subsequent connect with different key -> `.changedWarning` (caller MUST show high-severity warning; default Cancel)
    public func verifyHostKeyFingerprint(
        host: String,
        port: Int,
        keyType: String,
        sha256Fingerprint: String
    ) -> HostKeyVerificationStatus {
        let normalizedHost = host.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let existing = listKnownHostKeys().first(where: {
            $0.host.lowercased() == normalizedHost && $0.port == port
        })
        guard let existing else {
            return .firstConnect(
                host: normalizedHost,
                port: port,
                keyType: keyType,
                sha256Fingerprint: sha256Fingerprint
            )
        }
        if existing.sha256Fingerprint == sha256Fingerprint && existing.keyType == keyType {
            return .matched(existing)
        }
        return .changedWarning(
            existing: existing,
            presentedKeyType: keyType,
            presentedFingerprint: sha256Fingerprint
        )
    }

    public func trustHostKey(_ entry: KnownHostKey) {
        let normalizedHost = entry.host.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        var list = listKnownHostKeys().filter {
            !($0.host.lowercased() == normalizedHost && $0.port == entry.port)
        }
        var copy = entry
        copy.host = normalizedHost
        list.append(copy)
        list.sort { ($0.host, $0.port) < ($1.host, $1.port) }
        if let data = try? JSONEncoder().encode(list) {
            writeRaw(account: Self.knownHostsAccount, data: data)
        }
    }

    public func removeKnownHostKey(host: String, port: Int) {
        let normalizedHost = host.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let list = listKnownHostKeys().filter {
            !($0.host.lowercased() == normalizedHost && $0.port == port)
        }
        if let data = try? JSONEncoder().encode(list) {
            writeRaw(account: Self.knownHostsAccount, data: data)
        }
    }

    // MARK: - Low-level Keychain Operations

    private func readRaw(account: String) -> Data? {
        if useInMemoryFallback {
            lock.lock(); defer { lock.unlock() }
            return memoryStore[account]
        }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return item as? Data
    }

    private func writeRaw(account: String, data: Data) {
        if useInMemoryFallback {
            lock.lock(); defer { lock.unlock() }
            memoryStore[account] = data
            return
        }
        let deleteQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(deleteQuery as CFDictionary)

        let addQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    private func deleteRaw(account: String) {
        if useInMemoryFallback {
            lock.lock(); defer { lock.unlock() }
            memoryStore.removeValue(forKey: account)
            return
        }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
