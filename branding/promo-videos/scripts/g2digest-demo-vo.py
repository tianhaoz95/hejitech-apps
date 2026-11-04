# Narration for the G2 Digest walkthrough (reports/2026-11-02-g2digest-demo-video) with Kokoro-82M
# (Apache 2.0), run locally. One clip per line (vo-<voice>-<id>.wav, 24 kHz mono), so the edit places each
# line on its step; a re-recorded chapter only needs its own lines again.
#
#   uv venv --python 3.12 <venv> && uv pip install --python <venv>/bin/python "kokoro>=0.9" soundfile "misaki[en]" \
#     "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
#   <venv>/bin/python -I branding/promo-videos/scripts/g2digest-demo-vo.py \
#     /Volumes/DATA/GitHub/hejitech-apps/branding/promo-videos/public/g2digest-demo [voice …] [--only id,id]
#
# Lines: the report's script (Chapters + script). Words are spelled the way they're said ("G two", "M C P").
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
  "c0-1": "Your brief, ready before the train.",
  "c0-2": "Here's the whole path, from your words to your glasses.",
  "c0-3": "You write the brief. Your own agent builds the edition. G two Digest checks it, and delivers it.",
  # 1 · Write your brief
  "c1-1": "Start in the web app. Open Your brief, and give your edition a name.",
  "c1-2": "Set Ready by to the time you leave home.",
  "c1-3": "Add a section for each thing you follow, with a source and plain instructions: what counts, and what to skip.",
  "c1-4": "Then Save brief. Your agent reads it. It never edits it.",
  # 2 · Connect your agent
  "c2-1": "Next, Build agents. Any agent that speaks M C P and can make audio will do.",
  "c2-2": "Point it at the server, and it asks to connect.",
  "c2-3": "You see exactly what it may do. Click Allow.",
  "c2-4": "Copy the one prompt it runs, and schedule it an hour before your train.",
  # 3 · Your agent builds the edition
  "c3-1": "Here's a real run. The agent fetches the card guide and your brief.",
  "c3-2": "It reads every source, then writes the full edition and the cards.",
  "c3-3": "It records the audio itself, and uploads it.",
  "c3-4": "Then G two Digest checks every card against its rules. Nothing publishes until there are no errors.",
  "c3-5": "Published. Open the edition: every card with its sources, and a preview of the glasses.",
  # 4 · Pair your glasses
  "c4-1": "On Pair, get a six digit code.",
  "c4-2": "Open G two Digest in the Even app, and type it in. You pair once.",
  "c4-3": "The glasses leave the tour, and show every edition you have.",
  "c4-4": "No glasses today? Make a feed link for your podcast app.",
  # 5 · Read on the ride
  "c5-1": "On the train, pick today's edition. It opens at the first card.",
  "c5-2": "Swipe up on the ring for the next card. The dots show where you are.",
  "c5-3": "Tap to hear the glance. Tap, then hold, for the deep dive.",
  "c5-4": "Double tap to stop, and again to go back. It's already on your phone, so it plays offline.",
  # Recap + end
  "c6-1": "Write it once. Your agent builds it. You just read.",
  "c6-2": "G two Digest. Your brief, ready before the train.",
  # The short (9:16)
  "s-1": "Your agent builds tomorrow's brief tonight.",
  "s-2": "It reads your sources, writes the cards, records the audio, and passes every check.",
  "s-3": "Then it publishes.",
  "s-4": "In the morning, it's on your glasses.",
  "s-5": "Swipe the ring to skim. Tap, then hold, for the deep dive.",
  "s-6": "G two Digest. Your brief, ready before the train.",
}
SPEED = 1.06
args = sys.argv[1:]
only = None
if "--only" in args:
    i = args.index("--only"); only = set(args[i + 1].split(",")); del args[i:i + 2]
out, voices = args[0], args[1:] or ["am_echo"]
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
