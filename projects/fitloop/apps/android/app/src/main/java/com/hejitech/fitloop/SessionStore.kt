package com.hejitech.fitloop

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.hejitech.fitloop.core.AuthSession
import com.hejitech.fitloop.core.Backend
import kotlinx.serialization.encodeToString
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The sign-in session, encrypted with an AES-GCM key that never leaves the Android Keystore and
 * kept in the app's private preferences (not backed up: `allowBackup` is off).
 */
class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("fitloop.session", Context.MODE_PRIVATE)

    fun load(): AuthSession? = runCatching {
        val parts = prefs.getString(KEY, null)?.split(":") ?: return null
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
        Backend.json.decodeFromString<AuthSession>(String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP))))
    }.getOrNull()

    fun save(session: AuthSession?) {
        if (session == null) {
            prefs.edit().remove(KEY).apply()
            return
        }
        runCatching {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val sealed = cipher.doFinal(Backend.json.encodeToString(session).toByteArray())
            prefs.edit().putString(KEY, "${Base64.encodeToString(cipher.iv, Base64.NO_WRAP)}:${Base64.encodeToString(sealed, Base64.NO_WRAP)}").apply()
        }
    }

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(
                KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
        }.generateKey()
    }

    private companion object {
        const val KEY = "session"
        const val ALIAS = "fitloop.session"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
