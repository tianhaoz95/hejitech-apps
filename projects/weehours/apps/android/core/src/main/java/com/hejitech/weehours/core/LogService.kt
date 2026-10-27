package com.hejitech.weehours.core

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.util.Date
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

interface Transcriber {
    suspend fun transcribe(file: File): String
    suspend fun transcribeSpoken(file: File): Pair<String, String?> = transcribe(file) to null
    suspend fun warmUp() {}
}

object VoiceTranscript {
    fun display(english: String, spoken: String?): String {
        val eng = english.trim()
        val spk = spoken?.trim()
        if (spk.isNullOrEmpty() || spk.lowercase() == eng.lowercase()) return eng
        if (eng.isEmpty()) return spk
        return "$spk ($eng)"
    }
}

class LogService(
    val store: LogStore,
    household: Household,
    val me: UUID,
    interpreter: VoiceInterpreter,
    transcriber: Transcriber? = null,
    backend: SupabaseClient? = null,
    private val registry: EventRegistry = EventRegistry.shared
) {
    private val mutex = Mutex()

    @Volatile
    var household: Household = household
        private set

    @Volatile
    var interpreter: VoiceInterpreter = interpreter
        private set

    @Volatile
    var transcriber: Transcriber? = transcriber
        private set

    @Volatile
    var backend: SupabaseClient? = backend
        private set

    fun setInterpreter(i: VoiceInterpreter) {
        interpreter = i
    }

    fun setTranscriber(t: Transcriber?) {
        transcriber = t
    }

    fun setBackend(b: SupabaseClient?) {
        backend = b
    }

    fun setHousehold(h: Household) {
        household = h
    }

    sealed class LogError(message: String) : Exception(message) {
        class UnknownType(val type: String) : LogError("Unknown entry type $type")
        class DisabledCategory(val category: String) : LogError("$category logging is turned off for this household")
        class InvalidField(val field: String) : LogError("Invalid value for $field")
    }

    fun derived(asOf: Date? = null, baby: UUID? = null): DerivedLog =
        DerivedLog(events = store.events(), registry = registry, asOf = asOf, baby = baby)

    fun derivedByChild(babies: List<Baby>? = null): List<Pair<Baby, DerivedLog>> {
        val events = store.events()
        return (babies ?: household.active).map { it to DerivedLog(events = events, registry = registry, baby = it.id) }
    }

    fun status(baby: UUID? = null, now: Date = Date()): StatusSnapshot {
        val caps = store.captures()
        val single = household.active.size == 1
        return StatusSnapshot(
            log = derived(baby = baby ?: household.babyId),
            now = now,
            pendingCaptures = if (single) caps.count { it.status == Capture.Status.PENDING } else 0,
            pendingPicks = if (single) caps.count { it.status == Capture.Status.NEEDS_REVIEW } else 0
        )
    }

    fun log(
        type: String,
        fields: Map<String, FieldValue> = emptyMap(),
        occurredAt: Date = Date(),
        provenance: Provenance,
        supersedes: UUID? = null,
        id: UUID = UUID.randomUUID(),
        sessionId: UUID? = null,
        loggedBy: UUID? = null,
        baby: UUID? = null
    ): LogEvent {
        if (!SystemType.all.contains(type)) {
            val spec = registry.type(type) ?: throw LogError.UnknownType(type)
            if (!household.enabled.contains(spec.category)) throw LogError.DisabledCategory(spec.category)
            validate(type = type, fields = fields)
        }
        val e = LogEvent(
            id = id,
            householdId = household.id,
            babyId = baby ?: household.babyId,
            type = type,
            fields = fields,
            occurredAt = occurredAt,
            loggedAt = Date(),
            loggedBy = loggedBy ?: me,
            provenance = provenance,
            supersedes = supersedes,
            sessionId = sessionId
        )
        store.append(e)
        return e
    }

    fun validate(type: String, fields: Map<String, FieldValue>) {
        val allowed: Map<String, Set<String>> = mapOf(
            "side" to setOf("left", "right", "both"),
            "contents" to setOf("formula", "breast_milk"),
            "kind" to setOf("wet", "dirty", "both", "dry"),
            "amount" to setOf("taste", "some", "most", "all"),
            "storage" to setOf("fridge", "freezer", "fed"),
            "reaction" to setOf("none", "rash", "hives", "vomiting", "diarrhea", "gas", "spit_up"),
            "stool_color" to StoolColor.entries.map { it.rawValue }.toSet()
        )
        for ((k, v) in fields) {
            val set = allowed[k]
            if (set != null && (v.string == null || !set.contains(v.string))) {
                throw LogError.InvalidField(k)
            }
            if (k == "consumed_fraction") {
                val n = v.number ?: -1.0
                if (!(n > 0.0 && n <= 1.0)) throw LogError.InvalidField(k)
            }
            if (k in setOf("consumed_ml", "amount_ml", "grams", "height_cm", "head_cm")) {
                val n = v.number ?: -1.0
                if (n <= 0.0) throw LogError.InvalidField(k)
            }
        }
        if (type == "diaper" && fields["kind"] == null && fields[LogEvent.NEEDS_DETAILS] != FieldValue.Bool(true)) {
            throw LogError.InvalidField("kind")
        }
        if (type == "weight" && fields["grams"] == null) throw LogError.InvalidField("grams")
        if (type == "height" && fields["height_cm"] == null) throw LogError.InvalidField("height_cm")
        if (type == "head" && fields["head_cm"] == null) throw LogError.InvalidField("head_cm")

        for (f in registry.type(type)?.fields ?: emptyList()) {
            val v = fields[f.key]
            if (v == null) {
                if (f.isRequired) throw LogError.InvalidField(f.key)
                continue
            }
            when (f.kind) {
                "choice" -> {
                    val s = v.string
                    if (s == null || f.options?.any { it.key == s } != true) throw LogError.InvalidField(f.key)
                }
                "number" -> {
                    if ((v.number ?: -1.0) <= 0.0) throw LogError.InvalidField(f.key)
                }
                else -> {
                    if ((v.string ?: "").trim().isEmpty()) throw LogError.InvalidField(f.key)
                }
            }
        }
    }

    fun undo(id: UUID, surface: Surface = Surface.PHONE): LogEvent {
        val target = store.events().firstOrNull { it.id == id }
        return log(
            type = SystemType.UNDO,
            provenance = Provenance(surface = surface, input = InputKind.TAP),
            supersedes = id,
            baby = target?.babyId
        )
    }

    fun edit(
        id: UUID,
        fields: Map<String, FieldValue>,
        occurredAt: Date? = null,
        baby: UUID? = null,
        surface: Surface = Surface.PHONE
    ): LogEvent {
        val old = store.events().firstOrNull { it.id == id } ?: throw LogError.InvalidField("id")
        val p = old.provenance.copy(surface = surface, input = InputKind.TAP)
        return log(
            type = old.type,
            fields = fields,
            occurredAt = occurredAt ?: old.occurredAt,
            provenance = p,
            supersedes = id,
            sessionId = old.sessionId,
            baby = baby ?: old.babyId
        )
    }

    fun startTimed(
        type: String,
        at: Date = Date(),
        baby: UUID? = null,
        fields: Map<String, FieldValue> = emptyMap(),
        surface: Surface = Surface.PHONE,
        input: InputKind = InputKind.TAP
    ): LogEvent {
        val merged = fields.toMutableMap().apply { put("ongoing", FieldValue.Bool(true)) }
        return log(
            type = type,
            fields = merged,
            occurredAt = at,
            provenance = Provenance(surface = surface, input = input),
            baby = baby
        )
    }

    fun stopTimed(id: UUID, at: Date = Date(), surface: Surface = Surface.PHONE): LogEvent {
        val e = store.events().firstOrNull { it.id == id } ?: throw LogError.InvalidField("id")
        val fields = e.fields.toMutableMap()
        fields.remove("ongoing")
        val mins = max(1.0, ((at.time - e.occurredAt.time) / 60_000.0).roundToInt().toDouble())
        fields["minutes"] = FieldValue.Num(mins)
        return edit(id = id, fields = fields, surface = surface)
    }

    fun resolveDuplicate(original: UUID, duplicate: UUID, merge: Boolean, surface: Surface = Surface.PHONE): LogEvent =
        log(
            type = SystemType.RESOLVE,
            fields = mapOf(
                "original" to FieldValue.Str(original.uuidString()),
                "duplicate" to FieldValue.Str(duplicate.uuidString()),
                "resolution" to FieldValue.Str(if (merge) "merge" else "keep_both")
            ),
            provenance = Provenance(surface = surface, input = InputKind.TAP)
        )

    fun setOnDuty(caregiver: UUID?, surface: Surface = Surface.PHONE): LogEvent =
        log(
            type = SystemType.DUTY,
            fields = if (caregiver != null) mapOf("caregiver" to FieldValue.Str(caregiver.uuidString())) else emptyMap(),
            provenance = Provenance(surface = surface, input = InputKind.TAP)
        )

    fun toggleFeed(
        baby: UUID? = null,
        surface: Surface,
        input: InputKind = InputKind.TAP,
        now: Date = Date(),
        fields: Map<String, FieldValue> = emptyMap()
    ): LogEvent {
        val targetBaby = baby ?: household.babyId
        val log = derived(baby = targetBaby)
        val p = Provenance(surface = surface, input = input)
        val open = log.openFeedSession()
        if (open != null) {
            return this.log(
                type = if (open.kind == Session.Kind.BOTTLE) "feed.bottle.finish" else "feed.breast.finish",
                fields = fields,
                occurredAt = now,
                provenance = p,
                baby = targetBaby
            )
        }
        if (household.defaultFeed(targetBaby) == "breast" && household.enabled.contains("breast")) {
            val side = StatusSnapshot(log = log, now = now).nextSide ?: "left"
            val merged = mapOf("side" to FieldValue.Str(side)) + fields
            return this.log(type = "feed.breast.start", fields = merged, occurredAt = now, provenance = p, baby = targetBaby)
        }
        return this.log(type = "feed.bottle.start", fields = fields, occurredAt = now, provenance = p, baby = targetBaby)
    }

    fun toggleSleep(
        baby: UUID? = null,
        surface: Surface,
        input: InputKind = InputKind.TAP,
        now: Date = Date(),
        fields: Map<String, FieldValue> = emptyMap()
    ): LogEvent {
        val targetBaby = baby ?: household.babyId
        val open = derived(baby = targetBaby).openSession(Session.Kind.SLEEP) != null
        return log(
            type = if (open) "sleep.end" else "sleep.start",
            fields = fields,
            occurredAt = now,
            provenance = Provenance(surface = surface, input = input),
            baby = targetBaby
        )
    }

    fun switchSide(
        baby: UUID? = null,
        surface: Surface,
        input: InputKind = InputKind.TAP,
        now: Date = Date(),
        fields: Map<String, FieldValue> = emptyMap()
    ): LogEvent? {
        val targetBaby = baby ?: household.babyId
        val log = derived(baby = targetBaby)
        val open = log.openSession(Session.Kind.BREAST) ?: return null
        val next = if (open.sides.lastOrNull() == "left") "right" else "left"
        val merged = mapOf("side" to FieldValue.Str(next)) + fields
        return this.log(
            type = "feed.breast.switch",
            fields = merged,
            occurredAt = now,
            provenance = Provenance(surface = surface, input = input),
            baby = targetBaby
        )
    }

    fun forEach(babies: List<UUID>, body: (LogService, UUID, Map<String, FieldValue>) -> LogEvent?): List<LogEvent> {
        val group: Map<String, FieldValue> = if (babies.size > 1) mapOf("group" to FieldValue.Str(UUID.randomUUID().uuidString())) else emptyMap()
        return babies.mapNotNull { body(this, it, group) }
    }

    fun undoGroup(id: UUID, surface: Surface = Surface.PHONE): List<LogEvent> {
        val all = derived()
        val e = all.all.firstOrNull { it.id == id }
        val group = e?.string("group") ?: return listOf(undo(id, surface))
        return all.all.filter { it.string("group") == group && all.status[it.id] != EventStatus.UNDONE }
            .map { undo(it.id, surface) }
    }

    fun attachPhoto(
        id: UUID = UUID.randomUUID(),
        to: LogEvent,
        width: Int,
        height: Int,
        takenAt: Date? = null,
        surface: Surface = Surface.PHONE
    ): LogEvent {
        val fields = mutableMapOf<String, FieldValue>(
            LogEvent.PHOTO_ENTRY to FieldValue.Str(to.id.uuidString()),
            "path" to FieldValue.Str(EntryPhoto.path(id)),
            "width" to FieldValue.Num(width.toDouble()),
            "height" to FieldValue.Num(height.toDouble())
        )
        if (takenAt != null) {
            fields["taken_at"] = FieldValue.Str(LogCoding.isoString(takenAt))
        }
        return log(
            type = SystemType.PHOTO,
            fields = fields,
            provenance = Provenance(surface = surface, input = InputKind.TAP),
            id = id,
            baby = to.babyId
        )
    }

    data class VoiceResult(
        val capture: Capture,
        val interpretation: Interpretation,
        val events: List<LogEvent>
    ) {
        val committed: LogEvent? get() = events.firstOrNull()
    }

    suspend fun processVoice(
        transcript: String,
        spoken: String? = null,
        surface: Surface,
        capturedAt: Date = Date(),
        attachTo: UUID? = null,
        captureId: UUID = UUID.randomUUID(),
        loggedBy: UUID? = null,
        babies: List<UUID>? = null,
        quickCapture: Boolean = false
    ): VoiceResult = mutex.withLock {
        val current = (babies ?: emptyList()).filter { id -> household.active.any { it.id == id } }
        val targets = Parsers.children(transcript, household.active)
            ?: if (current.isEmpty()) listOf(household.babyId) else current
        val asOf = derived(asOf = capturedAt, baby = targets[0])
        val ctx = InterpretContext(
            reference = capturedAt,
            log = asOf,
            enabledCategories = household.enabled,
            bottleMl = household.bottleMl(targets[0])
        )
        val interp = interpreter.interpret(transcript, ctx).apply {
            babyIds = targets
        }
        var capture = Capture(
            id = captureId,
            householdId = household.id,
            surface = surface,
            capturedAt = capturedAt,
            loggedBy = loggedBy ?: me,
            transcript = VoiceTranscript.display(english = transcript, spoken = spoken),
            attachTo = attachTo,
            babyId = current.firstOrNull(),
            status = Capture.Status.NEEDS_REVIEW,
            interpretation = interp,
            processedBy = me,
            processedAt = Date()
        )
        var events = emptyList<LogEvent>()
        val noneWon = interp.noneConfidence != null
        val best = interp.best
        if (best != null && !noneWon && (interp.tier == ConfidenceTier.AUTO || quickCapture)) {
            events = commit(best, capture, interp)
            capture.status = Capture.Status.DONE
        }
        store.saveCapture(capture, synced = false)
        if (noneWon && (interp.isNotALog(registry.policy) || quickCapture)) {
            val note = dismissCapture(captureId)
            if (note != null) {
                capture.status = Capture.Status.DISMISSED
                events = listOf(note)
            }
        }
        VoiceResult(capture = capture, interpretation = interp, events = events)
    }

    fun reopenCapture(id: UUID, undoing: List<UUID>) {
        val capture = store.captures().firstOrNull { it.id == id } ?: return
        for (e in undoing) undo(e)
        capture.status = Capture.Status.NEEDS_REVIEW
        store.saveCapture(capture, synced = false)
    }

    fun resolveCapture(id: UUID, candidate: Int): List<LogEvent> {
        val capture = store.captures().firstOrNull { it.id == id } ?: return emptyList()
        val interp = capture.interpretation ?: return emptyList()
        if (candidate !in interp.candidates.indices) return emptyList()
        val chosen = interp.candidates[candidate].copy(probability = 1.0)
        val events = commit(chosen, capture, interp, interp.tier)
        capture.status = Capture.Status.DONE
        store.saveCapture(capture, synced = false)
        return events
    }

    fun dismissCapture(id: UUID): LogEvent? {
        val capture = store.captures().firstOrNull { it.id == id } ?: return null
        val text = capture.transcript ?: ""
        val noteFields = mutableMapOf<String, FieldValue>("transcript" to FieldValue.Str(text))
        if (Parsers.isDoctorQuestion(text)) noteFields["for_doctor"] = FieldValue.Bool(true)
        val e = log(
            type = SystemType.NOTE,
            fields = noteFields,
            occurredAt = capture.capturedAt,
            provenance = Provenance(
                surface = capture.surface,
                input = InputKind.VOICE,
                rawTranscript = capture.transcript,
                confidenceTier = ConfidenceTier.FULL_LIST,
                modelVersion = capture.interpretation?.modelVersion,
                captureId = capture.id
            ),
            id = capture.eventId
        )
        capture.status = Capture.Status.DISMISSED
        store.saveCapture(capture, synced = false)
        return e
    }

    fun discardCapture(id: UUID): LogEvent? {
        val note = dismissCapture(id) ?: return null
        return undo(note.id)
    }

    private fun commit(
        c: Candidate,
        capture: Capture,
        interpretation: Interpretation,
        tier: ConfidenceTier? = null
    ): List<LogEvent> {
        val provenance = Provenance(
            surface = capture.surface,
            input = InputKind.VOICE,
            rawTranscript = capture.transcript ?: interpretation.transcript,
            confidence = interpretation.confidence,
            confidenceTier = tier ?: interpretation.tier,
            modelVersion = interpretation.modelVersion,
            captureId = capture.id
        )
        val target = capture.attachTo
        if (target != null) {
            val old = store.events().firstOrNull { it.id == target }
            if (old != null) {
                val supported = (registry.type(old.type)?.questions ?: emptyList()).toSet()
                val fields = old.fields.toMutableMap()
                for ((k, v) in c.fields) {
                    val q = fieldQuestion[k]
                    if (q != null && supported.contains(q)) {
                        fields[k] = v
                    }
                }
                return listOf(
                    log(
                        type = old.type,
                        fields = fields,
                        occurredAt = old.occurredAt,
                        provenance = provenance,
                        supersedes = old.id,
                        id = capture.eventId,
                        sessionId = old.sessionId,
                        loggedBy = capture.loggedBy,
                        baby = old.babyId
                    )
                )
            }
        }
        val babies = interpretation.babyIds ?: listOf(household.babyId)
        val fields = c.fields.toMutableMap()
        if (babies.size > 1) fields["group"] = FieldValue.Str(capture.id.uuidString())
        return babies.mapIndexed { i, baby ->
            log(
                type = c.type,
                fields = fields,
                occurredAt = c.occurredAt,
                provenance = provenance,
                id = if (i == 0) capture.eventId else deriveUuid(capture.id, "capture-event-${baby.uuidString()}"),
                loggedBy = capture.loggedBy,
                baby = baby
            )
        }
    }

    data class SyncReport(
        var pushed: Int = 0,
        var pulled: Int = 0,
        var processedCaptures: Int = 0
    )

    suspend fun sync(): SyncReport {
        val b = backend ?: return SyncReport()
        val report = SyncReport()
        val outbox = store.unsyncedEvents()
        b.pushEvents(outbox)
        store.markSynced(outbox.map { it.id })
        report.pushed = outbox.size

        val caps = store.unsyncedCaptures()
        b.pushCaptures(caps)
        for (c in caps) store.saveCapture(c, synced = true)

        var cursor = store.value("seq")?.toLongOrNull() ?: 0L
        while (true) {
            val (events, next) = b.pullEvents(household = household.id, after = cursor)
            store.upsertRemote(events)
            report.pulled += events.size
            if (next == cursor || events.isEmpty()) break
            cursor = next
            store.setValue(cursor.toString(), "seq")
        }
        report.processedCaptures = processRemoteCaptures()
        return report
    }

    suspend fun processRemoteCaptures(): Int {
        val b = backend ?: return 0
        val remote = b.openCaptures(household = household.id)
        var processed = 0
        for (c in remote) {
            if (c.status == Capture.Status.NEEDS_REVIEW) {
                store.saveCapture(c, synced = true)
                continue
            }
            var transcript = c.transcript
            var spoken: String? = null
            val path = c.audioPath
            val tr = transcriber
            if (transcript == null && path != null && tr != null) {
                val audio = b.downloadAudio(path)
                val tempFile = File.createTempFile("capture-${c.id}", ".wav")
                try {
                    tempFile.writeBytes(audio)
                    val res = tr.transcribeSpoken(tempFile)
                    transcript = res.first
                    spoken = res.second
                } finally {
                    tempFile.delete()
                }
            }
            if (transcript == null) continue
            val r = processVoice(
                transcript = transcript,
                spoken = spoken,
                surface = c.surface,
                capturedAt = c.capturedAt,
                attachTo = c.attachTo,
                captureId = c.id,
                loggedBy = c.loggedBy,
                babies = c.babyId?.let { listOf(it) }
            )
            val done = r.capture.copy(audioPath = null)
            store.saveCapture(done, synced = false)
            if (path != null) {
                runCatching { b.deleteAudio(path) }
            }
            processed += 1
        }
        if (processed > 0) {
            val caps = store.unsyncedCaptures()
            b.pushCaptures(caps)
            for (c in caps) store.saveCapture(c, synced = true)
            val outbox = store.unsyncedEvents()
            b.pushEvents(outbox)
            store.markSynced(outbox.map { it.id })
        }
        return processed
    }

    companion object {
        val fieldQuestion: Map<String, String> = mapOf(
            "consumed_fraction" to "amount",
            "consumed_ml" to "amount",
            "side" to "side",
            "contents" to "contents",
            "kind" to "diaper_kind",
            "amount" to "solids_amount"
        )
    }
}
