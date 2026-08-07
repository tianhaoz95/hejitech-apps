package com.hejitech.contempo.agent

import com.hejitech.core.model.EntryCategory

/**
 * Deterministic keyword fallback for the capture paths that never go through
 * an LLM parse at all — Manual Entry (blank form, nothing to classify until
 * the user types) and a manually-started timer completed without ever
 * dictating what it was ("Start Timer" -> later filled in on Confirm) — so
 * these entries don't just silently sit at EntryCategory.OTHER forever.
 * Voice/text/photo capture already get a real LLM-inferred category (see
 * AgentClient.parseEntry / EntryTools' RecordEntryTool); ConfirmViewModel
 * only calls this when the current category is still OTHER and the user
 * hasn't manually picked one, so a genuine LLM classification (even a
 * deliberate OTHER) is never clobbered by a lower-quality guess. Mirrors
 * TimerIntentClassifier's "keyword pass before/instead of the LLM" pattern.
 */
object CategoryClassifier {
    private val keywords: List<Pair<EntryCategory, List<String>>> = listOf(
        EntryCategory.TURNOVER to listOf(
            "clean", "turnover", "checkout", "check-out", "linens", "laundry", "towel", "restock the", "vacuum", "sheets",
        ),
        EntryCategory.MAINTENANCE to listOf(
            "repair", "fix", "fixing", "leak", "broken", "maintenance", "hvac", "plumb", "paint", "replace", "install", "appliance",
        ),
        EntryCategory.GUEST_COMMUNICATION to listOf(
            "guest", "message", "messaging", "reply", "replied", "check-in", "check in", "checkin", "text", "call the", "email the", "communicat",
        ),
        EntryCategory.SUPPLY_RUN to listOf(
            "buy", "bought", "shopping", "store", "purchase", "restock", "supplies", "pick up", "picking up",
        ),
        EntryCategory.ADMIN to listOf(
            "admin", "bookkeeping", "taxes", "paperwork", "invoice", "schedul", "planning", "budget", "listing", "pricing", "accounting",
        ),
    )

    fun classify(taskText: String): EntryCategory? {
        val lower = taskText.lowercase().trim()
        if (lower.isEmpty()) return null
        return keywords.firstOrNull { (_, terms) -> terms.any { lower.contains(it) } }?.first
    }
}
