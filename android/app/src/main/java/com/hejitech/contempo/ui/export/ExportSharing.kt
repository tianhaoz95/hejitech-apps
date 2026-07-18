package com.hejitech.contempo.ui.export

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.hejitech.contempo.R
import java.io.File

/** Shares a generated CSV via ACTION_SEND — used by the Export section embedded in SettingsScreen. */
fun shareCsv(context: Context, csv: String) {
    val file = File(context.cacheDir, "contempo_export.csv").apply { writeText(csv) }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/csv"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, context.getString(R.string.export_share_button)))
}
