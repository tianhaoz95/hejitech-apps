package com.hejitech.weehours

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.hejitech.weehours.core.LogCoding
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

object WeeColors {
    val Amber = Color(0xFFE59838)
    val AmberLight = Color(0xFFF7E2C4)
    val AmberDark = Color(0xFFB36B12)
    val Cream = Color(0xFFFAF6F0)
    val CreamCard = Color(0xFFFFFFFF)
    val Charcoal = Color(0xFF1F1D1A)
    val CharcoalCard = Color(0xFF2B2824)
    val MutedText = Color(0xFF78716A)
    val Crimson = Color(0xFFD64545)

    // Night HUD (zero blue light)
    val NightBg = Color(0xFF050202)
    val NightSurface = Color(0xFF140707)
    val NightRed = Color(0xFFFF3B30)
    val NightRedDim = Color(0xFF8E241E)

    // Category accents
    val FeedOrange = Color(0xFFE58538)
    val SleepBlue = Color(0xFF4A78B8)
    val DiaperGreen = Color(0xFF4E9A6F)
    val PumpTeal = Color(0xFF3B9B96)
    val SolidsSage = Color(0xFF729B43)
    val GrowthPurple = Color(0xFF8464A0)
    val CareCoral = Color(0xFFD96B52)
    val HealthRose = Color(0xFFC94A6A)
    val PregnancyPlum = Color(0xFF9C598D)

    fun childColor(name: String?): Color = when (name?.lowercase()) {
        "amber" -> Color(0xFFE59838)
        "sky" -> Color(0xFF4A90D9)
        "sage" -> Color(0xFF5A9E6F)
        "plum" -> Color(0xFF9B6B9E)
        "coral" -> Color(0xFFE06D53)
        "teal" -> Color(0xFF3B9B96)
        else -> Amber
    }

    fun categoryColor(category: String): Color = when (category) {
        "feed" -> FeedOrange
        "sleep" -> SleepBlue
        "diaper" -> DiaperGreen
        "pump" -> PumpTeal
        "solids" -> SolidsSage
        "growth" -> GrowthPurple
        "health", "temperature", "medicine" -> HealthRose
        "movement" -> PregnancyPlum
        else -> CareCoral
    }
}

private val LightScheme = lightColorScheme(
    primary = WeeColors.Amber,
    onPrimary = Color.White,
    primaryContainer = WeeColors.AmberLight,
    onPrimaryContainer = WeeColors.Charcoal,
    secondary = WeeColors.SleepBlue,
    onSecondary = Color.White,
    background = WeeColors.Cream,
    onBackground = WeeColors.Charcoal,
    surface = WeeColors.CreamCard,
    onSurface = WeeColors.Charcoal,
    surfaceVariant = Color(0xFFF0EAE1),
    onSurfaceVariant = WeeColors.MutedText,
    error = WeeColors.Crimson,
    onError = Color.White
)

private val DarkScheme = darkColorScheme(
    primary = WeeColors.Amber,
    onPrimary = WeeColors.Charcoal,
    primaryContainer = WeeColors.AmberDark,
    onPrimaryContainer = Color.White,
    secondary = WeeColors.SleepBlue,
    onSecondary = Color.White,
    background = WeeColors.Charcoal,
    onBackground = WeeColors.Cream,
    surface = WeeColors.CharcoalCard,
    onSurface = WeeColors.Cream,
    surfaceVariant = Color(0xFF38342F),
    onSurfaceVariant = Color(0xFFB5ADA3),
    error = WeeColors.Crimson,
    onError = Color.White
)

@Composable
fun WeeHoursTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkScheme else LightScheme,
        content = content
    )
}

@Serializable
enum class NowSection(val id: String, val title: String, val subtitle: String) {
    @SerialName("status") STATUS("status", "Status & Timers", "Live status per child, active sessions, and on-duty caregiver"),
    @SerialName("tiles") TILES("tiles", "Quick Log Tiles", "One-tap bottle, nursing, diaper, sleep, and pumping buttons"),
    @SerialName("details") DETAILS("details", "Needs Details & Review", "Quick-captured events waiting for details or voice disambiguation"),
    @SerialName("rhythm") RHYTHM("rhythm", "Today vs 7-Day Rhythm", "Compare feeds, sleep, and diapers at this time of day"),
    @SerialName("note") NOTE("note", "Shift Handoff Note", "Pinned note for the next caregiver coming on duty"),
    @SerialName("partner") PARTNER("partner", "Partner Pulse", "Real-time indicator when another caregiver logs"),
    @SerialName("digest") DIGEST("digest", "Shift Digest", "Summary of events logged during the current shift"),
    @SerialName("stash") STASH("stash", "Milk Stash (FIFO)", "Fridge & freezer breastmilk inventory with expiry tracking"),
    @SerialName("pregnancy") PREGNANCY("pregnancy", "Pregnancy & Kick Counter", "Fetal movements, 10-kick timer, and contractions"),
    @SerialName("care") CARE("care", "Care, Health & Activities", "Temperature, medicine, bath, tummy time, milestones"),
    @SerialName("growth") GROWTH("growth", "Growth & WHO Percentiles", "Weight, length, and head circumference tracking"),
    @SerialName("photos") PHOTOS("photos", "Recent Photos", "Photos attached to today's logged moments");

    companion object {
        val defaultOrder: List<NowSection> = listOf(
            STATUS,
            PARTNER,
            DETAILS,
            TILES,
            NOTE,
            RHYTHM,
            PREGNANCY,
            CARE,
            STASH,
            GROWTH,
            PHOTOS,
            DIGEST
        )

        fun fromId(id: String): NowSection? = entries.firstOrNull { it.id == id }
    }
}

@Serializable
data class NowLayout(
    val active: List<NowSection> = NowSection.defaultOrder
) {
    val available: List<NowSection>
        get() = NowSection.entries.filter { it !in active }

    fun moveUp(section: NowSection): NowLayout {
        val idx = active.indexOf(section)
        if (idx <= 0) return this
        val mut = active.toMutableList()
        val tmp = mut[idx - 1]
        mut[idx - 1] = mut[idx]
        mut[idx] = tmp
        return copy(active = mut)
    }

    fun moveDown(section: NowSection): NowLayout {
        val idx = active.indexOf(section)
        if (idx < 0 || idx >= active.lastIndex) return this
        val mut = active.toMutableList()
        val tmp = mut[idx + 1]
        mut[idx + 1] = mut[idx]
        mut[idx] = tmp
        return copy(active = mut)
    }

    fun remove(section: NowSection): NowLayout {
        if (section == NowSection.STATUS || section == NowSection.TILES) return this
        return copy(active = active.filter { it != section })
    }

    fun add(section: NowSection): NowLayout {
        if (section in active) return this
        return copy(active = active + section)
    }

    fun encode(): String = LogCoding.json.encodeToString(serializer(), this)

    companion object {
        fun decode(raw: String?): NowLayout {
            if (raw.isNullOrBlank()) return NowLayout()
            return try {
                LogCoding.json.decodeFromString(serializer(), raw)
            } catch (_: Exception) {
                NowLayout()
            }
        }
    }
}
