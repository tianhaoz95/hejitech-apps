package com.hejitech.fitloop.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * What the phone and the Wear OS watch say to each other over the Wearable Data Layer (messages),
 * the Android side of the iPhone app's WatchMessage:
 *
 *   phone → watch  /fitloop/workout   the open workout and where it is (an empty ref: it ended)
 *   watch → phone  /fitloop/hr        heart rate, every few seconds while a workout is open
 *                  /fitloop/set-done  Set done on the wrist
 *                  /fitloop/hello     the watch app opened: send the workout again
 */
object WearProtocol {
    const val PATH_WORKOUT = "/fitloop/workout"
    const val PATH_HR = "/fitloop/hr"
    const val PATH_SET_DONE = "/fitloop/set-done"
    const val PATH_HELLO = "/fitloop/hello"

    /** The intent the phone opens on the watch (RemoteActivityHelper) when a workout starts. */
    const val OPEN_URI = "fitloop-watch://workout"

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    fun encode(w: WatchWorkout): ByteArray = json.encodeToString(WatchWorkout.serializer(), w).toByteArray()
    fun decode(bytes: ByteArray): WatchWorkout? = runCatching { json.decodeFromString(WatchWorkout.serializer(), bytes.decodeToString()) }.getOrNull()
    fun hr(bpm: Int): ByteArray = bpm.toString().toByteArray()
    fun hrOf(bytes: ByteArray): Int? = bytes.decodeToString().toIntOrNull()
}

@Serializable
data class WatchWorkout(
    /** The workout's ref; empty when no workout is open. */
    val ref: String = "",
    val title: String = "",
    val exercise: String = "",
    val setLine: String = "",
    /** The rest timer's end, epoch milliseconds (0: not resting). */
    val restUntil: Long = 0,
    val setsDone: Int = 0,
    val setsTotal: Int = 0,
) {
    val open: Boolean get() = ref.isNotEmpty()
}
