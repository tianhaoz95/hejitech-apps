package com.hejitech.weehours.wear

import android.content.ComponentName
import android.content.Context
import androidx.wear.tiles.TileService
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.hejitech.weehours.core.Baby
import com.hejitech.weehours.core.Household
import com.hejitech.weehours.core.LogCoding
import com.hejitech.weehours.core.StatusSnapshot
import com.hejitech.weehours.core.TiltCompass
import com.hejitech.weehours.core.uuidString
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.Serializable
import java.util.Date
import java.util.UUID

@Serializable
data class WatchOpenSessionInfo(
    val babyId: String,
    val feedKind: String? = null,
    val feedSinceMs: Long? = null,
    val nursingSide: String? = null,
    val sleepSinceMs: Long? = null,
    val timedActivities: Map<String, Long> = emptyMap()
)

@Serializable
data class WatchSlotPayload(
    val direction: String,
    val action: String,
    val type: String = "",
    val label: String,
    val icon: String
)

@Serializable
data class WatchContextPayload(
    val householdJson: String,
    val selectedBabyId: String,
    val statusByBaby: Map<String, StatusSnapshot> = emptyMap(),
    val statusLinesByBaby: Map<String, String> = emptyMap(),
    val openByBaby: Map<String, WatchOpenSessionInfo> = emptyMap(),
    val pinnedCategories: List<String> = listOf("bath", "tummy_time", "medicine", "temperature"),
    val compassSlots: Map<String, WatchSlotPayload> = emptyMap(),
    val lastEventId: String? = null,
    val lastEventSummary: String? = null,
    val updatedAtMs: Long = System.currentTimeMillis()
)

@Serializable
data class WatchActionMessage(
    val id: String = UUID.randomUUID().uuidString(),
    val kind: String,
    val action: String = "",
    val babyId: String? = null,
    val fraction: Double? = null,
    val category: String? = null,
    val transcript: String? = null,
    val needsDetails: Boolean = false,
    val occurredAtMs: Long = System.currentTimeMillis()
)

class PhoneLink(private val context: Context) {
    companion object {
        const val PATH_CONTEXT = "/weehours/context"
        const val PATH_ACTION = "/weehours/action"
        const val PATH_ACK = "/weehours/ack"
        private const val PREFS_NAME = "weehours_wear_prefs"
        private const val KEY_CACHED_CONTEXT = "cached_context_json"
        private const val KEY_PENDING_QUEUE = "pending_actions_json"

        @Volatile
        private var instance: PhoneLink? = null

        fun getInstance(context: Context): PhoneLink {
            return instance ?: synchronized(this) {
                instance ?: PhoneLink(context.applicationContext).also { instance = it }
            }
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _household = MutableStateFlow(Household())
    val household: StateFlow<Household> = _household.asStateFlow()

    private val _selectedBabyId = MutableStateFlow(_household.value.babyId)
    val selectedBabyId: StateFlow<UUID> = _selectedBabyId.asStateFlow()

    private val _statusLines = MutableStateFlow<Map<String, String>>(emptyMap())
    val statusLines: StateFlow<Map<String, String>> = _statusLines.asStateFlow()

    private val _openSessions = MutableStateFlow<Map<String, WatchOpenSessionInfo>>(emptyMap())
    val openSessions: StateFlow<Map<String, WatchOpenSessionInfo>> = _openSessions.asStateFlow()

    private val _pinnedCategories = MutableStateFlow(listOf("bath", "tummy_time", "medicine", "temperature"))
    val pinnedCategories: StateFlow<List<String>> = _pinnedCategories.asStateFlow()

    private val _compassSlots = MutableStateFlow<Map<TiltCompass.Direction, TiltCompass.Slot>>(defaultCompassSlots())
    val compassSlots: StateFlow<Map<TiltCompass.Direction, TiltCompass.Slot>> = _compassSlots.asStateFlow()

    private val _lastSummary = MutableStateFlow<String?>(null)
    val lastSummary: StateFlow<String?> = _lastSummary.asStateFlow()

    private val _pendingCount = MutableStateFlow(0)
    val pendingCount: StateFlow<Int> = _pendingCount.asStateFlow()

    init {
        prefs.getString(KEY_CACHED_CONTEXT, null)?.let { applyContextJson(it, notifySurfaces = false) }
        _pendingCount.value = loadQueue().size
        pullLatestFromDataLayer()
    }

    val activeBabies: List<Baby>
        get() = _household.value.active

    val currentBaby: Baby
        get() = activeBabies.firstOrNull { it.id == _selectedBabyId.value } ?: _household.value.firstBaby

    fun currentStatusLine(): String {
        val bid = currentBaby.id.uuidString()
        return _statusLines.value[bid] ?: if (currentBaby.isExpected) "No movements yet" else "No feeds yet"
    }

    fun currentOpenInfo(): WatchOpenSessionInfo? {
        return _openSessions.value[currentBaby.id.uuidString()]
    }

    fun cycleSelectedBaby() {
        val list = activeBabies
        if (list.size <= 1) return
        val idx = list.indexOfFirst { it.id == _selectedBabyId.value }
        val next = list[(idx + 1) % list.size]
        _selectedBabyId.value = next.id
    }

    fun applyContextJson(json: String, notifySurfaces: Boolean = true) {
        try {
            val payload = LogCoding.json.decodeFromString(WatchContextPayload.serializer(), json)
            prefs.edit().putString(KEY_CACHED_CONTEXT, json).apply()

            val h = LogCoding.json.decodeFromString(Household.serializer(), payload.householdJson)
            _household.value = h
            try {
                _selectedBabyId.value = UUID.fromString(payload.selectedBabyId)
            } catch (_: Exception) {
                _selectedBabyId.value = h.babyId
            }
            _statusLines.value = payload.statusLinesByBaby
            _openSessions.value = payload.openByBaby
            if (payload.pinnedCategories.isNotEmpty()) {
                _pinnedCategories.value = payload.pinnedCategories
            }
            if (payload.compassSlots.isNotEmpty()) {
                val mapped = defaultCompassSlots().toMutableMap()
                for ((k, v) in payload.compassSlots) {
                    val dir = TiltCompass.Direction.fromRaw(k) ?: continue
                    mapped[dir] = TiltCompass.Slot(
                        direction = dir,
                        action = v.action,
                        type = v.type.ifEmpty { v.action },
                        label = v.label,
                        icon = v.icon
                    )
                }
                _compassSlots.value = mapped
            }
            if (payload.lastEventSummary != null) {
                _lastSummary.value = payload.lastEventSummary
            }
            if (notifySurfaces) {
                refreshWatchSurfaces()
            }
        } catch (_: Exception) {
        }
    }

    fun sendAction(
        kind: String,
        action: String = "",
        fraction: Double? = null,
        category: String? = null,
        transcript: String? = null,
        needsDetails: Boolean = false
    ) {
        val msg = WatchActionMessage(
            kind = kind,
            action = action,
            babyId = currentBaby.id.uuidString(),
            fraction = fraction,
            category = category,
            transcript = transcript,
            needsDetails = needsDetails,
            occurredAtMs = System.currentTimeMillis()
        )
        applyOptimisticUpdate(msg)
        enqueueAndFlush(msg)
    }

    private fun applyOptimisticUpdate(msg: WatchActionMessage) {
        val bid = currentBaby.id.uuidString()
        val lines = _statusLines.value.toMutableMap()
        val openMap = _openSessions.value.toMutableMap()
        val curOpen = openMap[bid] ?: WatchOpenSessionInfo(babyId = bid)

        when (msg.kind) {
            "tap" -> when (msg.action) {
                "feed.toggle" -> {
                    if (curOpen.feedSinceMs != null) {
                        openMap[bid] = curOpen.copy(feedKind = null, feedSinceMs = null, nursingSide = null)
                        lines[bid] = "Fed just now"
                        _lastSummary.value = "Finished feed"
                    } else {
                        val defaultKind = _household.value.defaultFeed(currentBaby.id)
                        openMap[bid] = curOpen.copy(feedKind = defaultKind, feedSinceMs = msg.occurredAtMs)
                        lines[bid] = "Feeding 0m"
                        _lastSummary.value = "Started feed"
                    }
                }
                "feed.breast.left", "feed.breast.right" -> {
                    val side = if (msg.action.endsWith("left")) "left" else "right"
                    openMap[bid] = curOpen.copy(feedKind = "breast", feedSinceMs = msg.occurredAtMs, nursingSide = side)
                    lines[bid] = "Feeding 0m ($side)"
                    _lastSummary.value = "Nursing ($side)"
                }
                "feed.breast.switch" -> {
                    val nextSide = if (curOpen.nursingSide == "left") "right" else "left"
                    openMap[bid] = curOpen.copy(nursingSide = nextSide)
                    lines[bid] = "Feeding (${nextSide})"
                    _lastSummary.value = "Switched to $nextSide"
                }
                "diaper.wet", "diaper.dirty", "diaper.both" -> {
                    val kind = msg.action.removePrefix("diaper.")
                    lines[bid] = "Diaper ($kind) just now"
                    _lastSummary.value = "Diaper ($kind)"
                }
                "sleep.toggle" -> {
                    if (curOpen.sleepSinceMs != null) {
                        openMap[bid] = curOpen.copy(sleepSinceMs = null)
                        lines[bid] = "Woke up just now"
                        _lastSummary.value = "Woke up"
                    } else {
                        openMap[bid] = curOpen.copy(sleepSinceMs = msg.occurredAtMs)
                        lines[bid] = "Sleeping 0m"
                        _lastSummary.value = "Fell asleep"
                    }
                }
                "movement.kick" -> {
                    lines[bid] = "Moved just now"
                    _lastSummary.value = "Felt movement"
                }
            }
            "bottle" -> {
                openMap[bid] = curOpen.copy(feedKind = null, feedSinceMs = null)
                lines[bid] = "Fed bottle just now"
                _lastSummary.value = "Finished bottle"
            }
            "care" -> {
                val cat = msg.category ?: msg.action
                _lastSummary.value = "Logged ${cat.replace('_', ' ')}"
            }
            "stop_timed" -> {
                val cat = msg.category ?: msg.action
                val updatedTimed = curOpen.timedActivities.toMutableMap().apply { remove(cat) }
                openMap[bid] = curOpen.copy(timedActivities = updatedTimed)
                _lastSummary.value = "Finished ${cat.replace('_', ' ')}"
            }
            "undo" -> {
                _lastSummary.value = "Undid last entry"
            }
            "voice" -> {
                _lastSummary.value = "\"${msg.transcript ?: ""}\""
            }
        }
        _openSessions.value = openMap
        _statusLines.value = lines
        refreshWatchSurfaces()
    }

    private fun enqueueAndFlush(msg: WatchActionMessage) {
        val queue = loadQueue().toMutableList()
        queue.add(msg)
        saveQueue(queue)
        flushQueue()
    }

    fun flushQueue() {
        scope.launch {
            val queue = loadQueue().toMutableList()
            if (queue.isEmpty()) return@launch
            try {
                val nodes = Wearable.getNodeClient(context).connectedNodes.await()
                if (nodes.isEmpty()) return@launch
                val msgClient = Wearable.getMessageClient(context)
                val deliveredIds = mutableSetOf<String>()
                for (item in queue) {
                    val bytes = LogCoding.json.encodeToString(WatchActionMessage.serializer(), item).toByteArray(Charsets.UTF_8)
                    for (node in nodes) {
                        msgClient.sendMessage(node.id, PATH_ACTION, bytes).await()
                    }
                    deliveredIds.add(item.id)
                }
                val remaining = queue.filterNot { it.id in deliveredIds }
                saveQueue(remaining)
            } catch (_: Exception) {
            }
        }
    }

    fun acknowledgeAction(id: String) {
        val remaining = loadQueue().filterNot { it.id == id }
        saveQueue(remaining)
    }

    private fun loadQueue(): List<WatchActionMessage> {
        val raw = prefs.getString(KEY_PENDING_QUEUE, null) ?: return emptyList()
        return try {
            LogCoding.json.decodeFromString(
                kotlinx.serialization.builtins.ListSerializer(WatchActionMessage.serializer()),
                raw
            )
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveQueue(list: List<WatchActionMessage>) {
        val raw = LogCoding.json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(WatchActionMessage.serializer()),
            list
        )
        prefs.edit().putString(KEY_PENDING_QUEUE, raw).apply()
        _pendingCount.value = list.size
    }

    private fun pullLatestFromDataLayer() {
        scope.launch {
            try {
                val buffer = Wearable.getDataClient(context).dataItems.await()
                buffer.use { items ->
                    for (item in items) {
                        if (item.uri.path == PATH_CONTEXT) {
                            val dataMap = DataMapItem.fromDataItem(item).dataMap
                            dataMap.getString("payload_json")?.let { applyContextJson(it) }
                        }
                    }
                }
            } catch (_: Exception) {
            }
        }
    }

    private fun refreshWatchSurfaces() {
        try {
            TileService.getUpdater(context).requestUpdate(WeeHoursTileService::class.java)
        } catch (_: Exception) {
        }
        try {
            ComplicationDataSourceUpdateRequester.create(
                context,
                ComponentName(context, SpeakComplicationService::class.java)
            ).requestUpdateAll()
            ComplicationDataSourceUpdateRequester.create(
                context,
                ComponentName(context, TiltComplicationService::class.java)
            ).requestUpdateAll()
        } catch (_: Exception) {
        }
    }

    private fun defaultCompassSlots(): Map<TiltCompass.Direction, TiltCompass.Slot> = mapOf(
        TiltCompass.Direction.NORTH to TiltCompass.Slot(
            direction = TiltCompass.Direction.NORTH,
            action = "feed",
            type = "feed",
            label = "Feed",
            icon = "feed"
        ),
        TiltCompass.Direction.EAST to TiltCompass.Slot(
            direction = TiltCompass.Direction.EAST,
            action = "diaper",
            type = "diaper",
            label = "Diaper",
            icon = "diaper"
        ),
        TiltCompass.Direction.SOUTH to TiltCompass.Slot(
            direction = TiltCompass.Direction.SOUTH,
            action = "sleep",
            type = "sleep",
            label = "Sleep",
            icon = "sleep"
        ),
        TiltCompass.Direction.WEST to TiltCompass.Slot(
            direction = TiltCompass.Direction.WEST,
            action = "vitamin_d",
            type = "vitamin_d",
            label = "Vitamin D",
            icon = "vitamin_d"
        )
    )
}

class PhoneLinkService : WearableListenerService() {
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        super.onDataChanged(dataEvents)
        val link = PhoneLink.getInstance(applicationContext)
        for (event in dataEvents) {
            if (event.type == DataEvent.TYPE_CHANGED && event.dataItem.uri.path == PhoneLink.PATH_CONTEXT) {
                val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                dataMap.getString("payload_json")?.let { link.applyContextJson(it) }
            }
        }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        super.onMessageReceived(messageEvent)
        if (messageEvent.path == PhoneLink.PATH_ACK) {
            val id = String(messageEvent.data, Charsets.UTF_8)
            PhoneLink.getInstance(applicationContext).acknowledgeAction(id)
        }
    }
}
