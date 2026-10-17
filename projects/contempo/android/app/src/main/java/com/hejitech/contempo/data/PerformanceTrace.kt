package com.hejitech.contempo.data

import android.util.Log

/**
 * Timing around the app's slow operations (on-device transcription/parsing, the entry save).
 * Firebase Performance is gone with the move off Firebase; this logs the duration and attributes
 * to logcat (tag ContempoTrace) with the same call-site API, so a real tracer can slot back in.
 */
class Trace internal constructor(private val name: String) {
    private val attributes = linkedMapOf<String, String>()
    fun putAttribute(key: String, value: String) {
        attributes[key] = value
    }
    internal fun finish(startNanos: Long) {
        Log.d("ContempoTrace", "$name ${(System.nanoTime() - startNanos) / 1_000_000}ms $attributes")
    }
}

suspend fun <T> traced(name: String, attributes: Map<String, String> = emptyMap(), block: suspend Trace.() -> T): T {
    val trace = Trace(name)
    attributes.forEach { (key, value) -> trace.putAttribute(key, value) }
    val start = System.nanoTime()
    try {
        return trace.block()
    } finally {
        trace.finish(start)
    }
}
