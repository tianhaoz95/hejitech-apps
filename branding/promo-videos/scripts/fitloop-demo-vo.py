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
  # Intro
  "c0-1": "Your A I agent can write you a great training plan. Then you walk into the gym, and it is stuck in a chat window.",
  "c0-2": "Fit Loop puts your agent's plan on your phone, your watch and your Even G two glasses, and sends back how it went.",
  # 1 Your agent writes the plan
  "c1-1": "In Fit Loop's settings, copy the M C P address, and add it to your agent. Claude Code is shown here; any M C P client works.",
  "c1-2": "Sign in from your agent, once.",
  "c1-3": "Fit Loop shows exactly what it may do. Allow it, and you are connected.",
  "c1-4": "Then just ask: set up my training plan, starting today.",
  "c1-5": "It reads Fit Loop's plan guide and your profile, builds the week, and checks it against Fit Loop's rules before it publishes.",
  "c1-6": "Seconds later, today's workout and meals are on your phone, with a note on what it planned.",
  # 2 Train with your phone
  "c2-1": "At the gym, tap the workout to start it.",
  "c2-2": "Each exercise shows the set, the target, and your agent's form cues.",
  "c2-3": "Finish a set and tap Set done. The rest timer starts by itself.",
  # 3 Hands-free on your glasses
  "c3-1": "To go hands-free, get a pairing code in Settings, and type it into the Even app, once.",
  "c3-2": "Now your day is on your Even G two. Tap the R one ring to open the workout.",
  "c3-3": "Tap again when a set is done. The rest timer runs right in front of you, next to your heart rate.",
  "c3-4": "Something hurts? Hold the ring, and tell your agent, without stopping.",
  # 4 The loop closes
  "c4-1": "Check off your meals as you eat them.",
  "c4-2": "Later, ask your agent to take a look. It reads your note over M C P, and plays it safe.",
  "c4-3": "It answers you right in Fit Loop,",
  "c4-4": "and publishes a new plan. Today's Romanian dead lift is now a glute bridge.",
  # Recap + end
  "c5-1": "Your agent writes the plan. Fit Loop keeps you on it, and tells your agent how it went.",
  "c5-2": "Fit Loop. Your agent's plan, wherever you train.",
  # The short (9:16)
  "s-1": "My A I agent wrote this workout. Now it is on my glasses.",
  "s-2": "Tap the ring when a set is done, and the rest timer starts.",
  "s-3": "Something hurts? Hold the ring, and tell your agent.",
  "s-4": "It reads the note, answers, and changes the plan.",
  "s-5": "The dead lift is out. A glute bridge is in.",
  "s-6": "Fit Loop. Your agent's plan, wherever you train.",
}
SPEED = 1.06
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
