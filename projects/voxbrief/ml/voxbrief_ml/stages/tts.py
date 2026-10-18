"""Stage `tts`: reads every memo aloud with Kokoro (Apache-2.0, 82M), varying voice and speed and
adding noise and room echo, so Whisper hears something closer to a watch mic than a studio.
Writes 16 kHz mono WAVs to runs/<name>/audio/."""

import random

from .. import jsonl

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


def run_stage(run, limit=None):
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline
    from scipy.signal import resample_poly

    config = run["tts"]
    scenarios = jsonl.read(run.path("scenarios.jsonl"))
    audio_dir = run.path("audio")
    audio_dir.mkdir(exist_ok=True)
    out = run.path("tts.jsonl")
    done = jsonl.done_ids(out)
    todo = [s for s in scenarios if s["id"] not in done][:limit]
    print(f"tts: {len(todo)} to synthesize ({len(done)} already done)")

    pipelines = {}  # Kokoro lang code: "a" American voices (a*_), "b" British (b*_)
    rng = random.Random(run["run"]["seed"] + 1)
    with jsonl.Appender(out) as sink:
        for i, scenario in enumerate(todo, 1):
            voice = rng.choice(config["voices"])
            speed = rng.uniform(*config["speed"])
            lang = voice[0]
            if lang not in pipelines:
                pipelines[lang] = KPipeline(lang_code=lang)
            chunks = [np.asarray(audio) for _, _, audio in pipelines[lang](scenario["transcript"], voice=voice, speed=speed)]
            if not chunks:
                continue
            audio = resample_poly(np.concatenate(chunks), WHISPER_RATE, KOKORO_RATE)
            seconds = len(audio) / WHISPER_RATE
            if seconds > config["max_seconds"]:
                sink({"id": scenario["id"], "skipped": f"{seconds:.1f}s is too long"})
                continue
            path = audio_dir / f"{scenario['id']}.wav"
            sf.write(path, degrade(audio, rng, config, np), WHISPER_RATE)
            sink({"id": scenario["id"], "audio": str(path.relative_to(run.dir)), "voice": voice,
                  "speed": round(speed, 3), "seconds": round(seconds, 2)})
            if i % 100 == 0:
                print(f"tts: {i}/{len(todo)}", flush=True)
