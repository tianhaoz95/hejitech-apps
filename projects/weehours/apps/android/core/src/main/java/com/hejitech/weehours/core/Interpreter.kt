package com.hejitech.weehours.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

@Serializable
data class Candidate(
    var type: String,
    var fields: Map<String, FieldValue>,
    @SerialName("occurred_at") @Serializable(with = DateIsoSerializer::class) var occurredAt: Date,
    var probability: Double,
    var label: String
)

@Serializable
data class Interpretation(
    var transcript: String,
    @SerialName("model_version") var modelVersion: String,
    var tier: ConfidenceTier,
    var candidates: List<Candidate>,
    var confidence: Map<String, Double>,
    @SerialName("deciding_question") var decidingQuestion: String? = null,
    @Serializable(with = DateIsoSerializer::class) var reference: Date,
    @SerialName("baby_ids") var babyIds: List<@Serializable(with = UUIDSerializer::class) UUID>? = null,
    @SerialName("none_confidence") var noneConfidence: Double? = null
) {
    val best: Candidate? get() = candidates.firstOrNull()
    val isNote: Boolean get() = candidates.isEmpty()

    fun isNotALog(policy: EventRegistry.Policy): Boolean =
        tier == ConfidenceTier.FULL_LIST && (noneConfidence ?: 0.0) >= policy.auto
}

data class InterpretContext(
    var reference: Date,
    var log: DerivedLog,
    var enabledCategories: Set<String>,
    var bottleMl: Double = 120.0,
    var useContextPrior: Boolean = true
)

class VoiceInterpreter(
    val model: DecisionModel,
    val registry: EventRegistry = EventRegistry.shared,
    val calibration: Calibration = Calibration.identity,
    val design: Design = Design.HIERARCHICAL
) {
    enum class Design(val rawValue: String) {
        FLAT("flat"),
        HIERARCHICAL("hierarchical")
    }

    fun questions(context: InterpretContext): List<DecisionQuestion> {
        val types = registry.modelTypes(context.enabledCategories)
        val qs = mutableListOf<DecisionQuestion>()
        when (design) {
            Design.FLAT -> {
                val typeOptions = types.filter { registry.category(it.category)?.group == null }
                    .map { DecisionQuestion.Option(key = it.id, description = it.voice) }
                    .toMutableList()
                typeOptions.add(DecisionQuestion.Option(key = noneKey, description = noneDescription))
                qs.add(
                    DecisionQuestion(
                        id = "event_type",
                        instructions = registry.questions["event_type"]?.instructions ?: "Which entry?",
                        options = typeOptions
                    )
                )
            }
            Design.HIERARCHICAL -> {
                val groups = registry.modelGroups(context.enabledCategories)
                val catOptions = groups.map { DecisionQuestion.Option(key = it.first.id, description = it.first.voice) }.toMutableList()
                catOptions.add(DecisionQuestion.Option(key = noneKey, description = noneDescription))
                qs.add(
                    DecisionQuestion(
                        id = "category",
                        instructions = registry.questions["category"]?.instructions ?: "What is it about?",
                        options = catOptions
                    )
                )
                val roles = types.mapNotNull { role(it) }.toSet()
                val phase = registry.questions["phase"]
                if (phase != null) {
                    val opts = phase.options.filter { roles.contains(it.key) }
                        .map { DecisionQuestion.Option(key = it.key, description = it.spec.description) }
                    if (opts.size > 1) {
                        qs.add(DecisionQuestion(id = "phase", instructions = phase.instructions, options = opts))
                    }
                }
                for ((g, cats) in groups) {
                    if (cats.size > 1) {
                        qs.add(
                            DecisionQuestion(
                                id = EventRegistry.entryQuestion(g.id),
                                instructions = g.entry ?: "Which is it?",
                                options = cats.map { DecisionQuestion.Option(key = it.id, description = it.voice ?: it.label) }
                            )
                        )
                    }
                }
            }
        }
        val needed = types.flatMap { it.questions }.toSet()
        for (qid in listOf("amount", "side", "contents", "diaper_kind", "solids_amount")) {
            if (!needed.contains(qid)) continue
            val spec = registry.questions[qid] ?: continue
            qs.add(
                DecisionQuestion(
                    id = qid,
                    instructions = spec.instructions,
                    options = spec.options.map { DecisionQuestion.Option(key = it.key, description = it.spec.description) }
                )
            )
        }
        return qs
    }

    suspend fun interpret(transcript: String, context: InterpretContext): Interpretation {
        val raw = rawAnswers(transcript, context)
        return interpret(raw = raw, transcript = transcript, context = context)
    }

    suspend fun rawAnswers(transcript: String, context: InterpretContext): Map<String, DecisionAnswer> =
        model.decide(DecisionRequest(state = transcript, questions = questions(context)))

    fun interpret(raw: Map<String, DecisionAnswer>, transcript: String, context: InterpretContext): Interpretation {
        val answers = mutableMapOf<String, DecisionAnswer>()
        for ((k, v) in raw) answers[k] = calibration.apply(v, k)
        if (design == Design.HIERARCHICAL) {
            answers["event_type"] = combine(answers, context, transcript)
        }
        if (context.useContextPrior) {
            answers["event_type"]?.let { a ->
                answers["event_type"] = ContextPrior.apply(a, context.log)
            }
        }
        return build(transcript = transcript, answers = answers, context = context)
    }

    fun combine(answers: Map<String, DecisionAnswer>, context: InterpretContext, transcript: String = ""): DecisionAnswer {
        val measure = Parsers.growthMeasure(transcript)
        val types = registry.modelTypes(context.enabledCategories)
        val cat = answers["category"] ?: return DecisionAnswer(listOf(noneKey), listOf(1.0))
        val phase = answers["phase"]
        val keys = mutableListOf<String>()
        val probs = mutableListOf<Double>()
        val groups = registry.modelGroups(context.enabledCategories)
        for (g in cat.options) {
            if (g == noneKey) continue
            val cats = groups.firstOrNull { it.first.id == g }?.second ?: continue
            val entry = answers[EventRegistry.entryQuestion(g)]
            for (c in cats.map { it.id }) {
                val pc = if (cats.size == 1) 1.0 else max(entry?.p(c) ?: (1.0 / cats.size.toDouble()), 1e-6)
                val inCat = types.filter { it.category == c }
                val weights = inCat.map { t ->
                    if (inCat.size <= 1) 1.0
                    else if (c == "growth") measure?.let { if (it == t.id) 1.0 else 1e-6 } ?: 1.0
                    else {
                        val r = role(t)
                        if (r != null && phase != null) max(phase.p(r), 1e-6) else 1.0
                    }
                }
                val total = weights.sum()
                for ((t, w) in inCat.zip(weights)) {
                    keys.add(t.id)
                    probs.add(cat.p(g) * pc * w / total)
                }
            }
        }
        keys.add(noneKey)
        probs.add(cat.p(noneKey))
        val s = probs.sum()
        return DecisionAnswer(keys, probs.map { it / max(s, 1e-12) })
    }

    fun build(transcript: String, answers: Map<String, DecisionAnswer>, context: InterpretContext): Interpretation {
        val version = model.version
        val typeAnswer = answers["event_type"] ?: return Interpretation(
            transcript = transcript,
            modelVersion = version,
            tier = ConfidenceTier.FULL_LIST,
            candidates = emptyList(),
            confidence = emptyMap(),
            decidingQuestion = "event_type",
            reference = context.reference
        )
        val rankedTypes = typeAnswer.ranked()
        val explicitTime = Parsers.explicitTime(transcript, context.reference)

        fun candidate(type: String, typeP: Double, override: Pair<String, String>? = null): Pair<Candidate, Map<String, Double>>? {
            val spec = registry.type(type) ?: return null
            val fields = mutableMapOf<String, FieldValue>()
            val conf = mutableMapOf("event_type" to typeP)
            var occurred = context.reference
            var ok = true
            if (spec.questions.contains("when")) {
                val m = Parsers.minutesAgo(transcript)
                when {
                    explicitTime != null -> {
                        occurred = explicitTime
                        conf["when"] = 1.0
                    }
                    m != null -> {
                        occurred = Date(context.reference.time - 60_000L * m)
                        conf["when"] = 1.0
                    }
                    else -> {
                        conf["when"] = if (Parsers.mentionsVagueTime(transcript)) 0.6 else 1.0
                    }
                }
            }
            for (qid in spec.questions) {
                if (qid == "when") continue
                val a = answers[qid] ?: continue
                val choice: Pair<String, Double> = if (override?.first == qid) {
                    override.second to a.p(override.second)
                } else {
                    a.top
                }
                when (qid) {
                    "amount" -> {
                        conf["amount"] = choice.second
                        val f = registry.questions["amount"]?.options?.firstOrNull { it.key == choice.first }?.spec?.fraction
                        if (f != null) fields["consumed_fraction"] = FieldValue.Num(f)
                    }
                    "side" -> {
                        conf["side"] = choice.second
                        if (choice.first == "not_stated") {
                            if (type.startsWith("feed.breast")) {
                                val next = StatusSnapshot(log = context.log, now = context.reference).nextSide
                                if (next != null) fields["side"] = FieldValue.Str(next)
                            }
                        } else if (choice.first == "both" && type.startsWith("feed.breast")) {
                            conf["side"] = min(choice.second, 0.5)
                        } else {
                            fields["side"] = FieldValue.Str(choice.first)
                        }
                    }
                    "contents" -> {
                        conf["contents"] = choice.second
                        if (choice.first != "not_stated") fields["contents"] = FieldValue.Str(choice.first)
                    }
                    "diaper_kind" -> {
                        if (choice.first == "not_stated") {
                            conf["diaper_kind"] = min(choice.second, 0.49)
                        } else {
                            conf["diaper_kind"] = choice.second
                            fields["kind"] = FieldValue.Str(choice.first)
                        }
                    }
                    "solids_amount" -> {
                        conf["solids_amount"] = choice.second
                        if (choice.first != "not_stated") fields["amount"] = FieldValue.Str(choice.first)
                    }
                }
            }
            for (n in spec.numbers ?: emptyList()) {
                when (n) {
                    "ml" -> Parsers.milliliters(transcript)?.let { fields["amount_ml"] = FieldValue.Num(it) }
                    "grams" -> {
                        val g = Parsers.grams(transcript)
                        if (g != null) fields["grams"] = FieldValue.Num(g) else ok = false
                    }
                    "height_cm", "head_cm" -> {
                        val cm = Parsers.centimeters(transcript)
                        if (cm != null) fields[n] = FieldValue.Num(cm) else ok = false
                    }
                }
            }
            if (type == "feed.bottle.finish" || type == "feed.bottle.single") {
                val ml = Parsers.milliliters(transcript)
                if (ml != null) {
                    fields["consumed_ml"] = FieldValue.Num(ml)
                    fields.remove("consumed_fraction")
                    conf["amount"] = 1.0
                }
            }
            if (type == "feed.solids") {
                val items = Parsers.foods(transcript)
                if (items.isNotEmpty()) fields["foods"] = FieldValue.Str(items.joinToString(", "))
                Parsers.reaction(transcript)?.let { fields["reaction"] = FieldValue.Str(it) }
            }
            if (type == "pump") {
                Parsers.milkStorage(transcript)?.let { fields["storage"] = FieldValue.Str(it) }
            }
            for (f in spec.fields ?: emptyList()) {
                if (!fields.containsKey(f.key) && (f.isRequired || f.kind != "text")) {
                    val v = Parsers.field(f, transcript)
                    if (v != null) fields[f.key] = v
                    else if (f.isRequired) ok = false
                }
            }
            if (!ok) conf["numbers"] = 0.0
            val label = label(type = type, fields = fields, registry = registry)
            val p = conf.values.fold(1.0) { acc, d -> acc * d }
            return Candidate(type = type, fields = fields, occurredAt = occurred, probability = p, label = label) to conf
        }

        val top = rankedTypes[0]
        val bestAndConf = if (top.first != noneKey) candidate(top.first, top.second) else null
        if (bestAndConf == null) {
            val all = rankedTypes.filter { it.first != noneKey }.mapNotNull { candidate(it.first, it.second)?.first }
            return Interpretation(
                transcript = transcript,
                modelVersion = version,
                tier = ConfidenceTier.FULL_LIST,
                candidates = all,
                confidence = mapOf("event_type" to top.second),
                decidingQuestion = "event_type",
                reference = context.reference,
                noneConfidence = if (top.first == noneKey) top.second else null
            )
        }

        val (best, conf) = bestAndConf
        val weakest = conf.entries.minByOrNull { it.value }!!
        val tier = when {
            weakest.value >= registry.policy.auto -> ConfidenceTier.AUTO
            weakest.value >= registry.policy.pick -> ConfidenceTier.PICK
            else -> ConfidenceTier.FULL_LIST
        }

        val candidates = mutableListOf(best)
        if (tier != ConfidenceTier.AUTO) {
            if (weakest.key == "event_type") {
                val others = rankedTypes.drop(1).filter { it.first != noneKey }
                val slice = if (tier == ConfidenceTier.PICK) others.take(1) else others
                for (t in slice) {
                    candidate(t.first, t.second)?.first?.let { candidates.add(it) }
                }
            } else {
                val a = answers[weakest.key]
                if (a != null) {
                    val alts = a.ranked().drop(1).filter { it.first != "not_stated" || weakest.key == "when" }
                    val slice = if (tier == ConfidenceTier.PICK) alts.take(1) else alts
                    for (alt in slice) {
                        val c = candidate(top.first, top.second, weakest.key to alt.first)?.first
                        if (c != null && candidates.none { it.fields == c.fields && it.occurredAt == c.occurredAt }) {
                            candidates.add(c)
                        }
                    }
                }
            }
        }
        return Interpretation(
            transcript = transcript,
            modelVersion = version,
            tier = tier,
            candidates = candidates,
            confidence = conf,
            decidingQuestion = weakest.key,
            reference = context.reference
        )
    }

    companion object {
        const val noneKey = "none_of_these"
        const val noneDescription = "not reporting a feed, diaper change, sleep, pumping or measurement: errands, shopping, chores, plans, questions, health or milestones"

        fun role(type: EventRegistry.EventType): String? {
            if (type.id == "feed.bottle.single") return "single"
            return type.session?.role
        }

        fun label(type: String, fields: Map<String, FieldValue>, registry: EventRegistry = EventRegistry.shared): String {
            var label = registry.type(type)?.label ?: type
            val details = mutableListOf<String>()
            fields["consumed_fraction"]?.number?.let { details.add(fractionText(it)) }
            (fields["consumed_ml"]?.number ?: fields["amount_ml"]?.number)?.let { details.add("${it.toInt()} ml") }
            fields["side"]?.string?.let { details.add(it) }
            fields["kind"]?.string?.let { details.add(it) }
            fields["stool_color"]?.string?.let { StoolColor.fromRaw(it) }?.let { details.add(it.label.lowercase(Locale.ROOT)) }
            fields["contents"]?.string?.let { details.add(it.replace("_", " ")) }
            fields["foods"]?.string?.takeIf { it.isNotEmpty() }?.let { details.add(it) }
            fields["amount"]?.string?.let { details.add(it) }
            fields["reaction"]?.string?.takeIf { it != "none" && it.isNotEmpty() }?.let { details.add("reaction: ${it.replace("_", " ")}") }
            fields["storage"]?.string?.takeIf { it.isNotEmpty() }?.let { details.add(it) }
            fields["grams"]?.number?.let { details.add(String.format(Locale.US, "%.2f kg", it / 1000.0)) }
            (fields["height_cm"]?.number ?: fields["head_cm"]?.number)?.let { details.add(String.format(Locale.US, "%.1f cm", it)) }
            for (f in registry.type(type)?.fields ?: emptyList()) {
                val v = fields[f.key] ?: continue
                val key = v.string
                val opt = if (key != null) f.options?.firstOrNull { it.key == key } else null
                if (opt != null) {
                    details.add(opt.label)
                } else if (v.number != null) {
                    details.add(numberText(v.number!!, f.unit))
                } else if (!v.string.isNullOrEmpty()) {
                    details.add(v.string!!)
                }
            }
            if (fields["ongoing"] == FieldValue.Bool(true)) details.add("in progress")
            if (details.isNotEmpty()) label += " · " + details.joinToString(", ")
            return label
        }

        fun numberText(n: Double, unit: String?, locale: Locale = Locale.getDefault()): String {
            return when (unit) {
                "minutes" -> "${n.roundToInt()} min"
                "celsius" -> {
                    if (locale.country.uppercase(Locale.ROOT) == "US") {
                        String.format(Locale.US, "%.1f °F", n * 9.0 / 5.0 + 32.0)
                    } else {
                        String.format(Locale.US, "%.1f °C", n)
                    }
                }
                else -> if (n.roundToInt().toDouble() == n) "${n.toInt()}" else String.format(Locale.US, "%.1f", n)
            }
        }

        fun fractionText(f: Double): String = when (f) {
            0.25 -> "drank ¼"
            0.5 -> "drank ½"
            0.75 -> "drank ¾"
            1.0 -> "drank all"
            else -> "drank ${(f * 100).toInt()}%"
        }
    }
}

object ContextPrior {
    fun apply(a: DecisionAnswer, log: DerivedLog): DecisionAnswer {
        val bottleOpen = log.openSession(Session.Kind.BOTTLE) != null
        val breastOpen = log.openSession(Session.Kind.BREAST) != null
        val sleeping = log.openSession(Session.Kind.SLEEP) != null
        val w = mapOf(
            "feed.bottle.start" to if (bottleOpen) 0.5 else 1.2,
            "feed.bottle.finish" to if (bottleOpen) 1.6 else 0.9,
            "feed.breast.start" to if (breastOpen) 0.6 else 1.2,
            "feed.breast.switch" to if (breastOpen) 1.4 else 0.6,
            "feed.breast.finish" to if (breastOpen) 1.6 else 0.8,
            "sleep.start" to if (sleeping) 0.5 else 1.1,
            "sleep.end" to if (sleeping) 1.6 else 0.6
        )
        val raw = a.options.zip(a.probabilities).map { (opt, p) -> p * (w[opt] ?: 1.0) }
        val s = raw.sum()
        if (s <= 0.0) return a
        return DecisionAnswer(a.options, raw.map { it / s })
    }
}
