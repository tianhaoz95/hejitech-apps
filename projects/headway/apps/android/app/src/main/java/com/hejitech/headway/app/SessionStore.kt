package com.hejitech.headway.app

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.hejitech.headway.core.model.AuthSession
import com.hejitech.headway.core.net.BackendConfig
import com.hejitech.headway.core.net.HeadwayApiClient
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The sign-in session, encrypted with an AES-GCM key that never leaves the Android Keystore and kept
 * in the app's private preferences (not backed up: `allowBackup` is off). The app, the ride-watching
 * service and the watch link all read it, so each survives the app process being restarted.
 */
class SessionStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("headway.session", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    fun load(): AuthSession? = runCatching {
        val parts = prefs.getString(KEY, null)?.split(":") ?: return null
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)))
        json.decodeFromString<AuthSession>(String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP))))
    }.getOrNull()

    fun save(session: AuthSession?) {
        if (session == null) {
            prefs.edit().remove(KEY).apply()
            return
        }
        runCatching {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val sealed = cipher.doFinal(json.encodeToString(session).toByteArray())
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
                    .build()
            )
        }.generateKey()
    }

    private companion object {
        const val KEY = "session"
        const val ALIAS = "headway.session"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}

/** Which backend this build talks to, and a signed-in API client for code that runs outside the app's screens. */
object AppBackend {
    private const val PREFS = "headway"
    private const val KEY_LOCAL = "local_backend"

    private val isEmulator = Build.FINGERPRINT.contains("generic") || Build.HARDWARE in setOf("ranchu", "goldfish")

    /** Release builds always use production. Debug builds can switch to the local stack (Settings or the sign-in screen). */
    fun isLocal(context: Context): Boolean =
        BuildConfig.DEBUG && context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_LOCAL, false)

    fun setLocal(context: Context, local: Boolean) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_LOCAL, local).apply()
    }

    fun config(context: Context): BackendConfig = when {
        !isLocal(context) -> BackendConfig.PRODUCTION
        isEmulator -> BackendConfig.LOCAL_EMULATOR
        else -> BackendConfig.LOCAL_DEVICE
    }

    /** A client with the stored session that keeps the store current when it refreshes the token. */
    fun client(context: Context): HeadwayApiClient {
        val store = SessionStore(context)
        return HeadwayApiClient(config(context)).apply {
            restoreSession(store.load())
            onSessionChange = { store.save(it) }
        }
    }
}
