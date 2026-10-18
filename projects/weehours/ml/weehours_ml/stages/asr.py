"""Stage `asr`: transcribes every utterance's audio with Whisper base.en (the weights the app runs
through WhisperKit; Whisper itself is not trained), prompted with the app's closed vocabulary
(`[asr] prompt`, the same string as Services.swift). The result is Laya's training state: what
the app actually hears, mishearings included."""

from .. import jsonl

RATE = 16000


def strip_prompt(text, prompt):
    """Some transformers versions return the prompt in front of the transcript."""
    text = text.strip()
    if prompt and text.startswith(prompt.strip()):
        text = text[len(prompt.strip()):]
    return text.strip()


def run_stage(run, limit=None):
    import soundfile as sf
    import torch
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    config = run["asr"]
    audio = [r for r in jsonl.read(run.path("tts.jsonl")) if "audio" in r]
    out = run.path("asr.jsonl")
    done = jsonl.done_ids(out)
    todo = [r for r in audio if r["id"] not in done][:limit]
    print(f"asr: {len(todo)} to transcribe ({len(done)} already done)")
    if not todo:
        return

    device = config["device"] if torch.cuda.is_available() or config["device"] == "cpu" else "cpu"
    processor = WhisperProcessor.from_pretrained(config["model"])
    model = WhisperForConditionalGeneration.from_pretrained(config["model"]).to(device).eval()
    prompt = " " + config["prompt"]  # the app encodes " " + prompt
    prompt_ids = torch.tensor(processor.get_prompt_ids(prompt), device=device)
    with jsonl.Appender(out) as sink, torch.inference_mode():
        for i, record in enumerate(todo, 1):
            samples, rate = sf.read(run.dir / record["audio"], dtype="float32")
            assert rate == RATE, f"{record['audio']}: expected {RATE} Hz, got {rate}"
            features = processor(samples, sampling_rate=RATE, return_tensors="pt").input_features.to(device)
            ids = model.generate(features, prompt_ids=prompt_ids)  # base.en is English-only: no language
            text = strip_prompt(processor.batch_decode(ids, skip_special_tokens=True)[0], prompt)
            sink({"id": record["id"], "asr": text})
            if i % 200 == 0:
                print(f"asr: {i}/{len(todo)}", flush=True)
