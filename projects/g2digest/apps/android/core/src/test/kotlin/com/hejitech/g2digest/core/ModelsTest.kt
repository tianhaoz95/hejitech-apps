package com.hejitech.g2digest.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelsTest {
    @Test
    fun decodesEditionResponseAndAudioMap() {
        val raw = """
            {
              "date": "2026-11-22",
              "title": "Morning Brief",
              "status": "published",
              "bundle": {
                "date": "2026-11-22",
                "guide_version": "0.4",
                "brief_version": 3,
                "edition": {
                  "title": "Morning Brief",
                  "sections": [
                    { "section_id": "sec-1", "title": "Updates", "body": "Summary body.", "sources": [] }
                  ]
                },
                "cards": [
                  {
                    "slug": "cover",
                    "kind": "cover",
                    "title": "Morning Brief",
                    "body": "1 section ready",
                    "glance": { "script": "Hello.", "audio_path": "2026-11-22/cover-glance.mp3", "duration_sec": 12.5 }
                  }
                ]
              },
              "audio": { "2026-11-22/cover-glance.mp3": "https://example.com/a.mp3" }
            }
        """.trimIndent()
        val parsed = G2DigestApiClient.json.decodeFromString<EditionResponse>(raw)
        assertEquals("2026-11-22", parsed.date)
        assertEquals(1, parsed.bundle.cards.size)
        assertEquals("https://example.com/a.mp3", parsed.audio["2026-11-22/cover-glance.mp3"])
    }

    @Test
    fun pkceChallengeIsUrlSafe() {
        val (verifier, challenge) = G2DigestApiClient.generatePkce()
        assertTrue(verifier.length >= 43)
        assertTrue(challenge.length >= 43)
        val url = G2DigestApiClient().googleAuthUrl(challenge)
        assertTrue(url.contains("provider=google"))
        assertTrue(url.contains("code_challenge_method=S256"))
    }

    @Test
    fun briefValidatorCatchesCommonIssuesAndAcceptsValidBrief() {
        val valid = Brief(
            title = "Morning Brief",
            maxTotalCards = 12,
            delivery = BriefDelivery(time = "07:00", timezone = "America/Los_Angeles", days = listOf("mon", "wed", "fri")),
            sections = listOf(
                BriefSection(
                    id = "local-weather",
                    title = "Weather",
                    template = "status",
                    maxCards = 2,
                    instructions = "Summarize morning weather and transit.",
                ),
            ),
        )
        assertEquals(emptyList<BriefIssue>(), BriefValidator.checkBrief(valid))

        val invalid = valid.copy(
            title = "",
            delivery = BriefDelivery(time = "25:99", days = emptyList()),
            sections = listOf(
                BriefSection(
                    id = "Bad ID",
                    title = "A Very Long Section Title Over 18",
                    template = "metric",
                    audio = SectionAudio(glance = true, deepDive = "required"),
                    instructions = "",
                ),
            ),
        )
        val issues = BriefValidator.checkBrief(invalid)
        assertTrue(issues.any { it.path == "title" })
        assertTrue(issues.any { it.path == "delivery.time" })
        assertTrue(issues.any { it.path == "delivery.days" })
        assertTrue(issues.any { it.path == "sections[0].id" })
        assertTrue(issues.any { it.path == "sections[0].title" })
        assertTrue(issues.any { it.path == "sections[0].audio.deep_dive" })
        assertTrue(issues.any { it.path == "sections[0].instructions" })
    }
}
