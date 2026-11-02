# The demo edition's audio, read by Kokoro-82M (the "agent's" TTS in the story), and the filled bundle.
#   <venv>/bin/python -I make-audio.py <this dir> <work dir> <date>
# Writes <work>/<date>/bundle.json (scripts filled in, real durations) and <work>/<date>/audio/<slug>-glance.mp3 / -deep-dive.mp3.
import sys, json, os, subprocess, numpy as np, soundfile as sf
import misaki.espeak
class NoFallback:
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline
here, work, date = sys.argv[1:4]
b = json.load(open(os.path.join(here, "bundle.json")))
b["date"] = date
deep = {"DEEP_REEF": "deep-reef-playback.txt", "DEEP_BATTERY": "deep-seawater-battery.txt"}
out = os.path.join(work, date, "audio"); os.makedirs(out, exist_ok=True)
pipe = KPipeline(lang_code="b", repo_id="hexgrad/Kokoro-82M")  # British English, voice bf_emma
for c in b["cards"]:
    for kind, suffix in (("glance", "glance"), ("deep_dive", "deep-dive")):
        a = c.get(kind)
        if not a: continue
        if a["script"] in deep: a["script"] = open(os.path.join(here, deep[a["script"]])).read().strip().replace("\n\n", "\n")
        audio = np.concatenate([r.audio.numpy() for r in pipe(a["script"].replace("\n", " "), voice="bf_emma", speed=1.0)])
        wav = os.path.join(out, f"{c['slug']}-{suffix}.wav")
        sf.write(wav, audio / max(1e-6, np.abs(audio).max()) * 0.89, 24000, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-b:a", "96k", wav[:-4] + ".mp3"], check=True)
        os.remove(wav)
        a["duration_sec"] = round(len(audio) / 24000, 1)
        print(c["slug"], kind, a["duration_sec"])
json.dump(b, open(os.path.join(work, date, "bundle.json"), "w"), indent=2, ensure_ascii=False)
