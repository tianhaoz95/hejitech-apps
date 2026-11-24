package com.hejitech.g2digest.app

import android.content.Context
import com.hejitech.g2digest.core.EditionResponse
import com.hejitech.g2digest.core.G2DigestApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import java.io.File
import java.net.URL

/** Persists up to 5 recent editions and their prefetched audio files for offline reading/commutes. */
class OfflineCache(context: Context) {
    private val maxEditions = 5
    private val dir = File(context.cacheDir, "g2digest_offline").apply { mkdirs() }

    private fun editionFile(date: String) = File(dir, "edition-$date.json")
    private fun audioFile(audioPath: String) = File(dir, "audio-${audioPath.replace("/", "__")}")

    suspend fun saveEdition(edition: EditionResponse) = withContext(Dispatchers.IO) {
        runCatching {
            editionFile(edition.date).writeText(G2DigestApiClient.json.encodeToString(edition))
        }
        // Best-effort background audio prefetch
        for ((path, url) in edition.audio) {
            val dest = audioFile(path)
            if (dest.exists() && dest.length() > 0) continue
            runCatching {
                URL(url).openStream().use { input ->
                    dest.outputStream().use { out -> input.copyTo(out) }
                }
            }
        }
        pruneOld()
    }

    fun loadLatestEdition(): EditionResponse? {
        val files = dir.listFiles { f -> f.name.startsWith("edition-") && f.name.endsWith(".json") }
            ?.sortedByDescending { it.name }
            ?: return null
        val first = files.firstOrNull() ?: return null
        return runCatching { G2DigestApiClient.json.decodeFromString<EditionResponse>(first.readText()) }.getOrNull()
    }

    fun loadEdition(date: String): EditionResponse? {
        val file = editionFile(date)
        if (!file.exists()) return null
        return runCatching { G2DigestApiClient.json.decodeFromString<EditionResponse>(file.readText()) }.getOrNull()
    }

    fun localAudioFile(audioPath: String): File? {
        val f = audioFile(audioPath)
        return if (f.exists() && f.length() > 0) f else null
    }

    fun clearAll() {
        dir.listFiles()?.forEach { it.delete() }
    }

    private fun pruneOld() {
        val files = dir.listFiles { f -> f.name.startsWith("edition-") && f.name.endsWith(".json") }
            ?.sortedByDescending { it.name }
            ?: return
        files.drop(maxEditions).forEach { it.delete() }
    }
}
