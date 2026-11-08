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
  # Intro
  "c0-1": "Every Cal train rider knows the question: is my train on time, and when do I really have to leave?",
  "c0-2": "Headway answers it on your phone, your watch and your Even G two glasses, from Cal train's live feed.",
  # 1 Your commute, and when to leave
  "c1-1": "Set your commute once: where you get on, where you get off, and how long your walk to the station takes.",
  "c1-2": "The Trains tab shows your next trains, with live delays.",
  "c1-3": "The Catch card counts down to when you have to leave, walk included.",
  # 2 On your glasses
  "c2-1": "To see it on your glasses, get a pairing code in the Glasses tab, and type it into the Even app, once.",
  "c2-2": "Now your commute is right in front of you: the next trains, delays, and when to leave.",
  "c2-3": "Swipe on the R one ring to move through the trains.",
  "c2-4": "Tap to flip the direction, for the ride home.",
  "c2-5": "Hold for the menu: track a train, pick stations, or read alerts.",
  # 3 When your train runs late
  "c3-1": "When delays stack up, the next train out is not always the first one home.",
  "c3-2": "Headway spots it, and tells you to wait for the five eleven Express.",
  "c3-3": "Your glasses show the same advice,",
  "c3-4": "and a time-sensitive alert reaches you, before you board the slow one.",
  # 4 Track your ride
  "c4-1": "Swipe a train and tap Track.",
  "c4-2": "Share live E T A sends a private link, so whoever is waiting knows when you will arrive.",
  "c4-3": "They see your train and its arrival time, with no app and no sign in.",
  "c4-4": "Your ride follows you to the Dynamic Island and the Lock Screen.",
  "c4-5": "And five minutes out, a tap tells you it is time to get ready.",
  # Recap + end
  "c5-1": "Know when to leave, see it at a glance, and skip the slow train.",
  "c5-2": "Headway. Your next Cal train, at a glance.",
  # The short (9:16)
  "s-1": "My Cal train is ten minutes late. Should I still take it?",
  "s-2": "Headway says no: wait for the Express. It gets me there first.",
  "s-3": "It is right on my glasses, too.",
  "s-4": "And it pings me, before I board the slow one.",
  "s-5": "Headway. Your next Cal train, at a glance.",
}
SPEED = 1.06
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
