package com.hejitech.g2digest.core

object BriefValidator {
    val TEMPLATES = listOf("status", "discovery", "metric", "agenda", "note")
    val QUIET_BEHAVIORS = listOf("show_status", "omit", "show_last")
    val DEEP_DIVE_POLICIES = listOf("required", "optional", "none")
    val SOURCE_KINDS = listOf("web_news", "rss", "finance", "calendar", "feed")
    val WEEKDAYS = listOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")

    private val KEBAB_RE = Regex("^[a-z0-9]+(?:-[a-z0-9]+)*$")
    private val TIME_RE = Regex("^([01]\\d|2[0-3]):[0-5]\\d$")

    fun checkBrief(brief: Brief): List<BriefIssue> {
        val issues = mutableListOf<BriefIssue>()
        if (brief.title.trim().isEmpty()) {
            issues += BriefIssue("title", "Edition title is required.")
        }
        if (brief.maxTotalCards !in 3..30) {
            issues += BriefIssue("max_total_cards", "Max total cards must be between 3 and 30.")
        }
        if (!TIME_RE.matches(brief.delivery.time)) {
            issues += BriefIssue("delivery.time", "Delivery time must be HH:MM (24-hour).")
        }
        if (brief.delivery.days.isEmpty() || brief.delivery.days.any { it !in WEEKDAYS }) {
            issues += BriefIssue("delivery.days", "Pick at least one valid delivery day.")
        }
        if (brief.sections.isEmpty()) {
            issues += BriefIssue("sections", "Add at least one section.")
        } else if (brief.sections.size > 12) {
            issues += BriefIssue("sections", "At most 12 sections are allowed.")
        }

        val seenIds = mutableSetOf<String>()
        brief.sections.forEachIndexed { idx, s ->
            val p = "sections[$idx]"
            if (!KEBAB_RE.matches(s.id)) {
                issues += BriefIssue("$p.id", "Section #${idx + 1} id must be lowercase-kebab-case.")
            } else if (!seenIds.add(s.id)) {
                issues += BriefIssue("$p.id", "Duplicate section id '${s.id}'.")
            }
            if (s.title.trim().isEmpty()) {
                issues += BriefIssue("$p.title", "Section #${idx + 1} needs a title.")
            } else if (s.title.length > 18) {
                issues += BriefIssue("$p.title", "Section '${s.title}' title must be 18 characters or fewer.")
            }
            if (s.template !in TEMPLATES) {
                issues += BriefIssue("$p.template", "Unknown template '${s.template}'.")
            }
            if (s.maxCards !in 1..10) {
                issues += BriefIssue("$p.max_cards", "Section '${s.title}' max cards must be 1–10.")
            }
            if (s.quietBehavior !in QUIET_BEHAVIORS) {
                issues += BriefIssue("$p.quiet_behavior", "Unknown quiet behavior '${s.quietBehavior}'.")
            }
            if (s.audio.deepDive !in DEEP_DIVE_POLICIES) {
                issues += BriefIssue("$p.audio.deep_dive", "Unknown deep dive policy '${s.audio.deepDive}'.")
            }
            if (s.template == "metric" && s.audio.deepDive == "required") {
                issues += BriefIssue("$p.audio.deep_dive", "Metric section '${s.title}' cannot require deep dives.")
            }
            if (s.source.kind !in SOURCE_KINDS) {
                issues += BriefIssue("$p.source.kind", "Unknown source kind '${s.source.kind}'.")
            }
            if (s.instructions.trim().isEmpty()) {
                issues += BriefIssue("$p.instructions", "Section '${s.title}' needs instructions for the build agent.")
            }
        }

        brief.glossary.forEachIndexed { idx, g ->
            if (g.term.trim().isEmpty() || g.gloss.trim().isEmpty()) {
                issues += BriefIssue("glossary[$idx]", "Glossary entry #${idx + 1} needs both a term and explanation.")
            }
        }
        return issues
    }
}
