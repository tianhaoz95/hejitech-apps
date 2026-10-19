#!/usr/bin/env python3
import wave, struct, math, os, random

SAMPLE_RATE = 44100

def write_wav(filename, samples):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with wave.open(filename, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        max_val = max((abs(s) for s in samples), default=1.0)
        scale = 30000.0 / max_val if max_val > 0 else 1.0
        data = bytearray()
        for s in samples:
            val = int(s * scale)
            val = max(-32767, min(32767, val))
            data.extend(struct.pack('<h', val))
        wav.writeframes(data)
    print(f'Generated {filename} ({len(samples)/SAMPLE_RATE:.2f}s)')

def make_shutter():
    duration = 0.5
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    rng = random.Random(42)
    click_len = int(0.04 * SAMPLE_RATE)
    for i in range(click_len):
        decay = math.exp(-i / (0.008 * SAMPLE_RATE))
        samples[i] = (rng.uniform(-1, 1) * 0.8 + math.sin(2 * math.pi * 1200 * i / SAMPLE_RATE) * 0.5) * decay
    chimes = [(0.08, 523.25, 0.15), (0.16, 659.25, 0.15), (0.24, 783.99, 0.22)]
    for start_t, freq, dur in chimes:
        s_idx = int(start_t * SAMPLE_RATE)
        l_idx = int(dur * SAMPLE_RATE)
        for i in range(l_idx):
            idx = s_idx + i
            if idx < num_samples:
                decay = math.exp(-i / (0.07 * SAMPLE_RATE))
                samples[idx] += math.sin(2 * math.pi * freq * i / SAMPLE_RATE) * 0.6 * decay
                samples[idx] += math.sin(2 * math.pi * freq * 2 * i / SAMPLE_RATE) * 0.2 * decay
    return samples

def make_woof():
    duration = 0.6
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    barks = [0.0, 0.28]
    for b_start in barks:
        s_idx = int(b_start * SAMPLE_RATE)
        b_len = int(0.2 * SAMPLE_RATE)
        for i in range(b_len):
            idx = s_idx + i
            if idx < num_samples:
                t = i / SAMPLE_RATE
                freq = 450 - (230 * (t / 0.2))
                decay = math.exp(-i / (0.05 * SAMPLE_RATE))
                v = (math.sin(2 * math.pi * freq * t) * 0.7 +
                     math.sin(2 * math.pi * freq * 1.5 * t) * 0.4 +
                     math.sin(2 * math.pi * freq * 2.5 * t) * 0.3)
                samples[idx] += v * decay
    return samples

def make_meow():
    duration = 0.65
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    phase = 0.0
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        if t < 0.25:
            freq = 350 + (400 * (t / 0.25))
        else:
            freq = 750 - (270 * ((t - 0.25) / 0.40))
        envelope = math.sin(math.pi * min(1.0, t / duration))
        phase += 2 * math.pi * freq / SAMPLE_RATE
        v = (math.sin(phase) * 0.7 +
             math.sin(2 * phase) * 0.4 +
             math.sin(3 * phase) * 0.2)
        samples[i] = v * envelope
    return samples

def make_quack():
    duration = 0.45
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        freq = 320 - 70 * (t / duration)
        tremolo = 1.0 + 0.3 * math.sin(2 * math.pi * 35 * t)
        decay = math.exp(-i / (0.15 * SAMPLE_RATE)) if t > 0.05 else (t / 0.05)
        v = 0.0
        for h in range(1, 8):
            v += (1.0 / h) * math.sin(2 * math.pi * freq * h * t)
        samples[i] = v * decay * tremolo * 0.5
    return samples

def make_giggle():
    duration = 0.7
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    pops = [0.0, 0.12, 0.22, 0.34, 0.46, 0.56]
    for p_start in pops:
        s_idx = int(p_start * SAMPLE_RATE)
        p_len = int(0.09 * SAMPLE_RATE)
        base_f = 600 + 150 * math.sin(p_start * 10)
        for i in range(p_len):
            idx = s_idx + i
            if idx < num_samples:
                t = i / SAMPLE_RATE
                f = base_f + 250 * math.sin(2 * math.pi * 15 * t)
                decay = math.exp(-i / (0.03 * SAMPLE_RATE))
                samples[idx] += math.sin(2 * math.pi * f * t) * 0.6 * decay
    return samples

def make_boing():
    duration = 0.6
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    phase = 0.0
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        carrier = 200 + 400 * (t / duration)
        mod = 30 * math.sin(2 * math.pi * 25 * t)
        freq = carrier + mod
        phase += 2 * math.pi * freq / SAMPLE_RATE
        decay = math.exp(-t * 2.5)
        samples[i] = math.sin(phase) * decay
    return samples

def make_horn():
    duration = 0.4
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        envelope = math.sin(math.pi * min(1.0, t / duration)) ** 0.5
        v = (math.sin(2 * math.pi * 440 * t) +
             math.sin(2 * math.pi * 554 * t) +
             0.5 * math.sin(2 * math.pi * 880 * t))
        samples[i] = v * envelope * 0.4
    return samples

def make_pop():
    duration = 0.12
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        freq = 300 + 1200 * (t / duration)**2
        decay = math.exp(-t * 30.0)
        samples[i] = math.sin(2 * math.pi * freq * t) * decay
    return samples

def main():
    target_dir = os.path.join(os.getcwd(), 'KidsCam', 'Audio')
    sounds = {
        'shutter.wav': make_shutter(),
        'woof.wav': make_woof(),
        'meow.wav': make_meow(),
        'quack.wav': make_quack(),
        'giggle.wav': make_giggle(),
        'boing.wav': make_boing(),
        'horn.wav': make_horn(),
        'pop.wav': make_pop(),
    }
    for name, data in sounds.items():
        write_wav(os.path.join(target_dir, name), data)
    print('All toddler sound effects generated successfully!')

if __name__ == '__main__':
    main()
