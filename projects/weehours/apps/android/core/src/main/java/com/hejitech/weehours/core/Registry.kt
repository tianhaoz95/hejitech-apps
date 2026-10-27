package com.hejitech.weehours.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class EventRegistry(data: String) {
    @Serializable
    data class Category(
        val id: String,
        val label: String,
        val voice: String? = null,
        val defaultEnabled: Boolean = false,
        val group: String? = null,
        val model: Boolean? = null,
    ) {
        val inModel: Boolean get() = model ?: true
    }

    @Serializable
    data class FieldSpec(
        val key: String,
        val kind: String,
        val required: Boolean? = null,
        val options: List<Option>? = null,
        val unit: String? = null,
        val label: String? = null,
        val presets: List<Double>? = null,
    ) {
        @Serializable
        data class Option(val key: String, val label: String)

        val isRequired: Boolean get() = required ?: false
    }

    @Serializable
    data class SessionSpec(
        val kind: String,
        val role: String,
    )

    @Serializable
    data class EventType(
        val id: String,
        val category: String,
        val label: String,
        val voice: String,
        val session: SessionSpec? = null,
        val questions: List<String> = emptyList(),
        val numbers: List<String>? = null,
        val icon: String? = null,
        val fields: List<FieldSpec>? = null,
        val timed: Boolean? = null,
        val remindAfterMinutes: Int? = null,
    ) {
        val isTimed: Boolean get() = timed ?: false
        val isFeed: Boolean get() = id.startsWith("feed.")
    }

    @Serializable
    data class OptionSpec(
        val description: String? = null,
        val fraction: Double? = null,
        val minutesAgo: Int? = null,
    )

    data class QuestionOption(val key: String, val spec: OptionSpec)

    data class QuestionSpec(
        val id: String,
        val instructions: String,
        val options: List<QuestionOption>,
    )

    @Serializable
    data class ModelGroup(
        val id: String,
        val voice: String,
        val entry: String? = null,
        val categories: List<String> = emptyList(),
    )

    @Serializable
    data class Policy(
        val auto: Double,
        val pick: Double,
    )

    val version: Int
    val categories: List<Category>
    val modelGroups: List<ModelGroup>
    val types: List<EventType>
    val questions: Map<String, QuestionSpec>
    val policy: Policy
    val sessionReminders: Map<String, Int>
    val duplicateWindowDefault: Double
    val duplicateWindowStart: Double

    init {
        val root = LogCoding.json.parseToJsonElement(data).jsonObject
        version = root["version"]?.jsonPrimitive?.intOrNull ?: 1
        categories = LogCoding.json.decodeFromJsonElement(
            kotlinx.serialization.builtins.ListSerializer(Category.serializer()),
            root["categories"] ?: JsonArray(emptyList())
        )
        modelGroups = LogCoding.json.decodeFromJsonElement(
            kotlinx.serialization.builtins.ListSerializer(ModelGroup.serializer()),
            root["modelGroups"] ?: JsonArray(emptyList())
        )
        types = LogCoding.json.decodeFromJsonElement(
            kotlinx.serialization.builtins.ListSerializer(EventType.serializer()),
            root["types"] ?: JsonArray(emptyList())
        )
        policy = LogCoding.json.decodeFromJsonElement(
            Policy.serializer(),
            root["policy"] ?: JsonObject(emptyMap())
        )
        val remindersObj = root["sessionReminders"]?.jsonObject ?: JsonObject(emptyMap())
        sessionReminders = remindersObj.mapNotNull { (k, v) ->
            v.jsonPrimitive.intOrNull?.let { k to it }
        }.toMap()

        val windows = root["duplicateWindowsMinutes"]?.jsonObject ?: JsonObject(emptyMap())
        duplicateWindowDefault = (windows["default"]?.jsonPrimitive?.doubleOrNull ?: 5.0) * 60.0
        duplicateWindowStart = (windows["start"]?.jsonPrimitive?.doubleOrNull ?: 10.0) * 60.0

        // JsonObject in kotlinx.serialization preserves insertion order from the JSON file!
        val qsObj = root["questions"]?.jsonObject ?: JsonObject(emptyMap())
        val parsedQs = mutableMapOf<String, QuestionSpec>()
        for ((qid, rawQ) in qsObj) {
            val qObj = rawQ.jsonObject
            val instructions = qObj["instructions"]?.jsonPrimitive?.content ?: qid
            val optsObj = qObj["options"]?.jsonObject ?: JsonObject(emptyMap())
            val opts = optsObj.entries.map { (optKey, optVal) ->
                QuestionOption(
                    key = optKey,
                    spec = LogCoding.json.decodeFromJsonElement(OptionSpec.serializer(), optVal)
                )
            }
            parsedQs[qid] = QuestionSpec(id = qid, instructions = instructions, options = opts)
        }
        questions = parsedQs
    }

    fun type(id: String): EventType? = types.firstOrNull { it.id == id }

    fun types(enabled: Set<String>): List<EventType> = types.filter { enabled.contains(it.category) }

    fun modelTypes(enabled: Set<String>): List<EventType> {
        val asked = categories.filter { it.inModel }.map { it.id }.toSet()
        return types(enabled).filter { asked.contains(it.category) }
    }

    fun category(id: String): Category? = categories.firstOrNull { it.id == id }

    fun modelGroup(category: String): ModelGroup? = modelGroups.firstOrNull { it.categories.contains(category) }

    fun modelGroups(enabled: Set<String>): List<Pair<ModelGroup, List<Category>>> =
        modelGroups.mapNotNull { g ->
            val cats = g.categories.mapNotNull { category(it) }.filter { enabled.contains(it.id) && it.inModel }
            if (cats.isEmpty()) null else (g to cats)
        }

    val defaultCategories: Set<String>
        get() = categories.filter { it.defaultEnabled }.map { it.id }.toSet()

    companion object {
        fun entryQuestion(group: String): String = "${group}_entry"

        val shared: EventRegistry by lazy {
            val stream = EventRegistry::class.java.classLoader?.getResourceAsStream("event-types.json")
                ?: EventRegistry::class.java.getResourceAsStream("/event-types.json")
                ?: throw IllegalStateException("event-types.json missing from resources")
            val text = stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            EventRegistry(text)
        }
    }
}
