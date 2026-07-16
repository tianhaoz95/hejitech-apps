package com.hejitech.contempo.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri

/**
 * Camera photos can be several thousand pixels per side — decoding one at
 * full resolution just to hand it to the on-device model's vision input or a Confirm-screen
 * thumbnail wastes memory and time for no visual benefit at those sizes.
 * The original full-resolution file (already on disk from the camera
 * intent) is what actually gets uploaded to Storage as evidence — this
 * downsampled copy is only ever used in-memory.
 */
object PhotoUtils {
    fun decodeSampledBitmap(context: Context, uri: Uri, maxDimension: Int): Bitmap? {
        // inJustDecodeBounds=true always returns null from decodeStream —
        // that's how it reports dimensions (via the Options out-params) — so
        // null here does NOT mean "couldn't open the stream." Only a null
        // stream itself means that.
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        val boundsStream = context.contentResolver.openInputStream(uri) ?: return null
        boundsStream.use { BitmapFactory.decodeStream(it, null, bounds) }

        var sampleSize = 1
        while (bounds.outWidth / sampleSize > maxDimension || bounds.outHeight / sampleSize > maxDimension) {
            sampleSize *= 2
        }

        val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        val decodeStream = context.contentResolver.openInputStream(uri) ?: return null
        return decodeStream.use { BitmapFactory.decodeStream(it, null, decodeOptions) }
    }
}
