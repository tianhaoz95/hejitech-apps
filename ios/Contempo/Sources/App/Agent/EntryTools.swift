import Foundation

/// Captures the terminal `record_entry` tool call's arguments so
/// `LiteRtLlm.extractEntryDraft` can retrieve them once the conversation
/// finishes — unlike Android's LiteRT-LM binding (which runs a manual,
/// non-automatic tool loop and reads a `ToolCall`'s arguments directly), the
/// Swift package's `Tool.run()` bodies are actually executed by
/// `automaticToolCalling`, so this is the natural way to get the result back
/// out to the caller.
actor EntryDraftCapture {
    static let shared = EntryDraftCapture()

    private var captured: EntryDraft?

    func capture(_ draft: EntryDraft) {
        captured = draft
    }

    func takeCaptured() -> EntryDraft? {
        defer { captured = nil }
        return captured
    }
}

/// Tool declarations for on-device entry extraction — mirrors Android's
/// `EntryTools.kt` schema exactly (same names/descriptions/params), but each
/// `run()` body here is real: `RecordEntryTool` captures its arguments into
/// `EntryDraftCapture`, and the three time-arithmetic tools compute their
/// results directly, rather than being schema-only placeholders dispatched
/// by hand elsewhere.
///
/// `computeTimeBefore`/`computeTimeAfter` take `amountMinutes` only, never a
/// unit — on-device testing on Android showed the model would sometimes
/// convert the number (e.g. "4 hours" -> 240) without also updating the unit
/// label to match, silently corrupting the result. `convertToMinutes` exists
/// so the model does that conversion as its own explicit, deterministic tool
/// call instead of inline arithmetic it has to remember to keep consistent.
struct RecordEntryTool: Tool {
    static let name = "record_entry"
    static let description = "Record the structured details extracted from a short-term-rental host's description of work they did. Call this last, once you have everything you can determine."

    @ToolParam(description: "Property name/nickname, matched to a known property if the text clearly refers to one")
    var property: String?
    @ToolParam(description: "Short, specific, cleaned-up description of the work performed")
    var task: String?
    @ToolParam(description: "How long the work took, in minutes")
    var durationMinutes: Int?
    @ToolParam(description: "One of: maintenance, turnover, guest_communication, supply_run, admin, other")
    var category: String?
    @ToolParam(description: "One of: start, stop — only when opening/closing a timer, not a completed task")
    var eventType: String?
    @ToolParam(description: "Business miles driven, if a distance was stated")
    var miles: Double?
    @ToolParam(description: "Absolute ISO-8601 timestamp for when the work happened, computed via getCurrentTime/computeTimeBefore/computeTimeAfter if the host mentioned any time reference; leave null if none was mentioned")
    var resolvedActivityDateIso: String?

    init() {}

    func run() async throws -> Any {
        await EntryDraftCapture.shared.capture(EntryDraft(
            property: property,
            task: task,
            durationMinutes: durationMinutes,
            category: category,
            eventType: eventType,
            miles: miles,
            resolvedActivityDateIso: resolvedActivityDateIso
        ))
        return ["status": "recorded"]
    }
}

struct GetCurrentTimeTool: Tool {
    static let name = "get_current_time"
    static let description = "Get the current date and time, as an absolute ISO-8601 timestamp. Call this first if you need to resolve any time reference in the host's words."

    init() {}

    func run() async throws -> Any {
        ISO8601DateFormatter().string(from: Date())
    }
}

struct ConvertToMinutesTool: Tool {
    static let name = "convert_to_minutes"
    static let description = "Convert a duration to minutes. Every time amount used elsewhere in this tool set is always in minutes — call this first for any amount the host stated in hours or days, and use its result as amount_minutes."

    @ToolParam(description: "The number to convert")
    var amount: Int
    @ToolParam(description: "One of: minutes, hours, days")
    var unit: String

    init() {}

    func run() async throws -> Any {
        switch unit {
        case "hours": return amount * 60
        case "days": return amount * 1440
        default: return amount
        }
    }
}

struct ComputeTimeBeforeTool: Tool {
    static let name = "compute_time_before"
    static let description = "Compute an absolute ISO-8601 timestamp a given number of minutes before a reference timestamp — e.g. '4 hours ago' from the current time (convert hours/days to minutes with convert_to_minutes first)."

    @ToolParam(description: "Reference ISO-8601 timestamp, usually from get_current_time")
    var referenceIso: String
    @ToolParam(description: "How many minutes before the reference")
    var amountMinutes: Int

    init() {}

    func run() async throws -> Any {
        guard let reference = ISO8601DateFormatter().date(from: referenceIso) else { return referenceIso }
        return ISO8601DateFormatter().string(from: reference.addingTimeInterval(-Double(amountMinutes) * 60))
    }
}

struct ComputeTimeAfterTool: Tool {
    static let name = "compute_time_after"
    static let description = "Compute an absolute ISO-8601 timestamp a given number of minutes after a reference timestamp (convert hours/days to minutes with convert_to_minutes first)."

    @ToolParam(description: "Reference ISO-8601 timestamp")
    var referenceIso: String
    @ToolParam(description: "How many minutes after the reference")
    var amountMinutes: Int

    init() {}

    func run() async throws -> Any {
        guard let reference = ISO8601DateFormatter().date(from: referenceIso) else { return referenceIso }
        return ISO8601DateFormatter().string(from: reference.addingTimeInterval(Double(amountMinutes) * 60))
    }
}

enum EntryTools {
    static func all() -> [Tool] {
        [RecordEntryTool(), GetCurrentTimeTool(), ConvertToMinutesTool(), ComputeTimeBeforeTool(), ComputeTimeAfterTool()]
    }

    static func buildSystemPrompt(knownProperties: [String]) -> String {
        var lines = ["You extract short-term-rental work-log entries from a host's own words."]
        if !knownProperties.isEmpty {
            lines.append("Known properties: \(knownProperties.joined(separator: ", ")).")
        }
        lines.append("The host's message is dictated speech, not typed text — clean it up before extracting \"task\": remove filler words and disfluencies (\"uh\", \"um\", false starts, mid-sentence restarts) that carry no information, and fix likely transcription errors, punctuation, and capitalization. Never change the meaning or drop a real detail.")
        lines.append("Format \"task\" as plain prose by default. Only use a markdown bullet list (lines starting with \"- \") when the host clearly describes multiple distinct sub-tasks in one capture — a single task never needs a bullet. Never use headers, tables, or bold; a bullet list is the only formatting ever appropriate here, and only when it actually makes several items easier to scan than a sentence would.")
        lines.append("Set event_type only if the host is opening or closing a start/stop timer rather than describing a complete task: \"start\" for phrasing like 'I'm starting to work on X' / 'beginning work now' / 'clocking in', \"stop\" for phrasing like 'I just finished' / 'wrapping up' / 'clocking out'. Leave event_type null for a normal complete description of work already done — most messages are this case. When event_type is \"start\", duration_minutes should be null.")
        lines.append("Set miles if the host states a distance driven (e.g. 'drove 12 miles to pick up supplies') — a separate business-mileage tax deduction, not the hours above, so extract it whenever mentioned even alongside a normal task/duration. Leave miles null if no distance is mentioned.")
        lines.append("If the host mentions when the work happened relative to now (e.g. \"4 hours ago\", \"this morning\", \"last night\", \"yesterday\") or at a specific clock time (e.g. \"at 3pm\"), call get_current_time first. compute_time_before/compute_time_after take amount_minutes only — always minutes, never hours or days — so if the host's amount isn't already in minutes, call convert_to_minutes first (e.g. \"4 hours\" -> convert_to_minutes(amount=4, unit=\"hours\")) and use its result as amount_minutes. Never compute any of this arithmetic yourself — always call the tools. Leave resolved_activity_date_iso null if the host mentions no time reference at all — most messages are this case.")
        lines.append("Capture is meant to be fast, not a conversation: fill in every field you can confidently determine, and leave any field you genuinely can't determine as null. Never withhold a field or ask a question — the host reviews and fills in gaps themselves afterward, so a partial entry is the correct output, not a failure.")
        lines.append("Once you have everything you can determine, call record_entry exactly once with the final result.")
        return lines.joined(separator: "\n")
    }
}
