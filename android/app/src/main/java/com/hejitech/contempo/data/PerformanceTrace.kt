package com.hejitech.contempo.data

import com.google.firebase.Firebase
import com.google.firebase.perf.metrics.Trace
import com.google.firebase.perf.performance

/**
 * Firebase Performance Monitoring's automatic instrumentation (screen
 * render/network) doesn't cover this app's actual slow paths — on-device
 * Whisper transcription, on-device/cloud LLM parsing, and the Firestore
 * entry save that already has a known timeout issue (see ConfirmViewModel's
 * SAVE_TIMEOUT_MS/resetFirestoreConnection). This wraps [block] in a named
 * custom trace instead, so those three show up as real, queryable traces in
 * the Performance console.
 *
 * [block] runs as an extension on [Trace] (not just a plain lambda) so it can
 * call `putAttribute`/`incrementMetric` itself based on how things actually
 * turn out — e.g. which inference path ended up succeeding, not just which
 * one was attempted — rather than only supporting attributes known upfront.
 * [attributes] covers the common case of "known before the work starts" (a
 * capture's language, an inference preference) without every call site
 * needing its own `trace.putAttribute` boilerplate for that part.
 *
 * Trace collection itself is off for USE_FIREBASE_EMULATOR builds (see
 * ContempoApp.kt), so this is a no-op cost in local dev.
 */
suspend fun <T> traced(name: String, attributes: Map<String, String> = emptyMap(), block: suspend Trace.() -> T): T {
    val trace = Firebase.performance.newTrace(name)
    trace.start()
    attributes.forEach { (key, value) -> trace.putAttribute(key, value) }
    try {
        return trace.block()
    } finally {
        trace.stop()
    }
}
