package com.hejitech.weehours

import android.content.Context
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.hejitech.weehours.core.Household
import com.hejitech.weehours.core.LogCoding
import com.hejitech.weehours.core.LogEvent
import com.hejitech.weehours.core.LogService
import com.hejitech.weehours.core.Session
import com.hejitech.weehours.core.StatusSnapshot
import com.hejitech.weehours.core.Surface
import com.hejitech.weehours.core.uuidString
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
data class WatchContextPayload(
    val householdJson: String,
    val selectedBabyId: String,
    val statusByBaby: Map<String, StatusSnapshot>,
    val statusLinesByBaby: Map<String, String>,
    val openByBaby: Map<String, WatchOpenSessionInfo>,
    val pinnedCategories: List<String>,
    val compassSlots: Map<String, CompassSlot>,
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

object WearBridge {
    const val PATH_CONTEXT = "/weehours/context"
    const val PATH_ACTION = "/weehours/action"
    const val PATH_ACK = "/weehours/ack"
    private const val KEY_PAYLOAD = "payload_json"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile
    var onExternalActionApplied: (() -> Unit)? = null

    fun pushContext(
        context: Context,
        service: LogService,
        selectedBabyId: UUID,
        pinnedCategories: List<String>,
        compassSlots: Map<String, CompassSlot>,
        lastEvent: LogEvent? = null
    ) {
        val now = Date()
        val household = service.household
        val statusMap = mutableMapOf<String, StatusSnapshot>()
        val linesMap = mutableMapOf<String, String>()
        val openMap = mutableMapOf<String, WatchOpenSessionInfo>()

        for (baby in household.active) {
            val bid = baby.id.uuidString()
            val derived = service.derived(baby = baby.id)
            val snap = StatusSnapshot(derived, now = now)
            statusMap[bid] = snap
            linesMap[bid] = snap.line(now = now, expecting = baby.isExpected)

            val openFeed = derived.openFeedSession()
            val openSleep = derived.openSession(Session.Kind.SLEEP)
            val openTimed = service.openTimedActivities(baby = baby.id)
                .mapValues { entry -> entry.value.occurredAt.time }

            openMap[bid] = WatchOpenSessionInfo(
                babyId = bid,
                feedKind = openFeed?.kind?.rawValue,
                feedSinceMs = openFeed?.start?.time,
                nursingSide = openFeed?.sides?.lastOrNull(),
                sleepSinceMs = openSleep?.start?.time,
                timedActivities = openTimed
            )
        }

        val payload = WatchContextPayload(
            householdJson = LogCoding.json.encodeToString(Household.serializer(), household),
            selectedBabyId = selectedBabyId.uuidString(),
            statusByBaby = statusMap,
            statusLinesByBaby = linesMap,
            openByBaby = openMap,
            pinnedCategories = pinnedCategories,
            compassSlots = compassSlots,
            lastEventId = lastEvent?.id?.uuidString(),
            lastEventSummary = lastEvent?.let { service.describe(it) },
            updatedAtMs = System.currentTimeMillis()
        )

        val json = LogCoding.json.encodeToString(WatchContextPayload.serializer(), payload)
        scope.launch {
            try {
                val dataClient: DataClient = Wearable.getDataClient(context.applicationContext)
                val req = PutDataMapRequest.create(PATH_CONTEXT).apply {
                    dataMap.putString(KEY_PAYLOAD, json)
                    dataMap.putLong("ts", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()
                dataClient.putDataItem(req).await()
            } catch (_: Exception) {
            }
        }
    }

    suspend fun handleWatchAction(
        context: Context,
        msg: WatchActionMessage,
        serviceOverride: LogService? = null
    ): LogEvent? {
        val opened = if (serviceOverride == null) CoreBridge.openStoreAndService(context) else null
        val ownedStore = opened?.first
        val service = serviceOverride ?: opened!!.second

        try {
            val targetBaby: UUID = msg.babyId?.let {
                try { UUID.fromString(it) } catch (_: Exception) { null }
            } ?: service.household.babyId
            val at = Date(msg.occurredAtMs)
            var created: LogEvent? = null

            when (msg.kind) {
                "tap" -> {
                    created = when (msg.action) {
                        "feed.toggle" -> service.toggleFeed(baby = targetBaby, surface = Surface.WATCH, now = at)
                        "feed.breast.left" -> service.startNursing(side = "left", baby = targetBaby, surface = Surface.WATCH, at = at)
                        "feed.breast.right" -> service.startNursing(side = "right", baby = targetBaby, surface = Surface.WATCH, at = at)
                        "feed.breast.switch" -> service.switchNursingSide(baby = targetBaby, surface = Surface.WATCH, at = at)
                        "diaper.wet" -> service.logDiaper(kind = "wet", baby = targetBaby, surface = Surface.WATCH, at = at, needsDetails = msg.needsDetails)
                        "diaper.dirty" -> service.logDiaper(kind = "dirty", baby = targetBaby, surface = Surface.WATCH, at = at, needsDetails = msg.needsDetails)
                        "diaper.both" -> service.logDiaper(kind = "both", baby = targetBaby, surface = Surface.WATCH, at = at, needsDetails = msg.needsDetails)
                        "sleep.toggle" -> service.toggleSleep(baby = targetBaby, surface = Surface.WATCH, now = at)
                        "movement.kick" -> service.logMovement(baby = targetBaby, surface = Surface.WATCH, at = at)
                        else -> null
                    }
                }
                "bottle" -> {
                    val fraction = msg.fraction ?: 1.0
                    created = service.finishBottle(
                        consumedFraction = fraction,
                        baby = targetBaby,
                        surface = Surface.WATCH,
                        at = at
                    )
                }
                "care" -> {
                    val cat = msg.category ?: msg.action
                    created = if (CoreBridge.isTimedActivity(cat)) {
                        service.startTimedActivity(category = cat, baby = targetBaby, surface = Surface.WATCH, at = at)
                    } else {
                        service.logCare(category = cat, baby = targetBaby, surface = Surface.WATCH, at = at)
                    }
                }
                "stop_timed" -> {
                    val cat = msg.category ?: msg.action
                    created = service.stopTimedActivity(category = cat, baby = targetBaby, surface = Surface.WATCH, at = at)
                }
                "undo" -> {
                    val targetId = msg.action.takeIf { it.isNotEmpty() }?.let {
                        try { UUID.fromString(it) } catch (_: Exception) { null }
                    } ?: service.derived(baby = targetBaby).counted.lastOrNull()?.id
                    if (targetId != null) {
                        created = service.undo(id = targetId, surface = Surface.WATCH)
                    }
                }
                "voice" -> {
                    val text = msg.transcript?.trim().orEmpty()
                    if (text.isNotEmpty()) {
                        val res = service.processVoice(
                            transcript = text,
                            surface = Surface.WATCH,
                            capturedAt = at,
                            babies = listOf(targetBaby),
                            quickCapture = true
                        )
                        created = res.events.firstOrNull()
                    }
                }
            }

            val prefs = context.getSharedPreferences("weehours_prefs", Context.MODE_PRIVATE)
            val pinnedRaw = prefs.getString("watch_pinned", "bath,tummy_time,medicine,temperature") ?: ""
            val pinned = pinnedRaw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
            val slotsRaw = prefs.getString("watch_compass", null)
            val slots = CompassSlot.decodeOverrides(slotsRaw)

            pushContext(
                context = context,
                service = service,
                selectedBabyId = targetBaby,
                pinnedCategories = pinned,
                compassSlots = slots,
                lastEvent = created
            )
            Widgets.refreshAll(context)
            ReminderScheduler(context).syncNotifications(service)
            onExternalActionApplied?.invoke()
            return created
        } finally {
            ownedStore?.close()
        }
    }
}

class WearBridgeService : WearableListenerService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(messageEvent: MessageEvent) {
        super.onMessageReceived(messageEvent)
        if (messageEvent.path == WearBridge.PATH_ACTION) {
            val raw = String(messageEvent.data, Charsets.UTF_8)
            val actionMsg = try {
                LogCoding.json.decodeFromString(WatchActionMessage.serializer(), raw)
            } catch (_: Exception) {
                return
            }
            scope.launch {
                WearBridge.handleWatchAction(applicationContext, actionMsg)
                try {
                    Wearable.getMessageClient(applicationContext)
                        .sendMessage(messageEvent.sourceNodeId, WearBridge.PATH_ACK, actionMsg.id.toByteArray(Charsets.UTF_8))
                        .await()
                } catch (_: Exception) {
                }
            }
        }
    }
}
