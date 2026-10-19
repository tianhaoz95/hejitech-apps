import math
import struct
import wave
import os

SAMPLE_RATE = 44100

def write_wav(filename, samples):
    with wave.open(filename, 'w') as wav:
        wav.setnchannels(1)  # Mono
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(SAMPLE_RATE)
        # Normalize and convert to 16-bit PCM
        max_amp = max(abs(s) for s in samples) if samples else 1.0
        if max_amp == 0:
            max_amp = 1.0
        scale = 32767.0 * 0.85 / max(max_amp, 1.0)
        raw_data = bytearray()
        for s in samples:
            val = int(max(-32767, min(32767, s * scale)))
            raw_data.extend(struct.pack('<h', val))
        wav.writeframes(raw_data)
    print(f"Generated {filename} ({len(samples)/SAMPLE_RATE:.2f}s)")

def make_bubble_pop():
    # Rapid pitch drop with soft envelope
    duration = 0.12
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 35.0)
        freq = 850.0 * math.exp(-t * 18.0) + 120.0
        phase = 2.0 * math.pi * (850.0 / -18.0 * (math.exp(-t * 18.0) - 1.0) + 120.0 * t)
        s = math.sin(phase) * env
        samples.append(s)
    return samples

def make_chime(freq, duration=0.6):
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        # Glockenspiel envelope: instantaneous attack, exponential decay
        env1 = math.exp(-t * 5.0)
        env2 = math.exp(-t * 8.0)
        env3 = math.exp(-t * 14.0)
        # Fundamental + 2nd overtone + 3rd overtone
        s = 0.7 * math.sin(2.0 * math.pi * freq * t) * env1
        s += 0.2 * math.sin(2.0 * math.pi * (freq * 2.76) * t) * env2
        s += 0.1 * math.sin(2.0 * math.pi * (freq * 5.4) * t) * env3
        samples.append(s)
    return samples

def make_boing():
    duration = 0.35
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 5.5)
        # Upward sweep with wobble
        wobble = math.sin(2.0 * math.pi * 18.0 * t) * 25.0
        freq = 240.0 + (t / duration) * 380.0 + wobble
        phase = 2.0 * math.pi * freq * t
        s = math.sin(phase) * env
        samples.append(s)
    return samples

def make_sparkle():
    duration = 0.5
    num_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * num_samples
    notes = [1046.5, 1318.5, 1567.98, 2093.0, 2637.0] # C6, E6, G6, C7, E7
    for idx, freq in enumerate(notes):
        start_t = idx * 0.07
        start_i = int(start_t * SAMPLE_RATE)
        for i in range(start_i, num_samples):
            t = (i - start_i) / SAMPLE_RATE
            env = math.exp(-t * 9.0)
            shimmer = 1.0 + 0.3 * math.sin(2.0 * math.pi * 12.0 * t)
            s = math.sin(2.0 * math.pi * freq * t) * env * shimmer * 0.25
            samples[i] += s
    return samples

def make_quack():
    # Duck quack: modulated formant ~680Hz & 1350Hz
    duration = 0.32
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        env = (math.sin(math.pi * min(1.0, t / duration))) ** 1.5
        f0 = 260.0 - t * 60.0
        s1 = math.sin(2.0 * math.pi * f0 * t)
        s2 = 0.5 * math.sin(2.0 * math.pi * 680.0 * t) * math.sin(2.0 * math.pi * f0 * t)
        s3 = 0.3 * math.sin(2.0 * math.pi * 1350.0 * t) * math.sin(2.0 * math.pi * f0 * t)
        s = (s1 + s2 + s3) * env
        samples.append(s)
    return samples

def make_woof():
    # Puppy bark: two quick warm bursts
    duration = 0.25
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        env = math.exp(-t * 14.0) * math.sin(math.pi * min(1.0, t * 8.0))
        freq = 320.0 * math.exp(-t * 4.0)
        s = (math.sin(2.0 * math.pi * freq * t) + 0.35 * math.sin(2.0 * math.pi * freq * 1.8 * t)) * env
        samples.append(s)
    return samples

def make_meow():
    # Kitten meow: pitch rise then fall (420 -> 610 -> 380 Hz)
    duration = 0.55
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        progress = t / duration
        if progress < 0.35:
            f = 420.0 + (progress / 0.35) * 190.0
        else:
            f = 610.0 - ((progress - 0.35) / 0.65) * 230.0
        env = math.sin(math.pi * progress) ** 1.2
        s = (math.sin(2.0 * math.pi * f * t) +
             0.4 * math.sin(4.0 * math.pi * f * t) +
             0.2 * math.sin(6.0 * math.pi * f * t)) * env
        samples.append(s)
    return samples

def make_moo():
    # Cow moo: low warm 135Hz rich harmonic sound
    duration = 0.7
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        progress = t / duration
        f = 135.0 - progress * 20.0
        env = math.sin(math.pi * progress) ** 0.8
        s = (math.sin(2.0 * math.pi * f * t) +
             0.6 * math.sin(2.0 * math.pi * 2 * f * t) +
             0.4 * math.sin(2.0 * math.pi * 3 * f * t) +
             0.2 * math.sin(2.0 * math.pi * 4 * f * t)) * env
        samples.append(s)
    return samples

def make_ribbit():
    # Frog croak: modulated bursts
    duration = 0.3
    num_samples = int(duration * SAMPLE_RATE)
    samples = []
    for i in range(num_samples):
        t = i / SAMPLE_RATE
        pulse = 0.5 + 0.5 * math.sin(2.0 * math.pi * 45.0 * t)
        env = math.exp(-t * 6.0) * pulse
        freq = 190.0 + t * 40.0
        s = math.sin(2.0 * math.pi * freq * t) * env
        samples.append(s)
    return samples

def make_lullaby():
    # Sweet music box melody: Twinkle Twinkle opening notes
    # C4, C4, G4, G4, A4, A4, G4
    notes = [
        (261.63, 0.7),
        (261.63, 0.7),
        (392.00, 0.7),
        (392.00, 0.7),
        (440.00, 0.7),
        (440.00, 0.7),
        (392.00, 1.4),
    ]
    total_dur = sum(d for _, d in notes) + 0.5
    total_samples = int(total_dur * SAMPLE_RATE)
    samples = [0.0] * total_samples
    curr_time = 0.0
    for freq, dur in notes:
        start_idx = int(curr_time * SAMPLE_RATE)
        note_len = int(dur * 1.5 * SAMPLE_RATE)
        for i in range(note_len):
            idx = start_idx + i
            if idx >= total_samples:
                break
            t = i / SAMPLE_RATE
            env = math.exp(-t * 3.2)
            s = (0.75 * math.sin(2.0 * math.pi * freq * t) +
                 0.25 * math.sin(2.0 * math.pi * freq * 3.0 * t)) * env * 0.5
            samples[idx] += s
        curr_time += dur
    return samples

def make_unlock():
    # Ascending sweet chime C5, E5, G5
    duration = 0.45
    total_samples = int(duration * SAMPLE_RATE)
    samples = [0.0] * total_samples
    notes = [(523.25, 0.0), (659.25, 0.12), (783.99, 0.24)]
    for freq, start_t in notes:
        start_idx = int(start_t * SAMPLE_RATE)
        for i in range(start_idx, total_samples):
            t = (i - start_idx) / SAMPLE_RATE
            env = math.exp(-t * 8.0)
            s = math.sin(2.0 * math.pi * freq * t) * env * 0.4
            samples[i] += s
    return samples

def main():
    out_dir = "/Users/tianhaoz/GitHub/watch_game/ToddlerPlay/Resources/Sounds"
    os.makedirs(out_dir, exist_ok=True)
    
    write_wav(f"{out_dir}/bubble_pop.wav", make_bubble_pop())
    write_wav(f"{out_dir}/boing.wav", make_boing())
    write_wav(f"{out_dir}/sparkle.wav", make_sparkle())
    write_wav(f"{out_dir}/quack.wav", make_quack())
    write_wav(f"{out_dir}/woof.wav", make_woof())
    write_wav(f"{out_dir}/meow.wav", make_meow())
    write_wav(f"{out_dir}/moo.wav", make_moo())
    write_wav(f"{out_dir}/ribbit.wav", make_ribbit())
    write_wav(f"{out_dir}/lullaby.wav", make_lullaby())
    write_wav(f"{out_dir}/unlock.wav", make_unlock())
    
    # Pentatonic scale notes
    scale = [
        ("c4", 261.63),
        ("d4", 293.66),
        ("e4", 329.63),
        ("g4", 392.00),
        ("a4", 440.00),
        ("c5", 523.25)
    ]
    for name, freq in scale:
        write_wav(f"{out_dir}/chime_{name}.wav", make_chime(freq))

if __name__ == "__main__":
    main()
