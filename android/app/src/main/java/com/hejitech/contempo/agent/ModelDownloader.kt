package com.hejitech.contempo.agent

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import java.io.File

/**
 * Downloads the Gemma 4 E2B .litertlm model file (~2.6GB, hosted publicly on
 * Hugging Face — no self-hosting needed, Apache 2.0 licensed) via Android's
 * DownloadManager, which handles HTTP range-request resume, retry, and
 * survival across app/process death at the OS level. Hand-rolling that for a
 * 2.6GB transfer would be real, unnecessary risk — DownloadManager is the
 * standard, battle-tested mechanism for exactly this.
 *
 * WiFi-only by default (setAllowedOverMetered(false)): a multi-GB download
 * silently starting over mobile data on first launch is the kind of thing
 * that should not be the default without the user having said so.
 *
 * The DownloadManager request id is persisted in SharedPreferences so a
 * download in progress survives app restarts — without this, relaunching
 * the app mid-download would orphan the running system download and start
 * a redundant second one.
 */
class ModelDownloader(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("model_downloader", Context.MODE_PRIVATE)
    private val downloadManager = appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

    val modelFile: File
        get() = File(appContext.getExternalFilesDir(null), "$SUBDIR/$FILENAME")

    fun isDownloaded(): Boolean = modelFile.exists() && modelFile.length() >= MODEL_SIZE_BYTES

    fun hasEnoughFreeSpace(): Boolean {
        val dir = modelFile.parentFile?.apply { mkdirs() } ?: return false
        return dir.usableSpace > MODEL_SIZE_BYTES + FREE_SPACE_BUFFER_BYTES
    }

    fun start(): Long {
        modelFile.parentFile?.mkdirs()
        val request = DownloadManager.Request(Uri.parse(MODEL_URL))
            .setTitle("Contempo on-device AI model")
            .setDescription("Downloading Gemma 4 E2B for on-device AI features")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_ONLY_COMPLETION)
            .setDestinationInExternalFilesDir(appContext, null, "$SUBDIR/$FILENAME")
            .setAllowedOverMetered(false)
            .setAllowedOverRoaming(false)
        val id = downloadManager.enqueue(request)
        prefs.edit().putLong(KEY_DOWNLOAD_ID, id).apply()
        return id
    }

    fun activeDownloadId(): Long? =
        prefs.getLong(KEY_DOWNLOAD_ID, -1L).takeIf { it != -1L }

    fun clearDownloadId() {
        prefs.edit().remove(KEY_DOWNLOAD_ID).apply()
    }

    data class ProgressSnapshot(
        val status: Int,
        val bytesDownloaded: Long,
        val totalBytes: Long,
        val reason: Int,
    )

    fun queryProgress(id: Long): ProgressSnapshot? {
        downloadManager.query(DownloadManager.Query().setFilterById(id)).use { cursor ->
            if (cursor == null || !cursor.moveToFirst()) return null
            return ProgressSnapshot(
                status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)),
                bytesDownloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)),
                totalBytes = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)),
                reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)),
            )
        }
    }

    fun cancel(id: Long) {
        downloadManager.remove(id)
        clearDownloadId()
    }

    companion object {
        // Generic (non-chip-specific) build — broadest device compatibility
        // over the slightly more optimized NPU-specific variants also
        // hosted in this repo. Size confirmed directly via Hugging Face's
        // x-linked-size response header, not estimated.
        const val MODEL_URL =
            "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm"
        const val MODEL_SIZE_BYTES = 2_588_147_712L
        private const val FREE_SPACE_BUFFER_BYTES = 500L * 1024 * 1024 // 500MB safety margin
        private const val SUBDIR = "models"
        private const val FILENAME = "gemma-4-E2B-it.litertlm"
        private const val KEY_DOWNLOAD_ID = "download_id"
    }
}
