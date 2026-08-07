import ContempoFirestore
import FirebaseFunctions
import Foundation

/// Two-tier entry parsing + chat, mirroring Android's `AgentClient`:
///
///  1. Try the on-device model (`OnDeviceLlm` — Gemma 4 E2B via LiteRT-LM,
///     see task #5) — free, no network round trip.
///  2. Cloud fallback: the `parseEntry`/`askAgent` Genkit flows in
///     backend/functions/src/flows.
///
/// Which tier actually runs is governed by the caller-supplied
/// `inferencePreference` (backed by AI settings, user-controlled from
/// Settings). Notably, `.onDeviceOnly` does NOT fall back to cloud on
/// failure: a silent fallback can never prove the on-device model actually
/// works, which is the whole point of that setting.
@MainActor
final class AgentClient {
    private let onDeviceLlm: OnDeviceLlm
    private let functions: Functions
    private let inferencePreference: () -> InferencePreference

    init(onDeviceLlm: OnDeviceLlm, functions: Functions, inferencePreference: @escaping () -> InferencePreference) {
        self.onDeviceLlm = onDeviceLlm
        self.functions = functions
        self.inferencePreference = inferencePreference
    }

    /// `onStage` is a best-effort progress signal for the caller to render
    /// (see `ParsingStage`) — tied to which branch is actually being taken.
    func parseEntry(rawText: String, knownProperties: [String], onStage: (ParsingStage) -> Void = { _ in }) async -> ParseOutcome {
        switch inferencePreference() {
        case .cloudOnly:
            onStage(.structuring)
            return await cloudParseEntry(rawText: rawText, knownProperties: knownProperties)

        case .onDeviceOnly:
            onStage(.tryingOnDevice)
            if let result = await onDeviceExtractEntry(rawText: rawText, knownProperties: knownProperties) {
                return result
            }
            return .failure(message: "On-device model unavailable — no cloud fallback (On-device only is selected in Settings).")

        case .preferOnDevice:
            onStage(.tryingOnDevice)
            if let result = await onDeviceExtractEntry(rawText: rawText, knownProperties: knownProperties) {
                return result
            }
            onStage(.fallingBackToCloud)
            return await cloudParseEntry(rawText: rawText, knownProperties: knownProperties)
        }
    }

    /// Drafts an entry from a just-taken photo. Deliberately no cloud vision
    /// fallback yet — a photo a host takes shouldn't leave the device
    /// silently, and a real cloud vision flow is future work.
    func draftEntryFromPhoto(imageData: Data, knownProperties: [String]) async -> ParseOutcome {
        let prompt = Self.buildPhotoEntryPrompt(knownProperties: knownProperties)
        switch inferencePreference() {
        case .cloudOnly:
            return .failure(message: "Photo drafting isn't available in Cloud-only mode yet — switch to On-device only or Prefer on-device in Settings, or fill in the entry manually.")
        case .onDeviceOnly:
            if let result = await onDeviceDraftFromPhoto(imageData: imageData, prompt: prompt) { return result }
            return .failure(message: "On-device model unavailable for photo drafting — no cloud fallback (On-device only is selected in Settings).")
        case .preferOnDevice:
            if let result = await onDeviceDraftFromPhoto(imageData: imageData, prompt: prompt) { return result }
            return .failure(message: "This device's on-device model isn't ready for photo understanding yet, and cloud photo drafting isn't built yet — fill in the entry manually; the photo is still attached as evidence.")
        }
    }

    /// Reads a single odometer number from a photo — used by the mileage-trip photo capture method.
    func readOdometerFromPhoto(imageData: Data) async -> OdometerReadOutcome {
        let prompt = Self.buildOdometerPrompt()
        switch inferencePreference() {
        case .cloudOnly:
            return .failure(message: "Odometer reading isn't available in Cloud-only mode yet — switch to On-device only or Prefer on-device in Settings, or enter the mileage manually.")
        case .onDeviceOnly:
            if let result = await onDeviceReadOdometer(imageData: imageData, prompt: prompt) { return result }
            return .failure(message: "On-device model unavailable for odometer reading — no cloud fallback (On-device only is selected in Settings).")
        case .preferOnDevice:
            if let result = await onDeviceReadOdometer(imageData: imageData, prompt: prompt) { return result }
            return .failure(message: "This device's on-device model isn't ready for photo understanding yet, and cloud odometer reading isn't built yet — enter the mileage manually.")
        }
    }

    func askQuestionStream(
        history: [ChatMessage],
        question: String,
        stats: UserStats,
        attachedEntries: [Entry] = [],
        onEvent: @escaping (GenerationEvent) -> Void
    ) async -> AskOutcome {
        let prompt = Self.buildChatPrompt(history: history, question: question, stats: stats, attachedEntries: attachedEntries)
        switch inferencePreference() {
        case .cloudOnly:
            return await cloudAskQuestion(history: history, question: question, stats: stats, attachedEntries: attachedEntries)
        case .onDeviceOnly:
            if let text = await onDeviceLlm.generateTextStream(prompt, onEvent: onEvent) {
                return .success(answer: text, source: .onDevice)
            }
            return .failure(message: "On-device model unavailable — no cloud fallback (On-device only is selected in Settings).")
        case .preferOnDevice:
            if let text = await onDeviceLlm.generateTextStream(prompt, onEvent: onEvent) {
                return .success(answer: text, source: .onDevice)
            }
            return await cloudAskQuestion(history: history, question: question, stats: stats, attachedEntries: attachedEntries)
        }
    }

    func askQuestion(
        history: [ChatMessage],
        question: String,
        stats: UserStats,
        imageData: Data? = nil,
        attachedEntries: [Entry] = []
    ) async -> AskOutcome {
        let prompt = Self.buildChatPrompt(history: history, question: question, stats: stats, attachedEntries: attachedEntries)
        if let imageData {
            switch inferencePreference() {
            case .cloudOnly:
                return .failure(message: "Photo questions aren't available in Cloud-only mode yet — switch to On-device only or Prefer on-device in Settings.")
            case .onDeviceOnly:
                if let text = await onDeviceLlm.generateFromImage(imageData, prompt: prompt) {
                    return .success(answer: text, source: .onDevice)
                }
                return .failure(message: "On-device model unavailable for photo questions — no cloud fallback (On-device only is selected in Settings).")
            case .preferOnDevice:
                if let text = await onDeviceLlm.generateFromImage(imageData, prompt: prompt) {
                    return .success(answer: text, source: .onDevice)
                }
                return .failure(message: "This device's on-device model isn't ready for photo questions yet, and cloud photo questions aren't built yet.")
            }
        }
        switch inferencePreference() {
        case .cloudOnly:
            return await cloudAskQuestion(history: history, question: question, stats: stats, attachedEntries: attachedEntries)
        case .onDeviceOnly:
            if let text = await onDeviceLlm.generateText(prompt) {
                return .success(answer: text, source: .onDevice)
            }
            return .failure(message: "On-device model unavailable — no cloud fallback (On-device only is selected in Settings).")
        case .preferOnDevice:
            if let text = await onDeviceLlm.generateText(prompt) {
                return .success(answer: text, source: .onDevice)
            }
            return await cloudAskQuestion(history: history, question: question, stats: stats, attachedEntries: attachedEntries)
        }
    }

    /// Cleans up a raw Whisper transcript before it's shown to the user or
    /// handed to `parseEntry`. Deliberately always on-device (never gated by
    /// the user's inference preference) — a lightweight formatting pass, not
    /// core functionality, so on unsupported/not-yet-ready hardware the
    /// honest behavior is "skip it, use the raw transcript as-is."
    func cleanupTranscript(_ rawText: String) async -> String {
        guard !rawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return rawText }
        return await onDeviceLlm.generateText(Self.buildCleanupPrompt(rawText: rawText)) ?? rawText
    }

    private func onDeviceExtractEntry(rawText: String, knownProperties: [String]) async -> ParseOutcome? {
        guard let draft = await onDeviceLlm.extractEntryDraft(rawText: rawText, knownProperties: knownProperties) else { return nil }
        return .success(ParseResult(draft: draft, source: .onDevice))
    }

    private func onDeviceReadOdometer(imageData: Data, prompt: String) async -> OdometerReadOutcome? {
        guard let text = await onDeviceLlm.generateFromImage(imageData, prompt: prompt) else { return nil }
        guard let miles = Self.extractNumber(text) else {
            return .failure(message: "Couldn't read a number from that photo — make sure the odometer digits are clearly visible and try again.")
        }
        return .success(miles: miles, source: .onDevice)
    }

    private func onDeviceDraftFromPhoto(imageData: Data, prompt: String) async -> ParseOutcome? {
        guard let text = await onDeviceLlm.generateFromImage(imageData, prompt: prompt) else { return nil }
        guard let draft = try? JSONDecoder().decode(EntryDraft.self, from: Data(Self.extractJsonObject(text).utf8)) else { return nil }
        return .success(ParseResult(draft: draft, source: .onDevice))
    }

    private func cloudParseEntry(rawText: String, knownProperties: [String]) async -> ParseOutcome {
        do {
            let payload: [String: Any] = [
                "rawText": rawText,
                "knownProperties": knownProperties,
                "nowIso": ISO8601DateFormatter().string(from: Date()),
            ]
            let result = try await functions.httpsCallable("parseEntry").call(payload)
            guard let draft = Self.parseCallableResult(result.data) else {
                return .failure(message: "Cloud parse returned an unexpected shape")
            }
            return .success(ParseResult(draft: draft, source: .cloud))
        } catch {
            return .failure(message: error.localizedDescription)
        }
    }

    private func cloudAskQuestion(history: [ChatMessage], question: String, stats: UserStats, attachedEntries: [Entry] = []) async -> AskOutcome {
        do {
            let payload: [String: Any] = [
                "history": history.map { ["role": $0.role.rawValue, "text": $0.text] },
                "question": question,
                "confirmedHours": stats.confirmedHours,
                "thresholdHours": stats.thresholdHours,
                "testName": stats.testName,
                "attachedEntries": attachedEntries.map { $0.chatContextPayload() },
            ]
            let result = try await functions.httpsCallable("askAgent").call(payload)
            guard let data = result.data as? [String: Any], let answer = data["answer"] as? String else {
                return .failure(message: "Cloud answer returned an unexpected shape")
            }
            return .success(answer: answer, source: .cloud)
        } catch {
            return .failure(message: error.localizedDescription)
        }
    }

    private static func parseCallableResult(_ data: Any?) -> EntryDraft? {
        guard let map = data as? [String: Any] else { return nil }
        return EntryDraft(
            property: map["property"] as? String,
            task: map["task"] as? String,
            durationMinutes: (map["durationMinutes"] as? NSNumber)?.intValue,
            category: map["category"] as? String,
            eventType: map["eventType"] as? String,
            miles: (map["miles"] as? NSNumber)?.doubleValue,
            resolvedActivityDateIso: map["resolvedActivityDateIso"] as? String
        )
    }

    private static func buildPhotoEntryPrompt(knownProperties: [String]) -> String {
        var lines = ["You extract a short-term-rental work-log entry from a photo a host just took of work they did."]
        if !knownProperties.isEmpty {
            lines.append("Known properties: \(knownProperties.joined(separator: ", ")).")
        }
        lines.append("Look at the photo and describe the task it evidences (e.g. cleaning, a repair, a replaced part, a receipt) as a short, specific sentence.")
        lines.append("Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:")
        lines.append(#"{"property": string|null, "task": string|null, "durationMinutes": integer|null, "category": one of "maintenance"|"turnover"|"guest_communication"|"supply_run"|"admin"|"other"|null}"#)
        lines.append("A photo alone often won't show duration or which property, and that's fine — fill in whatever you can determine and leave the rest null. Never withhold the draft to ask a question; the host reviews and fills in gaps themselves afterward.")
        return lines.joined(separator: "\n")
    }

    private static func buildChatPrompt(history: [ChatMessage], question: String, stats: UserStats, attachedEntries: [Entry] = []) -> String {
        var lines = [
            "You are the in-app copilot for an app that helps short-term-rental hosts log hours " +
            "toward IRS material-participation tests (IRS Pub 925 / §1.469-5T). " +
            "You are not a lawyer or CPA and this is not tax or legal advice — say so plainly " +
            "for genuinely unsettled or fact-specific questions, and suggest confirming with a tax professional. " +
            "Do not fabricate case law, IRS rulings, or numbers you weren't given.",
            "This host is tracking toward the \(stats.testName) test: \(stats.confirmedHours) of \(stats.thresholdHours) hours confirmed so far.",
        ]
        if !attachedEntries.isEmpty {
            lines.append("The host attached these specific logged entries to ask about — ground your answer in them, don't ask which entry they mean:")
            for (index, entry) in attachedEntries.enumerated() {
                let property = entry.propertyName.isEmpty ? "(no property)" : entry.propertyName
                let task = entry.task.isEmpty ? "(no task)" : entry.task
                lines.append("\(index + 1). \(property) — \(task) (\(entry.durationMinutes) min, \(entry.category), \(entry.activityDate.dateValue()))")
            }
        }
        for message in history {
            let speaker = message.role == .user ? "Host" : "You"
            lines.append("\(speaker): \(message.text)")
        }
        lines.append("Host: \(question)")
        lines.append("Respond with plain text only — no markdown, no JSON.")
        return lines.joined(separator: "\n")
    }

    private static func buildOdometerPrompt() -> String {
        """
        You are reading a car odometer or trip-mileage display from a photo.
        Respond with ONLY the number shown — digits only, no units, no commentary, no markdown.
        If you cannot clearly read a number in the photo, respond with exactly: unknown
        """
    }

    private static func buildCleanupPrompt(rawText: String) -> String {
        """
        You clean up dictated speech-to-text for a short-term-rental host's work log entry.
        Fix likely transcription errors, punctuation, and capitalization.
        Keep the meaning and every detail exactly the same — never add or remove information.
        Respond with ONLY the corrected text, no commentary, no quotes, no markdown.
        Dictated text: "\(rawText)"
        """
    }

    /// First number found in the model's response, or nil (covers "unknown" and any non-numeric reply).
    private static func extractNumber(_ text: String) -> Double? {
        guard let range = text.range(of: #"\d+(\.\d+)?"#, options: .regularExpression) else { return nil }
        return Double(text[range])
    }

    /// Strips markdown code fences etc. in case the on-device model adds them despite instructions not to.
    private static func extractJsonObject(_ text: String) -> String {
        guard let start = text.firstIndex(of: "{"), let end = text.lastIndex(of: "}"), start < end else { return text }
        return String(text[start...end])
    }
}

private extension Entry {
    /// Plain summary sent to `askAgent`'s `attachedEntries` field — mirrors
    /// backend's `AttachedEntrySchema`, not the full document (no ids,
    /// photo/audio URLs, etc.).
    func chatContextPayload() -> [String: Any] {
        [
            "propertyName": propertyName,
            "task": task,
            "durationMinutes": durationMinutes,
            "category": category,
            "activityDate": ISO8601DateFormatter().string(from: activityDate.dateValue()),
        ]
    }
}
