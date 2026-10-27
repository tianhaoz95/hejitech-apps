package com.hejitech.weehours.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.text.DateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round

@Serializable
enum class EventStatus(val rawValue: String) {
    @SerialName("active") ACTIVE("active"),
    @SerialName("undone") UNDONE("undone"),
    @SerialName("superseded") SUPERSEDED("superseded"),
    @SerialName("merged") MERGED("merged"),
    @SerialName("duplicate_unresolved") DUPLICATE_UNRESOLVED("duplicate_unresolved")
}

data class DuplicateFlag(
    val original: UUID,
    val duplicate: UUID,
)

data class Session(
    val kind: Kind,
    var babyId: UUID? = null,
    var start: Date? = null,
    var end: Date? = null,
    var startEvent: UUID? = null,
    val switchEvents: MutableList<UUID> = mutableListOf(),
    var endEvent: UUID? = null,
    val sides: MutableList<String> = mutableListOf(),
    var consumedFraction: Double? = null,
    var consumedMl: Double? = null,
    var contents: String? = null,
    var abandoned: Boolean = false,
) {
    enum class Kind(val rawValue: String) {
        BOTTLE("bottle"),
        BREAST("breast"),
        SLEEP("sleep")
    }

    val isOpen: Boolean get() = start != null && end == null && !abandoned
    val anchor: Date get() = start ?: end ?: Date(Long.MIN_VALUE / 2)
    val duration: Double?
        get() {
            val s = start ?: return null
            val e = end ?: return null
            return (e.time - s.time) / 1000.0
        }
    val eventIds: List<UUID>
        get() {
            val ids = mutableListOf<UUID>()
            startEvent?.let { ids.add(it) }
            ids.addAll(switchEvents)
            val endEv = endEvent
            if (endEv != null && endEv != startEvent) ids.add(endEv)
            return ids
        }
}

data class DutyState(
    val caregiver: UUID?,
    val since: Date,
)

class DerivedLog(
    events: List<LogEvent>,
    registry: EventRegistry = EventRegistry.shared,
    asOf: Date? = null,
    val baby: UUID? = null,
) {
    val all: List<LogEvent>
    val status: Map<UUID, EventStatus>
    val effective: List<LogEvent>
    val duplicates: List<DuplicateFlag>
    val sessions: List<Session>
    val duty: DutyState?
    internal val photosByRoot: Map<UUID, List<EntryPhoto>>
    internal val rootOf: Map<UUID, UUID>

    init {
        val visible = if (asOf != null) events.filter { !it.occurredAt.after(asOf) } else events
        val ordered = visible.sortedBy { it.loggedAt.time }
        fun mine(e: LogEvent): Boolean = baby == null || SystemType.all.contains(e.type) || e.babyId == baby
        all = ordered.filter(::mine)
        val byId = LinkedHashMap<UUID, LogEvent>()
        for (e in ordered) {
            if (!byId.containsKey(e.id)) byId[e.id] = e
        }

        // 1. undo events
        val undone = mutableSetOf<UUID>()
        for (e in ordered) {
            if (e.type != SystemType.UNDO) continue
            val target = e.supersedes ?: continue
            if (undone.contains(e.id)) continue
            if (undone.contains(target)) undone.remove(target) else undone.add(target)
        }

        // 2. edits
        val superseded = mutableSetOf<UUID>()
        for (e in ordered) {
            if (!SystemType.all.contains(e.type) && !undone.contains(e.id)) {
                val target = e.supersedes
                if (target != null && byId.containsKey(target)) {
                    superseded.add(target)
                }
            }
        }

        // 3. duplicate resolutions
        val merged = mutableSetOf<UUID>()
        val resolvedPairs = mutableSetOf<String>()
        for (e in ordered) {
            if (e.type == SystemType.RESOLVE && !undone.contains(e.id)) {
                val a = e.string("original")?.let { try { UUID.fromString(it) } catch (_: Exception) { null } } ?: continue
                val b = e.string("duplicate")?.let { try { UUID.fromString(it) } catch (_: Exception) { null } } ?: continue
                resolvedPairs.add(pairKey(a, b))
                if (e.string("resolution") == "merge") {
                    merged.add(b)
                }
            }
        }

        val statusMap = mutableMapOf<UUID, EventStatus>()
        for (e in ordered) {
            statusMap[e.id] = when {
                undone.contains(e.id) -> EventStatus.UNDONE
                superseded.contains(e.id) -> EventStatus.SUPERSEDED
                merged.contains(e.id) -> EventStatus.MERGED
                else -> EventStatus.ACTIVE
            }
        }

        val data = ordered
            .filter { !SystemType.all.contains(it.type) && statusMap[it.id] == EventStatus.ACTIVE }
            .sortedWith(compareBy<LogEvent> { it.occurredAt.time }.thenBy { it.loggedAt.time })

        // 4. duplicate flags
        val flags = mutableListOf<DuplicateFlag>()
        val lineage = computeLineage(ordered, byId)
        for (i in data.indices) {
            val a = data[i]
            for (j in (i + 1) until data.size) {
                val b = data[j]
                val windowSec = if (registry.type(a.type)?.session?.role == "start") {
                    registry.duplicateWindowStart
                } else {
                    registry.duplicateWindowDefault
                }
                if ((b.occurredAt.time - a.occurredAt.time) / 1000.0 > windowSec) break
                if (a.type != b.type || a.babyId != b.babyId) continue
                if (a.loggedBy == b.loggedBy && a.provenance.surface == b.provenance.surface) continue
                if (lineage[a.id] == lineage[b.id]) continue
                if (resolvedPairs.contains(pairKey(a.id, b.id))) continue
                val (first, second) = if (a.loggedAt.time <= b.loggedAt.time) (a to b) else (b to a)
                if (flags.any { it.duplicate == second.id }) continue
                flags.add(DuplicateFlag(original = first.id, duplicate = second.id))
                statusMap[second.id] = EventStatus.DUPLICATE_UNRESOLVED
            }
        }

        val byRoot = mutableMapOf<UUID, MutableList<EntryPhoto>>()
        for (e in ordered) {
            if (e.type == SystemType.PHOTO && statusMap[e.id] == EventStatus.ACTIVE) {
                val p = EntryPhoto.fromEvent(e) ?: continue
                val root = lineage[p.entry] ?: p.entry
                byRoot.getOrPut(root) { mutableListOf() }.add(p)
            }
        }
        photosByRoot = byRoot.mapValues { (_, list) ->
            list.sortedWith(compareBy<EntryPhoto> { it.takenAt.time }.thenBy { it.id.uuidString() })
        }
        rootOf = lineage

        val own = data.filter(::mine)
        val ownIds = own.map { it.id }.toSet()
        duplicates = flags.filter { ownIds.contains(it.duplicate) }
        status = statusMap
        effective = own
        val active = own.filter { statusMap[it.id] == EventStatus.ACTIVE }
        val children = active.groupBy { it.babyId }
        sessions = if (children.size <= 1) {
            pairSessions(active, registry)
        } else {
            children.values.flatMap { pairSessions(it, registry) }
                .sortedWith(compareBy<Session> { it.anchor.time }.thenBy { it.babyId?.uuidString() ?: "" })
        }

        // 5. on-duty
        val d = ordered.lastOrNull { it.type == SystemType.DUTY && statusMap[it.id] == EventStatus.ACTIVE }
        duty = if (d != null) {
            val cg = d.string("caregiver")?.let { try { UUID.fromString(it) } catch (_: Exception) { null } }
            DutyState(caregiver = cg, since = d.occurredAt)
        } else {
            null
        }
    }

    val counted: List<LogEvent> get() = effective.filter { status[it.id] == EventStatus.ACTIVE }

    fun openSession(kind: Session.Kind? = null): Session? =
        sessions.lastOrNull { it.isOpen && (kind == null || it.kind == kind) }

    fun openFeedSession(): Session? =
        sessions.lastOrNull { it.isOpen && (it.kind == Session.Kind.BOTTLE || it.kind == Session.Kind.BREAST) }

    fun photos(forEvent: LogEvent): List<EntryPhoto> =
        photosByRoot[rootOf[forEvent.id] ?: forEvent.id] ?: emptyList()

    fun photos(forEvents: List<LogEvent>): List<EntryPhoto> {
        val seen = mutableSetOf<UUID>()
        return forEvents.flatMap { photos(it) }
            .filter { seen.add(it.id) }
            .sortedBy { it.takenAt.time }
    }

    val allPhotos: List<EntryPhoto>
        get() {
            val live = effective.map { rootOf[it.id] ?: it.id }.toSet()
            return photosByRoot.filter { live.contains(it.key) }
                .values.flatten()
                .sortedByDescending { it.takenAt.time }
        }

    fun entry(forPhoto: EntryPhoto): LogEvent? {
        val root = rootOf[forPhoto.entry] ?: forPhoto.entry
        return effective.lastOrNull { (rootOf[it.id] ?: it.id) == root }
    }

    fun shiftSummary(household: Household, now: Date = Date(), includeCurrent: Boolean = false): ShiftSummary? {
        val duties = all.filter { it.type == SystemType.DUTY && status[it.id] == EventStatus.ACTIVE }
            .sortedBy { it.occurredAt.time }
        val startAt: Date
        val endAt: Date
        val caregiver: UUID?
        if (duties.size >= 2 && !includeCurrent) {
            val prev = duties[duties.size - 2]
            val last = duties[duties.size - 1]
            startAt = prev.occurredAt
            endAt = last.occurredAt
            caregiver = prev.string("caregiver")?.let { try { UUID.fromString(it) } catch (_: Exception) { null } }
        } else if (duties.isNotEmpty()) {
            val last = duties.last()
            startAt = last.occurredAt
            endAt = now
            caregiver = last.string("caregiver")?.let { try { UUID.fromString(it) } catch (_: Exception) { null } }
        } else {
            return null
        }
        val inWindow = counted.filter { !it.occurredAt.before(startAt) && !it.occurredAt.after(endAt) }
        val feedSessions = sessions.filter {
            (it.kind == Session.Kind.BOTTLE || it.kind == Session.Kind.BREAST) &&
                !it.anchor.before(startAt) && !it.anchor.after(endAt)
        }
        val solidsCount = inWindow.count { it.type == "feed.solids" }
        val feedCount = feedSessions.size + solidsCount
        val bottleMl = inWindow.filter { it.type == "feed.bottle.finish" || it.type == "feed.bottle.single" }
            .mapNotNull { household.milliliters(it) }
            .sum()
        val diapers = inWindow.filter { it.type == "diaper" }
        val wetDiapers = diapers.count { val k = it.string("kind"); k == "wet" || k == "both" }
        val dirtyDiapers = diapers.count { val k = it.string("kind"); k == "dirty" || k == "both" }
        val sleepList = sessions.filter {
            it.kind == Session.Kind.SLEEP &&
                (it.end ?: now).after(startAt) &&
                (it.start ?: startAt).before(endAt)
        }
        val sleepSeconds = sleepList.sumOf { s ->
            val a = max(s.start?.time ?: startAt.time, startAt.time)
            val b = min(s.end?.time ?: now.time, endAt.time)
            max(0.0, (b - a) / 1000.0)
        }
        val meds = inWindow.filter { it.type == "medication" }.map { e ->
            ShiftSummary.MedEntry(
                id = e.id,
                medicine = e.string("medicine") ?: "Medication",
                dose = e.string("dose"),
                occurredAt = e.occurredAt
            )
        }
        val notes = all.filter {
            it.type == SystemType.NOTE && status[it.id] == EventStatus.ACTIVE &&
                !it.occurredAt.before(startAt) && !it.occurredAt.after(endAt)
        }.mapNotNull { e ->
            val text = (e.string("transcript") ?: e.provenance.rawTranscript ?: "").trim()
            if (text.isEmpty()) null else ShiftSummary.NoteEntry(
                id = e.id,
                text = text,
                occurredAt = e.occurredAt,
                by = e.loggedBy
            )
        }
        return ShiftSummary(
            caregiver = caregiver,
            startedAt = startAt,
            endedAt = endAt,
            feedCount = feedCount,
            bottleMl = bottleMl,
            wetDiapers = wetDiapers,
            dirtyDiapers = dirtyDiapers,
            sleepSeconds = sleepSeconds,
            sleepStretches = sleepList.size,
            medications = meds,
            notes = notes
        )
    }

    fun milkStash(household: Household, now: Date = Date()): MilkStash {
        data class Lot(var ml: Double, val at: Date)
        val fridge = mutableListOf<Lot>()
        val freezer = mutableListOf<Lot>()
        val startContents = mutableMapOf<UUID, String>()
        for (s in sessions) {
            if (s.kind == Session.Kind.BOTTLE) {
                val endId = s.endEvent
                val c = s.contents
                if (endId != null && c != null) startContents[endId] = c
            }
        }
        for (e in counted) {
            if (e.type == "pump") {
                val ml = e.number("amount_ml") ?: household.bottleMl(e.babyId)
                if (ml <= 0) continue
                val storage = e.string("storage") ?: "fridge"
                if (storage == "freezer") {
                    if (e.fields["from_fridge"] == FieldValue.Bool(true)) {
                        var rem = ml
                        while (rem > 0 && fridge.isNotEmpty()) {
                            val take = min(fridge[0].ml, rem)
                            fridge[0].ml -= take
                            rem -= take
                            if (fridge[0].ml <= 0.1) fridge.removeAt(0)
                        }
                    }
                    freezer.add(Lot(ml = ml, at = e.occurredAt))
                } else if (storage == "fridge") {
                    fridge.add(Lot(ml = ml, at = e.occurredAt))
                }
            } else if (e.type == "feed.bottle.finish" || e.type == "feed.bottle.single") {
                val contents = e.string("contents") ?: startContents[e.id]
                if (contents != "breast_milk") continue
                var rem = household.milliliters(e) ?: household.bottleMl(e.babyId)
                while (rem > 0 && fridge.isNotEmpty()) {
                    val take = min(fridge[0].ml, rem)
                    fridge[0].ml -= take
                    rem -= take
                    if (fridge[0].ml <= 0.1) fridge.removeAt(0)
                }
            }
        }
        val fridgeMl = round(fridge.sumOf { it.ml })
        val freezerMl = round(freezer.sumOf { it.ml })
        val batchList = mutableListOf<MilkStash.Batch>()
        var expiringSoon = 0
        var expired = 0
        for (lot in fridge) {
            val exp = Date(lot.at.time + 4L * 24L * 3600_000L)
            val isExp = now.after(exp)
            val isSoon = !isExp && (exp.time - now.time) <= 24L * 3600_000L
            if (isExp) expired += 1 else if (isSoon) expiringSoon += 1
            batchList.add(MilkStash.Batch(ml = round(lot.ml), at = lot.at, location = "fridge", expiresAt = exp, isExpiringSoon = isSoon, isExpired = isExp))
        }
        for (lot in freezer) {
            val exp = Date(lot.at.time + 180L * 24L * 3600_000L)
            val isExp = now.after(exp)
            val isSoon = !isExp && (exp.time - now.time) <= 7L * 24L * 3600_000L
            if (isExp) expired += 1 else if (isSoon) expiringSoon += 1
            batchList.add(MilkStash.Batch(ml = round(lot.ml), at = lot.at, location = "freezer", expiresAt = exp, isExpiringSoon = isSoon, isExpired = isExp))
        }
        return MilkStash(
            fridgeMl = fridgeMl,
            freezerMl = freezerMl,
            fridgeLots = fridge.size,
            freezerBags = freezer.size,
            oldestFridgeAt = fridge.firstOrNull()?.at,
            oldestFreezerAt = freezer.firstOrNull()?.at,
            batches = batchList,
            expiringSoonCount = expiringSoon,
            expiredCount = expired
        )
    }

    fun solidsSummary(): SolidsSummary {
        val counts = mutableMapOf<String, Int>()
        val orderedFoods = mutableListOf<String>()
        val allergenCounts = SolidsSummary.topAllergens.associate { it.key to 0 }.toMutableMap()
        val reactions = mutableListOf<SolidsSummary.ReactionRecord>()
        for (e in counted) {
            if (e.type != "feed.solids") continue
            val raw = e.string("foods") ?: ""
            val items = raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
            for (item in items) {
                val canonical = item.take(1).uppercase(Locale.US) + item.drop(1).lowercase(Locale.US)
                if (!counts.containsKey(canonical)) orderedFoods.add(canonical)
                counts[canonical] = (counts[canonical] ?: 0) + 1
                val lower = canonical.lowercase(Locale.US)
                for (a in SolidsSummary.topAllergens) {
                    if (a.keywords.any { lower.contains(it) }) {
                        allergenCounts[a.key] = (allergenCounts[a.key] ?: 0) + 1
                    }
                }
            }
            val r = e.string("reaction")
            if (!r.isNullOrEmpty() && r != "none") {
                val foodLabel = if (items.isEmpty()) "Solids" else items.joinToString(", ")
                reactions.add(SolidsSummary.ReactionRecord(id = e.id, foods = foodLabel, reaction = r, occurredAt = e.occurredAt))
            }
        }
        return SolidsSummary(triedFoods = orderedFoods, foodCounts = counts, allergenCounts = allergenCounts, reactions = reactions)
    }

    fun doctorVisitPack(household: Household, now: Date = Date()): DoctorVisitPack {
        val visits = counted.filter { it.type == "doctor_visit" }
        val lastVisit = visits.lastOrNull()
        val since = lastVisit?.occurredAt ?: Date(now.time - 14L * 86400_000L)
        val sevenDaysAgo = Date(now.time - 7L * 86400_000L)
        val earliest = min(counted.firstOrNull()?.occurredAt?.time ?: now.time, sevenDaysAgo.time)
        val spanDays = max(1.0, min(7.0, (now.time - earliest) / 86400_000.0))

        val recentFeeds = sessions.filter {
            (it.kind == Session.Kind.BOTTLE || it.kind == Session.Kind.BREAST) && !it.anchor.before(sevenDaysAgo)
        }
        val recentSolids = counted.filter { it.type == "feed.solids" && !it.occurredAt.before(sevenDaysAgo) }
        val recentBottleMl = counted.filter {
            (it.type == "feed.bottle.finish" || it.type == "feed.bottle.single") && !it.occurredAt.before(sevenDaysAgo)
        }.mapNotNull { household.milliliters(it) }.sum()
        val recentDiapers = counted.filter { it.type == "diaper" && !it.occurredAt.before(sevenDaysAgo) }
        val wet7d = recentDiapers.count { val k = it.string("kind"); k == "wet" || k == "both" }
        val dirty7d = recentDiapers.count { val k = it.string("kind"); k == "dirty" || k == "both" }

        fun measure(type: String, key: String): Pair<Double?, Double?> {
            val list = counted.filter { it.type == type }.mapNotNull { e ->
                e.number(key)?.let { e.occurredAt to it }
            }
            val latest = list.lastOrNull() ?: return null to null
            val baseline = list.lastOrNull { !it.first.after(since) }
                ?: if (list.size >= 2) list[list.size - 2] else null
            val delta = baseline?.let { b -> if (b.first == latest.first) null else latest.second - b.second }
            return latest.second to delta
        }

        val (wLatest, wDelta) = measure("weight", "grams")
        val (hLatest, hDelta) = measure("height", "height_cm")
        val (hdLatest, hdDelta) = measure("head", "head_cm")
        val healthTypes = setOf("medication", "symptom", "temperature", "vaccination", "teething")
        val healthEvents = counted.filter { healthTypes.contains(it.type) && !it.occurredAt.before(since) }

        val questions = all.filter { e ->
            if (e.type != SystemType.NOTE || status[e.id] != EventStatus.ACTIVE) return@filter false
            if (e.fields["for_doctor"] == FieldValue.Bool(true) || e.string("for_doctor") == "yes") return@filter true
            val text = (e.string("transcript") ?: e.provenance.rawTranscript ?: "").lowercase(Locale.US)
            text.contains("ask the doctor") || text.contains("ask the pediatrician") ||
                text.contains("ask doctor") || text.contains("ask pediatrician")
        }.sortedByDescending { it.occurredAt.time }

        return DoctorVisitPack(
            lastVisitAt = lastVisit?.occurredAt,
            lastVisitReason = lastVisit?.string("reason"),
            latestWeightGrams = wLatest,
            weightDeltaGrams = wDelta,
            latestHeightCm = hLatest,
            heightDeltaCm = hDelta,
            latestHeadCm = hdLatest,
            headDeltaCm = hdDelta,
            feedsPerDay7d = (recentFeeds.size + recentSolids.size) / spanDays,
            bottleMlPerDay7d = recentBottleMl / spanDays,
            wetDiapersPerDay7d = wet7d / spanDays,
            dirtyDiapersPerDay7d = dirty7d / spanDays,
            healthEvents = healthEvents,
            questions = questions
        )
    }

    companion object {
        private fun pairKey(a: UUID, b: UUID): String =
            listOf(a.uuidString(), b.uuidString()).sorted().joinToString("|")

        private fun computeLineage(events: List<LogEvent>, byId: Map<UUID, LogEvent>): Map<UUID, UUID> {
            val out = mutableMapOf<UUID, UUID>()
            for (e in events) {
                var root = e.id
                var cur = e
                var hops = 0
                while (hops < 64) {
                    val s = cur.supersedes ?: break
                    val next = byId[s] ?: break
                    root = next.id
                    cur = next
                    hops += 1
                }
                out[e.id] = root
            }
            return out
        }

        internal fun pairSessions(events: List<LogEvent>, registry: EventRegistry): List<Session> {
            val sessions = mutableListOf<Session>()
            val open = mutableMapOf<Session.Kind, Int>()

            fun kindFor(type: String): Session.Kind? = when {
                type.startsWith("feed.bottle") -> Session.Kind.BOTTLE
                type.startsWith("feed.breast") -> Session.Kind.BREAST
                type.startsWith("sleep") -> Session.Kind.SLEEP
                else -> null
            }

            for (e in events) {
                val k = kindFor(e.type) ?: continue
                if (e.type == "feed.bottle.single") {
                    sessions.add(
                        Session(
                            kind = Session.Kind.BOTTLE,
                            babyId = e.babyId,
                            start = e.occurredAt,
                            end = e.occurredAt,
                            startEvent = e.id,
                            endEvent = e.id,
                            consumedFraction = e.number("consumed_fraction"),
                            consumedMl = e.number("consumed_ml"),
                            contents = e.string("contents")
                        )
                    )
                    continue
                }
                val role = registry.type(e.type)?.session?.role ?: "start"
                when (role) {
                    "start" -> {
                        open[k]?.let { i ->
                            sessions[i].abandoned = true
                            open.remove(k)
                        }
                        val s = Session(kind = k, babyId = e.babyId, start = e.occurredAt, startEvent = e.id, contents = e.string("contents"))
                        e.string("side")?.let { s.sides.add(it) }
                        sessions.add(s)
                        open[k] = sessions.size - 1
                    }
                    "switch" -> {
                        val i = open[k]
                        if (i != null) {
                            sessions[i].switchEvents.add(e.id)
                            e.string("side")?.let { sessions[i].sides.add(it) }
                        } else {
                            val s = Session(kind = k, babyId = e.babyId, start = e.occurredAt, startEvent = e.id)
                            e.string("side")?.let { s.sides.add(it) }
                            sessions.add(s)
                            open[k] = sessions.size - 1
                        }
                    }
                    else -> { // finish
                        val i = open[k]
                        if (i != null) {
                            sessions[i].end = e.occurredAt
                            sessions[i].endEvent = e.id
                            sessions[i].consumedFraction = e.number("consumed_fraction")
                            sessions[i].consumedMl = e.number("consumed_ml")
                            val c = e.string("contents")
                            if (c != null && sessions[i].contents == null) sessions[i].contents = c
                            open.remove(k)
                        } else {
                            sessions.add(
                                Session(
                                    kind = k,
                                    babyId = e.babyId,
                                    start = null,
                                    end = e.occurredAt,
                                    endEvent = e.id,
                                    consumedFraction = e.number("consumed_fraction"),
                                    consumedMl = e.number("consumed_ml"),
                                    contents = e.string("contents")
                                )
                            )
                        }
                    }
                }
            }
            return sessions
        }
    }
}

data class ShiftSummary(
    val caregiver: UUID?,
    val startedAt: Date,
    val endedAt: Date,
    val feedCount: Int,
    val bottleMl: Double,
    val wetDiapers: Int,
    val dirtyDiapers: Int,
    val sleepSeconds: Double,
    val sleepStretches: Int,
    val medications: List<MedEntry>,
    val notes: List<NoteEntry>,
) {
    data class MedEntry(val id: UUID, val medicine: String, val dose: String?, val occurredAt: Date)
    data class NoteEntry(val id: UUID, val text: String, val occurredAt: Date, val by: UUID)
}

data class MilkStash(
    val fridgeMl: Double,
    val freezerMl: Double,
    val fridgeLots: Int,
    val freezerBags: Int,
    val oldestFridgeAt: Date?,
    val oldestFreezerAt: Date?,
    val batches: List<Batch> = emptyList(),
    val expiringSoonCount: Int = 0,
    val expiredCount: Int = 0,
) {
    data class Batch(
        val ml: Double,
        val at: Date,
        val location: String,
        val expiresAt: Date,
        val isExpiringSoon: Boolean,
        val isExpired: Boolean,
    ) {
        val id: String get() = "$location-${at.time / 1000}-${ml.toInt()}"
    }
}

data class SolidsSummary(
    val triedFoods: List<String>,
    val foodCounts: Map<String, Int>,
    val allergenCounts: Map<String, Int>,
    val reactions: List<ReactionRecord>,
) {
    data class AllergenSpec(val key: String, val label: String, val keywords: List<String>)
    data class ReactionRecord(val id: UUID, val foods: String, val reaction: String, val occurredAt: Date)

    companion object {
        val topAllergens: List<AllergenSpec> = listOf(
            AllergenSpec("egg", "Egg", listOf("egg")),
            AllergenSpec("peanut", "Peanut", listOf("peanut")),
            AllergenSpec("dairy", "Dairy", listOf("yogurt", "cheese", "milk", "butter", "dairy", "cottage")),
            AllergenSpec("tree_nut", "Tree nut", listOf("almond", "cashew", "walnut", "pecan", "hazelnut", "pistachio")),
            AllergenSpec("soy", "Soy", listOf("tofu", "soy", "edamame")),
            AllergenSpec("wheat", "Wheat", listOf("wheat", "bread", "toast", "pasta", "noodle", "cereal", "oatmeal")),
            AllergenSpec("fish", "Fish", listOf("salmon", "cod", "tuna", "fish", "tilapia", "sardine")),
            AllergenSpec("shellfish", "Shellfish", listOf("shrimp", "prawn", "crab", "lobster", "shellfish")),
            AllergenSpec("sesame", "Sesame", listOf("sesame", "tahini", "hummus"))
        )
    }
}

data class DoctorVisitPack(
    val lastVisitAt: Date?,
    val lastVisitReason: String?,
    val latestWeightGrams: Double?,
    val weightDeltaGrams: Double?,
    val latestHeightCm: Double?,
    val heightDeltaCm: Double?,
    val latestHeadCm: Double?,
    val headDeltaCm: Double?,
    val feedsPerDay7d: Double,
    val bottleMlPerDay7d: Double,
    val wetDiapersPerDay7d: Double,
    val dirtyDiapersPerDay7d: Double,
    val healthEvents: List<LogEvent>,
    val questions: List<LogEvent>,
) {
    fun plainTextSummary(babyName: String, household: Household): String {
        val df = DateFormat.getDateInstance(DateFormat.MEDIUM, Locale.US)
        val tf = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT, Locale.US)
        val lines = mutableListOf("$babyName — Pediatrician Fact Sheet")
        if (lastVisitAt != null) {
            lines.add("Since last visit on ${df.format(lastVisitAt)}:")
        } else {
            lines.add("Recent 7-day summary:")
        }
        val meas = mutableListOf<String>()
        latestWeightGrams?.let { w ->
            val d = weightDeltaGrams?.let { String.format(Locale.US, " (%+.0f g)", it) } ?: ""
            meas.add(String.format(Locale.US, "Weight: %.2f kg%s", w / 1000.0, d))
        }
        latestHeightCm?.let { h ->
            val d = heightDeltaCm?.let { String.format(Locale.US, " (%+.1f cm)", it) } ?: ""
            meas.add(String.format(Locale.US, "Length: %.1f cm%s", h, d))
        }
        latestHeadCm?.let { hd ->
            val d = headDeltaCm?.let { String.format(Locale.US, " (%+.1f cm)", it) } ?: ""
            meas.add(String.format(Locale.US, "Head: %.1f cm%s", hd, d))
        }
        if (meas.isNotEmpty()) lines.add("• " + meas.joinToString(" · "))
        lines.add(String.format(Locale.US, "• Feeds (7d avg): %.1f/day · %.0f ml/day bottle", feedsPerDay7d, bottleMlPerDay7d))
        lines.add(String.format(Locale.US, "• Diapers (7d avg): %.1f wet/day · %.1f dirty/day", wetDiapersPerDay7d, dirtyDiapersPerDay7d))
        if (healthEvents.isNotEmpty()) {
            val summary = healthEvents.takeLast(5).joinToString("; ") {
                "${VoiceInterpreter.label(it.type, it.fields)} (${tf.format(it.occurredAt)})"
            }
            lines.add("• Health entries: $summary")
        }
        if (questions.isNotEmpty()) {
            lines.add("Questions for the doctor:")
            for (q in questions) {
                val text = q.string("transcript") ?: q.provenance.rawTranscript ?: ""
                if (text.isNotEmpty()) lines.add("  - $text")
            }
        }
        return lines.joinToString("\n")
    }
}
