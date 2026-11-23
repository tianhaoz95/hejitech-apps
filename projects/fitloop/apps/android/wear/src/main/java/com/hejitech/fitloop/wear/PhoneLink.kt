package com.hejitech.fitloop.wear

import android.content.Context
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.hejitech.fitloop.core.WatchWorkout
import com.hejitech.fitloop.core.WearProtocol
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.tasks.await

/** The workout the phone has open, as the watch knows it. */
object WatchState {
    private val _workout = MutableStateFlow(WatchWorkout())
    val workout: StateFlow<WatchWorkout> = _workout
    fun update(w: WatchWorkout) { _workout.value = w }
}

/** Messages from the phone (the open workout), delivered even when the watch app isn't open. */
class PhoneListener : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path == WearProtocol.PATH_WORKOUT) WearProtocol.decode(event.data)?.let(WatchState::update)
    }
}

/** Watch → phone: heart rate, Set done, and "I'm open, send the workout". */
class PhoneLink(context: Context) {
    private val messages = Wearable.getMessageClient(context)
    private val nodes = Wearable.getNodeClient(context)

    private suspend fun send(path: String, data: ByteArray = ByteArray(0)) {
        runCatching { for (n in nodes.connectedNodes.await()) messages.sendMessage(n.id, path, data).await() }
    }

    suspend fun hello() = send(WearProtocol.PATH_HELLO)
    suspend fun heartRate(bpm: Int) = send(WearProtocol.PATH_HR, WearProtocol.hr(bpm))
    suspend fun setDone() = send(WearProtocol.PATH_SET_DONE)
}
