package com.hejitech.weehours.core

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.Calendar
import java.util.Date
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.round

@Serializable
data class Caregiver(
    @Serializable(with = UUIDSerializer::class) var id: UUID,
    var name: String,
    var role: String? = null,
    @SerialName("quiet_start") var quietStart: Int? = null,
    @SerialName("quiet_end") var quietEnd: Int? = null,
)

@Serializable
data class ReminderSettings(
    @SerialName("feed_every_minutes") var feedEveryMinutes: Int? = null,
    @SerialName("diaper_every_minutes") var diaperEveryMinutes: Int? = null,
    @SerialName("overdue_margin_minutes") var overdueMarginMinutes: Int = 20,
    @SerialName("snooze_minutes") var snoozeMinutes: Int = 10,
    var adaptive: Boolean = false,
)

@Serializable
data class Baby(
    @Serializable(with = UUIDSerializer::class) var id: UUID = UUID.randomUUID(),
    var name: String,
    @SerialName("birth_date") @Serializable(with = DateIsoSerializer::class) var birthDate: Date? = null,
    var color: String? = null,
    @SerialName("bottle_ml") var bottleMl: Double? = null,
    @SerialName("default_feed") var defaultFeed: String? = null,
    var position: Int = 0,
    var archived: Boolean = false,
    @SerialName("due_date") @Serializable(with = DateIsoSerializer::class) var dueDate: Date? = null,
) {
    init {
        name = name.trim()
    }

    val isExpected: Boolean get() = birthDate == null && dueDate != null

    fun gestation(now: Date = Date(), calendar: Calendar = Calendar.getInstance()): Pair<Int, Int>? {
        val due = dueDate ?: return null
        if (!isExpected) return null
        fun startOfDay(d: Date): Long {
            val c = calendar.clone() as Calendar
            c.time = d
            c.set(Calendar.HOUR_OF_DAY, 0)
            c.set(Calendar.MINUTE, 0)
            c.set(Calendar.SECOND, 0)
            c.set(Calendar.MILLISECOND, 0)
            return c.timeInMillis
        }
        val toGo = TimeUnit.MILLISECONDS.toDays(startOfDay(due) - startOfDay(now)).toInt()
        val along = max(0, 280 - toGo)
        return (along / 7) to (along % 7)
    }

    fun canLog(category: String): Boolean = (category == MOVEMENT_CATEGORY) == isExpected

    companion object {
        const val MOVEMENT_CATEGORY = "movement"
    }
}

@Serializable(with = HouseholdSerializer::class)
data class Household(
    var id: UUID = UUID.randomUUID(),
    var name: String = "Our family",
    var babies: List<Baby>,
    var bottleMl: Double = 120.0,
    var categories: List<String> = EventRegistry.shared.defaultCategories.sorted(),
    var defaultFeed: String = "bottle",
    var reminders: ReminderSettings = ReminderSettings(),
    var caregivers: List<Caregiver> = emptyList(),
    var nightStart: Int = 21 * 60,
    var nightEnd: Int = 7 * 60,
    var trackMilkStash: Boolean = false,
) {
    constructor(
        id: UUID = UUID.randomUUID(),
        name: String = "Our family",
        babyId: UUID = UUID.randomUUID(),
        babyName: String = "Baby",
        birthDate: Date? = null,
        babies: List<Baby>? = null,
        bottleMl: Double = 120.0,
        categories: List<String> = EventRegistry.shared.defaultCategories.sorted(),
        defaultFeed: String = "bottle",
        reminders: ReminderSettings = ReminderSettings(),
        caregivers: List<Caregiver> = emptyList(),
        nightStart: Int = 21 * 60,
        nightEnd: Int = 7 * 60,
        trackMilkStash: Boolean = false,
    ) : this(
        id = id,
        name = name,
        babies = babies ?: listOf(Baby(id = babyId, name = babyName, birthDate = birthDate)),
        bottleMl = bottleMl,
        categories = categories,
        defaultFeed = defaultFeed,
        reminders = reminders,
        caregivers = caregivers,
        nightStart = nightStart,
        nightEnd = nightEnd,
        trackMilkStash = trackMilkStash,
    )

    val active: List<Baby>
        get() {
            val list = babies.filter { !it.archived }
            return if (list.isEmpty()) babies.take(1) else list
        }

    val firstBaby: Baby get() = active.first()
    val babyId: UUID get() = firstBaby.id
    val babyName: String get() = firstBaby.name
    val birthDate: Date? get() = firstBaby.birthDate

    fun baby(id: UUID?): Baby? = babies.firstOrNull { it.id == id }
    fun babyName(id: UUID?): String = baby(id)?.name ?: babyName
    fun bottleMl(forBaby: UUID?): Double = baby(forBaby)?.bottleMl ?: bottleMl
    fun defaultFeed(forBaby: UUID?): String = baby(forBaby)?.defaultFeed ?: defaultFeed

    val enabled: Set<String> get() = categories.toSet()
    val expecting: List<Baby> get() = active.filter { it.isExpected }

    fun trackMovementsIfExpecting() {
        if (expecting.isNotEmpty() && !categories.contains(Baby.MOVEMENT_CATEGORY)) {
            categories = categories + Baby.MOVEMENT_CATEGORY
        }
    }

    fun caregiverName(id: UUID?): String {
        if (id == null) return "nobody"
        return caregivers.firstOrNull { it.id == id }?.name ?: "someone"
    }

    fun isNight(date: Date, calendar: Calendar = Calendar.getInstance()): Boolean {
        val c = calendar.clone() as Calendar
        c.time = date
        val m = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE)
        return if (nightStart > nightEnd) (m >= nightStart || m < nightEnd) else (m >= nightStart && m < nightEnd)
    }

    fun milliliters(e: LogEvent): Double? {
        e.number("consumed_ml")?.let { return it }
        e.number("consumed_fraction")?.let { return round(it * bottleMl(e.babyId)) }
        return null
    }

    companion object {
        fun names(babies: List<Baby>): String {
            val n = babies.map { it.name }
            if (n.size <= 1) return n.firstOrNull() ?: ""
            return n.dropLast(1).joinToString(", ") + " & " + n.last()
        }
    }
}

object HouseholdSerializer : KSerializer<Household> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("Household")

    override fun deserialize(decoder: Decoder): Household {
        val jsonDecoder = decoder as JsonDecoder
        val obj = jsonDecoder.decodeJsonElement().jsonObject
        val id = UUID.fromString(obj["id"]!!.jsonPrimitive.content)
        val name = obj["name"]?.jsonPrimitive?.content ?: "Our family"
        val babiesList = obj["babies"]?.jsonArray?.map {
            LogCoding.json.decodeFromJsonElement(Baby.serializer(), it)
        }?.sortedWith(compareBy<Baby> { it.position }.thenBy { it.name })
        val babies = if (!babiesList.isNullOrEmpty()) {
            babiesList
        } else {
            val bId = obj["baby_id"]?.jsonPrimitive?.content?.let { UUID.fromString(it) } ?: UUID.randomUUID()
            val bName = obj["baby_name"]?.jsonPrimitive?.content ?: "Baby"
            val bBirth = obj["birth_date"]?.jsonPrimitive?.content?.let { LogCoding.parseISO(it) }
            listOf(Baby(id = bId, name = bName, birthDate = bBirth))
        }
        val bottleMl = obj["bottle_ml"]?.jsonPrimitive?.doubleOrNull ?: 120.0
        val categories = obj["categories"]?.jsonArray?.map { it.jsonPrimitive.content }
            ?: EventRegistry.shared.defaultCategories.sorted()
        val defaultFeed = obj["default_feed"]?.jsonPrimitive?.content ?: "bottle"
        val reminders = obj["reminders"]?.let {
            LogCoding.json.decodeFromJsonElement(ReminderSettings.serializer(), it)
        } ?: ReminderSettings()
        val caregivers = obj["caregivers"]?.jsonArray?.map {
            LogCoding.json.decodeFromJsonElement(Caregiver.serializer(), it)
        } ?: emptyList()
        val nightStart = obj["night_start"]?.jsonPrimitive?.intOrNull ?: (21 * 60)
        val nightEnd = obj["night_end"]?.jsonPrimitive?.intOrNull ?: (7 * 60)
        val trackMilkStash = obj["track_milk_stash"]?.jsonPrimitive?.booleanOrNull ?: false
        return Household(
            id = id,
            name = name,
            babies = babies,
            bottleMl = bottleMl,
            categories = categories,
            defaultFeed = defaultFeed,
            reminders = reminders,
            caregivers = caregivers,
            nightStart = nightStart,
            nightEnd = nightEnd,
            trackMilkStash = trackMilkStash
        )
    }

    override fun serialize(encoder: Encoder, value: Household) {
        val jsonEncoder = encoder as JsonEncoder
        val obj = buildJsonObject {
            put("id", JsonPrimitive(value.id.uuidString()))
            put("name", JsonPrimitive(value.name))
            put(
                "babies",
                LogCoding.json.encodeToJsonElement(
                    kotlinx.serialization.builtins.ListSerializer(Baby.serializer()),
                    value.babies
                )
            )
            put("baby_id", JsonPrimitive(value.babyId.uuidString()))
            put("baby_name", JsonPrimitive(value.babyName))
            value.birthDate?.let { put("birth_date", JsonPrimitive(LogCoding.isoString(it))) }
            put("bottle_ml", JsonPrimitive(value.bottleMl))
            put("categories", JsonArray(value.categories.map { JsonPrimitive(it) }))
            put("default_feed", JsonPrimitive(value.defaultFeed))
            put("reminders", LogCoding.json.encodeToJsonElement(ReminderSettings.serializer(), value.reminders))
            put(
                "caregivers",
                LogCoding.json.encodeToJsonElement(
                    kotlinx.serialization.builtins.ListSerializer(Caregiver.serializer()),
                    value.caregivers
                )
            )
            put("night_start", JsonPrimitive(value.nightStart))
            put("night_end", JsonPrimitive(value.nightEnd))
            if (value.trackMilkStash) {
                put("track_milk_stash", JsonPrimitive(true))
            }
        }
        jsonEncoder.encodeJsonElement(obj)
    }
}

data class PlannedReminder(
    val kind: Kind,
    val baby: UUID? = null,
    val fireAt: Date,
    val escalated: Boolean,
    val message: String,
) {
    enum class Kind(val rawValue: String) {
        FEED("feed"),
        DIAPER("diaper"),
        STILL_FEEDING("stillFeeding"),
        STILL_SLEEPING("stillSleeping"),
        STILL_ACTIVITY("stillActivity")
    }
}

object ReminderPlanner {
    fun plan(
        logs: List<Pair<Baby, DerivedLog>>,
        household: Household,
        me: UUID,
        now: Date,
        snoozedUntil: Map<PlannedReminder.Kind, Date> = emptyMap(),
        calendar: Calendar = Calendar.getInstance(),
    ): List<PlannedReminder> =
        logs.flatMap { (baby, log) ->
            plan(log = log, household = household, me = me, now = now, snoozedUntil = snoozedUntil, calendar = calendar)
                .map {
                    PlannedReminder(
                        kind = it.kind,
                        baby = baby.id,
                        fireAt = it.fireAt,
                        escalated = it.escalated,
                        message = if (logs.size > 1) "${baby.name} · ${it.message}" else it.message
                    )
                }
        }

    fun plan(
        log: DerivedLog,
        household: Household,
        me: UUID,
        now: Date,
        snoozedUntil: Map<PlannedReminder.Kind, Date> = emptyMap(),
        calendar: Calendar = Calendar.getInstance(),
    ): List<PlannedReminder> {
        val duty = log.duty
        if (duty?.caregiver != null && duty.caregiver != me) return emptyList()
        val status = StatusSnapshot(log = log, now = now)
        val out = mutableListOf<PlannedReminder>()
        val settings = household.reminders

        fun add(kind: PlannedReminder.Kind, due: Date, text: String) {
            var first = if (due.after(now)) due else now
            val snooze = snoozedUntil[kind]
            if (snooze != null && snooze.after(first)) first = snooze
            val meCaregiver = household.caregivers.firstOrNull { it.id == me }
            val onDuty = log.duty?.caregiver != null
            if (!onDuty && meCaregiver != null && inQuiet(first, meCaregiver, calendar)) return
            out.add(PlannedReminder(kind = kind, fireAt = first, escalated = false, message = text))
            out.add(
                PlannedReminder(
                    kind = kind,
                    fireAt = Date(first.time + settings.overdueMarginMinutes * 60_000L),
                    escalated = true,
                    message = "$text (overdue)"
                )
            )
        }

        val feedEvery = (if (settings.adaptive) suggestedFeedInterval(log = log, now = now) else null)
            ?: settings.feedEveryMinutes
        val lastFeedAt = status.lastFeedAt
        if (feedEvery != null && status.openFeedSince == null && lastFeedAt != null) {
            val sideHint = status.nextSide?.let { "$it next" } ?: ""
            add(
                PlannedReminder.Kind.FEED,
                due = Date(lastFeedAt.time + feedEvery * 60_000L),
                text = "Feed due · $sideHint"
            )
        }
        val diaperEvery = settings.diaperEveryMinutes
        val lastDiaperAt = status.lastDiaperAt
        if (diaperEvery != null && lastDiaperAt != null) {
            add(
                PlannedReminder.Kind.DIAPER,
                due = Date(lastDiaperAt.time + diaperEvery * 60_000L),
                text = "Diaper check due"
            )
        }

        fun nudge(kind: PlannedReminder.Kind, since: Date, minutes: Int, text: String) {
            val due = Date(since.time + minutes * 60_000L)
            if (due.time <= now.time - 6 * 3600_000L) return
            val first = if (due.after(now)) due else now
            val snooze = snoozedUntil[kind]
            if (snooze != null && snooze.after(first)) return
            val meCaregiver = household.caregivers.firstOrNull { it.id == me }
            if (log.duty?.caregiver == null && meCaregiver != null && inQuiet(first, meCaregiver, calendar)) return
            out.add(PlannedReminder(kind = kind, fireAt = first, escalated = false, message = text))
        }

        val limits = EventRegistry.shared.sessionReminders
        val openFeed = log.openFeedSession()
        val openFeedStart = openFeed?.start
        if (openFeed != null && openFeedStart != null) {
            val m = limits[openFeed.kind.rawValue]
            if (m != null) {
                val what = if (openFeed.kind == Session.Kind.BOTTLE) "Still feeding? The bottle started" else "Still nursing? It started"
                nudge(
                    PlannedReminder.Kind.STILL_FEEDING,
                    since = openFeedStart,
                    minutes = m,
                    text = "$what ${StatusSnapshot.duration((m * 60).toDouble())} ago. Finish it if it's over."
                )
            }
        }
        val openSleep = log.openSession(Session.Kind.SLEEP)
        val openSleepStart = openSleep?.start
        if (openSleep != null && openSleepStart != null) {
            val m = limits["sleep"]
            if (m != null && !household.isNight(openSleepStart, calendar)) {
                nudge(
                    PlannedReminder.Kind.STILL_SLEEPING,
                    since = openSleepStart,
                    minutes = m,
                    text = "Still napping? ${StatusSnapshot.duration((m * 60).toDouble())} so far. Log the wake-up if they're up."
                )
            }
        }
        for (e in log.effective) {
            if (e.fields["ongoing"] == FieldValue.Bool(true)) {
                val t = EventRegistry.shared.type(e.type) ?: continue
                val m = t.remindAfterMinutes ?: continue
                nudge(
                    PlannedReminder.Kind.STILL_ACTIVITY,
                    since = e.occurredAt,
                    minutes = m,
                    text = "${t.label} has been going ${StatusSnapshot.duration((m * 60).toDouble())}. Stop the timer if it's over."
                )
            }
        }
        return out
    }

    internal fun inQuiet(date: Date, c: Caregiver, calendar: Calendar): Boolean {
        val s = c.quietStart ?: return false
        val e = c.quietEnd ?: return false
        val cal = calendar.clone() as Calendar
        cal.time = date
        val m = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
        return if (s > e) (m >= s || m < e) else (m >= s && m < e)
    }

    fun suggestedFeedInterval(log: DerivedLog, now: Date): Int? {
        val starts = log.sessions
            .filter { it.kind == Session.Kind.BOTTLE || it.kind == Session.Kind.BREAST }
            .map { it.anchor }
            .filter { (now.time - it.time) <= 3 * 86400_000L }
            .sorted()
        if (starts.size < 4) return null
        val gaps = starts.drop(1).zip(starts)
            .map { (a, b) -> (a.time - b.time) / 60_000.0 }
            .filter { it > 20.0 }
            .sorted()
        if (gaps.isEmpty()) return null
        val median = gaps[gaps.size / 2]
        return (round(median / 15.0) * 15.0).toInt()
    }
}

object CSVExport {
    fun csv(log: DerivedLog, household: Household): String {
        val lines = mutableListOf("occurred_at,child,type,details,ml,logged_by,surface,input,transcript,confidence_tier")
        for (e in log.effective) {
            if (log.status[e.id] != EventStatus.ACTIVE) continue
            val ml = household.milliliters(e)?.let { it.toInt().toString() } ?: ""
            val details = e.fields.keys.sorted().joinToString(" ") { "$it=${e.fields[it]}" }
            val cols = listOf(
                LogCoding.isoString(e.occurredAt),
                household.babyName(e.babyId),
                e.type,
                details,
                ml,
                household.caregiverName(e.loggedBy),
                e.provenance.surface.rawValue,
                e.provenance.input.rawValue,
                e.provenance.rawTranscript ?: "",
                e.provenance.confidenceTier?.rawValue ?: ""
            )
            lines.add(cols.joinToString(",") { escape(it) })
        }
        return lines.joinToString("\n") + "\n"
    }

    private fun escape(s: String): String =
        if (s.contains(",") || s.contains("\"") || s.contains("\n")) {
            "\"" + s.replace("\"", "\"\"") + "\""
        } else s
}

@Serializable
enum class Plan(val rawValue: String) {
    @SerialName("monthly") MONTHLY("monthly"),
    @SerialName("yearly") YEARLY("yearly"),
    @SerialName("lifetime") LIFETIME("lifetime");

    val productId: String get() = "subscription.$rawValue"
}

@Serializable
data class Entitlement(
    @SerialName("trial_started_at") @Serializable(with = DateIsoSerializer::class) var trialStartedAt: Date,
    var plan: Plan? = null,
    @SerialName("expires_at") @Serializable(with = DateIsoSerializer::class) var expiresAt: Date? = null,
) {
    sealed class Access {
        data class Trial(val daysLeft: Int) : Access()
        data class Subscribed(val plan: Plan, val until: Date?) : Access()
        data object Lifetime : Access()
        data object Expired : Access()
    }

    enum class Feature { TAP_LOGGING, VOICE, WATCH, GLASSES, MCP, REMINDERS, EXPORT, PHOTOS }

    fun access(now: Date): Access {
        if (plan == Plan.LIFETIME) return Access.Lifetime
        val p = plan
        val exp = expiresAt
        if (p != null && exp != null && exp.after(now)) {
            return Access.Subscribed(p, until = exp)
        }
        val trialEndMs = trialStartedAt.time + TRIAL_DAYS * 86400_000L
        if (trialEndMs > now.time) {
            val daysLeft = ceil((trialEndMs - now.time) / 86400_000.0).toInt()
            return Access.Trial(daysLeft = daysLeft)
        }
        return Access.Expired
    }

    fun allows(feature: Feature, now: Date): Boolean {
        if (feature == Feature.TAP_LOGGING) return true
        return access(now) != Access.Expired
    }

    companion object {
        const val TRIAL_DAYS = 14
    }
}
