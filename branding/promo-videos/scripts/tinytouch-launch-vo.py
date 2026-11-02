# Narration for the tinytouch-launch promo with Kokoro-82M (Apache 2.0), run locally.
#
#   uv venv --python 3.12 <venv> && uv pip install --python <venv>/bin/python "kokoro>=0.9" soundfile "misaki[en]"
#   <venv>/bin/python branding/promo-videos/scripts/tinytouch-launch-vo.py branding/promo-videos/public/tinytouch-launch [voice …]
#
# One clip per line (vo-<voice>-<line>.wav, 24 kHz mono), placed on its beat by the edit between the
# characters' own lines from Flow ("Please don't call anyone.", "Hiii!", "She's called my boss. Twice.",
# "Zero calls."), which the narration leaves out. Leo narrates in the first person, so the voices are
# male. Lines are the ones in reports/2026-10-31-tinytouch-promo-video §2; "TinyTouch" is spelled
# "Tiny Touch" so Kokoro's dictionary knows it.
import sys, json, numpy as np, soundfile as sf
import misaki.espeak
class NoFallback:  # misaki's espeak fallback crashes on macOS; fail loudly on an unknown word instead
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline

SR = 24000
LINES = {
  "first":   "So now, I open Tiny Touch first.",
  "play":    "Every tap is a bubble, an animal, a note.",
  "nothing": "Swipes and the crown are part of the game. Nothing gets out.",
  "phone":   "From my phone, I switch the game, or start the lullaby.",
  "hold":    "Getting out takes a three-second hold. Little fingers can't.",
  "tag":     "Tiny Touch. Gentle play. No surprise calls.",
  "turns":   "Tiny Touch turns every tap and swipe into gentle play.",
  "hold15":  "Getting out takes a three-second hold.",
}
SPEED = float(__import__("os").environ.get("SPEED", "1.08"))
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
