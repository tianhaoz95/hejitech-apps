# Narration for the waypack-launch promo with Kokoro-82M (Apache 2.0), run locally.
#
#   uv venv --python 3.12 <venv> && uv pip install --python <venv>/bin/python "kokoro>=0.9" soundfile "misaki[en]"
#   <venv>/bin/python branding/promo-videos/scripts/waypack-launch-vo.py branding/promo-videos/public/waypack-launch [voice …]
#
# One clip per line (vo-<voice>-<line>.wav, 24 kHz mono, leading silence trimmed to 50 ms): the edit
# places each line on its beat, between the characters' own lines from Flow (Gus: "Does anyone have
# a single bar?", Rosa: "Don't need one.", Gus: "Okay, where's the sledding hill?"), which the
# narration leaves out. Lines are the ones in reports/2026-11-01-waypack-promo-video.
import sys, json, numpy as np, soundfile as sf
import misaki.espeak
class NoFallback:  # misaki's espeak fallback crashes on macOS; fail loudly on an unknown word instead
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline

SR = 24000
# "Waypack" isn't in the dictionary: spelled the way it's said.
LINES = {
  "signal":  "Up in the mountains, there's no signal.",
  "planned": "My A.I. agent planned this trip. Way pack keeps it working offline.",
  "agent":   "My agent planned the trip. Way pack keeps it working offline.",
  "next":    "What's next, the map, my G.P.S. dot. Zero bars.",
  "lodging": "Lodging, check-in times, and a backup plan if the road closes.",
  "home":    "I planned it at home with my agent, and hit Download on the Wi-Fi.",
  "tag":     "Way pack. Your trip, packed.",
}
SPEED = {"tag": 1.0}
VOICES = sys.argv[2:] or ["af_heart", "af_bella", "af_nicole", "af_sarah", "bf_emma"]
out = sys.argv[1]
pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
lengths = {}
for v in VOICES:
    p = pipe if v.startswith("a") else KPipeline(lang_code="b", repo_id="hexgrad/Kokoro-82M")
    for key, text in LINES.items():
        audio = np.concatenate([r.audio.numpy() for r in p(text, voice=v, speed=SPEED.get(key, 1.12))])
        loud = np.flatnonzero(np.abs(audio) > 0.02 * np.abs(audio).max())
        audio = audio[max(0, loud[0] - int(0.05 * SR)) : loud[-1] + int(0.15 * SR)]
        audio = audio / max(1e-6, np.abs(audio).max()) * 0.89  # peak at about -1 dBFS
        sf.write(f"{out}/vo-{v}-{key}.wav", audio, SR, subtype="PCM_16")
        lengths[f"{v}-{key}"] = round(len(audio) / SR, 2)
print(json.dumps(lengths, indent=0))
