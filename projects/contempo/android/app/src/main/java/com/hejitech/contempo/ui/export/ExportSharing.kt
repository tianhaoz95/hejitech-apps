package com.hejitech.contempo.ui.export

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.hejitech.contempo.R
import java.io.File

/** Shares a generated CSV via ACTION_SEND — used by the Export section embedded in SettingsScreen. */
fun shareCsv(context: Context, csv: String) {
    val file = File(context.cacheDir, "contempo_export.csv").apply { writeText(csv) }
    shareFile(context, file, "text/csv")
}

/** Shares a generated PDF audit binder via ACTION_SEND. */
fun sharePdf(context: Context, file: File) {
    shareFile(context, file, "application/pdf")
}

/**
 * Generic counterpart to [shareCsv] — shares any already-on-disk file
 * (e.g. a downloaded entry attachment, see EntryDetailScreen.kt) via
 * ACTION_SEND, same FileProvider authority/pattern.
 */
fun shareFile(context: Context, file: File, mimeType: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, context.getString(R.string.export_share_button)))
}

/**
 * Opens an already-on-disk file externally via ACTION_VIEW — used for entry
 * attachment types this app has no in-app preview for (anything besides
 * image/video/PDF, see EntryDetailScreen.kt's AttachmentsSection).
 */
fun openFileExternally(context: Context, file: File, mimeType: String) {
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, mimeType)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(
        Intent.createChooser(intent, context.getString(R.string.entry_detail_attachment_open_chooser_title)),
    )
}
