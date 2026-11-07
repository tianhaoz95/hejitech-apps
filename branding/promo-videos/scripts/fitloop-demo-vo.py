# Narration for the FitLoop walkthrough (reports/2026-11-02-fitloop-demo-video) with Kokoro-82M
# (Apache 2.0), run locally. One clip per line (vo-<voice>-<id>.wav, 24 kHz mono), so the edit places each
# line on its step; a re-recorded chapter only needs its own lines again.
#
#   <venv>/bin/python -I branding/promo-videos/scripts/fitloop-demo-vo.py \
#     /Volumes/proj/github/hejitech-apps/branding/promo-videos/public/fitloop-demo [voice …] [--only id,id]
#
# Lines: the report's script (Chapters + script). Words are spelled phonetically ("Fit Loop", "M C P", "A I", "R one", "G two", "H U D").
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
  "c0-1": "Everyone at the gym is guessing weights and counting sets.",
  "c0-2": "Here is how Fit Loop lets your own A I agent coach your workouts and meals across iPhone, Apple Watch, and Even G2 glasses.",
  # 1 · Bring your agent & generate plan (0:08 - 0:32)
  "c1-1": "Connect Claude or any M C P agent to Fit Loop with a single tap.",
  "c1-2": "Your agent fetches the plan guide and your profile to craft a customized weekly routine.",
  "c1-3": "Fit Loop validates every exercise, rest timer, and rep count against strict glasses-friendly limits.",
  "c1-4": "Once validated, your agent publishes the plan, instantly syncing to your devices.",
  # 2 · Mid-workout on iPhone & Apple Watch (0:32 - 0:56)
  "c2-1": "On your phone, the Today tab displays your full morning session, from goblet squats to meals.",
  "c2-2": "Tap into any movement to preview procedural exercise animations and coaching cues.",
  "c2-3": "When you start, your Apple Watch tracks your workout session and streams live heart rate.",
  "c2-4": "Check off sets as you finish them, and the rest timer automatically counts down.",
  # 3 · Hands-free on Even G2 glasses & R1 ring (0:56 - 1:20)
  "c3-1": "Take your workout completely hands-free by pairing your Even G2 glasses.",
  "c3-2": "A crisp nine-line green display shows your active exercise, target reps, and live heart rate.",
  "c3-3": "Single tap your R one smart ring to log your set and trigger the rest countdown.",
  "c3-4": "Hold the ring to view form cues, or tap out instant feedback if something hurts.",
  # 4 · The closed loop: instant feedback & plan adaptation (1:20 - 1:44)
  "c4-1": "If your knee twinges during lunges, select It hurts right from your glasses or phone.",
  "c4-2": "At lunch, check off your meal, adjusting whether you ate more, less, or swapped dishes.",
  "c4-3": "Your agent reads your check-ins and notes over M C P, and replies with helpful adjustments.",
  "c4-4": "Tomorrows plan automatically swaps out squats for step-ups, keeping you safe and on track.",
  # Recap + end (1:44 - 1:55)
  "c5-1": "Your agent coaches. Fit Loop keeps you on the plan.",
  "c5-2": "Fit Loop. Smarter training, right in your vision.",
  # The short (9:16)
  "s-1": "Tired of looking at your phone between every gym set?",
  "s-2": "Fit Loop puts your A I agent plan directly in your Even G2 glasses.",
  "s-3": "Tap your R one ring to log a set and start your rest timer hands-free.",
  "s-4": "If an exercise hurts, flag it mid-set, and your agent updates tomorrows routine.",
  "s-5": "Your agent coaches. Fit Loop keeps you on the plan.",
}
SPEED = 1.05
args = sys.argv[1:]
only = None
if "--only" in args:
    i = args.index("--only"); only = set(args[i + 1].split(",")); del args[i:i + 2]
out, voices = args[0], args[1:] or ["af_sarah"]
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
