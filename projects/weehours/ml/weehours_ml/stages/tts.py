"""Stage `tts`: reads every agreed utterance aloud with Kokoro (Apache-2.0, 82M), varying voice
and speed and adding noise and room echo (night-time rooms are not studios), so Whisper hears
something closer to a phone at 3 am. Writes 16 kHz mono WAVs to runs/<name>/audio/."""

import random

from .. import jsonl


def agreed_utterances(run):
    """Utterances whose blind labels matched their plan, as {id, text}."""
    items = []
    for plan in jsonl.read(run.path("utterances.jsonl")):
        for i, u in enumerate(plan["utterances"]):
            if u["agrees"]:
                items.append({"id": f"{plan['id']}-{i}", "plan": plan["id"], "text": u["text"]})
    return items

KOKORO_RATE = 24000
WHISPER_RATE = 16000


def degrade(audio, rng, config, np):
    """Additive white noise at a random SNR, plus a short synthetic room reverb sometimes."""
    if rng.random() < config["reverb_probability"]:
        length = int(WHISPER_RATE * rng.uniform(0.15, 0.4))
        decay = np.exp(-np.linspace(0, rng.uniform(4, 8), length))
        impulse = np.random.default_rng(rng.randrange(1 << 30)).standard_normal(length) * decay
        impulse[0] = 1.0
        audio = np.convolve(audio, impulse / np.abs(impulse).sum() * 2)[: len(audio)]
    snr_db = rng.uniform(*config["noise_snr_db"])
    power = float(np.mean(audio ** 2)) or 1e-9
    noise = np.random.default_rng(rng.randrange(1 << 30)).standard_normal(len(audio))
    audio = audio + noise * np.sqrt(power / (10 ** (snr_db / 10)))
    peak = float(np.max(np.abs(audio))) or 1.0
    return (audio / peak * 0.9).astype(np.float32)


def synthesize(job):
    """One worker process: synthesizes its share of the items (every `workers`-th one), each with
    a voice, speed and noise drawn from its own id, so reruns and resumes give the same audio."""
    import hashlib

    import numpy as np
    import soundfile as sf
    import torch
    from kokoro import KPipeline
    from scipy.signal import resample_poly

    run_dir, config, seed, items, threads = job
    torch.set_num_threads(threads)
    pipelines = {}  # Kokoro lang code: "a" American voices (a*_), "b" British (b*_)
    records = []
    with jsonl.Appender(run_dir / "tts.jsonl") as sink:
        for item in items:
            rng = random.Random(int(hashlib.sha256(f"{seed}:{item['id']}".encode()).hexdigest()[:12], 16))
            voice = rng.choice(config["voices"])
            speed = rng.uniform(*config["speed"])
            lang = voice[0]
            if lang not in pipelines:
                pipelines[lang] = KPipeline(lang_code=lang, device=config["device"])
            chunks = [np.asarray(audio) for _, _, audio in pipelines[lang](item["text"], voice=voice, speed=speed)]
            if not chunks:
                continue
            audio = resample_poly(np.concatenate(chunks), WHISPER_RATE, KOKORO_RATE)
            seconds = len(audio) / WHISPER_RATE
            if seconds > config["max_seconds"]:
                sink({"id": item["id"], "skipped": f"{seconds:.1f}s is too long"})
                continue
            path = run_dir / "audio" / f"{item['id']}.wav"
            sf.write(path, degrade(audio, rng, config, np), WHISPER_RATE)
            sink({"id": item["id"], "audio": str(path.relative_to(run_dir)), "voice": voice,
                  "speed": round(speed, 3), "seconds": round(seconds, 2)})
            records.append(item["id"])
    return len(records)


def run_stage(run, limit=None):
    import multiprocessing
    import os

    config = run["tts"]
    items = agreed_utterances(run)
    run.path("audio").mkdir(exist_ok=True)
    done = jsonl.done_ids(run.path("tts.jsonl"))
    todo = [s for s in items if s["id"] not in done][:limit]
    workers = max(1, min(config["workers"], len(todo)))
    print(f"tts: {len(todo)} to synthesize ({len(done)} already done) on {config['device']}, {workers} workers")
    if not todo:
        return
    threads = max(1, (os.cpu_count() or 1) // workers)
    jobs = [(run.dir, config, run["run"]["seed"], todo[k::workers], threads) for k in range(workers)]
    # Each worker appends whole lines to tts.jsonl; "spawn" keeps torch out of a forked parent.
    with multiprocessing.get_context("spawn").Pool(workers) as pool:
        for i, count in enumerate(pool.imap_unordered(synthesize, jobs), 1):
            print(f"tts: worker {i}/{workers} done ({count} files)", flush=True)
