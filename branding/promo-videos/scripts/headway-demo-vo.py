# Narration for the Headway walkthrough (reports/2026-11-02-headway-demo-video) with Kokoro-82M
# (Apache 2.0), run locally. One clip per line (vo-<voice>-<id>.wav, 24 kHz mono), so the edit places each
# line on its step; a re-recorded chapter only needs its own lines again.
#
#   <venv>/bin/python -I branding/promo-videos/scripts/headway-demo-vo.py \
#     /Volumes/proj/github/hejitech-apps/branding/promo-videos/public/headway-demo [voice …] [--only id,id]
#
# Lines: the report's script (Chapters + script). Words are spelled phonetically ("Cal train", "E T A", "R one").
import sys, json, numpy as np, soundfile as sf
import misaki.espeak
class NoFallback:  # misaki's espeak fallback crashes on macOS; fail loudly on an unknown word instead
    def __init__(self, *a, **k): pass
    def __call__(self, token): raise SystemExit(f"word not in Kokoro's dictionary: {token.text!r}")
misaki.espeak.EspeakFallback = NoFallback
from kokoro import KPipeline

SR = 24000
LINES = {
  # Intro (0:00 - 0:08)
  "c0-1": "Every commuter knows the sprint for Cal train.",
  "c0-2": "Here is how Headway puts your exact departures, leave-by times, and live alerts on your wrist and your glasses.",
  # 1 · Your commute & leave-by times (0:08 - 0:30)
  "c1-1": "Open Headway on your phone, and save your morning and evening commute stations.",
  "c1-2": "The Trains tab instantly loads live departures with real-time delays.",
  "c1-3": "Instead of doing platform mental math, the Catch card counts down to the exact minute you must walk out your door.",
  "c1-4": "Green means you are on time; if you need to hustle, it warns you to run.",
  # 2 · Even G2 glasses & R1 ring (0:30 - 0:52)
  "c2-1": "To take it hands-free, generate a six-digit pairing code in the Glasses tab.",
  "c2-2": "Type it into your Even app once. Now your commute board floats right before your eyes.",
  "c2-3": "Swipe down on your R one smart ring to browse the next trains.",
  "c2-4": "Tap the ring to flip directions instantly when you are ready to head back.",
  "c2-5": "Hold the ring to open the quick menu and track your train without reaching into your pocket.",
  # 3 · Wait for the Express (0:52 - 1:12)
  "c3-1": "When delays stack up, the next train out is not always the first one home.",
  "c3-2": "Headway compares transit times across all trains and flags the overtake: wait for the five eleven Express.",
  "c3-3": "The advice appears right on your glasses H U D, saving you four minutes.",
  "c3-4": "And a time-sensitive alert notifies you before you step onto the slower train.",
  # 4 · Track your train & Live Activities (1:12 - 1:36)
  "c4-1": "Swipe right on your train to track your ride.",
  "c4-2": "Your Lock Screen and Dynamic Island update in real time with every passing station.",
  "c4-3": "Glance at your Apple Watch for a quick countdown on the platform.",
  "c4-4": "Tap Share E T A to send friends a private live map link that requires no login.",
  "c4-5": "As you roll in, a gentle five-minute arrival tap reminds you to gather your things.",
  # Recap + end (1:36 - 1:48)
  "c5-1": "Never guess. Never sprint. Cal train on your schedule.",
  "c5-2": "Headway. Your next Cal train, at a glance.",
  # The short (9:16)
  "s-1": "Still sprinting for Cal train? Here is how to commute smarter.",
  "s-2": "Headway gives you an exact leave-by countdown with your walking buffer.",
  "s-3": "When a local train is delayed, it tells you to wait for the Express that beats it.",
  "s-4": "Swipe to track for live Lock Screen progress, and a five-minute arrival tap.",
  "s-5": "Headway. Your next Cal train, at a glance.",
}
SPEED = 1.05
args = sys.argv[1:]
only = None
if "--only" in args:
    i = args.index("--only"); only = set(args[i + 1].split(",")); del args[i:i + 2]
out, voices = args[0], args[1:] or ["af_heart"]
pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
lengths = {}
for v in voices:
    for key, text in LINES.items():
        if only and key not in only: continue
        audio = np.concatenate([r.audio.numpy() for r in pipe(text, voice=v, speed=SPEED)])
        audio = audio / max(1e-6, np.abs(audio).max()) * 0.89  # peak at about -1 dBFS
        sf.write(f"{out}/vo-{v}-{key}.wav", audio, SR, subtype="PCM_16")
        lengths[f"{v}-{key}"] = round(len(audio) / SR, 2)
print(json.dumps(lengths))
