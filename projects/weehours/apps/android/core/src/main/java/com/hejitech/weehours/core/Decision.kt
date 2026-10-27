package com.hejitech.weehours.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.text.DateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.roundToInt

data class DecisionQuestion(
    val id: String,
    val instructions: String,
    val options: List<Option>
) {
    data class Option(
        val key: String,
        val description: String?
    )
}

data class DecisionRequest(
    val state: String,
    val questions: List<DecisionQuestion>
) {
    fun systemOneJSON(): String {
        fun str(s: String): String = LogCoding.json.encodeToString(String.serializer(), s)
        val qs = questions.map { q ->
            val criteria = q.options.joinToString(",") { opt ->
                "${str(opt.key)}:${opt.description?.let { str(it) } ?: "null"}"
            }
            "${str(q.id)}:{\"type\":\"choice\",\"instructions\":${str(q.instructions)},\"criteria\":{$criteria}}"
        }
        return "{\"state\":${str(state)},\"questions\":{${qs.joinToString(",")}}}"
    }
}

@Serializable
data class DecisionAnswer(
    val options: List<String>,
    val probabilities: List<Double>
) {
    val top: Pair<String, Double>
        get() {
            val i = probabilities.indices.maxByOrNull { probabilities[it] } ?: 0
            return options[i] to probabilities[i]
        }

    fun ranked(): List<Pair<String, Double>> =
        options.zip(probabilities).sortedByDescending { it.second }

    fun p(key: String): Double {
        val idx = options.indexOf(key)
        return if (idx >= 0) probabilities[idx] else 0.0
    }
}

interface DecisionModel {
    val version: String
    suspend fun decide(request: DecisionRequest): Map<String, DecisionAnswer>
    suspend fun warmUp() {}
}

sealed class DecisionError(message: String) : Exception(message) {
    class Unavailable(reason: String) : DecisionError("Decision model unavailable: $reason")
    class BadResponse(reason: String) : DecisionError("Decision model returned an unexpected response: $reason")
}

@Serializable
data class Calibration(
    val temperatures: Map<String, Double> = emptyMap(),
    val modelVersion: String? = null
) {
    fun apply(answer: DecisionAnswer, question: String): DecisionAnswer {
        val t = temperatures[question]
        if (t == null || t <= 0.0 || t == 1.0) return answer
        val logs = answer.probabilities.map { ln(max(it, 1e-9)) / t }
        val m = logs.maxOrNull() ?: 0.0
        val ex = logs.map { exp(it - m) }
        val s = ex.sum()
        return DecisionAnswer(answer.options, ex.map { it / s })
    }

    companion object {
        val identity = Calibration()

        val bundled: Calibration by lazy {
            try {
                val stream = Calibration::class.java.classLoader?.getResourceAsStream("calibration.json")
                    ?: Calibration::class.java.getResourceAsStream("/calibration.json")
                val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: return@lazy identity
                LogCoding.json.decodeFromString(serializer(), text)
            } catch (_: Exception) {
                identity
            }
        }
    }
}

class SystemOneHTTPModel(
    val endpoint: String,
    val apiKey: String? = null,
    override val version: String = "laya-q8_0@http",
    val timeoutSeconds: Long = 8L,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .writeTimeout(timeoutSeconds, TimeUnit.SECONDS)
        .build()
) : DecisionModel {

    override suspend fun decide(request: DecisionRequest): Map<String, DecisionAnswer> = withContext(Dispatchers.IO) {
        val baseUrl = endpoint.trimEnd('/')
        val body = request.systemOneJSON().toRequestBody("application/json; charset=utf-8".toMediaType())
        val reqBuilder = Request.Builder()
            .url("$baseUrl/v1/systemone")
            .post(body)
            .header("Content-Type", "application/json")
        if (!apiKey.isNullOrEmpty()) {
            reqBuilder.header("Authorization", "Bearer $apiKey")
        }
        client.newCall(reqBuilder.build()).execute().use { resp ->
            val respBody = resp.body?.string() ?: ""
            if (resp.code != 200) {
                throw DecisionError.Unavailable("HTTP ${resp.code}")
            }
            parse(respBody, request.questions)
        }
    }

    companion object {
        fun parse(jsonText: String, questions: List<DecisionQuestion>): Map<String, DecisionAnswer> {
            val root = try {
                LogCoding.json.parseToJsonElement(jsonText).jsonObject
            } catch (_: Exception) {
                throw DecisionError.BadResponse(jsonText.take(200))
            }
            val answers = root["answers"] as? JsonObject
                ?: throw DecisionError.BadResponse(jsonText.take(200))
            val out = mutableMapOf<String, DecisionAnswer>()
            for (q in questions) {
                val a = answers[q.id] as? JsonObject ?: continue
                val probs = a["probabilities"] as? JsonObject ?: continue
                val keys = q.options.map { it.key }
                out[q.id] = DecisionAnswer(keys, keys.map { (probs[it] as? JsonPrimitive)?.doubleOrNull ?: 0.0 })
            }
            return out
        }
    }
}

class KeywordDecisionModel : DecisionModel {
    override val version: String = "keywords-1"

    override suspend fun decide(request: DecisionRequest): Map<String, DecisionAnswer> {
        val text = " " + request.state.lowercase(Locale.ROOT) + " "
        val out = mutableMapOf<String, DecisionAnswer>()
        for (q in request.questions) {
            val lex: Map<String, List<String>> = when {
                q.id == "event_type" -> lexicon
                q.id == "category" -> groupLexicon
                q.id == "phase" -> phaseLexicon
                q.id.endsWith("_entry") -> categoryWords
                else -> fieldLexicon[q.id] ?: emptyMap()
            }
            val scores = q.options.map { opt ->
                val phrases = lex[opt.key] ?: emptyList()
                phrases.filter { text.contains(it) }.maxOfOrNull { it.length.toDouble() } ?: 0.0
            }.toMutableList()
            if (scores.all { it == 0.0 }) {
                val fallback = q.options.indexOfFirst { it.key in setOf("not_stated", "now", "none_of_these") }
                if (fallback >= 0) {
                    scores[fallback] = if (q.options[fallback].key == "none_of_these") 3.0 else 6.0
                }
            }
            val m = scores.maxOrNull() ?: 0.0
            val ex = scores.map { exp((it - m) / 1.5) }
            val s = ex.sum()
            out[q.id] = DecisionAnswer(q.options.map { it.key }, ex.map { it / s })
        }
        return out
    }

    companion object {
        val lexicon: Map<String, List<String>> = mapOf(
            "feed.bottle.start" to listOf("start bottle", "starting bottle", "started bottle", "start drinking", "started drinking", "starting a bottle", "started a bottle", "giving a bottle", "begin bottle", "start feeding", "started feeding", "bottle start"),
            "feed.bottle.finish" to listOf("finished drinking", "done drinking", "finished bottle", "finished the bottle", "bottle done", "finished, drank", "drank", "left in the bottle", "left over", "finished feeding", "done with the bottle", "finished a bottle", "quarter left", "half left", "quarters left", "of the bottle"),
            "feed.bottle.single" to listOf("had a bottle", "gave a bottle", "had a full bottle", "bottle earlier", "fed a bottle"),
            "feed.breast.start" to listOf("nursing", "start nursing", "breastfeeding", "breast feeding", "latched", "on the left", "on the right", "start feeding left", "start feeding right"),
            "feed.breast.switch" to listOf("switch", "switched", "other side", "swapped"),
            "feed.breast.finish" to listOf("done nursing", "finished nursing", "stopped nursing", "done breastfeeding", "finished breastfeeding", "unlatched"),
            "feed.solids" to listOf("puree", "cereal", "solids", "ate", "banana", "avocado", "oatmeal"),
            "diaper" to listOf("diaper", "nappy", "poop", "pee", "wet", "dirty", "poopy", "blowout"),
            "sleep.start" to listOf("asleep", "fell asleep", "down for a nap", "sleeping", "nap time", "went to sleep", "put her down", "put him down"),
            "sleep.end" to listOf("woke up", "awake", "is up", "woke", "up from nap"),
            "pump" to listOf("pumped", "pumping", "pump"),
            "weight" to listOf("weighs", "weighed", "weight", "kilos", "pounds", "kg", "lbs"),
            "height" to listOf("height", "tall", "length", "inches", "centimeters", "cm"),
            "head" to listOf("head", "circumference", "head size")
        )

        val careLexicon: Map<String, List<String>> = mapOf(
            "bath" to listOf("bath", "bathed", "bathtub"),
            "lotion" to listOf("lotion", "cream", " ointment", "moisturiz"),
            "toothbrush" to listOf("brushed her teeth", "brushed his teeth", "brush teeth", "brushed teeth", "toothbrush"),
            "potty" to listOf("potty", "toilet"),
            "teething" to listOf("teething", "tooth coming", "new tooth", "gums"),
            "medication" to listOf("medicine", "medication", "drops", "vitamin", "tylenol", "ibuprofen", "dose", "antibiotic"),
            "symptom" to listOf("cough", "runny nose", "congest", "rash", "vomit", "threw up", "diarrhea", "sneez", "spit up", "spat up"),
            "temperature" to listOf("temperature", "fever", "degrees", "thermometer"),
            "doctor" to listOf("back from the doctor", "back from the pediatrician", "saw the doctor", "saw the pediatrician", "at the doctor", "at the pediatrician", "doctor says", "pediatrician says", "doctor visit", "checkup", "check-up"),
            "vaccination" to listOf("vaccine", "vaccination", "shots", "jab", "immuniz"),
            "tummy_time" to listOf("tummy time", "on her tummy", "on his tummy"),
            "play" to listOf("played", "playing", "play time", "playtime"),
            "walk" to listOf("walk", "stroller", "pram", "outside")
        )

        val fieldLexicon: Map<String, Map<String, List<String>>> = mapOf(
            "amount" to mapOf(
                "quarter" to listOf("drank a quarter", "quarter of", "a quarter"),
                "half" to listOf("drank half", "half a bottle", "half of", "half"),
                "three_quarters" to listOf("three quarters", "three-quarters", "most of"),
                "full" to listOf("whole bottle", "all of it", "full bottle", "finished it all", "the whole", "everything", "full"),
                "quarter_left" to listOf("quarter left", "quarter is left", "quarter of it left"),
                "half_left" to listOf("half left", "half is left", "half of it left"),
                "three_quarters_left" to listOf("three quarters left", "three-quarters left")
            ),
            "side" to mapOf("left" to listOf("left"), "right" to listOf("right"), "both" to listOf("both sides", "both")),
            "contents" to mapOf("formula" to listOf("formula"), "breast_milk" to listOf("breast milk", "breastmilk", "pumped milk", "expressed")),
            "diaper_kind" to mapOf(
                "wet" to listOf("wet", "pee"),
                "dirty" to listOf("dirty", "poop", "poopy", "soiled", "blowout"),
                "both" to listOf("both", "wet and dirty", "pee and poop"),
                "dry" to listOf("dry", "clean")
            ),
            "solids_amount" to mapOf(
                "taste" to listOf("taste", "a bite"),
                "some" to listOf("some", "a little"),
                "most" to listOf("most"),
                "all" to listOf("all of it", "everything", "all")
            ),
            "when" to mapOf(
                "5" to listOf("five minutes ago", "5 minutes ago", "few minutes ago", "couple minutes ago"),
                "15" to listOf("fifteen minutes ago", "15 minutes ago", "little while ago"),
                "30" to listOf("half an hour ago", "thirty minutes ago", "30 minutes ago"),
                "60" to listOf("an hour ago", "one hour ago", "60 minutes ago")
            )
        )

        val categoryPrefixes: Map<String, List<String>> = mapOf(
            "bottle" to listOf("feed.bottle"),
            "breast" to listOf("feed.breast"),
            "pumping" to listOf("pump"),
            "solids" to listOf("feed.solids"),
            "diaper" to listOf("diaper"),
            "sleep" to listOf("sleep"),
            "growth" to listOf("weight", "height", "head")
        )

        val phaseLexicon: Map<String, List<String>> = mapOf(
            "start" to listOf("start", "started", "starting", "began", "begin", "giving", "fell asleep", "asleep", "nursing on", "latched", "down for", "nap time", "dozed", "out like", "now"),
            "switch" to listOf("switch", "switched", "swapped", "other side"),
            "finish" to listOf("finished", "done", "woke", "awake", "drank", "left over", "unlatched", "is up", "'s up", "gone", "all done"),
            "single" to listOf("had a bottle", "gave him a full", "gave her a full", "fed a bottle", "earlier")
        )

        val categoryWords: Map<String, List<String>>
            get() {
                val out = careLexicon.toMutableMap()
                for ((cat, prefixes) in categoryPrefixes) {
                    out[cat] = lexicon.filter { (k, _) -> prefixes.any { k.startsWith(it) } }.values.flatten()
                }
                return out
            }

        val groupLexicon: Map<String, List<String>>
            get() {
                val words = categoryWords
                return EventRegistry.shared.modelGroups.associate { g ->
                    g.id to g.categories.flatMap { words[it] ?: emptyList() }
                }
            }
    }
}

object Parsers {
    private val explicitTimePattern = Pattern.compile("(?i)(?:\\bat\\s+)?\\b(\\d{1,2}):(\\d{2})\\s*(am|pm|a\\.m\\.|p\\.m\\.)?")

    fun explicitTime(text: String, reference: Date, calendar: Calendar = Calendar.getInstance()): Date? {
        val m = explicitTimePattern.matcher(text)
        if (!m.find()) return null
        var hour = m.group(1)?.toIntOrNull() ?: return null
        val minute = m.group(2)?.toIntOrNull() ?: return null
        if (hour >= 24 || minute >= 60) return null
        val ampm = m.group(3)?.lowercase(Locale.ROOT)
        if (ampm != null) {
            if (ampm.startsWith("p") && hour < 12) hour += 12
            if (ampm.startsWith("a") && hour == 12) hour = 0
            return mostRecent(hour, minute, reference, calendar)
        }
        val candidates = if (hour > 12) listOf(hour) else listOf(hour % 12, hour % 12 + 12)
        return candidates.mapNotNull { mostRecent(it, minute, reference, calendar) }.maxByOrNull { it.time }
    }

    private fun mostRecent(hour: Int, minute: Int, ref: Date, calendar: Calendar): Date? {
        val c = calendar.clone() as Calendar
        c.time = ref
        c.set(Calendar.HOUR_OF_DAY, hour)
        c.set(Calendar.MINUTE, minute)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        if (c.timeInMillis > ref.time + 60_000L) {
            c.add(Calendar.DAY_OF_YEAR, -1)
        }
        return c.time
    }

    fun minutesAgo(text: String): Int? {
        val t = text.lowercase(Locale.ROOT)
        val fixed = listOf(
            "half an hour ago" to 30,
            "an hour and a half ago" to 90,
            "an hour ago" to 60,
            "one hour ago" to 60,
            "a few minutes ago" to 5,
            "few minutes ago" to 5,
            "couple of minutes ago" to 3,
            "couple minutes ago" to 3,
            "a minute ago" to 1,
            "a little while ago" to 15,
            "little while ago" to 15,
            "quarter of an hour ago" to 15
        )
        for ((phrase, m) in fixed) {
            if (t.contains(phrase)) return m
        }
        number(listOf("minutes ago", "mins ago", "min ago", "minute ago"), t)?.let { return it.toInt() }
        number(listOf("hours ago", "hour ago"), t)?.let { return (it * 60).toInt() }
        return null
    }

    fun mentionsVagueTime(text: String): Boolean {
        val t = text.lowercase(Locale.ROOT)
        return t.contains(" ago") || t.contains("earlier") || t.contains("before")
    }

    fun milliliters(text: String): Double? {
        val t = text.lowercase(Locale.ROOT)
        number(listOf("ml", "mls", "milliliters", "millilitres", "mil"), t)?.let { return it }
        number(listOf("oz", "ounces", "ounce"), t)?.let { return (it * 29.5735).roundToInt().toDouble() }
        return null
    }

    fun grams(text: String): Double? {
        val t = text.lowercase(Locale.ROOT)
        number(listOf("kg", "kilos", "kilograms", "kilo"), t)?.let { return (it * 1000.0).roundToInt().toDouble() }
        number(listOf("g", "grams", "gram"), t)?.let { return it }
        number(listOf("lb", "lbs", "pounds", "pound"), t)?.let { lb ->
            val oz = number(listOf("oz", "ounces", "ounce"), t) ?: 0.0
            return ((lb * 16.0 + oz) * 28.3495).roundToInt().toDouble()
        }
        return null
    }

    fun centimeters(text: String): Double? {
        val t = text.lowercase(Locale.ROOT)
        number(listOf("cm", "centimeters", "centimetres", "centimeter", "centimetre"), t)?.let { return it }
        val feet = number(listOf("feet", "foot", "ft"), t)
        val inches = number(listOf("inches", "inch"), t)
        if (feet != null || inches != null) {
            return (((feet ?: 0.0) * 12.0 + (inches ?: 0.0)) * 2.54 * 10.0).roundToInt() / 10.0
        }
        return null
    }

    fun growthMeasure(text: String): String? {
        val t = text.lowercase(Locale.ROOT)
        if (t.contains("head") || t.contains("circumference")) return "head"
        if (grams(t) != null) return "weight"
        if (centimeters(t) != null || t.contains("tall") || t.contains("length") || t.contains("height")) return "height"
        return null
    }

    val everyChild = listOf(
        "the twins", "twins", "both babies", "both kids", "both of them", "both girls", "both boys",
        "all of them", "all three", "all the kids", "all the babies", "everyone", "everybody", "the babies", "the kids"
    )

    fun children(text: String, among: List<Baby>): List<UUID>? {
        if (among.size <= 1) return null
        val t = " " + text.lowercase(Locale.ROOT).replace("’", "'") + " "
        if (everyChild.any { t.contains(" $it ") || t.contains(" $it,") || t.contains(" $it.") || t.contains(" $it'") }) {
            return among.map { it.id }
        }
        val named = among.filter { b ->
            val name = b.name.lowercase(Locale.ROOT).trim()
            if (name.isEmpty()) false
            else Pattern.compile("\\b${Pattern.quote(name)}\\b").matcher(t).find()
        }
        return if (named.isEmpty()) null else named.map { it.id }
    }

    val wordNumbers: Map<String, Double> = mapOf(
        "one" to 1.0, "two" to 2.0, "three" to 3.0, "four" to 4.0, "five" to 5.0,
        "six" to 6.0, "seven" to 7.0, "eight" to 8.0, "nine" to 9.0, "ten" to 10.0,
        "eleven" to 11.0, "twelve" to 12.0, "fifteen" to 15.0, "a" to 1.0, "an" to 1.0,
        "forty-five" to 45.0, "twenty-five" to 25.0, "twenty" to 20.0, "thirty" to 30.0,
        "forty" to 40.0, "fifty" to 50.0, "sixty" to 60.0, "seventy" to 70.0,
        "eighty" to 80.0, "ninety" to 90.0, "hundred" to 100.0
    )

    private val durationMinutesPattern = Pattern.compile("(\\d+(?:\\.\\d+)?|[a-z-]+)\\s*(?:minutes|minute|mins|min)\\b(?!\\s+ago)")
    private val firstNumberPattern = Pattern.compile("\\d+(\\.\\d+)?")

    fun field(f: EventRegistry.FieldSpec, text: String): FieldValue? {
        val t = " " + text.lowercase(Locale.ROOT) + " "
        return when {
            f.kind == "text" -> {
                val s = text.trim()
                if (s.isEmpty()) null else FieldValue.Str(s)
            }
            f.kind == "choice" -> {
                val options = f.options ?: emptyList()
                val said = options.filter { o ->
                    val words = listOf(o.label.lowercase(Locale.ROOT), o.key.replace("_", " "))
                    words.any { t.contains(" $it") }
                }
                if (said.size == 1) return FieldValue.Str(said[0].key)
                if (f.key == "result" && t.contains(" pee") && t.contains(" poop")) return FieldValue.Str("both")
                if (options.any { it.key == "other" } && said.isEmpty()) FieldValue.Str("other") else null
            }
            f.kind == "number" && f.unit == "minutes" -> {
                val m = durationMinutesPattern.matcher(t)
                if (!m.find()) return null
                val token = m.group(1) ?: return null
                val n = token.toDoubleOrNull() ?: wordNumbers[token] ?: return null
                if (n > 0) FieldValue.Num(n) else null
            }
            f.kind == "number" && f.unit == "celsius" -> {
                val n = firstNumber(t) ?: return null
                val c = if (n > 45.0) (n - 32.0) * 5.0 / 9.0 else n
                if (c in 30.0..45.0) FieldValue.Num((c * 10.0).roundToInt() / 10.0) else null
            }
            else -> null
        }
    }

    private fun firstNumber(t: String): Double? {
        val m = firstNumberPattern.matcher(t)
        return if (m.find()) m.group().toDoubleOrNull() else null
    }

    private fun number(units: List<String>, t: String): Double? {
        for (u in units) {
            val pattern = Pattern.compile("(\\d+(?:\\.\\d+)?|[a-z-]+)\\s*${Pattern.quote(u)}(?:\\b|$)")
            val m = pattern.matcher(t)
            if (m.find()) {
                val token = m.group(1) ?: continue
                token.toDoubleOrNull()?.let { return it }
                wordNumbers[token]?.let { return it }
            }
        }
        return null
    }

    fun milkStorage(text: String): String? {
        val t = " " + text.lowercase(Locale.ROOT) + " "
        if (listOf("freezer", "froze", "frozen", "freeze").any { t.contains(it) }) return "freezer"
        if (listOf("fridge", "refrigerator", "refrigerated").any { t.contains(it) }) return "fridge"
        if (listOf("fed right away", "fed now", "gave right away", "fed immediately").any { t.contains(it) }) return "fed"
        return null
    }

    private val foodVocabulary: List<Pair<String, String>> = listOf(
        "peanut butter" to "Peanut butter", "sweet potato" to "Sweet potato", "rice cereal" to "Rice cereal",
        "green beans" to "Green beans", "egg yolk" to "Egg", "scrambled egg" to "Egg",
        "avocado" to "Avocado", "banana" to "Banana", "oatmeal" to "Oatmeal", "egg" to "Egg",
        "peanut" to "Peanut", "yogurt" to "Yogurt", "cheese" to "Cheese", "apple" to "Apple",
        "applesauce" to "Applesauce", "pear" to "Pear", "carrot" to "Carrot", "broccoli" to "Broccoli",
        "peas" to "Peas", "squash" to "Squash", "pumpkin" to "Pumpkin", "mango" to "Mango",
        "peach" to "Peach", "strawberry" to "Strawberry", "strawberries" to "Strawberry",
        "blueberry" to "Blueberry", "blueberries" to "Blueberry", "raspberry" to "Raspberry",
        "salmon" to "Salmon", "cod" to "Cod", "tuna" to "Tuna", "fish" to "Fish",
        "chicken" to "Chicken", "turkey" to "Turkey", "beef" to "Beef", "tofu" to "Tofu",
        "edamame" to "Edamame", "hummus" to "Hummus", "tahini" to "Tahini", "sesame" to "Sesame",
        "toast" to "Toast", "bread" to "Bread", "pasta" to "Pasta", "noodles" to "Noodles",
        "beans" to "Beans", "lentils" to "Lentils", "spinach" to "Spinach", "zucchini" to "Zucchini",
        "plum" to "Plum", "prune" to "Prune", "almond" to "Almond", "cashew" to "Cashew",
        "walnut" to "Walnut", "shrimp" to "Shrimp", "cereal" to "Cereal", "porridge" to "Porridge"
    )

    fun foods(text: String): List<String> {
        val t = " " + text.lowercase(Locale.ROOT) + " "
        val found = mutableListOf<String>()
        for ((phrase, label) in foodVocabulary) {
            val p = Pattern.compile("\\b${Pattern.quote(phrase)}\\b")
            if (p.matcher(t).find() && !found.contains(label)) {
                found.add(label)
            }
        }
        return found
    }

    fun reaction(text: String): String? {
        val t = " " + text.lowercase(Locale.ROOT) + " "
        if (t.contains("no reaction") || t.contains("without reaction")) return "none"
        if (t.contains("hive")) return "hives"
        if (t.contains("rash") || t.contains("redness")) return "rash"
        if (t.contains("vomit") || t.contains("threw up")) return "vomiting"
        if (t.contains("diarrhea")) return "diarrhea"
        if (t.contains("spit up") || t.contains("spit-up") || t.contains("spat up")) return "spit_up"
        if (t.contains("gassy") || t.contains(" gas ")) return "gas"
        return null
    }

    fun isDoctorQuestion(text: String): Boolean {
        val t = text.lowercase(Locale.ROOT)
        return t.contains("ask the doctor") || t.contains("ask the pediatrician") ||
            t.contains("ask doctor") || t.contains("ask pediatrician") ||
            t.contains("question for the doctor") || t.contains("question for the pediatrician")
    }

    fun liveChips(text: String, reference: Date = Date()): List<String> {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return emptyList()
        val chips = mutableListOf<String>()
        val t = " " + trimmed.lowercase(Locale.ROOT) + " "
        for ((typeId, phrases) in KeywordDecisionModel.lexicon) {
            if (phrases.any { t.contains(it) }) {
                val label = EventRegistry.shared.type(typeId)?.label
                if (label != null && !chips.contains(label)) {
                    chips.add(label)
                    break
                }
            }
        }
        if (chips.isEmpty()) {
            for ((catId, phrases) in KeywordDecisionModel.careLexicon) {
                if (phrases.any { t.contains(it) }) {
                    val label = EventRegistry.shared.types.firstOrNull { it.category == catId }?.label
                    if (label != null) {
                        chips.add(label)
                        break
                    }
                }
            }
        }
        val ml = milliliters(trimmed)
        val g = grams(trimmed)
        val cm = centimeters(trimmed)
        when {
            ml != null -> chips.add("${ml.toInt()} ml")
            g != null -> chips.add(String.format(Locale.US, "%.2f kg", g / 1000.0))
            cm != null -> chips.add(String.format(Locale.US, "%.1f cm", cm))
        }
        for ((key, phrases) in KeywordDecisionModel.fieldLexicon["amount"] ?: emptyMap()) {
            if (phrases.any { t.contains(it) }) {
                val f = EventRegistry.shared.questions["amount"]?.options?.firstOrNull { it.key == key }?.spec?.fraction
                if (f != null) {
                    chips.add(VoiceInterpreter.fractionText(f))
                    break
                }
            }
        }
        for ((key, phrases) in KeywordDecisionModel.fieldLexicon["diaper_kind"] ?: emptyMap()) {
            if (phrases.any { t.contains(it) }) {
                chips.add(key)
                break
            }
        }
        val fds = foods(trimmed)
        if (fds.isNotEmpty()) chips.add(fds.take(2).joinToString(" + "))
        val m = minutesAgo(trimmed)
        if (m != null) {
            chips.add("-${m}m")
        } else {
            val at = explicitTime(trimmed, reference)
            if (at != null) {
                val fmt = DateFormat.getTimeInstance(DateFormat.SHORT, Locale.getDefault())
                chips.add(fmt.format(at))
            }
        }
        return chips.take(4)
    }
}
