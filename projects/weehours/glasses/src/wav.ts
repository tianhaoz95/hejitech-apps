// The glasses mic delivers signed 16-bit little-endian PCM at 16 kHz in 100 ms frames.
export const SAMPLE_RATE = 16_000;

export function concat(frames: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(frames.reduce((n, f) => n + f.length, 0));
  let o = 0;
  for (const f of frames) {
    out.set(f, o);
    o += f.length;
  }
  return out;
}

/** Wraps raw PCM16 mono in a WAV container (what the phone's Whisper transcriber reads). */
export function wav(pcm: Uint8Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const buf = new ArrayBuffer(44 + pcm.length);
  const v = new DataView(buf);
  const text = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm);
  return new Uint8Array(buf);
}

export function durationMs(pcm: Uint8Array, sampleRate = SAMPLE_RATE) {
  return (pcm.length / 2 / sampleRate) * 1000;
}
