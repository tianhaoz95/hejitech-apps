package com.hejitech.weehours.core

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import java.nio.ByteBuffer
import java.text.SimpleDateFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import kotlin.math.roundToInt

object UUIDSerializer : KSerializer<UUID> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("UUID", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: UUID) {
        encoder.encodeString(value.toString().uppercase(Locale.US))
    }
    override fun deserialize(decoder: Decoder): UUID {
        return UUID.fromString(decoder.decodeString())
    }
}

object DateIsoSerializer : KSerializer<Date> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("Date", PrimitiveKind.STRING)
    override fun serialize(encoder: Encoder, value: Date) {
        encoder.encodeString(LogCoding.isoString(value))
    }
    override fun deserialize(decoder: Decoder): Date {
        val s = decoder.decodeString()
        return LogCoding.parseISO(s) ?: throw IllegalArgumentException("Bad date: $s")
    }
}

@Serializable(with = FieldValueSerializer::class)
sealed class FieldValue {
    data class Str(val value: String) : FieldValue()
    data class Num(val value: Double) : FieldValue()
    data class Bool(val value: Boolean) : FieldValue()

    val string: String? get() = (this as? Str)?.value
    val number: Double? get() = (this as? Num)?.value
    val bool: Boolean? get() = (this as? Bool)?.value

    override fun toString(): String = when (this) {
        is Str -> value
        is Num -> if (value == kotlin.math.round(value)) value.toLong().toString() else String.format(Locale.US, "%.2f", value)
        is Bool -> if (value) "yes" else "no"
    }

    companion object {
        fun string(v: String) = Str(v)
        fun number(v: Double) = Num(v)
        fun number(v: Int) = Num(v.toDouble())
        fun bool(v: Boolean) = Bool(v)
    }
}

object FieldValueSerializer : KSerializer<FieldValue> {
    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor("FieldValue", PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: FieldValue) {
        val jsonEncoder = encoder as? JsonEncoder
        if (jsonEncoder != null) {
            val elem = when (value) {
                is FieldValue.Str -> JsonPrimitive(value.value)
                is FieldValue.Num -> {
                    val n = value.value
                    if (n == kotlin.math.round(n) && n >= Long.MIN_VALUE && n <= Long.MAX_VALUE) {
                        JsonPrimitive(n.toLong())
                    } else {
                        JsonPrimitive(n)
                    }
                }
                is FieldValue.Bool -> JsonPrimitive(value.value)
            }
            jsonEncoder.encodeJsonElement(elem)
        } else {
            encoder.encodeString(value.toString())
        }
    }

    override fun deserialize(decoder: Decoder): FieldValue {
        val jsonDecoder = decoder as? JsonDecoder
        if (jsonDecoder != null) {
            val prim = jsonDecoder.decodeJsonElement() as? JsonPrimitive
                ?: return FieldValue.Str("")
            if (prim.isString) return FieldValue.Str(prim.content)
            prim.booleanOrNull?.let { return FieldValue.Bool(it) }
            prim.doubleOrNull?.let { return FieldValue.Num(it) }
            return FieldValue.Str(prim.content)
        }
        return FieldValue.Str(decoder.decodeString())
    }
}

@Serializable
enum class Surface(val rawValue: String) {
    @SerialName("phone") PHONE("phone"),
    @SerialName("watch") WATCH("watch"),
    @SerialName("glasses") GLASSES("glasses"),
    @SerialName("ring") RING("ring"),
    @SerialName("mcp") MCP("mcp"),
    @SerialName("widget") WIDGET("widget"),
    @SerialName("siri") SIRI("siri");

    companion object {
        fun fromRaw(raw: String?): Surface = entries.firstOrNull { it.rawValue == raw } ?: PHONE
    }
}

@Serializable
enum class InputKind(val rawValue: String) {
    @SerialName("voice") VOICE("voice"),
    @SerialName("gesture") GESTURE("gesture"),
    @SerialName("tap") TAP("tap"),
    @SerialName("agent") AGENT("agent");

    companion object {
        fun fromRaw(raw: String?): InputKind = entries.firstOrNull { it.rawValue == raw } ?: TAP
    }
}

@Serializable
enum class ConfidenceTier(val rawValue: String) {
    @SerialName("auto") AUTO("auto"),
    @SerialName("pick") PICK("pick"),
    @SerialName("full_list") FULL_LIST("full_list");

    companion object {
        fun fromRaw(raw: String?): ConfidenceTier? = entries.firstOrNull { it.rawValue == raw }
    }
}

@Serializable
data class Provenance(
    val surface: Surface,
    val input: InputKind,
    @SerialName("raw_transcript") val rawTranscript: String? = null,
    val confidence: Map<String, Double> = emptyMap(),
    @SerialName("confidence_tier") val confidenceTier: ConfidenceTier? = null,
    @SerialName("model_version") val modelVersion: String? = null,
    @SerialName("capture_id") @Serializable(with = UUIDSerializer::class) val captureId: UUID? = null,
    val caller: String? = null,
)

@Serializable
data class LogEvent(
    @Serializable(with = UUIDSerializer::class) val id: UUID = UUID.randomUUID(),
    @SerialName("household_id") @Serializable(with = UUIDSerializer::class) var householdId: UUID,
    @SerialName("baby_id") @Serializable(with = UUIDSerializer::class) var babyId: UUID,
    val type: String,
    var fields: Map<String, FieldValue> = emptyMap(),
    @SerialName("occurred_at") @Serializable(with = DateIsoSerializer::class) val occurredAt: Date = Date(),
    @SerialName("logged_at") @Serializable(with = DateIsoSerializer::class) val loggedAt: Date = Date(),
    @SerialName("logged_by") @Serializable(with = UUIDSerializer::class) var loggedBy: UUID,
    val provenance: Provenance,
    @Serializable(with = UUIDSerializer::class) var supersedes: UUID? = null,
    @SerialName("session_id") @Serializable(with = UUIDSerializer::class) val sessionId: UUID? = null,
) {
    fun string(key: String): String? = fields[key]?.string
    fun number(key: String): Double? = fields[key]?.number
    fun bool(key: String): Boolean? = fields[key]?.bool

    val needsDetails: Boolean get() = fields[NEEDS_DETAILS] == FieldValue.Bool(true)

    companion object {
        const val NEEDS_DETAILS = "needs_details"
        const val PHOTO_ENTRY = "attached_to"
    }
}

object SystemType {
    const val NOTE = "note"
    const val UNDO = "undo"
    const val RESOLVE = "resolve"
    const val DUTY = "duty"
    const val PHOTO = "photo"
    val all: Set<String> = setOf(NOTE, UNDO, RESOLVE, DUTY, "settings", PHOTO)
}

@Serializable
data class Capture(
    @Serializable(with = UUIDSerializer::class) val id: UUID = UUID.randomUUID(),
    @SerialName("household_id") @Serializable(with = UUIDSerializer::class) var householdId: UUID,
    val surface: Surface,
    @SerialName("captured_at") @Serializable(with = DateIsoSerializer::class) val capturedAt: Date,
    @SerialName("logged_by") @Serializable(with = UUIDSerializer::class) var loggedBy: UUID,
    @SerialName("audio_path") var audioPath: String? = null,
    var transcript: String? = null,
    @SerialName("attach_to") @Serializable(with = UUIDSerializer::class) val attachTo: UUID? = null,
    @SerialName("baby_id") @Serializable(with = UUIDSerializer::class) var babyId: UUID? = null,
    var status: Status = Status.PENDING,
    var interpretation: Interpretation? = null,
    @SerialName("processed_by") @Serializable(with = UUIDSerializer::class) var processedBy: UUID? = null,
    @SerialName("processed_at") @Serializable(with = DateIsoSerializer::class) var processedAt: Date? = null,
) {
    @Serializable
    enum class Status(val rawValue: String) {
        @SerialName("pending") PENDING("pending"),
        @SerialName("needs_review") NEEDS_REVIEW("needs_review"),
        @SerialName("done") DONE("done"),
        @SerialName("dismissed") DISMISSED("dismissed"),
        @SerialName("failed") FAILED("failed")
    }

    val eventId: UUID get() = deriveUuid(id, "capture-event")
}

fun deriveUuid(base: UUID, salt: String): UUID {
    val buf = ByteBuffer.allocate(16)
    buf.putLong(base.mostSignificantBits)
    buf.putLong(base.leastSignificantBits)
    val bytes = buf.array()
    var h: ULong = 0xcbf29ce484222325uL
    val prime: ULong = 0x100000001b3uL
    for (b in salt.toByteArray(Charsets.UTF_8)) {
        h = (h xor (b.toInt() and 0xFF).toULong()) * prime
    }
    for (i in 0 until 16) {
        h = (h xor (bytes[i].toInt() and 0xFF).toULong()) * prime
        bytes[i] = ((h shr 24) and 0xFFuL).toByte()
    }
    bytes[6] = ((bytes[6].toInt() and 0x0F) or 0x50).toByte()
    bytes[8] = ((bytes[8].toInt() and 0x3F) or 0x80).toByte()
    val out = ByteBuffer.wrap(bytes)
    return UUID(out.long, out.long)
}

fun UUID.uuidString(): String = this.toString().uppercase(Locale.US)

enum class StoolColor(val rawValue: String, val label: String) {
    YELLOW("yellow", "Mustard"),
    BROWN("brown", "Brown"),
    GREEN("green", "Green"),
    BLACK("black", "Black"),
    RED("red", "Red"),
    WHITE("white", "Pale/white");

    fun isFlagged(ageDays: Int?): Boolean = when (this) {
        RED, WHITE -> true
        BLACK -> (ageDays ?: 99) > 4
        else -> false
    }

    companion object {
        fun fromRaw(raw: String?): StoolColor? = entries.firstOrNull { it.rawValue == raw }
    }
}

object LogCoding {
    val json: Json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    private val isoMillisFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).withZone(ZoneOffset.UTC)

    fun isoString(date: Date): String {
        return isoMillisFormatter.format(Instant.ofEpochMilli(date.time))
    }

    fun dayString(date: Date): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(date)
    }

    fun parseISO(s: String): Date? {
        val trimmed = s.trim()
        if (trimmed.isEmpty()) return null
        try {
            return Date.from(Instant.parse(trimmed))
        } catch (_: Exception) {}
        try {
            return Date.from(DateTimeFormatter.ISO_OFFSET_DATE_TIME.parse(trimmed, Instant::from))
        } catch (_: Exception) {}
        // Postgres style: "2026-10-14 03:10:00.123+00" or "yyyy-MM-dd"
        if (trimmed.length == 10 && trimmed[4] == '-' && trimmed[7] == '-') {
            try {
                val ld = LocalDate.parse(trimmed)
                return Date.from(ld.atStartOfDay(ZoneOffset.UTC).toInstant())
            } catch (_: Exception) {}
        }
        val normalized = trimmed.replace(' ', 'T').let {
            if (it.endsWith("+00") || it.endsWith("-00")) "${it}:00"
            else if (Regex(".*[+-]\\d{2}$").matches(it)) "${it}:00"
            else it
        }
        try {
            return Date.from(DateTimeFormatter.ISO_OFFSET_DATE_TIME.parse(normalized, Instant::from))
        } catch (_: Exception) {}
        val patterns = listOf(
            "yyyy-MM-dd HH:mm:ss.SSSSSSX",
            "yyyy-MM-dd HH:mm:ss.SSSX",
            "yyyy-MM-dd HH:mm:ssX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSSSSX",
            "yyyy-MM-dd'T'HH:mm:ss.SSSX",
            "yyyy-MM-dd'T'HH:mm:ssX",
            "yyyy-MM-dd"
        )
        for (p in patterns) {
            try {
                val sdf = SimpleDateFormat(p, Locale.US)
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                val d = sdf.parse(trimmed)
                if (d != null) return d
            } catch (_: Exception) {}
        }
        return null
    }
}
