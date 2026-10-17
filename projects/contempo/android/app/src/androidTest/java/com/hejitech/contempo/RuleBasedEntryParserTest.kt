package com.hejitech.contempo

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.hejitech.contempo.agent.RuleBasedEntryParser
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

/** The rule fallback and small-model cross-check: spoken numbers, as Whisper transcribes them. */
@RunWith(AndroidJUnit4::class)
class RuleBasedEntryParserTest {
    private fun minutes(text: String) = RuleBasedEntryParser.parse(text, emptyList())?.durationMinutes

    @Test
    fun spokenDurations() {
        assertEquals(120, minutes("uh spent like two hours fixing the dishwasher"))
        assertEquals(45, minutes("forty-five minutes restocking towels"))
        assertEquals(25, minutes("twenty five minutes on the phone with a guest"))
        assertEquals(90, minutes("an hour and a half of turnover"))
        assertEquals(150, minutes("two and a half hours painting"))
        assertEquals(30, minutes("half an hour answering emails"))
        assertEquals(60, minutes("an hour at the hardware store"))
        assertEquals(80, minutes("1 hour 20 minutes cleaning"))
        assertEquals(null, minutes("fixed the dishwasher"))
    }

    @Test
    fun spokenMilesAndTaskKeepsWords() {
        val draft = RuleBasedEntryParser.parse("drove twelve miles to the lake house", listOf("Lake House"))!!
        assertEquals(12.0, draft.miles)
        assertEquals("Lake House", draft.property)
        assertEquals("Drove twelve miles to the lake house", draft.task)
    }

    @Test
    fun strayModelTaskFallsBackToTheCapture() {
        val model = com.hejitech.contempo.agent.EntryDraft(property = null, task = "start", durationMinutes = null, category = null, eventType = null, miles = null, resolvedActivityDateIso = null)
        val refined = RuleBasedEntryParser.refineSmallModelDraft(model, "two hours fixing the dishwasher", emptyList())
        assertEquals("Two hours fixing the dishwasher", refined.task)
        assertEquals(120, refined.durationMinutes)
        assertEquals("Two hours fixing the dishwasher", RuleBasedEntryParser.refineSmallModelDraft(model.copy(task = "spend_two_hours_fixing_dishwasher"), "two hours fixing the dishwasher", emptyList()).task)
        val good = model.copy(task = "Fixed the dishwasher")
        assertEquals("Fixed the dishwasher", RuleBasedEntryParser.refineSmallModelDraft(good, "two hours fixing the dishwasher", emptyList()).task)
    }
}
