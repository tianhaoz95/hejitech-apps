# Narration for the g2digest-launch promo with Kokoro-82M (Apache 2.0), run locally.
#
#   uv venv --python 3.12 <venv> && uv pip install --python <venv>/bin/python "kokoro>=0.9" soundfile "misaki[en]"
#   <venv>/bin/python branding/promo-videos/scripts/g2digest-launch-vo.py branding/promo-videos/public/g2digest-launch [voice …]
#
# One clip per line (vo-<voice>-<line>.wav, 24 kHz mono): the edit places each line on its beat, between
# the characters' own lines from Flow (Bea: "Is anyone's news loading?", Sam: "Mine was ready last
# night.", Bea: "It loaded! Oh, this is my stop."), which the narration leaves out. Lines: the report's
# Story section (reports/2026-11-01-g2digest-promo-video). Sam narrates, so male voices.
import sys, json, numpy as np, soundfile as sf
import misaki.espeak
class NoFallback:  # misaki's espeak fallback crashes on macOS; fail loudly on an unknown word instead
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline

SR = 24000
# "G2" is spelled the way it's said.
LINES = {
  "under":  "Underground, nothing loads.",
  "agent":  "Overnight, my own AI agent turns my brief into cards for my glasses.",
  "swipe":  "Swipe the ring to skim. One card, one glance.",
  "hold":   "Want more? Hold the ring, and the deep dive plays in my headphones.",
  "write":  "I write the brief. My agent researches, writes, and checks every card.",
  "tag":    "G two Digest. Your brief, ready before the train.",
  "ready15": "My brief was ready last night. Cards in my glasses, audio in my headphones.",
  "skim15": "Swipe to skim. Hold for the deep dive.",
}
SPEED = 1.12
VOICES = sys.argv[2:] or ["am_michael", "am_fenrir", "am_puck", "am_echo", "bm_george"]
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
