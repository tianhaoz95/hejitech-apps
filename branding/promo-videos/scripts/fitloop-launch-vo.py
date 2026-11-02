# Narration for the fitloop-launch promo with Kokoro-82M (Apache 2.0), run locally.
#
#   uv venv --python 3.12 <venv> && uv pip install --python <venv>/bin/python "kokoro>=0.9" soundfile "misaki[en]"
#   <venv>/bin/python branding/promo-videos/scripts/fitloop-launch-vo.py branding/promo-videos/public/fitloop-launch [voice …]
#
# One clip per line (vo-<voice>-<line>.wav, 24 kHz mono): the edit places each line on its beat,
# between the characters' own lines from Flow (Theo: "Wait, how many sets is this?", Maya: "My agent
# wrote mine.", Theo: "Okay, I'm getting an agent."), which the narration leaves out. Lines are the
# ones in reports/2026-11-01-fitloop-promo-video.
import sys, json, numpy as np, soundfile as sf
import misaki.espeak
class NoFallback:  # misaki's espeak fallback crashes on macOS; fail loudly on an unknown word instead
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline

SR = 24000
# "FitLoop" isn't in the dictionary: spelled the way it's said.
LINES = {
  "guess": "Everyone at my gym is guessing.",
  "plans": "My own A.I. agent plans my workouts and meals. Fit Loop puts them in my glasses.",
  "tap":   "Set done? One tap. The rest timer starts itself.",
  "hurts": "Something hurts? I tell my agent, mid-set.",
  "reads": "It reads everything back, and adjusts tomorrow's plan.",
  "tag":   "Your agent coaches. Fit Loop keeps you on the plan.",
  "puts":  "Fit Loop puts my plan in my glasses.",
}
SPEED = 1.1
VOICES = sys.argv[2:] or ["af_heart", "af_bella", "af_nicole", "af_sarah", "bf_emma"]
out = sys.argv[1]
pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
lengths = {}
for v in VOICES:
    p = pipe if v.startswith("a") else KPipeline(lang_code="b", repo_id="hexgrad/Kokoro-82M")
    for key, text in LINES.items():
        audio = np.concatenate([r.audio.numpy() for r in p(text, voice=v, speed=SPEED)])
        audio = audio / max(1e-6, np.abs(audio).max()) * 0.89  # peak at about -1 dBFS
        sf.write(f"{out}/vo-{v}-{key}.wav", audio, SR, subtype="PCM_16")
        lengths[f"{v}-{key}"] = round(len(audio) / SR, 2)
print(json.dumps(lengths))
