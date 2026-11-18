#!/usr/bin/env python3
"""Builds Roarly's bundled sounds (apps/ios/App/Resources/Sounds/*.m4a) and CREDITS.txt.

Every source is public domain, CC0 or CC BY (credited in CREDITS.txt, shown in the app under
Settings > Sound credits). A few sounds are synthesized here with ffmpeg. Sources are downloaded by
hand into a folder (not committed); run:

    python3 tools/build_sounds.py <sources-dir>

Clip windows were picked with tools/classify_sound.swift (Apple's sound classifier) because the
long Wikimedia "sound effect" files are compilations. One-shots are normalized to -16 LUFS, beds to
-26 LUFS and made seamless (the tail crossfades into the head), all mono 44.1 kHz AAC 96 kbps.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "apps/ios/App/Resources/Sounds")

C0 = "CC0 1.0"
PD = "Public domain"
OGA = "https://opengameart.org/content/"
WM = "https://commons.wikimedia.org/wiki/File:"

# name: (source file, start s, duration s, extra filters, kind, credit (title, author, license, url))
SOUNDS = {
    "lion": ("commons/Lion sound effect.wav", 179.0, 3.4, "", "shot", ("Lion sound effect", "Zagz (Wikimedia Commons)", C0, WM + "Lion_sound_effect.wav")),
    "lion_2": ("commons/Lion sound effect.wav", 190.3, 3.0, "", "shot", None),
    "tiger": ("commons/Tiger sound effect.wav", 64.3, 3.2, "", "shot", ("Tiger sound effect", "Zagz (Wikimedia Commons)", C0, WM + "Tiger_sound_effect.wav")),
    "tiger_2": ("commons/439280 schots angry-tiger.wav", 3.0, 2.8, "", "shot", ("Angry tiger", "schots (freesound, via Wikimedia Commons)", C0, WM + "439280_schots_angry-tiger.wav")),
    "bear": ("commons/Grizzly bear sound effect.wav", 9.6, 3.0, "", "shot", ("Grizzly bear sound effect", "Zagz (Wikimedia Commons)", C0, WM + "Grizzly_bear_sound_effect.wav")),
    "dinosaur": ("commons/Lion sound effect.wav", 275.0, 3.4, "asetrate=44100*0.68,aresample=44100,aecho=0.8:0.7:60:0.25", "shot", None),
    "dragon": ("commons/Tiger sound effect.wav", 117.6, 3.0, "asetrate=44100*0.78,aresample=44100,aecho=0.8:0.6:45:0.3", "shot", None),
    "wolf": ("oga/80-cc0-creature-sfx/80-CC0-creature-SFX_0_unz/howl.ogg", 0.0, 3.0, "", "shot", ("80 CC0 creature SFX", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creature-sfx")),
    "monkey": ("oga/gorilla-sounds/gorilla_grunt.ogg", 0.0, 3.5, "", "shot", ("Gorilla Sounds", "AntumDeluge (OpenGameArt)", C0, OGA + "gorilla-sounds")),
    "snake": ("oga/steam-release-sounds/steam_hisses_unz/steam hisses - Marker #2.wav", 0.0, 1.8, "highpass=1500", "shot", ("Steam release sounds", "bart (OpenGameArt)", C0, OGA + "steam-release-sounds")),
    "whale": ("commons/52 Hz Whale Normal Speed.wav", 38.5, 5.0, "", "shot", ("52 Hz Whale (normal speed)", "Wikimedia Commons contributor", C0, WM + "52_Hz_Whale_Normal_Speed.wav")),
    "dog": ("oga/dog-barking-mono/dog_barking_mono.wav", 0.0, 2.0, "", "shot", ("Dog barking (mono)", "OpenGameArt contributor", C0, OGA + "dog-barking-mono")),
    "dog_2": ("oga/dog-sounds/montageAudio-20120706@125721.mp3", 18.0, 2.0, "", "shot", ("Dog sounds", "OpenGameArt contributor", C0, OGA + "dog-sounds")),
    "cat": ("commons/Meow of a Siamese cat - freemaster2.wav", 0.0, 1.6, "", "shot", ("Meow of a Siamese cat", "freemaster2 (via Wikimedia Commons)", C0, WM + "Meow_of_a_Siamese_cat_-_freemaster2.wav")),
    "cat_2": ("oga/cat-purr-meow/cat_mewpurr2.wav", 0.0, 2.4, "", "shot", ("Cat purr & meow", "OpenGameArt contributor", C0, OGA + "cat-purr-meow")),
    "sheep": ("oga/sheep-baa/sheep_baa.flac", 0.0, 2.5, "", "shot", ("Sheep baa", "AntumDeluge (OpenGameArt)", C0, OGA + "sheep-baa")),
    "horse": ("oga/horse-trotting/Trot.ogg", 0.0, 3.0, "", "shot", ("Horse trotting", "EZduzziteh (OpenGameArt)", C0, OGA + "horse-trotting")),
    "frog": ("oga/frog-croaks/croak_03.mp3", 0.0, 1.3, "", "shot", ("Frog croaks", "EZduzziteh (OpenGameArt)", C0, OGA + "frog-croaks")),
    "frog_2": ("oga/frog-croaks/croak_01.mp3", 0.0, 1.0, "", "shot", None),
    "bird": ("oga/bird-chirping-sounds/birdchirping071414.wav", 0.0, 3.0, "", "shot", ("Bird chirping sounds", "syncopika (OpenGameArt)", C0, OGA + "bird-chirping-sounds")),
    "seagull": ("commons/XC707075 - European Herring Gull - Larus argentatus.mp3", 9.8, 2.6, "", "shot", ("European Herring Gull (XC707075)", "xeno-canto recordist (via Wikimedia Commons)", C0, WM + "XC707075_-_European_Herring_Gull_-_Larus_argentatus.mp3")),
    "thunder": ("commons/Nosferatu thunderclap - Richard Humphries.wav", 0.8, 4.2, "", "shot", ("Nosferatu thunderclap", "Richard Humphries", "CC BY 4.0", WM + "Nosferatu_thunderclap_-_Richard_Humphries.wav")),
    "knock": ("commons/Knock on door.wav", 0.0, 2.2, "", "shot", ("Knock on door", "Wikimedia Commons contributor", C0, WM + "Knock_on_door.wav")),
    "doorbell": ("oga/doorbell/doorbell.wav", 0.0, 1.2, "", "shot", ("Doorbell", "frosty ham (OpenGameArt)", C0, OGA + "doorbell")),
    "bell": ("oga/bell-dingschimes/bell_ding1.wav", 0.0, 2.1, "", "shot", ("Bell dings/chimes", "PWL (OpenGameArt)", C0, OGA + "bell-dingschimes")),
    "clock": ("oga/ticking-clock/ticking_clock.wav", 0.0, 3.0, "", "shot", ("Ticking clock", "bart (OpenGameArt)", C0, OGA + "ticking-clock")),
    "car": ("oga/car-sound-effects-pack-low-quality/car_sound_effects_pack_unz/Car_Horn.ogg", 0.0, 0.8, "", "shot", ("Car sound effects pack", "GGBotNet (OpenGameArt)", C0, OGA + "car-sound-effects-pack-low-quality")),
    "rocket": ("oga/rocket-launch/l.mp3", 0.0, 4.5, "", "shot", ("Rocket launch", "qubodup (OpenGameArt)", C0, OGA + "rocket-launch")),
    "magic": ("oga/magic-spell-sfx/magical_1.ogg", 0.0, 2.5, "", "shot", ("Magic spell SFX", "JaggedStone (OpenGameArt)", C0, OGA + "magic-spell-sfx")),
    "magic_2": ("oga/fantasy-magic-spell/fantasy_magic_button_1.mp3", 0.0, 2.5, "", "shot", ("Fantasy magic spell", "Almitory (OpenGameArt)", C0, OGA + "fantasy-magic-spell")),
    "splash": ("oga/6-short-water-splashes/ws.mp3", 0.0, 1.2, "", "shot", ("6 short water splashes", "qubodup (OpenGameArt)", C0, OGA + "6-short-water-splashes")),
    "footsteps": ("@footsteps", 0, 2.0, "", "shot", ("Footsteps", "GboxMikeFozzy (OpenGameArt)", C0, OGA + "footsteps-0")),
    "snore": ("oga/80-cc0-creature-sfx/80-CC0-creature-SFX_0_unz/snore.ogg", 0.0, 3.0, "", "shot", ("80 CC0 creature SFX", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creature-sfx")),
    "giggle": ("oga/group-giggling/group_giggling.ogg", 0.0, 2.5, "", "shot", ("Group giggling", "Nocturnal_Vanguard (OpenGameArt)", C0, OGA + "group-giggling")),
    "whoosh": ("oga/air-whoosh/whoosh2_0.wav", 0.0, 1.6, "", "shot", ("Air whoosh", "pyranostudios (OpenGameArt)", C0, OGA + "air-whoosh")),
    "pop": ("oga/balloon-sounds/balloon_pop.flac", 0.0, 0.6, "", "shot", ("Balloon sounds", "AntumDeluge (OpenGameArt)", C0, OGA + "balloon-sounds")),
    "boing": ("oga/boing/boing.ogg", 0.0, 1.6, "", "shot", ("Boing", "Aeva (OpenGameArt)", C0, OGA + "boing")),
    # Beds (loop).
    "rain": ("oga/amb-rain-loop-1/amb_rain_loop_1.wav", 2.0, 40.0, "", "bed", ("Ambient rain loop", "Kresiek The Furry (OpenGameArt)", C0, OGA + "amb-rain-loop-1")),
    "ocean": ("@ocean", 0, 24.0, "", "bed", ("Beach ocean waves (from jasinski's alkaibeach, freesound CC0)", "qubodup (OpenGameArt)", C0, OGA + "beach-ocean-waves")),
    "forest": ("oga/forest-bird-sounds/fb.mp3", 0.5, 26.0, "", "bed", ("Forest bird sounds", "pauliuw (OpenGameArt)", C0, OGA + "forest-bird-sounds")),
    "night": ("oga/crickets-ambient-noise-loopable/crickets-oneloop.mp3", 0.0, 22.0, "", "bed", ("Crickets ambient noise (loopable)", "Wolfgang_ (OpenGameArt)", C0, OGA + "crickets-ambient-noise-loopable")),
    "fire": ("oga/fireplace-sound-loop/fire.wav", 0.0, 27.0, "", "bed", ("Fireplace sound loop", "PagDev (OpenGameArt)", C0, OGA + "fireplace-sound-loop")),
    "river": ("commons/363120 fractalstudios water-trickle.wav", 1.0, 30.0, "", "bed", ("Water trickle", "fractalstudios (freesound, via Wikimedia Commons)", C0, WM + "363120_fractalstudios_water-trickle.wav")),
    # Synthesized here.
    "bee": ("@synth", 0, 1.8, "aevalsrc=0.35*(2*mod(210*t+2.5*sin(2*PI*5*t)\\,1)-1)*(0.65+0.35*sin(2*PI*11*t)):s=44100:d=1.8,bandpass=f=600:w=500", "shot", None),
    "boat": ("@synth", 0, 2.6, "aevalsrc=0.45*sin(2*PI*98*t)+0.3*sin(2*PI*147*t)+0.12*sin(2*PI*196*t):s=44100:d=2.6,lowpass=900,afade=t=in:d=0.15", "shot", None),
    "wind": ("@synth", 0, 40.0, "anoisesrc=color=pink:r=44100:d=40:a=0.6,lowpass=f=700,highpass=f=90,volume='0.55+0.35*sin(2*PI*0.11*t)+0.1*sin(2*PI*0.37*t)':eval=frame", "bed", None),
    "train": ("@synth", 0, 2.0, "aevalsrc=0.22*sin(2*PI*523*t)+0.22*sin(2*PI*659*t)+0.18*sin(2*PI*784*t)+0.05*(random(0)-0.5):s=44100:d=2.0,afade=t=in:d=0.12,lowpass=3000", "shot", None),
    "airplane": ("@synth", 0, 4.0, "anoisesrc=color=brown:r=44100:d=4:a=0.8,lowpass=f=1200,volume='min(1\\,t/1.5)*min(1\\,(4-t)/1.5)':eval=frame", "shot", None),
    "elephant": ("@synth", 0, 1.6, "aevalsrc=0.4*(2*mod((380+260*sin(PI*t/1.6))*t\\,1)-1)*(0.8+0.2*sin(2*PI*14*t)):s=44100:d=1.6,bandpass=f=900:w=1200,afade=t=in:d=0.08", "shot", None),
    # Two soft "hoo" calls gliding down, like a tawny owl.
    "owl": ("@synth", 0, 1.4, "aevalsrc=(0.5*exp(-pow((t-0.22)/0.09\\,2))+0.45*exp(-pow((t-0.78)/0.16\\,2)))*sin(2*PI*(410-40*t)*t)*(1+0.15*sin(2*PI*28*t)):s=44100:d=1.4,lowpass=f=1500", "shot", None),
    "cow": ("@synth", 0, 1.8, "aevalsrc=0.4*(2*mod((115-25*t/1.8)*t\\,1)-1):s=44100:d=1.8,lowpass=f=700,bandpass=f=350:w=500,afade=t=in:d=0.25", "shot", None),
}


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-800:])


def encode(src_args, out, kind, dur, filters):
    loud = "loudnorm=I=-16:TP=-1.5:LRA=11" if kind == "shot" else "loudnorm=I=-26:TP=-3:LRA=7"
    fades = f"afade=t=in:d=0.015,afade=t=out:st={max(0.0, dur - 0.35):.2f}:d=0.35" if kind == "shot" else ""
    chain = ",".join(x for x in [filters, "highpass=f=40", fades, loud] if x)
    run(["ffmpeg", "-y", "-loglevel", "error", *src_args, "-af", chain, "-ac", "1", "-ar", "44100", "-c:a", "aac", "-b:a", "96k", out])


def seamless(src_args, out, dur, xfade=2.0):
    """Loop-ready bed: the clip's tail crossfades into its head."""
    graph = (
        f"[0:a]aresample=44100,asplit=3[a][b][c];"
        f"[a]atrim=0:{xfade},asetpts=N/SR/TB,afade=t=in:d={xfade}[head];"
        f"[b]atrim={dur}:{dur + xfade},asetpts=N/SR/TB,afade=t=out:d={xfade}[tail];"
        f"[head][tail]amix=inputs=2:normalize=0[joint];"
        f"[c]atrim={xfade}:{dur},asetpts=N/SR/TB[body];"
        f"[joint][body]concat=n=2:v=0:a=1,highpass=f=40,loudnorm=I=-26:TP=-3:LRA=7[o]"
    )
    run(["ffmpeg", "-y", "-loglevel", "error", *src_args, "-filter_complex", graph, "-map", "[o]", "-ac", "1", "-ar", "44100", "-c:a", "aac", "-b:a", "96k", out])


def main():
    src = sys.argv[1]
    tmp = os.path.join(src, "_build")
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    credits, missing = {}, []
    for name, (path, start, dur, filters, kind, credit) in SOUNDS.items():
        out = os.path.join(OUT, name + ".m4a")
        try:
            if path == "@synth":
                gen = os.path.join(tmp, name + ".wav")
                chain = filters
                run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", chain, gen])
                if kind == "bed":
                    seamless(["-i", gen], out, dur - 3, xfade=3)
                else:
                    encode(["-i", gen], out, kind, dur, "")
            elif path == "@footsteps":
                steps = [os.path.join(src, f"oga/footsteps-0/0{i}-footstep.ogg") for i in (1, 2, 3, 4)]
                gen = os.path.join(tmp, "footsteps.wav")
                inputs = sum((["-i", s] for s in steps), [])
                delays = "".join(f"[{i}]adelay={i * 420}|{i * 420}[s{i}];" for i in range(4))
                run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", delays + "[s0][s1][s2][s3]amix=inputs=4:normalize=0", gen])
                encode(["-i", gen], out, kind, dur, "")
            elif path == "@ocean":
                waves = [os.path.join(src, f"oga/beach-ocean-waves/wave_0{i}_cc0-18363__jasinski__alkaibeach.flac") for i in (1, 2, 3, 4)]
                gen = os.path.join(tmp, "ocean.wav")
                order = [0, 1, 2, 3, 1, 0, 3, 2, 0, 3]
                inputs = sum((["-i", waves[i]] for i in order), [])
                n = len(order)
                delays = "".join(f"[{k}]adelay={int(k * 2600)}|{int(k * 2600)}[w{k}];" for k in range(n))
                mix = "".join(f"[w{k}]" for k in range(n)) + f"amix=inputs={n}:normalize=0"
                run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", delays + mix, gen])
                seamless(["-i", gen], out, dur, xfade=2.5)
            else:
                full = os.path.join(src, path)
                if not os.path.exists(full) or os.path.getsize(full) < 2000:
                    raise FileNotFoundError(path)
                args = ["-ss", str(start), "-t", str(dur + (3 if kind == "bed" else 0)), "-i", full]
                if kind == "bed":
                    seamless(args, out, dur, xfade=2.5)
                else:
                    encode(args, out, kind, dur, filters)
            if credit:
                credits[credit] = credits.get(credit, []) + [name]
            print(f"ok  {name}")
        except Exception as e:  # noqa: BLE001
            missing.append(name)
            print(f"--  {name}: {e}")

    lines = [
        "Roarly's sounds come from people who share their recordings freely. Thank you!",
        "",
        "Public domain and CC0 recordings need no credit; we list them anyway. CC BY 4.0: https://creativecommons.org/licenses/by/4.0/",
        "Some sounds were changed (trimmed, pitched, looped, mixed). A few are synthesized for Roarly.",
        "",
    ]
    for (title, author, lic, url), names in sorted(credits.items(), key=lambda x: x[1][0]):
        lines.append(f"{', '.join(n.split('_')[0] for n in names)}: \"{title}\" by {author}. {lic}. {url}")
    lines.append("")
    lines.append("Synthesized for Roarly: " + ", ".join(n for n, s in SOUNDS.items() if s[0] == "@synth" or (s[4] == "shot" and s[5] is None and not n.endswith('_2'))))
    with open(os.path.join(OUT, "CREDITS.txt"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("missing:", missing)


if __name__ == "__main__":
    main()
