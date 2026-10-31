# Voiceover takes for the tradeboard-launch promo with Kokoro-82M (Apache 2.0), run locally.
#
#   uv venv --python 3.12 /tmp/kokoro && uv pip install --python /tmp/kokoro/bin/python "kokoro>=0.9" soundfile "misaki[en]"
#   /tmp/kokoro/bin/python branding/promo-videos/scripts/tradeboard-launch-vo.py branding/promo-videos/public/tradeboard-launch [voice …]
#
# Writes vo-30-<voice>.wav and vo-15-<voice>.wav (24 kHz mono), each nudged in speed until it lands in
# 26–28 s / 13–14 s. The scripts are the ones in reports/2026-10-30-tradeboard-promo-video §1.
import sys, numpy as np, soundfile as sf
# misaki's espeak fallback (only for words missing from its English dictionary) crashes on macOS
# with the bundled espeak-ng. Every word in these scripts is in the dictionary, so turn it off and
# fail loudly if a word ever isn't.
import misaki.espeak
class NoFallback:
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline

SR = 24000
SCRIPTS = {
  "30": ["Most bad trades happen in a hurry.",
         "Trading Plan Board turns every idea into a dated plan.",
         "Your AI agents draft it, and argue it out.",
         "Only you approve it, from your phone.",
         "Then your own machine checks your limits and the live price.",
         "Any doubt? No order.",
         "Agents debate the trade. You approve it. Your machine places it."],
  "15": ["Your AI agents debate the trade.",
         "Only you approve it.",
         "Your own machine checks it, then places it. Any doubt? No order.",
         "Trading Plan Board."],
}
TARGET = {"30": (26.0, 28.0), "15": (13.0, 14.0)}
VOICES = sys.argv[2:] or ["af_heart", "af_bella", "am_michael", "am_fenrir", "bf_emma"]
out = sys.argv[1]
pipes = {}

def render(voice, lines, speed, gap):
    lang = voice[0]
    pipes.setdefault(lang, KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M"))
    parts = [np.zeros(int(0.15 * SR), dtype=np.float32)]
    for i, line in enumerate(lines):
        for r in pipes[lang](line, voice=voice, speed=speed):
            parts.append(r.audio.numpy())
        pause = gap * (1.6 if i == len(lines) - 2 else 1.0)  # a beat before the closing line
        parts.append(np.zeros(int(pause * SR), dtype=np.float32))
    return np.concatenate(parts)

for cut, lines in SCRIPTS.items():
    lo, hi = TARGET[cut]
    for v in VOICES:
        speed, gap = 1.0, 0.45 if cut == "30" else 0.3
        for _ in range(6):  # nudge the speed until the take lands in the target length
            audio = render(v, lines, speed, gap)
            d = len(audio) / SR
            if lo <= d <= hi: break
            speed *= d / ((lo + hi) / 2)
            speed = min(1.35, max(0.8, speed))
        audio = audio / max(1e-6, np.abs(audio).max()) * 0.89  # peak at about -1 dBFS
        sf.write(f"{out}/vo-{cut}-{v}.wav", audio, SR, subtype="PCM_16")
        print(f"vo-{cut}-{v}.wav {d:.1f}s speed {speed:.2f}", flush=True)
