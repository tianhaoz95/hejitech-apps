"""Kokoro (mlx-audio) story reader: tts_say.py <voice> <out.wav> <text file> — one line per sentence,
with a pause between lines. 16 kHz mono WAV for the app's -listenFile test."""
import sys, numpy as np, soundfile as sf
from mlx_audio.tts.utils import load_model
voice, out, src = sys.argv[1:4]
m = load_model("mlx-community/Kokoro-82M-bf16")
lang = voice[0]
parts = []
for line in open(src):
    line = line.strip()
    if not line: continue
    for r in m.generate(text=line, voice=voice, speed=1.0, lang_code=lang):
        parts.append(np.array(r.audio, dtype=np.float32))
    parts.append(np.zeros(int(24000 * 1.4), dtype=np.float32))
a = np.concatenate(parts)
idx = np.arange(0, len(a), 1.5)
a16 = np.interp(idx, np.arange(len(a)), a).astype(np.float32)
sf.write(out, a16, 16000, subtype="PCM_16")
print(out, round(len(a16) / 16000, 1), "s")
