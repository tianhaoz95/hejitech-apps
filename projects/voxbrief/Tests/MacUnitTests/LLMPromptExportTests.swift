import XCTest
@testable import VoxbriefMac

/// Builds the prompts for every case of the Stage 2 LLM eval (`evals/llm/cases.json`) with the
/// app's own prompt builders, so `evals/llm/run_eval.py` scores exactly what ships. As a unit test
/// it checks every case builds; it writes the prompts only when `VOXBRIEF_PROMPT_EXPORT` names a
/// file (set `TEST_RUNNER_VOXBRIEF_PROMPT_EXPORT` through xcodebuild, see `evals/llm/README.md`).
final class LLMPromptExportTests: XCTestCase {
    private struct EvalCase: Decodable {
        struct Entry: Decodable {
            var term: String
            var aliases: [String]?
            var contextHint: String?
        }

        var id: String
        var mode: String
        var transcript: String
        var dictionary: [Entry]?
        var templates: [String]?
    }

    func testExportPromptsForEvalCases() throws {
        // Bundled as a test resource (project.yml).
        let casesURL = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "cases", withExtension: "json"))
        let data = try Data(contentsOf: casesURL)
        let cases = try JSONDecoder().decode([EvalCase].self, from: data)
        XCTAssertFalse(cases.isEmpty)
        XCTAssertEqual(Set(cases.map(\.id)).count, cases.count, "Case ids must be unique")

        let service = LLMCopywriterService()
        var exported: [[String: Any]] = []
        for evalCase in cases {
            let dictionary = (evalCase.dictionary ?? []).map {
                DictionaryEntry(term: $0.term, aliases: $0.aliases ?? [], contextHint: $0.contextHint)
            }
            // Same steps as NoteProcessingPipeline (aliases) and processTranscript (tokens, voice
            // commands, trimming) before a prompt is built.
            let corrected = DictionaryCorrector.apply(to: evalCase.transcript, entries: dictionary)
            let transcript = VoiceCommandProcessor.process(service.stripASRSpecialTokens(corrected))
                .cleanedTranscript
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let userPrompt = service.transcriptUserPrompt(transcript, dictionary: dictionary)

            var item: [String: Any] = ["id": evalCase.id, "mode": evalCase.mode]
            switch evalCase.mode {
            case "light":
                item["light"] = ["system": service.buildLightSystemPrompt(dictionary: dictionary), "user": userPrompt]
            case "full":
                let templates = try evalCase.templates.map { names in
                    try names.map { name in
                        try XCTUnwrap(NoteTemplate.builtIns.first { $0.name == name }, "\(evalCase.id): unknown template \(name)")
                    }
                } ?? NoteTemplate.builtIns
                if LLMCopywriterService.singleTemplate(in: templates) == nil {
                    // maxTokens matches the MLX classification call.
                    item["classification"] = [
                        "system": service.buildClassificationSystemPrompt(templates: templates),
                        "user": transcript,
                        "maxTokens": 24
                    ] as [String: Any]
                }
                item["fallbackTemplate"] = service.effectiveFallbackTemplate(in: templates).name
                item["generation"] = Dictionary(uniqueKeysWithValues: templates.map { template in
                    (template.name, [
                        "system": service.buildGenerationSystemPrompt(template: template, dictionary: dictionary),
                        "user": userPrompt,
                        "fieldKeys": template.sections.map(\.fieldKey)
                    ] as [String: Any])
                })
            default:
                XCTFail("\(evalCase.id): unknown mode \(evalCase.mode)")
            }
            exported.append(item)
        }

        guard let path = ProcessInfo.processInfo.environment["VOXBRIEF_PROMPT_EXPORT"], !path.isEmpty else { return }
        let json = try JSONSerialization.data(withJSONObject: ["cases": exported], options: [.prettyPrinted, .sortedKeys])
        try json.write(to: URL(fileURLWithPath: path))
    }
}
