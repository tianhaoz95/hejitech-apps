package com.hejitech.weehours

import android.content.Context
import com.hejitech.weehours.core.Capture
import com.hejitech.weehours.core.DerivedLog
import com.hejitech.weehours.core.EventRegistry
import com.hejitech.weehours.core.EventStatus
import com.hejitech.weehours.core.FieldValue
import com.hejitech.weehours.core.Household
import com.hejitech.weehours.core.InputKind
import com.hejitech.weehours.core.KeywordDecisionModel
import com.hejitech.weehours.core.LogCoding
import com.hejitech.weehours.core.LogEvent
import com.hejitech.weehours.core.LogService
import com.hejitech.weehours.core.Provenance
import com.hejitech.weehours.core.SQLiteLogStore
import com.hejitech.weehours.core.StatusSnapshot
import com.hejitech.weehours.core.SupabaseClient
import com.hejitech.weehours.core.Surface
import com.hejitech.weehours.core.SystemType
import com.hejitech.weehours.core.TiltCompass
import com.hejitech.weehours.core.VoiceInterpreter
import com.hejitech.weehours.core.uuidString
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer
import java.io.File
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.pow
import kotlin.math.roundToInt

@Serializable
data class CompassSlot(
    val direction: String,
    val action: String,
    val type: String = action,
    val label: String,
    val icon: String = action
) {
    companion object {
        fun defaults(): Map<String, CompassSlot> = mapOf(
            TiltCompass.Direction.NORTH.rawValue to CompassSlot("north", "feed", "feed", "Feed", "feed"),
            TiltCompass.Direction.EAST.rawValue to CompassSlot("east", "diaper", "diaper", "Diaper", "diaper"),
            TiltCompass.Direction.SOUTH.rawValue to CompassSlot("south", "sleep", "sleep", "Sleep", "sleep"),
            TiltCompass.Direction.WEST.rawValue to CompassSlot("west", "vitamin_d", "vitamin_d", "Vitamin D", "vitamin_d")
        )

        fun encodeOverrides(map: Map<String, CompassSlot>): String =
            LogCoding.json.encodeToString(MapSerializer(String.serializer(), serializer()), map)

        fun decodeOverrides(raw: String?): Map<String, CompassSlot> {
            if (raw.isNullOrBlank()) return defaults()
            return try {
                val decoded = LogCoding.json.decodeFromString(MapSerializer(String.serializer(), serializer()), raw)
                defaults() + decoded
            } catch (_: Exception) {
                defaults()
            }
        }
    }
}

object CoreBridge {
    val timedCategories = setOf("tummy_time", "skin_to_skin", "crying", "bath", "contraction")

    fun isTimedActivity(category: String): Boolean = category in timedCategories

    fun openStoreAndService(
        context: Context,
        backend: SupabaseClient? = null
    ): Pair<SQLiteLogStore, LogService> {
        val dbFile = File(context.filesDir, "weehours.sqlite")
        val store = SQLiteLogStore(context.applicationContext, dbFile)
        val household = store.value("household")?.let {
            try { LogCoding.json.decodeFromString(Household.serializer(), it) } catch (_: Exception) { null }
        } ?: Household()
        val me = store.value("me")?.let {
            try { UUID.fromString(it) } catch (_: Exception) { null }
        } ?: UUID.randomUUID().also { store.setValue(it.uuidString(), "me") }

        val service = LogService(
            store = store,
            household = household,
            me = me,
            interpreter = VoiceInterpreter(model = KeywordDecisionModel()),
            backend = backend
        )
        return store to service
    }
}

val SupabaseClient.isAuthenticated: Boolean
    get() = session != null

val SupabaseClient.currentUserId: UUID?
    get() = session?.userId

val LogService.caregiverId: UUID
    get() = me

fun LogService.reloadHousehold() {
    val raw = store.value("household") ?: return
    try {
        val h = LogCoding.json.decodeFromString(Household.serializer(), raw)
        setHousehold(h)
    } catch (_: Exception) {
    }
}

fun LogService.persistHousehold(h: Household) {
    setHousehold(h)
    store.setValue(LogCoding.json.encodeToString(Household.serializer(), h), "household")
}

fun LogService.ensureCategoryEnabled(cat: String) {
    if (!household.enabled.contains(cat)) {
        val updated = household.copy(categories = (household.categories + cat).distinct())
        persistHousehold(updated)
    }
}

fun LogService.describe(e: LogEvent): String =
    VoiceInterpreter.label(e.type, e.fields)

fun StatusSnapshot.summaryLine(now: Date, expecting: Boolean = false): String =
    line(now, expecting)

fun LogService.openTimedActivities(baby: UUID? = null): Map<String, LogEvent> {
    val d = derived(baby = baby ?: household.babyId)
    val out = LinkedHashMap<String, LogEvent>()
    for (e in d.effective) {
        if (e.fields["ongoing"] == FieldValue.Bool(true)) {
            out[e.type] = e
        }
    }
    return out
}

fun LogService.quickBottle(
    ml: Double? = null,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    ensureCategoryEnabled("bottle")
    val targetBaby = baby ?: household.babyId
    val amount = ml ?: household.bottleMl(targetBaby)
    return log(
        type = "feed.bottle.single",
        fields = mapOf("consumed_ml" to FieldValue.Num(amount)),
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = targetBaby
    )
}

fun LogService.finishBottle(
    consumedFraction: Double? = null,
    consumedMl: Double? = null,
    contents: String? = null,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    ensureCategoryEnabled("bottle")
    val targetBaby = baby ?: household.babyId
    val open = derived(baby = targetBaby).openFeedSession()
    val fields = mutableMapOf<String, FieldValue>()
    if (consumedFraction != null) fields["consumed_fraction"] = FieldValue.Num(consumedFraction.coerceIn(0.05, 1.0))
    if (consumedMl != null) fields["consumed_ml"] = FieldValue.Num(consumedMl.coerceAtLeast(1.0))
    if (contents != null && contents in setOf("formula", "breast_milk")) {
        fields["contents"] = FieldValue.Str(contents)
    }
    if (fields["consumed_fraction"] == null && fields["consumed_ml"] == null) {
        fields["consumed_ml"] = FieldValue.Num(household.bottleMl(targetBaby))
    }
    val type = if (open != null) "feed.bottle.finish" else "feed.bottle.single"
    return log(
        type = type,
        fields = fields,
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = targetBaby
    )
}

fun LogService.startNursing(
    side: String = "left",
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    ensureCategoryEnabled("breast")
    val targetBaby = baby ?: household.babyId
    return log(
        type = "feed.breast.start",
        fields = mapOf("side" to FieldValue.Str(if (side == "right") "right" else "left")),
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = targetBaby
    )
}

fun LogService.switchNursingSide(
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    ensureCategoryEnabled("breast")
    return switchSide(baby = baby, surface = surface, now = at)
        ?: startNursing(side = "left", baby = baby, surface = surface, at = at)
}

fun LogService.finishNursing(
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    ensureCategoryEnabled("breast")
    val targetBaby = baby ?: household.babyId
    return log(
        type = "feed.breast.finish",
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = targetBaby
    )
}

fun LogService.logSolids(
    foods: List<String>,
    reaction: String? = null,
    amount: String? = null,
    note: String? = null,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    ensureCategoryEnabled("solids")
    val fields = mutableMapOf<String, FieldValue>(
        "food" to FieldValue.Str(foods.joinToString(", "))
    )
    if (amount != null && amount in setOf("taste", "some", "most", "all")) {
        fields["amount"] = FieldValue.Str(amount)
    }
    if (reaction != null && reaction in setOf("none", "rash", "hives", "vomiting", "diarrhea", "gas", "spit_up")) {
        fields["reaction"] = FieldValue.Str(reaction)
    }
    if (!note.isNullOrBlank()) fields["note"] = FieldValue.Str(note.trim())
    return log(
        type = "feed.solids",
        fields = fields,
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = baby ?: household.babyId
    )
}

fun LogService.logDiaper(
    kind: String,
    stoolColor: String? = null,
    rash: Boolean = false,
    blowout: Boolean = false,
    note: String? = null,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date(),
    needsDetails: Boolean = false
): LogEvent {
    ensureCategoryEnabled("diaper")
    val fields = mutableMapOf<String, FieldValue>(
        "kind" to FieldValue.Str(if (kind in setOf("wet", "dirty", "both", "dry")) kind else "wet")
    )
    if (stoolColor != null) fields["stool_color"] = FieldValue.Str(stoolColor)
    if (rash) fields["rash"] = FieldValue.Str("yes")
    if (blowout) fields["blowout"] = FieldValue.Str("yes")
    if (!note.isNullOrBlank()) fields["note"] = FieldValue.Str(note.trim())
    if (needsDetails) fields[LogEvent.NEEDS_DETAILS] = FieldValue.Bool(true)
    return log(
        type = "diaper",
        fields = fields,
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = baby ?: household.babyId
    )
}

fun LogService.logPump(
    leftMl: Double? = null,
    rightMl: Double? = null,
    totalMl: Double? = null,
    durationMinutes: Double? = null,
    storage: String? = null,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    ensureCategoryEnabled("pumping")
    val amt = (totalMl ?: ((leftMl ?: 0.0) + (rightMl ?: 0.0))).coerceAtLeast(5.0)
    val fields = mutableMapOf<String, FieldValue>(
        "amount_ml" to FieldValue.Num(amt)
    )
    if (durationMinutes != null && durationMinutes > 0) {
        fields["minutes"] = FieldValue.Num(durationMinutes)
    }
    if (storage != null && storage in setOf("fridge", "freezer", "fed")) {
        fields["storage"] = FieldValue.Str(storage)
    }
    return log(
        type = "pump",
        fields = fields,
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = baby ?: household.babyId
    )
}

fun LogService.logGrowth(
    weightKg: Double? = null,
    lengthCm: Double? = null,
    headCm: Double? = null,
    note: String? = null,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    val targetBaby = baby ?: household.babyId
    var last: LogEvent? = null
    if (weightKg != null && weightKg > 0) {
        ensureCategoryEnabled("weight")
        last = log(
            type = "weight",
            fields = mapOf("grams" to FieldValue.Num((weightKg * 1000.0).roundToInt().toDouble())),
            occurredAt = at,
            provenance = Provenance(surface = surface, input = InputKind.TAP),
            baby = targetBaby
        )
    }
    if (lengthCm != null && lengthCm > 0) {
        ensureCategoryEnabled("height")
        last = log(
            type = "height",
            fields = mapOf("height_cm" to FieldValue.Num(lengthCm)),
            occurredAt = at,
            provenance = Provenance(surface = surface, input = InputKind.TAP),
            baby = targetBaby
        )
    }
    if (headCm != null && headCm > 0) {
        ensureCategoryEnabled("head")
        last = log(
            type = "head",
            fields = mapOf("head_cm" to FieldValue.Num(headCm)),
            occurredAt = at,
            provenance = Provenance(surface = surface, input = InputKind.TAP),
            baby = targetBaby
        )
    }
    return last ?: log(
        type = SystemType.NOTE,
        fields = mapOf("transcript" to FieldValue.Str(note ?: "Growth check")),
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = targetBaby
    )
}

fun LogService.logCare(
    category: String,
    fields: Map<String, FieldValue> = emptyMap(),
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    val targetBaby = baby ?: household.babyId
    val normalizedType = when (category) {
        "medicine" -> "medication"
        "custom" -> SystemType.NOTE
        else -> if (EventRegistry.shared.type(category) != null) category else SystemType.NOTE
    }
    if (normalizedType == SystemType.NOTE) {
        val text = fields["note"]?.string ?: fields["title"]?.string ?: category
        return log(
            type = SystemType.NOTE,
            fields = mapOf("transcript" to FieldValue.Str(text)),
            occurredAt = at,
            provenance = Provenance(surface = surface, input = InputKind.TAP),
            baby = targetBaby
        )
    }
    val spec = EventRegistry.shared.type(normalizedType)!!
    ensureCategoryEnabled(spec.category)
    val validFields = mutableMapOf<String, FieldValue>()
    when (normalizedType) {
        "temperature" -> {
            val c = fields["celsius"]?.number ?: 37.0
            validFields["celsius"] = FieldValue.Num(c)
        }
        "medication" -> {
            val med = fields["name"]?.string?.lowercase(Locale.US)?.let {
                when {
                    it.contains("ibuprofen") -> "ibuprofen"
                    it.contains("acetaminophen") || it.contains("tylenol") || it.contains("paracetamol") -> "acetaminophen"
                    it.contains("gas") || it.contains("simethicone") -> "simethicone"
                    it.contains("vitamin") -> "vitamin_d"
                    else -> "other"
                }
            } ?: "acetaminophen"
            validFields["medicine"] = FieldValue.Str(med)
            fields["dose"]?.string?.let { validFields["dose"] = FieldValue.Str(it) }
        }
        "tummy_time", "skin_to_skin", "crying", "bath" -> {
            fields["duration_min"]?.number?.let { validFields["minutes"] = FieldValue.Num(it) }
        }
        "milestone" -> {
            validFields["milestone"] = FieldValue.Str(fields["title"]?.string ?: fields["note"]?.string ?: "Milestone")
        }
    }
    return log(
        type = normalizedType,
        fields = validFields,
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = targetBaby
    )
}

fun LogService.startTimedActivity(
    category: String,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    val type = if (EventRegistry.shared.type(category) != null) category else "tummy_time"
    val spec = EventRegistry.shared.type(type)!!
    ensureCategoryEnabled(spec.category)
    return startTimed(type = type, at = at, baby = baby ?: household.babyId, surface = surface)
}

fun LogService.stopTimedActivity(
    category: String,
    note: String? = null,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent? {
    val open = openTimedActivities(baby = baby)[category] ?: return null
    return stopTimed(id = open.id, at = at, surface = surface)
}

fun LogService.logMovement(
    strength: String? = null,
    note: String? = null,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    ensureCategoryEnabled("movement")
    val fields = mutableMapOf<String, FieldValue>()
    if (strength != null && strength in setOf("gentle", "normal", "strong")) {
        fields["strength"] = FieldValue.Str(strength)
    }
    return log(
        type = "movement",
        fields = fields,
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = baby ?: household.babyId
    )
}

fun LogService.logKickSession(
    kicks: Int,
    durationMinutes: Int,
    startedAt: Date? = null,
    baby: UUID? = null,
    surface: Surface = Surface.PHONE,
    at: Date = Date()
): LogEvent {
    ensureCategoryEnabled("movement")
    return log(
        type = "kick_count",
        fields = mapOf(
            "count" to FieldValue.Num(kicks.coerceAtLeast(1).toDouble()),
            "minutes" to FieldValue.Num(durationMinutes.coerceAtLeast(1).toDouble())
        ),
        occurredAt = at,
        provenance = Provenance(surface = surface, input = InputKind.TAP),
        baby = baby ?: household.babyId
    )
}

fun LogService.setShiftNote(text: String, surface: Surface = Surface.PHONE): LogEvent {
    store.setValue(text.trim().ifEmpty { null }, "shift_note")
    return log(
        type = SystemType.NOTE,
        fields = mapOf(
            "transcript" to FieldValue.Str(text.trim()),
            "shift_note" to FieldValue.Bool(true)
        ),
        provenance = Provenance(surface = surface, input = InputKind.TAP)
    )
}

fun LogService.pendingCaptures(): List<Capture> =
    store.captures().filter { it.status == Capture.Status.PENDING || it.status == Capture.Status.NEEDS_REVIEW }

fun LogService.pendingPickEvents(): List<LogEvent> =
    derived(baby = null).counted.filter { it.needsDetails }

fun LogService.needsDetailsEvents(baby: UUID? = null): List<LogEvent> =
    derived(baby = baby).counted.filter { it.needsDetails }

val DerivedLog.shiftNote: String?
    get() = all.lastOrNull {
        it.type == SystemType.NOTE && status[it.id] == EventStatus.ACTIVE && it.fields["shift_note"] == FieldValue.Bool(true)
    }?.string("transcript")

fun DerivedLog.lastMedicine(name: String): LogEvent? {
    val lower = name.lowercase(Locale.US)
    return counted.lastOrNull {
        it.type == "medication" && (it.string("medicine")?.lowercase(Locale.US)?.contains(lower) == true)
    }
}
