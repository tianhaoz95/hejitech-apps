package com.hejitech.g2digest.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.hejitech.g2digest.core.AuthSession
import com.hejitech.g2digest.core.G2DigestApiClient
import kotlinx.serialization.encodeToString
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("g2digest_secure", Context.MODE_PRIVATE)
    private val keyAlias = "g2digest_session_aes"

    private fun secretKey(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        val spec = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(spec)
        }.generateKey()
    }

    private fun encrypt(plain: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val ct = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        val iv = Base64.getEncoder().encodeToString(cipher.iv)
        val body = Base64.getEncoder().encodeToString(ct)
        return "$iv:$body"
    }

    private fun decrypt(encoded: String): String? = runCatching {
        val parts = encoded.split(":")
        if (parts.size != 2) return null
        val iv = Base64.getDecoder().decode(parts[0])
        val ct = Base64.getDecoder().decode(parts[1])
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
        String(cipher.doFinal(ct), Charsets.UTF_8)
    }.getOrNull()

    fun loadSession(): AuthSession? = prefs.getString("session", null)?.let(::decrypt)?.let {
        runCatching { G2DigestApiClient.json.decodeFromString<AuthSession>(it) }.getOrNull()
    }

    fun saveSession(session: AuthSession?) {
        if (session == null) prefs.edit().remove("session").apply()
        else prefs.edit().putString("session", encrypt(G2DigestApiClient.json.encodeToString(session))).apply()
    }

    fun loadDeviceToken(): String? = prefs.getString("device_token", null)?.let(::decrypt)

    fun saveDeviceToken(token: String?) {
        if (token.isNullOrBlank()) prefs.edit().remove("device_token").apply()
        else prefs.edit().putString("device_token", encrypt(token)).apply()
    }

    fun savePkceVerifier(v: String?) {
        if (v == null) prefs.edit().remove("pkce_v").apply()
        else prefs.edit().putString("pkce_v", v).apply()
    }

    fun loadPkceVerifier(): String? = prefs.getString("pkce_v", null)

    fun useLocalStack(): Boolean = BuildConfig.DEBUG && prefs.getBoolean("use_local", false)

    fun setUseLocalStack(local: Boolean) {
        prefs.edit().putBoolean("use_local", local).apply()
    }

    fun lastSeenWhatsNew(): String? = prefs.getString("whats_new", null)
    fun markWhatsNewSeen(version: String) {
        prefs.edit().putString("whats_new", version).apply()
    }
}
