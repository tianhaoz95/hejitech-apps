# Narration for the weehours-launch promo with Kokoro-82M (Apache 2.0), run locally.
#
#   uv venv --python 3.12 <venv> && uv pip install --python <venv>/bin/python "kokoro>=0.9" soundfile "misaki[en]"
#   <venv>/bin/python branding/promo-videos/scripts/weehours-launch-vo.py branding/promo-videos/public/weehours-launch [voice …]
#
# One clip per line (vo-<voice>-<line>.wav, 24 kHz mono), placed on its beat by the edit between the
# characters' own lines from Flow ("Did I feed her?", "I fed her.", Doudou's lines, "Bottle, ninety
# mils."), which the narration leaves out. Jun narrates in the first person, so the voices are male.
# Lines are the ones in reports/2026-10-30-weehours-promo-video §1.
import sys, json, numpy as np, soundfile as sf
import misaki.espeak
class NoFallback:  # misaki's espeak fallback crashes on macOS; fail loudly on an unknown word instead
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline

SR = 24000
LINES = {
  "nobody":  "At three a.m., nobody remembers anything.",
  "watch":   "Now I just whisper to my watch. My phone understands it, right there.",
  "mei":     "My wife sees it on hers, and goes back to sleep.",
  "tilt":    "Baby asleep? Not a word. I just tilt my wrist.",
  "tag":     "Wee Hours. A newborn log built for three a.m.",
  "whisper": "Now I just whisper to my watch, and Wee Hours logs it.",
  "both":    "We both see it, and we both go back to sleep.",
}
SPEED = 1.08
VOICES = sys.argv[2:] or ["am_michael", "am_puck", "am_fenrir", "am_echo", "bm_george"]
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
