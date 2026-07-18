package com.hejitech.contempo.agent

import com.google.ai.edge.litertlm.Tool
import com.google.ai.edge.litertlm.ToolParam
import com.google.ai.edge.litertlm.ToolSet

/**
 * Tool declarations for on-device entry extraction (see LiteRtLlm.extractEntryDraft).
 * Every function body is unreachable by design: LiteRtLlm's manual tool loop always
 * runs with automaticToolCalling = false, so the SDK's own reflective
 * ReflectionTool.execute() path — which would actually invoke these — never fires.
 * ReflectionTool is only used here to derive each tool's JSON schema from the
 * function signature via reflection; the real behavior for getCurrentTime/
 * convertToMinutes/computeTimeBefore/computeTimeAfter lives in plain, directly-called
 * functions in LiteRtLlm, and recordEntry's "return value" is never used at all — its
 * arguments are read straight off the ToolCall the model emits.
 *
 * computeTimeBefore/computeTimeAfter take amountMinutes only, never a unit — an
 * earlier design accepted an amount+unit pair, but on-device testing showed the
 * model would sometimes convert the number (e.g. "4 hours" -> 240) without also
 * updating the unit label to match, silently corrupting the result. convertToMinutes
 * exists so the model does that conversion as its own explicit, deterministic tool
 * call instead of inline arithmetic it has to remember to keep consistent.
 */
internal object EntryTools : ToolSet {
    @Tool(description = "Record the structured details extracted from a short-term-rental host's description of work they did. Call this last, once you have everything you can determine.")
    fun recordEntry(
        @ToolParam(description = "Property name/nickname, matched to a known property if the text clearly refers to one") property: String? = null,
        @ToolParam(description = "Short, specific, cleaned-up description of the work performed") task: String? = null,
        @ToolParam(description = "How long the work took, in minutes") durationMinutes: Int? = null,
        @ToolParam(description = "One of: maintenance, turnover, guest_communication, supply_run, admin, other") category: String? = null,
        @ToolParam(description = "One of: start, stop — only when opening/closing a timer, not a completed task") eventType: String? = null,
        @ToolParam(description = "Business miles driven, if a distance was stated") miles: Double? = null,
        @ToolParam(description = "Absolute ISO-8601 timestamp for when the work happened, computed via getCurrentTime/computeTimeBefore/computeTimeAfter if the host mentioned any time reference; leave null if none was mentioned") resolvedActivityDateIso: String? = null,
    ): Unit = error("schema-only — never invoked; see LiteRtLlm's manual tool loop")

    @Tool(description = "Get the current date and time, as an absolute ISO-8601 timestamp. Call this first if you need to resolve any time reference in the host's words.")
    fun getCurrentTime(): String = error("schema-only — never invoked; see LiteRtLlm's manual tool loop")

    @Tool(description = "Convert a duration to minutes. Every time amount used elsewhere in this tool set is always in minutes — call this first for any amount the host stated in hours or days, and use its result as amount_minutes.")
    fun convertToMinutes(
        @ToolParam(description = "The number to convert") amount: Int,
        @ToolParam(description = "One of: minutes, hours, days") unit: String,
    ): Int = error("schema-only — never invoked; see LiteRtLlm's manual tool loop")

    @Tool(description = "Compute an absolute ISO-8601 timestamp a given number of minutes before a reference timestamp — e.g. '4 hours ago' from the current time (convert hours/days to minutes with convert_to_minutes first).")
    fun computeTimeBefore(
        @ToolParam(description = "Reference ISO-8601 timestamp, usually from getCurrentTime") referenceIso: String,
        @ToolParam(description = "How many minutes before the reference") amountMinutes: Int,
    ): String = error("schema-only — never invoked; see LiteRtLlm's manual tool loop")

    @Tool(description = "Compute an absolute ISO-8601 timestamp a given number of minutes after a reference timestamp (convert hours/days to minutes with convert_to_minutes first).")
    fun computeTimeAfter(
        @ToolParam(description = "Reference ISO-8601 timestamp") referenceIso: String,
        @ToolParam(description = "How many minutes after the reference") amountMinutes: Int,
    ): String = error("schema-only — never invoked; see LiteRtLlm's manual tool loop")
}
