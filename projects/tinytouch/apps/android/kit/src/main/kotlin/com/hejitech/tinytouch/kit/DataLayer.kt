package com.hejitech.tinytouch.kit

import android.content.Context
import android.net.Uri
import android.util.Log
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.tasks.await

/**
 * Phone <-> watch over the Wearable Data Layer, the Android counterpart of WatchConnectivity.
 *
 * Each side keeps one data item: the phone `/tinytouch/settings` (what WCSession's application
 * context and user-info queue carry on iPhone), the watch `/tinytouch/status` (live telemetry and
 * the watch's own settings). Play services deliver an item whenever the devices meet, and it
 * stays readable afterwards, so the receiver also reads it at launch; the change stamp
 * ([com.hejitech.tinytouch.core.SettingsSync]) keeps those re-reads harmless. Both apps must share
 * the application id and signing key for the Data Layer to connect them.
 */
object DataLayer {
    const val SETTINGS_PATH = "/tinytouch/settings"
    const val STATUS_PATH = "/tinytouch/status"
    /** Declared in each app's res/values/wear.xml. */
    const val WATCH_CAPABILITY = "tinytouch_watch"
    const val PHONE_CAPABILITY = "tinytouch_phone"

    private const val TAG = "TinyTouchSync"

    suspend fun put(context: Context, path: String, values: Map<String, Any>): Boolean = try {
        val req = PutDataMapRequest.create(path)
        values.forEach { (k, v) -> req.dataMap.putAny(k, v) }
        Wearable.getDataClient(context).putDataItem(req.asPutDataRequest().setUrgent()).await()
        true
    } catch (e: Exception) {
        Log.w(TAG, "put $path failed", e)
        false
    }

    /** Every item at [path] on any connected node (normally one). */
    suspend fun read(context: Context, path: String): List<Map<String, Any?>> = try {
        val uri = Uri.Builder().scheme(PutDataRequest.WEAR_URI_SCHEME).path(path).build()
        val buffer = Wearable.getDataClient(context).getDataItems(uri).await()
        try {
            buffer.map { DataMapItem.fromDataItem(it).dataMap.toMap() }
        } finally {
            buffer.release()
        }
    } catch (e: Exception) {
        Log.w(TAG, "read $path failed", e)
        emptyList()
    }

    /** Calls [onChange] (on the main thread) whenever the item at [path] changes. Remove with [stopListening]. */
    fun listen(context: Context, path: String, onChange: (Map<String, Any?>) -> Unit): DataClient.OnDataChangedListener {
        val listener = DataClient.OnDataChangedListener { events ->
            events.forEach { event ->
                if (event.type == DataEvent.TYPE_CHANGED && event.dataItem.uri.path == path) {
                    onChange(DataMapItem.fromDataItem(event.dataItem).dataMap.toMap())
                }
            }
        }
        runCatching { Wearable.getDataClient(context).addListener(listener) }
            .onFailure { Log.w(TAG, "listen $path failed", it) }
        return listener
    }

    fun stopListening(context: Context, listener: DataClient.OnDataChangedListener) {
        runCatching { Wearable.getDataClient(context).removeListener(listener) }
    }

    /** Nearby devices that have the other TinyTouch app installed. */
    suspend fun reachableNodeCount(context: Context, capability: String): Int = try {
        Wearable.getCapabilityClient(context)
            .getCapability(capability, CapabilityClient.FILTER_REACHABLE).await().nodes.size
    } catch (e: Exception) {
        0
    }

    private fun DataMap.putAny(key: String, value: Any) {
        when (value) {
            is String -> putString(key, value)
            is Int -> putInt(key, value)
            is Long -> putLong(key, value)
            is Double -> putDouble(key, value)
            is Float -> putFloat(key, value)
            is Boolean -> putBoolean(key, value)
            else -> putString(key, value.toString())
        }
    }

    private fun DataMap.toMap(): Map<String, Any?> = keySet().associateWith { get<Any>(it) }
}
