# Narration for the toddlercam-launch promo with Kokoro-82M (Apache 2.0), run locally.
#
#   uv venv --python 3.12 <venv> && uv pip install --python <venv>/bin/python "kokoro>=0.9" soundfile "misaki[en]"
#   <venv>/bin/python branding/promo-videos/scripts/toddlercam-launch-vo.py branding/promo-videos/public/toddlercam-launch [voice …]
#
# One clip per line (vo-<voice>-<line>.wav, 24 kHz mono), placed on its beat by the edit between the
# characters' own lines from Flow ("Milo! Look at Mommy!", "Mine!", "Mommy!", "Quack!"), which the
# narration leaves out. Nora narrates in the first person, so the voices are female.
# Lines are the ones in reports/2026-10-31-toddlercam-promo-video §2.
import sys, json, numpy as np, soundfile as sf
import misaki.espeak
class NoFallback:  # misaki's espeak fallback crashes on macOS; fail loudly on an unknown word instead
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline

SR = 24000
LINES = {
  "photos":  "Four hundred photos of the back of his head.",
  "camera":  "So we gave him his own camera.",
  "both":    "Both cameras at once: what he sees, and his face.",
  "remote":  "My watch is the remote. One tap,",
  "snap":    "he looks. Snap.",
  "bubbles": "He can tap all he likes. It only makes bubbles.",
  "account": "No account, no ads. It all stays on the phone.",
  "tag":     "Toddler Cam. A camera for little hands, and a remote on yours.",
  "camera15": "So we gave him his own camera. Both sides at once.",
}
SPEED = 1.1
VOICES = sys.argv[2:] or ["af_heart", "af_bella", "af_nicole", "af_sarah", "bf_emma"]
out = sys.argv[1]
pipes = {}
lengths = {}
for v in VOICES:
    lang = v[0]  # a = American, b = British
    pipe = pipes.setdefault(lang, KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M"))
    for key, text in LINES.items():
        audio = np.concatenate([r.audio.numpy() for r in pipe(text, voice=v, speed=SPEED)])
        audio = audio / max(1e-6, np.abs(audio).max()) * 0.89  # peak at about -1 dBFS
        sf.write(f"{out}/vo-{v}-{key}.wav", audio, SR, subtype="PCM_16")
        lengths[f"{v}-{key}"] = round(len(audio) / SR, 2)
print(json.dumps(lengths))
