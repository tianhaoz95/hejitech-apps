package com.hejitech.tether.core

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.util.Base64
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@Serializable
data class StoredSshKey(
    val id: String = "key-${UUID.randomUUID().toString().take(8)}",
    val label: String,
    val algorithm: String = "RSA-2048",
    val publicKeyOpenSsh: String,
    val privateKeyPem: String,
    val hasPassphrase: Boolean = false
) {
    val fingerprintSha256: String
        get() = PaneTreeOps.computeSha256Fingerprint(publicKeyOpenSsh.toByteArray(Charsets.UTF_8))
}

/**
 * Android Keystore AES-GCM encrypted store for SSH private keys, host passwords, key passphrases,
 * and known_hosts SHA-256 fingerprints (PRD §10.2, §10.3, §14).
 * Never stores plaintext secrets in SharedPreferences or layout JSON.
 */
class SecureCredentialStore(private val context: Context? = null) {
    private val memoryStore = mutableMapOf<String, String>()
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    companion object {
        private const val KEYSTORE_ALIAS = "com.hejitech.tether.master_aes_key"
        private const val PREFS_FILE = "tether_keystore_encrypted_blobs"
        private const val KEY_SSH_KEYS = "ssh.keys"
        private const val KEY_KNOWN_HOSTS = "ssh.known_hosts"

        fun generateSshKeyPair(label: String): StoredSshKey {
            val kpg = KeyPairGenerator.getInstance("RSA")
            kpg.initialize(2048)
            val kp = kpg.generateKeyPair()
            val pubB64 = Base64.getEncoder().encodeToString(kp.public.encoded)
            val privB64 = Base64.getMimeEncoder(64, "\n".toByteArray()).encodeToString(kp.private.encoded)
            val pubOpenSsh = "ssh-rsa $pubB64 $label"
            val pem = "-----BEGIN PRIVATE KEY-----\n$privB64\n-----END PRIVATE KEY-----"
            return StoredSshKey(
                label = label,
                algorithm = "RSA-2048",
                publicKeyOpenSsh = pubOpenSsh,
                privateKeyPem = pem
            )
        }
    }

    fun listSshKeys(): List<StoredSshKey> {
        val raw = readEncrypted(KEY_SSH_KEYS) ?: return emptyList()
        return runCatching { json.decodeFromString<List<StoredSshKey>>(raw) }.getOrDefault(emptyList())
    }

    fun saveSshKey(key: StoredSshKey, passphrase: String? = null) {
        val updated = if (!passphrase.isNullOrEmpty()) {
            saveSecret("ssh.key_passphrase.${key.id}", passphrase)
            key.copy(hasPassphrase = true)
        } else key
        val next = listOf(updated) + listSshKeys().filterNot { it.id == key.id }
        writeEncrypted(KEY_SSH_KEYS, json.encodeToString(next))
    }

    fun deleteSshKey(id: String) {
        val next = listSshKeys().filterNot { it.id == id }
        writeEncrypted(KEY_SSH_KEYS, json.encodeToString(next))
        deleteSecret("ssh.key_passphrase.$id")
    }

    fun saveHostPassword(hostId: String, password: String) {
        saveSecret("ssh.host_password.$hostId", password)
    }

    fun loadHostPassword(hostId: String): String? = readEncrypted("ssh.host_password.$hostId")

    fun deleteHostPassword(hostId: String) {
        deleteSecret("ssh.host_password.$hostId")
    }

    // Mandatory Host Key Verification (PRD §10.3)

    fun listKnownHosts(): List<KnownHostKey> {
        val raw = readEncrypted(KEY_KNOWN_HOSTS) ?: return emptyList()
        return runCatching { json.decodeFromString<List<KnownHostKey>>(raw) }.getOrDefault(emptyList())
    }

    fun verifyHostKeyFingerprint(
        host: String,
        port: Int,
        keyType: String,
        sha256Fingerprint: String
    ): HostKeyVerificationResult {
        val norm = host.trim().lowercase()
        val existing = listKnownHosts().firstOrNull { it.host.lowercase() == norm && it.port == port }
            ?: return HostKeyVerificationResult.FirstConnect(norm, port, keyType, sha256Fingerprint)
        return if (existing.sha256Fingerprint == sha256Fingerprint && existing.keyType == keyType) {
            HostKeyVerificationResult.Matched(existing)
        } else {
            HostKeyVerificationResult.ChangedWarning(existing, keyType, sha256Fingerprint)
        }
    }

    fun trustHostKey(entry: KnownHostKey) {
        val norm = entry.host.trim().lowercase()
        val next = listKnownHosts()
            .filterNot { it.host.lowercase() == norm && it.port == entry.port } + entry.copy(host = norm)
        writeEncrypted(KEY_KNOWN_HOSTS, json.encodeToString(next))
    }

    fun removeKnownHostKey(host: String, port: Int) {
        val norm = host.trim().lowercase()
        val next = listKnownHosts().filterNot { it.host.lowercase() == norm && it.port == port }
        writeEncrypted(KEY_KNOWN_HOSTS, json.encodeToString(next))
    }

    private fun saveSecret(key: String, value: String) {
        writeEncrypted(key, value)
    }

    private fun deleteSecret(key: String) {
        val ctx = context
        if (ctx == null) {
            memoryStore.remove(key)
            return
        }
        ctx.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE).edit().remove(key).apply()
    }

    private fun getOrCreateMasterKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = ks.getEntry(KEYSTORE_ALIAS, null) as? KeyStore.SecretKeyEntry
        if (existing != null) return existing.secretKey
        val kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        kg.init(
            KeyGenParameterSpec.Builder(
                KEYSTORE_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return kg.generateKey()
    }

    private fun writeEncrypted(key: String, plaintext: String) {
        val ctx = context
        if (ctx == null) {
            memoryStore[key] = plaintext
            return
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateMasterKey())
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val encoded = Base64.getEncoder().encodeToString(iv) + ":" + Base64.getEncoder().encodeToString(ciphertext)
        ctx.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE).edit().putString(key, encoded).apply()
    }

    private fun readEncrypted(key: String): String? {
        val ctx = context ?: return memoryStore[key]
        val encoded = ctx.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE).getString(key, null) ?: return null
        val parts = encoded.split(":")
        if (parts.size != 2) return null
        return runCatching {
            val iv = Base64.getDecoder().decode(parts[0])
            val ciphertext = Base64.getDecoder().decode(parts[1])
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateMasterKey(), GCMParameterSpec(128, iv))
            String(cipher.doFinal(ciphertext), Charsets.UTF_8)
        }.getOrNull()
    }
}
