import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Optional Apple Intelligence (`FoundationModels`, iOS 26+) helper for fast on-device text
/// responses without loading the bundled LiteRT-LM model. Returns nil when unavailable so callers
/// fall back seamlessly to LiteRT-LM or `RuleBasedEntryParser`.
enum AppleIntelligenceHelper {
    static var isAvailable: Bool {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            if case .available = SystemLanguageModel.default.availability {
                return true
            }
        }
        #endif
        return false
    }

    static func respond(systemPrompt: String, userPrompt: String) async -> String? {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            guard case .available = SystemLanguageModel.default.availability else { return nil }
            do {
                let session = LanguageModelSession(instructions: systemPrompt)
                let response = try await session.respond(to: userPrompt)
                let text = response.content.trimmingCharacters(in: .whitespacesAndNewlines)
                return text.isEmpty ? nil : text
            } catch {
                return nil
            }
        }
        #endif
        return nil
    }
}
