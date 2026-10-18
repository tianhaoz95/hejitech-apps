"""The app's Stage 2 prompts, so training examples look exactly like what Lite sees on device.

The dictionary-free prompts come from the app itself (the "kit" in the prompts.json that
`LLMPromptExportTests` writes). What depends on the dictionary and transcript is ported here from
`LLMCopywriterService` (`dictionaryInstructionBlock`, `transcriptUserPrompt`,
`stripASRSpecialTokens`) and `DictionaryCorrector`, and `verify_against_export` checks the port
against every prompt the app built for the eval cases: if the Swift prompts change, it fails
until this file follows. Voice commands (`VoiceCommandProcessor`) aren't ported; the synthetic
memos are written without dictation commands.
"""

import json
import re
from pathlib import Path


def load_kit(prompts_export):
    path = Path(prompts_export)
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found: export the app's prompts first (see ml/README.md, 'Prompt export')")
    export = json.loads(path.read_text())
    if "kit" not in export:
        raise ValueError(f"{path} has no prompt kit: re-export it with the current LLMPromptExportTests")
    return Kit(export["kit"])


class Kit:
    def __init__(self, kit):
        self.kit = kit
        self.max_terms = kit["maxDictionaryTermsInPrompt"]
        self.max_aliases = kit["maxAliasesPerTermInPrompt"]

    @property
    def templates(self):
        return list(self.kit["generation"])

    @property
    def fallback_template(self):
        return self.kit["fallbackTemplate"]

    def field_keys(self, template):
        return self.kit["generation"][template]["fieldKeys"]

    def classification_system(self):
        return self.kit["classification"]["system"]

    def generation_system(self, template, dictionary):
        return self.kit["generation"][template]["system"] + self.dictionary_block(dictionary)

    def light_system(self, dictionary):
        return self.kit["light"]["system"] + self.dictionary_block(dictionary)

    def dictionary_block(self, dictionary):
        """Port of LLMCopywriterService.dictionaryInstructionBlock."""
        if not dictionary:
            return ""
        lines = []
        for entry in dictionary[:self.max_terms]:
            notes = []
            hint = (entry.get("contextHint") or "").strip()
            if hint:
                notes.append(hint)
            aliases = [a.strip() for a in entry.get("aliases") or [] if a.strip()][:self.max_aliases]
            if aliases:
                notes.append("often misheard as " + ", ".join(f'"{a}"' for a in aliases))
            term = entry["term"]
            lines.append(f"- {term} ({'; '.join(notes)})" if notes else f"- {term}")
        return ("\n\nPersonal dictionary: the transcript comes from speech recognition, which often "
                "mishears names and jargon. Any word or phrase that sounds like one of the terms "
                "below is almost certainly that term: write the term with exactly this spelling and "
                "capitalization everywhere, including the title. For example, if the list had "
                "\"Zentrify\", a transcript saying \"Sentrafy\" or \"send trify\" means Zentrify. "
                "Keep the original word only when the term clearly makes no sense in that sentence "
                "(a note in parentheses says what a term is). Terms:\n" + "\n".join(lines))

    def user_prompt(self, transcript, dictionary):
        """Port of LLMCopywriterService.transcriptUserPrompt."""
        if not dictionary:
            return transcript
        terms = ", ".join(entry["term"] for entry in dictionary[:self.max_terms])
        return f"Dictionary terms (anything that sounds like one is that term): {terms}\n\nTranscript:\n{transcript}"


def apply_aliases(transcript, dictionary):
    """Port of DictionaryCorrector.apply: whole-word, case-insensitive alias → term."""
    result = transcript
    for entry in dictionary:
        for alias in entry.get("aliases") or []:
            alias = alias.strip()
            if alias:
                pattern = re.compile(rf"\b{re.escape(alias)}\b", re.IGNORECASE)
                result = pattern.sub(lambda _: entry["term"], result)
    return result


def strip_asr_tokens(text):
    """Port of LLMCopywriterService.stripASRSpecialTokens."""
    result = re.sub(r"\[[^\[\]]*\]", "", text)
    while "  " in result:
        result = result.replace("  ", " ")
    return result.strip()


def app_transcript(asr_text, dictionary):
    """What the app passes to Stage 2 for a raw ASR transcript (aliases, tags, trimming)."""
    return strip_asr_tokens(apply_aliases(asr_text, dictionary)).strip()


def verify_against_export(prompts_export, cases_path):
    """Problems (empty when in sync) between this port and the prompts the app built for the
    eval cases."""
    export = json.loads(Path(prompts_export).read_text())
    kit = Kit(export["kit"])
    cases = {c["id"]: c for c in json.loads(Path(cases_path).read_text())}
    problems = []
    for exported in export["cases"]:
        case = cases.get(exported["id"])
        if case is None:
            problems.append(f"{exported['id']}: not in cases.json (stale export)")
            continue
        dictionary = case.get("dictionary") or []
        user = kit.user_prompt(app_transcript(case["transcript"], dictionary), dictionary)
        if exported["mode"] == "light":
            pairs = [("light system", kit.light_system(dictionary), exported["light"]["system"]),
                     ("light user", user, exported["light"]["user"])]
        else:
            pairs = []
            for template, prompts in exported["generation"].items():
                pairs.append((f"{template} system", kit.generation_system(template, dictionary), prompts["system"]))
                pairs.append((f"{template} user", user, prompts["user"]))
        for name, ours, theirs in pairs:
            if ours != theirs:
                problems.append(f"{exported['id']}: {name} differs from the app's")
    return problems
