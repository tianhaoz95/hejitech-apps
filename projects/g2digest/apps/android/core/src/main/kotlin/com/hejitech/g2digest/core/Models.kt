package com.hejitech.g2digest.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AudioRef(
    val script: String,
    @SerialName("audio_path") val audioPath: String,
    @SerialName("duration_sec") val durationSec: Double,
)

@Serializable
data class MetricLine(val label: String, val value: String)

@Serializable
data class CardInput(
    val slug: String,
    val kind: String,
    @SerialName("section_id") val sectionId: String? = null,
    val template: String? = null,
    val title: String,
    val body: String,
    @SerialName("key_number") val keyNumber: String? = null,
    @SerialName("method_keyword") val methodKeyword: String? = null,
    val metrics: List<MetricLine>? = null,
    val alert: Boolean? = null,
    val quiet: Boolean? = null,
    @SerialName("carried_from") val carriedFrom: String? = null,
    @SerialName("source_url") val sourceUrl: String? = null,
    val glance: AudioRef? = null,
    @SerialName("deep_dive") val deepDive: AudioRef? = null,
)

@Serializable
data class SourceReference(val title: String, val url: String)

@Serializable
data class EditionSection(
    @SerialName("section_id") val sectionId: String,
    val title: String,
    val body: String,
    val methodology: String? = null,
    val sources: List<SourceReference> = emptyList(),
)

@Serializable
data class Edition(
    val title: String,
    val intro: String? = null,
    val sections: List<EditionSection> = emptyList(),
)

@Serializable
data class BundleData(
    val date: String,
    @SerialName("guide_version") val guideVersion: String,
    @SerialName("brief_version") val briefVersion: Int,
    val edition: Edition,
    val cards: List<CardInput>,
)

@Serializable
data class EditionResponse(
    val date: String,
    val title: String,
    val status: String? = null,
    @SerialName("publish_at") val publishAt: String? = null,
    @SerialName("published_at") val publishedAt: String? = null,
    val bundle: BundleData,
    val audio: Map<String, String> = emptyMap(),
)

@Serializable
data class EditionSummary(
    val date: String,
    val title: String,
    @SerialName("total_cards") val totalCards: Int = 0,
    @SerialName("total_audio_sec") val totalAudioSec: Double = 0.0,
    val status: String? = null,
)

@Serializable
data class BookmarkItem(
    @SerialName("edition_date") val editionDate: String,
    @SerialName("card_slug") val cardSlug: String,
    @SerialName("card_title") val cardTitle: String,
    @SerialName("section_title") val sectionTitle: String? = null,
    val body: String,
    @SerialName("source_url") val sourceUrl: String? = null,
    @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class BuildRunError(val code: String, val message: String, val card: String? = null)

@Serializable
data class BuildRunItem(
    val id: String,
    val action: String,
    @SerialName("edition_date") val editionDate: String? = null,
    val status: String,
    @SerialName("error_count") val errorCount: Int = 0,
    @SerialName("warning_count") val warningCount: Int = 0,
    val errors: List<BuildRunError> = emptyList(),
    @SerialName("agent_name") val agentName: String? = null,
    @SerialName("created_at") val createdAt: String,
)

@Serializable
data class SearchHitItem(
    val date: String,
    @SerialName("edition_title") val editionTitle: String,
    @SerialName("card_slug") val cardSlug: String,
    @SerialName("card_title") val cardTitle: String,
    @SerialName("section_title") val sectionTitle: String? = null,
    val snippet: String,
    @SerialName("source_url") val sourceUrl: String? = null,
)

@Serializable
data class PairResult(
    @SerialName("device_token") val deviceToken: String,
    @SerialName("device_id") val deviceId: String,
)

@Serializable
data class PairingCode(
    val code: String,
    @SerialName("expires_at") val expiresAt: String,
)

@Serializable
data class PairedDevice(
    val id: String,
    val kind: String,
    val label: String? = null,
    @SerialName("created_at") val createdAt: String,
    @SerialName("last_used_at") val lastUsedAt: String? = null,
)

@Serializable
data class AgentToken(
    val id: String,
    val name: String,
    @SerialName("created_at") val createdAt: String,
    @SerialName("last_used_at") val lastUsedAt: String? = null,
)

@Serializable
data class FeedLinks(
    val id: String,
    val url: String,
    @SerialName("glance_url") val glanceUrl: String? = null,
    @SerialName("deep_dive_url") val deepDiveUrl: String? = null,
)

@Serializable
data class ShareLinkResult(
    val id: String,
    val token: String,
    val url: String,
    @SerialName("expires_at") val expiresAt: String? = null,
)

@Serializable
data class ProStatus(
    val pro: Boolean = false,
    val email: String? = null,
    val until: String? = null,
)

@Serializable
data class AuthSession(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_at") val expiresAtEpochSec: Long = 0,
    val email: String? = null,
)

@Serializable
data class DeliveryStatus(
    val missed: Boolean = false,
    @SerialName("expected_date") val expectedDate: String = "",
    @SerialName("delivery_time") val deliveryTime: String = "07:00",
    val timezone: String = "UTC",
    @SerialName("latest_edition_date") val latestEditionDate: String? = null,
)

@Serializable
data class OnboardingStatus(
    @SerialName("brief_configured") val briefConfigured: Boolean = false,
    @SerialName("agent_connected") val agentConnected: Boolean = false,
    @SerialName("first_validation_passed") val firstValidationPassed: Boolean = false,
    @SerialName("first_edition_published") val firstEditionPublished: Boolean = false,
    val delivery: DeliveryStatus = DeliveryStatus(),
)

@Serializable
data class SectionAudio(
    val glance: Boolean = true,
    @SerialName("deep_dive") val deepDive: String = "optional",
)

@Serializable
data class SectionSource(
    val kind: String = "web_news",
    val entities: List<String>? = null,
    val query: String? = null,
    val urls: List<String>? = null,
)

@Serializable
data class BriefSection(
    val id: String,
    val title: String,
    val template: String = "status",
    @SerialName("max_cards") val maxCards: Int = 2,
    @SerialName("quiet_behavior") val quietBehavior: String = "show_status",
    val audio: SectionAudio = SectionAudio(),
    val source: SectionSource = SectionSource(),
    val instructions: String = "",
)

@Serializable
data class BriefDelivery(
    val time: String = "07:00",
    val timezone: String = "America/Los_Angeles",
    val days: List<String> = listOf("mon", "tue", "wed", "thu", "fri"),
)

@Serializable
data class GlossaryEntry(
    val term: String,
    val gloss: String,
)

@Serializable
data class Brief(
    val title: String = "Morning Brief",
    val language: String = "en",
    val units: String = "imperial",
    @SerialName("max_total_cards") val maxTotalCards: Int = 12,
    @SerialName("tldr_enabled") val tldrEnabled: Boolean = true,
    val delivery: BriefDelivery = BriefDelivery(),
    val sections: List<BriefSection> = emptyList(),
    val glossary: List<GlossaryEntry> = emptyList(),
)

@Serializable
data class BriefResponse(
    val brief: Brief,
    @SerialName("brief_version") val briefVersion: Int = 1,
)

data class BriefIssue(val path: String, val message: String)
