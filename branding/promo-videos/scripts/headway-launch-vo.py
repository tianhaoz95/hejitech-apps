# Narration for the headway-launch promo with Kokoro-82M (Apache 2.0), run locally.
#
#   uv venv --python 3.12 <venv> && uv pip install --python <venv>/bin/python "kokoro>=0.9" soundfile "misaki[en]"
#   <venv>/bin/python branding/promo-videos/scripts/headway-launch-vo.py branding/promo-videos/public/headway-launch [voice …]
#
# Unlike tradeboard-launch, the narration is one clip per line (vo-<voice>-<line>.wav, 24 kHz mono):
# the edit places each line on its beat, between the characters' own lines from Flow ("Hold the
# door!", "Me? I don't run.", "Bye, Max!"), which the narration leaves out. Lines are the ones in
# reports/2026-10-30-headway-promo-video §1.
import sys, json, numpy as np, soundfile as sf
import misaki.espeak
class NoFallback:  # misaki's espeak fallback crashes on macOS; fail loudly on an unknown word instead
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline

SR = 24000
# "Caltrain" isn't in the dictionary: spelled the way it's said.
LINES = {
  "city":   "Every morning, this whole city runs for the train.",
  "wear":   "I wear Headway. My next Cal train, live, right before my eyes.",
  "ring":   "One swipe of my ring, and I see every train after it.",
  "taps":   "Late? Cancelled? Time to go? My phone taps me first.",
  "stop":   "It even taps me before my stop.",
  "tag":    "Headway. Your next Cal train, at a glance.",
  "puts":   "Headway puts my next Cal train right before my eyes.",
  "go":     "And my phone taps me when it's time to go.",
}
SPEED = 1.1
VOICES = sys.argv[2:] or ["af_heart", "af_bella", "af_nicole", "af_sky", "af_aoede"]
out = sys.argv[1]
pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
lengths = {}
for v in VOICES:
    for key, text in LINES.items():
        audio = np.concatenate([r.audio.numpy() for r in pipe(text, voice=v, speed=SPEED)])
        audio = audio / max(1e-6, np.abs(audio).max()) * 0.89  # peak at about -1 dBFS
        sf.write(f"{out}/vo-{v}-{key}.wav", audio, SR, subtype="PCM_16")
        lengths[f"{v}-{key}"] = round(len(audio) / SR, 2)
print(json.dumps(lengths))
