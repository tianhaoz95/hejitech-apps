#!/usr/bin/env python3
"""Builds Roarly's bundled sounds (apps/ios/App/Resources/Sounds/*.m4a) and CREDITS.txt.

Every source is public domain, CC0 or CC BY (credited in CREDITS.txt, shown in the app under
Settings > Sound credits). A few sounds are synthesized here with ffmpeg. Sources are downloaded by
hand into a folder (not committed); run:

    python3 tools/build_sounds.py <sources-dir> [name ...]   # only these (others keep their files)

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
BY4 = "CC BY 4.0"
BY3 = "CC BY 3.0"
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
    "wind": ("@synth", 0, 40.0, "anoisesrc=color=pink:r=44100:d=40:a=0.6,lowpass=f=700,highpass=f=90,volume='0.55+0.35*sin(2*PI*0.11*t)+0.1*sin(2*PI*0.37*t)':eval=frame", "bed", None),
    # Two soft "hoo" calls gliding down, like a tawny owl.
    "owl": ("@synth", 0, 1.4, "aevalsrc=(0.5*exp(-pow((t-0.22)/0.09\\,2))+0.45*exp(-pow((t-0.78)/0.16\\,2)))*sin(2*PI*(410-40*t)*t)*(1+0.15*sin(2*PI*28*t)):s=44100:d=1.4,lowpass=f=1500", "shot", None),
}

WWS = "Work With Sounds"
# 2026-11 additions (vehicles, farm, around the house, fantasy, beds) and upgrades of synthesized
# sounds. "@mix" sources are (file, start, dur, delay ms, filters, loop) parts mixed together.
SOUNDS.update({
    # Things that go
    "tractor": ("commons/WWS JohnDeereTractor.ogg", 1.0, 3.5, "", "shot", ("John Deere tractor", WWS + " / Werstas", BY4, WM + "WWS_JohnDeereTractor.ogg")),
    "tractor_2": ("commons/WWS TractorLanzBuldogHL12driving.ogg", 0.0, 3.5, "", "shot", ("Lanz Bulldog HL12 tractor driving", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_TractorLanzBuldogHL12driving.ogg")),
    "bicycle": ("oga/bicycle-sounds/unz/rotating_bicycle_bell-1.wav", 0.0, 1.6, "", "shot", ("Bicycle sounds", "OpenGameArt contributor", C0, OGA + "bicycle-sounds")),
    "bicycle_2": ("commons/Bicycle-bell-1.wav", 0.0, 1.5, "", "shot", ("Bicycle bell 1", "Soundscape_Leuphana (Wikimedia Commons)", C0, WM + "Bicycle-bell-1.wav")),
    "truck": ("commons/WWS FSRTarpan239Dvandriving.ogg", 4.0, 3.5, "", "shot", ("FSR Tarpan 239D van driving", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_FSRTarpan239Dvandriving.ogg")),
    "truck_2": ("commons/Sound of American Train Horn Nathan Airchime K5LA.ogg", 2.6, 2.4, "", "shot", ("American train horn (Nathan Airchime K5LA)", "WeenyBeany (Wikimedia Commons)", BY4, WM + "Sound_of_American_Train_Horn_Nathan_Airchime_K5LA.ogg")),
    "train_2": ("commons/Sound of American Train Horn Nathan Airchime K5LA.ogg", 0.0, 3.5, "", "shot", ("American train horn (Nathan Airchime K5LA)", "WeenyBeany (Wikimedia Commons)", BY4, WM + "Sound_of_American_Train_Horn_Nathan_Airchime_K5LA.ogg")),
    "car_2": ("commons/WWS CarPrinzNSU1200Cengine.ogg", 45.5, 3.5, "", "shot", ("NSU Prinz 1200 C engine", WWS + " / Technical Museum of Slovenia", BY4, WM + "WWS_CarPrinzNSU1200Cengine.ogg")),
    "duck": ("commons/Ducks snatching.ogg", 0.0, 2.8, "", "shot", ("Ducks snatching", "Bert76 (Wikimedia Commons)", C0, WM + "Ducks_snatching.ogg")),
    "motorcycle": ("commons/Motorbike 4.ogg", 0.0, 3.1, "", "shot", ("Motorbike 4", "ezwa (Wikimedia Commons)", PD, WM + "Motorbike_4.ogg")),
    "siren_2": ("commons/American police siren i.ogg", 2.0, 4.0, "", "shot", ("American police siren", "lezer (Wikimedia Commons)", PD, WM + "American_police_siren_i.ogg")),
    "train": ("@mix", 0, 3.6, [("commons/Steam engine.ogg", 36.0, 3.6, 0, "", False), ("commons/Parovoz sound.ogg", 0.0, 2.4, 700, "volume=0.8", False)], "shot",
              [("Steam engine", "aradlaw (Wikimedia Commons)", PD, WM + "Steam_engine.ogg"), ("Parovoz sound", "Alex Alex Lep (Wikimedia Commons)", PD, WM + "Parovoz_sound.ogg")]),
    "boat": ("commons/Original foghorn at East Brother Island Lighthouse.ogg", 0.8, 3.4, "", "shot", ("Original foghorn at East Brother Island Lighthouse", "Elwood P. Dowd (Wikimedia Commons)", C0, WM + "Original_foghorn_at_East_Brother_Island_Lighthouse.ogg")),
    "airplane": ("commons/428086 inspectorj airplane-boeing-flyby-right-to-left-a.wav", 7.0, 5.0, "", "shot", ("Airplane, Boeing, flyby, right to left (freesound 428086)", "InspectorJ (via Wikimedia Commons)", BY4, WM + "428086_inspectorj_airplane-boeing-flyby-right-to-left-a.wav")),
    "rooster": ("commons/Medium rooster crowing.ogg", 2.0, 4.0, "", "shot", ("Medium rooster crowing", "alys (Wikimedia Commons)", PD, WM + "Medium_rooster_crowing.ogg")),
    "goat_2": ("commons/Herd of goats bleating.ogg", 3.0, 2.5, "", "shot", ("Herd of goats bleating", "stephan (Wikimedia Commons)", PD, WM + "Herd_of_goats_bleating.ogg")),
    "helicopter": ("oga/helicopter-sounds/helicopter_0.mp3", 18.0, 3.6, "", "shot", ("Helicopter sounds", "OpenGameArt contributor", C0, OGA + "helicopter-sounds")),
    "siren": ("oga/sirens-and-alarm-noise/siren_0.mp3", 0.0, 4.0, "", "shot", ("Sirens and alarm noise", "OpenGameArt contributor", C0, OGA + "sirens-and-alarm-noise")),
    "digger": ("@mix", 0, 3.4, [("commons/WWS JohnDeereTractor.ogg", 6.0, 3.4, 0, "volume=0.45", False),
                                 ("commons/Back-up beeper.ogg", 0.4, 3.4, 0, "", False)], "shot",
               [("John Deere tractor", WWS + " / Werstas", BY4, WM + "WWS_JohnDeereTractor.ogg"), ("Back-up beeper", "Ke4roh (Wikimedia Commons)", C0, WM + "Back-up_beeper.ogg")]),
    # Farm and little critters
    "pig": ("oga/baby-animals-sounds-pack/unz/Squeal.ogg", 0.0, 1.2, "", "shot", ("Baby animals sounds pack", "OpenGameArt contributor", C0, OGA + "baby-animals-sounds-pack")),
    "goat": ("oga/baby-animals-sounds-pack/unz/Bleat.ogg", 0.0, 1.0, "", "shot", ("Baby animals sounds pack", "OpenGameArt contributor", C0, OGA + "baby-animals-sounds-pack")),
    "chicken_2": ("oga/baby-animals-sounds-pack/unz/Peeps.ogg", 0.0, 0.7, "", "shot", ("Baby animals sounds pack", "OpenGameArt contributor", C0, OGA + "baby-animals-sounds-pack")),
    "donkey": ("commons/157763 felix-blume a-donkey-is-braying-in-his-enclosure-in-south-of-france.wav", 6.0, 3.6, "", "shot", ("A donkey is braying in his enclosure (freesound 157763)", "Felix Blume (via Wikimedia Commons)", C0, WM + "157763_felix-blume_a-donkey-is-braying-in-his-enclosure-in-south-of-france.wav")),
    "dolphin": ("commons/161691 felixblume dolphin-screaming-underwater-in-caribbean-sea-mexico.wav", 29.5, 3.0, "", "shot", ("Dolphin screaming underwater, Caribbean Sea (freesound 161691)", "Felix Blume (via Wikimedia Commons)", C0, WM + "161691_felixblume_dolphin-screaming-underwater-in-caribbean-sea-mexico.wav")),
    "turkey": ("commons/Gobbler.ogg", 0.0, 2.6, "", "shot", ("Gobbler", "bod (Wikimedia Commons)", PD, WM + "Gobbler.ogg")),
    "chicken": ("commons/Hen announcing shes lain an egg.ogg", 0.5, 3.0, "", "shot", ("Hen announcing she's lain an egg", "alys (Wikimedia Commons)", PD, WM + "Hen_announcing_shes_lain_an_egg.ogg")),
    "pig_2": ("commons/Pig grunt - Erdie.ogg", 0.0, 0.8, "", "shot", ("Pig grunt", "Erdie (Wikimedia Commons)", BY3, WM + "Pig_grunt_-_Erdie.ogg")),
    "bee": ("commons/Bombus buzz.ogg", 3.0, 2.2, "", "shot", ("Bombus buzz", "Mysid (Wikimedia Commons)", PD, WM + "Bombus_buzz.ogg")),
    "fly": ("commons/Bombus buzz.ogg", 0.5, 2.0, "asetrate=44100*1.35,aresample=44100,highpass=f=200", "shot", ("Bombus buzz", "Mysid (Wikimedia Commons)", PD, WM + "Bombus_buzz.ogg")),
    "elephant": ("commons/Elephant voice - trumpeting.ogg", 0.0, 1.5, "", "shot", ("Elephant voice, trumpeting", "தகவலுழவன் (Wikimedia Commons)", C0, WM + "Elephant_voice_-_trumpeting.ogg")),
    "cow": ("oga/baby-animals-sounds-pack/unz/Moo.ogg", 0.0, 1.6, "", "shot", ("Baby animals sounds pack", "OpenGameArt contributor", C0, OGA + "baby-animals-sounds-pack")),
    "crow": ("@mix", 0, 1.3, [("oga/crow-caw/crow_caw.wav", 0, 0.5, 0, "", False), ("oga/crow-caw/crow_caw.wav", 0, 0.5, 620, "asetrate=44100*0.96,aresample=44100", False)], "shot", ("Crow caw", "OpenGameArt contributor", C0, OGA + "crow-caw")),
    # Three quick squeaks.
    "mouse": ("@synth", 0, 0.9, "aevalsrc=0.5*(exp(-pow((t-0.12)/0.035\\,2))+exp(-pow((t-0.38)/0.03\\,2))+0.8*exp(-pow((t-0.6)/0.04\\,2)))*sin(2*PI*(3600+900*sin(2*PI*9*t))*t):s=44100:d=0.9", "shot", None),
    # Places (beds)
    "farm": ("commons/WWS Cattleshed.ogg", 72.0, 28.0, "", "bed", ("Cattle shed", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_Cattleshed.ogg")),
    "city": ("oga/high-traffic-road-sounds/gatve Varniu_2.ogg", 2.0, 30.0, "", "bed", ("High traffic road sounds", "OpenGameArt contributor", C0, OGA + "high-traffic-road-sounds")),
    "underwater": ("commons/Underwater sound of a river.mp3", 2.0, 28.0, "", "bed", ("Underwater sound of a river", "Thomas Bresson (Wikimedia Commons)", BY4, WM + "Underwater_sound_of_a_river.mp3")),
    "cave": ("oga/dripping-water-loop/atmosbasement.mp3_.flac", 0.0, 17.0, "", "bed", ("Dripping water loop", "OpenGameArt contributor", C0, OGA + "dripping-water-loop")),
    # Around the house
    "creak": ("oga/door-open-door-close-set/unz/qubodup-DoorSet/flac/qubodup-DoorOpen03.flac", 0.0, 1.0, "", "shot", ("Door open, door close set", "qubodup (OpenGameArt)", C0, OGA + "door-open-door-close-set")),
    "creak_2": ("oga/creaky-door-hinge-spooky/creaky_door_hinge.wav", 0.0, 4.2, "", "shot", ("Creaky door hinge (spooky)", "OpenGameArt contributor", C0, OGA + "creaky-door-hinge-spooky")),
    "slam": ("oga/100-cc0-sfx/unz/slam_03.ogg", 0.0, 0.8, "", "shot", ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx")),
    "munch": ("oga/7-eating-crunches/unz/crunch.2.ogg", 0.0, 0.9, "", "shot", ("7 eating crunches", "Tito (OpenGameArt)", C0, OGA + "7-eating-crunches")),
    "munch_2": ("oga/apple-bite/apple_bite_0.ogg", 0.0, 0.8, "", "shot", ("Apple bite", "OpenGameArt contributor", C0, OGA + "apple-bite")),
    "slurp": ("@mix", 0, 1.6, [("oga/liquid-bottle-drink-set/unz/qubodup-bottle-and-drink-sounds/swallow-05.flac", 0, 1.0, 0, "", False),
                               ("oga/liquid-bottle-drink-set/unz/qubodup-bottle-and-drink-sounds/swallow-02.flac", 0, 0.8, 750, "", False)], "shot",
              ("Liquid, bottle and drink set", "qubodup (OpenGameArt)", C0, OGA + "liquid-bottle-drink-set")),
    "phone": ("@mix", 0, 3.7, [("commons/WWS Telephone8211ringing.ogg", 15.95, 1.65, 0, "", False), ("commons/WWS Telephone8211ringing.ogg", 20.95, 1.65, 2000, "", False)], "shot", ("Telephone ringing", WWS + " / Technical Museum of Slovenia", BY4, WM + "WWS_Telephone8211ringing.ogg")),
    "yawn": ("commons/Yawning 1.ogg", 0.4, 3.6, "", "shot", ("Yawning 1", "ezwa (Wikimedia Commons)", PD, WM + "Yawning_1.ogg")),
    "kiss": ("commons/Kiss Pop.ogg", 0.0, 1.0, "", "shot", ("Kiss Pop", "Nathan Smith (Wikimedia Commons)", PD, WM + "Kiss_Pop.ogg")),
    "flush": ("commons/Toilet flush.flac", 1.0, 4.0, "", "shot", ("Toilet flush", "ᐃᓄᒃᑎᑐᑦ (Wikimedia Commons)", C0, WM + "Toilet_flush.flac")),
    "baby": ("commons/Crying newborn baby.ogg", 8.0, 3.0, "", "shot", ("Crying newborn baby", "the_yura (Wikimedia Commons)", C0, WM + "Crying_newborn_baby.ogg")),
    "sneeze": ("oga/genuine-sneeze-sound/sneeze.flac", 0.0, 1.8, "", "shot", ("Genuine sneeze sound", "OpenGameArt contributor", C0, OGA + "genuine-sneeze-sound")),
    "cheer": ("oga/applause-in-a-large-hall-or-church/applause-clapping-church-crowd-immersive.wav", 34.0, 3.5, "", "shot", ("Applause in a large hall or church", "OpenGameArt contributor", C0, OGA + "applause-in-a-large-hall-or-church")),
    "drum": ("oga/horde-war-drums-loop/horde_war_drums_by_william_hector.wav", 0.0, 3.0, "", "shot", ("Horde war drums loop", "William Hector (OpenGameArt)", C0, OGA + "horde-war-drums-loop")),
    "trumpet": ("oga/classic-fanfare-lick/fanfare_3.ogg", 0.0, 2.9, "", "shot", ("Classic fanfare lick", "OpenGameArt contributor", C0, OGA + "classic-fanfare-lick")),
    "whistle": ("commons/WWS Policewhistle.ogg", 0.5, 2.2, "", "shot", ("Police whistle", WWS + " / Konrad Gutkowski", BY4, WM + "WWS_Policewhistle.ogg")),
    "fireworks": ("@mix", 0, 2.4, [("@whizz", 0, 0.8, 0, "", False), ("oga/25-cc0-bang-firework-sfx/unz/bang_05.ogg", 0, 1.6, 750, "", False)], "shot", ("25 CC0 bang / firework SFX", "rubberduck (OpenGameArt)", C0, OGA + "25-cc0-bang-firework-sfx")),
    "fireworks_2": ("@mix", 0, 2.2, [("@whizz", 0, 0.8, 0, "asetrate=44100*1.15,aresample=44100", False), ("oga/25-cc0-bang-firework-sfx/unz/bang_04.ogg", 0, 1.2, 700, "", False),
                                     ("oga/25-cc0-bang-firework-sfx/unz/bang_05.ogg", 0, 1.2, 1100, "volume=0.6", False)], "shot", None),
    # Magic & silly
    "ghost": ("oga/ghost-monster-voice-moaning-growling/unz/qubodup-GhostMoans/wav/qubodup-GhostMoan02.wav", 0.0, 3.5, "", "shot", ("Ghost / monster voice moaning", "qubodup (OpenGameArt)", C0, OGA + "ghost-monster-voice-moaning-growling")),
    "monster": ("oga/big-scary-troll-sounds/troll-roars_0.ogg", 7.0, 2.8, "", "shot", ("Big scary troll sounds", "OpenGameArt contributor", C0, OGA + "big-scary-troll-sounds")),
    "monster_2": ("oga/80-cc0-creture-sfx-2/unz/roar_05.ogg", 0.0, 1.1, "", "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),
    # Beep boop: a little square-wave melody.
    "robot": ("@synth", 0, 1.3, "aevalsrc=0.3*(between(t\\,0.0\\,0.14)*sgn(sin(2*PI*880*t))+between(t\\,0.2\\,0.34)*sgn(sin(2*PI*660*t))+between(t\\,0.4\\,0.54)*sgn(sin(2*PI*990*t))+between(t\\,0.62\\,1.0)*sgn(sin(2*PI*(520+300*sin(2*PI*6*t))*t))):s=44100:d=1.3,lowpass=f=4000", "shot", None),
    "laser": ("oga/50-cc0-sci-fi-sfx/unz/retro_laser_01.ogg", 0.0, 1.0, "", "shot", ("50 CC0 sci-fi SFX", "rubberduck (OpenGameArt)", C0, OGA + "50-cc0-sci-fi-sfx")),
    "sword": ("oga/20-sword-sound-effects-attacks-and-clashes/unz/sword_clash.1.ogg", 0.0, 1.0, "", "shot", ("20 sword sound effects", "starninjas (OpenGameArt)", C0, OGA + "20-sword-sound-effects-attacks-and-clashes")),
    "sword_2": ("oga/20-sword-sound-effects-attacks-and-clashes/unz/sword_clash.3.ogg", 0.0, 0.9, "", "shot", None),
    "treasure": ("@mix", 0, 2.0, [("oga/coin-drop/coin_drop.wav", 0, 1.4, 0, "", False), ("oga/12-coin-sound-effects/unz/coin.5.ogg", 0, 0.6, 450, "", False),
                                  ("oga/12-coin-sound-effects/unz/coin.1.ogg", 0, 0.5, 800, "", False)], "shot",
                 [("Coin drop", "OpenGameArt contributor", C0, OGA + "coin-drop"), ("12 coin sound effects", "starninjas (OpenGameArt)", C0, OGA + "12-coin-sound-effects")]),
    "witch": ("oga/witch-cackle/witch_cackle-1_0.ogg", 0.0, 1.3, "", "shot", ("Witch cackle", "OpenGameArt contributor", C0, OGA + "witch-cackle")),
    "giant": ("@mix", 0, 2.4, [("oga/mech-stomp-step-sound/stomp.flac", 0, 0.7, 0, "asetrate=44100*0.7,aresample=44100,aecho=0.8:0.6:70:0.3", False),
                               ("oga/mech-stomp-step-sound/stomp.flac", 0, 0.7, 720, "asetrate=44100*0.66,aresample=44100,aecho=0.8:0.6:70:0.3", False),
                               ("oga/mech-stomp-step-sound/stomp.flac", 0, 0.7, 1440, "asetrate=44100*0.62,aresample=44100,aecho=0.8:0.6:70:0.3", False)], "shot",
              ("Mech stomp step sound", "OpenGameArt contributor", C0, OGA + "mech-stomp-step-sound")),
    "alien": ("oga/ufo-beam/Beam.ogg", 0.0, 3.5, "", "shot", ("UFO beam", "OpenGameArt contributor", C0, OGA + "ufo-beam")),
})

BY2 = "CC BY 2.0"
# 2026-11-22 additions: 50 new sounds across all 8 categories (141 cues total).
SOUNDS.update({
    # Wild animals
    "seal": ("commons/Arctocephalus forsteri - sound.ogg", 25.5, 3.0, "", "shot", ("Arctocephalus forsteri sound", "Department of Conservation (Wikimedia Commons)", BY4, WM + "Arctocephalus_forsteri_-_sound.ogg")),
    "penguin": ("commons/20091121 Little Penguin calls at St Kilda Breakwater.ogg", 27.5, 3.0, "", "shot", ("Little Penguin calls at St Kilda Breakwater", "Mikeybear (Wikimedia Commons)", BY3, WM + "20091121_Little_Penguin_calls_at_St_Kilda_Breakwater.ogg")),
    "fox": ("commons/Fennec Singing.ogg", 2.5, 2.8, "", "shot", ("Fennec Singing", "Eosin-Y (Wikimedia Commons)", PD, WM + "Fennec_Singing.ogg")),
    "hyena": ("@mix", 0, 2.1, [
        ("commons/Giggling call of a spotted hyena (Crocuta crocuta) - 1472-6785-10-9-S1.oga", 0.0, 1.0, 0, "", False),
        ("commons/Giggling call of a spotted hyena (Crocuta crocuta) - 1472-6785-10-9-S1.oga", 0.0, 1.0, 1020, "asetrate=44100*0.95,aresample=44100", False),
    ], "shot", ("Giggling call of a spotted hyena", "Mathevon et al. (Wikimedia Commons)", BY2, WM + "Giggling_call_of_a_spotted_hyena_(Crocuta_crocuta)_-_1472-6785-10-9-S1.oga")),
    "hippo": ("commons/Hippopotamus sound effect.wav", 35.5, 3.2, "", "shot", ("Hippopotamus sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Hippopotamus_sound_effect.wav")),
    "eagle": ("commons/Screaming Hawk.wav", 0.0, 2.8, "", "shot", ("Screaming Hawk", "PsychoBird (Wikimedia Commons)", BY3, WM + "Screaming_Hawk.wav")),
    "crocodile": ("commons/27alligator2bellow.ogg", 12.5, 3.2, "", "shot", ("Alligator bellow", "Wikimedia Commons contributor", PD, WM + "27alligator2bellow.ogg")),
    "peacock": ("commons/Pavo cristatus (call).ogg", 0.0, 2.8, "", "shot", ("Pavo cristatus call", "Ke4roh (Wikimedia Commons)", PD, WM + "Pavo_cristatus_(call).ogg")),
    # Farm friends
    "goose": ("commons/Branta canadensis.ogg", 0.0, 2.8, "", "shot", ("Branta canadensis", "Wikimedia Commons contributor", PD, WM + "Branta_canadensis.ogg")),
    "hooves": ("commons/Six Horses Galloping By.ogg", 13.0, 3.5, "", "shot", ("Six Horses Galloping By", "Freesound Community (via Wikimedia Commons)", C0, WM + "Six_Horses_Galloping_By.ogg")),
    "guinea_pig": ("commons/Guinea Pig Feeding Wheek.ogg", 0.0, 2.6, "", "shot", ("Guinea Pig Feeding Wheek", "Wikimedia Commons contributor", PD, WM + "Guinea_Pig_Feeding_Wheek.ogg")),
    # Little critters
    "parrot": ("commons/Talking Parrot (Psittacula krameri).ogg", 3.5, 2.8, "", "shot", ("Talking Parrot (Psittacula krameri)", "Amada44 (Wikimedia Commons)", BY3, WM + "Talking_Parrot_(Psittacula_krameri).ogg")),
    "woodpecker": ("commons/Woodpecker tapping.ogg", 7.5, 2.6, "", "shot", ("Woodpecker tapping", "U.S. Fish and Wildlife Service (Wikimedia Commons)", PD, WM + "Woodpecker_tapping.ogg")),
    "bat": ("commons/Hoary bat chirp recording.wav", 17.5, 2.4, "", "shot", ("Hoary bat chirp recording", "Kaldari (Wikimedia Commons)", C0, WM + "Hoary_bat_chirp_recording.wav")),
    "cicada": ("commons/Cicadas in Greece.ogg", 0.5, 22.0, "", "bed", ("Cicadas in Greece", "Channel R (Wikimedia Commons)", PD, WM + "Cicadas_in_Greece.ogg")),
    "pigeon": ("commons/Dove cooing.ogg", 0.0, 3.0, "", "shot", ("Dove cooing", "mary905 (Wikimedia Commons)", PD, WM + "Dove_cooing.ogg")),
    # Rapid chattering squirrel chirps.
    "squirrel": ("@synth", 0, 1.5, "aevalsrc=0.45*(exp(-pow((t-0.12)/0.03\\,2))+exp(-pow((t-0.28)/0.028\\,2))+exp(-pow((t-0.44)/0.032\\,2))+exp(-pow((t-0.78)/0.03\\,2))+exp(-pow((t-0.96)/0.035\\,2)))*(sin(2*PI*(2500-700*mod(t\\,0.16))*t)+0.4*sin(2*PI*(5000-1400*mod(t\\,0.16))*t)):s=44100:d=1.5,bandpass=f=2400:w=2200", "shot", None),
    "cuckoo": ("commons/Great Spotted Cuckoo call (Clamator glandarius).ogg", 0.0, 2.8, "", "shot", ("Great Spotted Cuckoo call", "João Tomás (Wikimedia Commons)", BY4, WM + "Great_Spotted_Cuckoo_call_(Clamator_glandarius).ogg")),
    # Weather
    "hail": ("@mix", 0, 24.0, [
        ("oga/amb-rain-loop-1/amb_rain_loop_1.wav", 2.0, 28.0, 0, "highpass=f=500,volume=0.8", True),
        ("@hail", 0, 28.0, 0, "volume=0.55", False),
    ], "bed", ("Ambient rain loop", "Kresiek The Furry (OpenGameArt)", C0, OGA + "amb-rain-loop-1")),
    "snow_crunch": ("commons/Crunchy Snow Walking Sound Effect - Human Sounds.opus", 1.0, 3.0, "", "shot", ("Crunchy Snow Walking Sound Effect", "Spanac (via Wikimedia Commons)", BY3, WM + "Crunchy_Snow_Walking_Sound_Effect_-_Human_Sounds.opus")),
    # Gentle pentatonic metallic wind chimes.
    "wind_chimes": ("@synth", 0, 3.0, "aevalsrc=0.22*(gt(t\\,0.05)*exp(-(t-0.05)*1.7)*sin(2*PI*1046.5*t)+gt(t\\,0.28)*exp(-(t-0.28)*1.6)*sin(2*PI*1318.5*t)+gt(t\\,0.52)*exp(-(t-0.52)*1.5)*sin(2*PI*1568*t)+gt(t\\,0.85)*exp(-(t-0.85)*1.6)*sin(2*PI*1760*t)+gt(t\\,1.15)*exp(-(t-1.15)*1.5)*sin(2*PI*2093*t)+gt(t\\,1.55)*exp(-(t-1.55)*1.8)*sin(2*PI*1568*t)):s=44100:d=3.0,aecho=0.8:0.7:120:0.35", "shot", None),
    "storm": ("@mix", 0, 28.0, [
        ("oga/amb-rain-loop-1/amb_rain_loop_1.wav", 0.0, 32.0, 0, "volume=0.85", True),
        ("@stormwind", 0, 32.0, 0, "volume=0.75", False),
        ("commons/Nosferatu thunderclap - Richard Humphries.wav", 0.8, 4.2, 6500, "lowpass=f=600,volume=0.45", False),
        ("commons/Nosferatu thunderclap - Richard Humphries.wav", 0.8, 4.2, 19500, "lowpass=f=500,volume=0.35", False),
    ], "bed", [
        ("Ambient rain loop", "Kresiek The Furry (OpenGameArt)", C0, OGA + "amb-rain-loop-1"),
        ("Nosferatu thunderclap", "Richard Humphries", BY4, WM + "Nosferatu_thunderclap_-_Richard_Humphries.wav"),
    ]),
    "drip": ("@mix", 0, 18.0, [
        ("oga/dripping-water/Dripping Water.wav", 0.0, 22.0, 0, "", True),
    ], "bed", ("Dripping water", "WolfTech (OpenGameArt)", BY3, OGA + "dripping-water")),
    # Places (beds)
    "jungle": ("commons/404114 felix-blume toucans-singing-in-the-amazonian-rainforest-brazil.ogg", 10.0, 28.0, "", "bed", ("Toucans singing in the Amazonian rainforest (freesound 404114)", "Felix Blume (via Wikimedia Commons)", C0, WM + "404114_felix-blume_toucans-singing-in-the-amazonian-rainforest-brazil.ogg")),
    "playground": ("commons/209901 foongaz city-playground-boxhagenerplatz-berlin.wav", 55.0, 26.0, "", "bed", ("City playground Boxhagenerplatz Berlin (freesound 209901)", "foongaz (via Wikimedia Commons)", C0, WM + "209901_foongaz_city-playground-boxhagenerplatz-berlin.wav")),
    "space": ("oga/underwater-or-space-engine-rumble/underwater_or_space_engine_0.ogg", 2.0, 26.0, "lowpass=f=900", "bed", ("Underwater or space engine rumble", "OpenGameArt contributor", C0, OGA + "underwater-or-space-engine-rumble")),
    "castle": ("oga/loopable-dungeon-ambience/dungeon_ambient_1_0.ogg", 2.0, 26.0, "", "bed", ("Loopable dungeon ambience", "OpenGameArt contributor", C0, OGA + "loopable-dungeon-ambience")),
    "train_ride": ("commons/Steam engine.ogg", 5.0, 26.0, "", "bed", ("Steam engine", "aradlaw (Wikimedia Commons)", PD, WM + "Steam_engine.ogg")),
    "meadow": ("@mix", 0, 24.0, [
        ("oga/bird-chirping-sounds/birdchirping071414.wav", 0.0, 28.0, 0, "volume=0.45", True),
        ("@breeze", 0, 28.0, 0, "volume=0.45", False),
    ], "bed", ("Bird chirping sounds", "syncopika (OpenGameArt)", C0, OGA + "bird-chirping-sounds")),
    "fairground": ("commons/Street parade carnival people yelling kamelle kamelle.ogg", 35.0, 26.0, "", "bed", ("Street parade carnival", "stephan (Wikimedia Commons)", PD, WM + "Street_parade_carnival_people_yelling_kamelle_kamelle.ogg")),
    # Things that go
    "submarine": ("oga/sonar-ping/sonar_ping_0.mp3", 0.0, 2.6, "", "shot", ("Sonar ping", "OpenGameArt contributor", C0, OGA + "sonar-ping")),
    "cannon": ("oga/25-cc0-bang-firework-sfx/unz/cannon_02.ogg", 0.0, 1.8, "", "shot", ("25 CC0 bang / firework SFX", "rubberduck (OpenGameArt)", C0, OGA + "25-cc0-bang-firework-sfx")),
    "hot_air_balloon": ("commons/Pressurized fire.ogg", 0.0, 1.8, "", "shot", ("Pressurized fire", "gregoryweir (Wikimedia Commons)", PD, WM + "Pressurized_fire.ogg")),
    # Rolling wheels on pavement with rhythmic sidewalk cracks.
    "skateboard": ("@synth", 0, 2.6, "anoisesrc=color=brown:r=44100:d=2.6:a=0.55,bandpass=f=320:w=420,volume='0.75+0.25*exp(-pow((mod(t\\,0.55)-0.08)/0.02\\,2))+0.25*exp(-pow((mod(t\\,0.55)-0.13)/0.02\\,2))':eval=frame", "shot", None),
    "sleigh": ("commons/Sleigh bells.wav", 0.5, 2.8, "", "shot", ("Sleigh bells", "The Midnite Wolf (Wikimedia Commons)", C0, WM + "Sleigh_bells.wav")),
    "anchor": ("oga/chain-winch-sounds/unz/winch - Marker #8.wav", 0.0, 3.2, "", "shot", ("Chain winch sounds", "HaelDB (OpenGameArt)", C0, OGA + "chain-winch-sounds")),
    # Around the house
    "bath": ("commons/Faucet water into sink.ogg", 16.0, 3.0, "", "shot", ("Faucet water into sink", "stephan (Wikimedia Commons)", PD, WM + "Faucet_water_into_sink.ogg")),
    "zipper": ("oga/zipper/zipper-1.wav", 0.0, 0.8, "", "shot", ("Zipper", "OpenGameArt contributor", C0, OGA + "zipper")),
    "page_turn": ("oga/100-cc0-sfx/unz/paper_04.ogg", 0.0, 0.6, "", "shot", ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx")),
    # Cute quick double hiccup.
    "hiccup": ("@synth", 0, 1.2, "aevalsrc=0.55*(exp(-pow((t-0.16)/0.045\\,2))*sin(2*PI*(320+900*(t-0.12))*t)+0.85*exp(-pow((t-0.78)/0.045\\,2))*sin(2*PI*(340+850*(t-0.74))*t)):s=44100:d=1.2,bandpass=f=700:w=900", "shot", None),
    "tummy_rumble": ("oga/gastric-distress/gastricdistress_bylfa_0.wav", 10.5, 2.6, "", "shot", ("Gastric distress", "cheese2135 (OpenGameArt)", C0, OGA + "gastric-distress")),
    # Soft breathy "shhh!"
    "shush": ("@synth", 0, 1.5, "anoisesrc=color=white:r=44100:d=1.5:a=0.45,bandpass=f=3400:w=2200,volume='exp(-pow((t-0.65)/0.38\\,2))':eval=frame", "shot", None),
    # Gentle tinkling music-box lullaby loop (C-C-G-G-A-A-G, F-F-E-E-D-D-C).
    "music_box": ("@synth", 0, 19.0, "aevalsrc=0.22*("
        "gt(mod(t\\,8)\\,0.0)*lt(mod(t\\,8)\\,0.6)*exp(-mod(t\\,0.5)*5)*sin(2*PI*523.25*t)+"
        "gt(mod(t\\,8)\\,0.5)*lt(mod(t\\,8)\\,1.1)*exp(-(mod(t\\,8)-0.5)*5)*sin(2*PI*523.25*t)+"
        "gt(mod(t\\,8)\\,1.0)*lt(mod(t\\,8)\\,1.6)*exp(-(mod(t\\,8)-1.0)*5)*sin(2*PI*783.99*t)+"
        "gt(mod(t\\,8)\\,1.5)*lt(mod(t\\,8)\\,2.1)*exp(-(mod(t\\,8)-1.5)*5)*sin(2*PI*783.99*t)+"
        "gt(mod(t\\,8)\\,2.0)*lt(mod(t\\,8)\\,2.6)*exp(-(mod(t\\,8)-2.0)*5)*sin(2*PI*880.0*t)+"
        "gt(mod(t\\,8)\\,2.5)*lt(mod(t\\,8)\\,3.1)*exp(-(mod(t\\,8)-2.5)*5)*sin(2*PI*880.0*t)+"
        "gt(mod(t\\,8)\\,3.0)*lt(mod(t\\,8)\\,4.0)*exp(-(mod(t\\,8)-3.0)*3)*sin(2*PI*783.99*t)+"
        "gt(mod(t\\,8)\\,4.0)*lt(mod(t\\,8)\\,4.6)*exp(-(mod(t\\,8)-4.0)*5)*sin(2*PI*698.46*t)+"
        "gt(mod(t\\,8)\\,4.5)*lt(mod(t\\,8)\\,5.1)*exp(-(mod(t\\,8)-4.5)*5)*sin(2*PI*698.46*t)+"
        "gt(mod(t\\,8)\\,5.0)*lt(mod(t\\,8)\\,5.6)*exp(-(mod(t\\,8)-5.0)*5)*sin(2*PI*659.25*t)+"
        "gt(mod(t\\,8)\\,5.5)*lt(mod(t\\,8)\\,6.1)*exp(-(mod(t\\,8)-5.5)*5)*sin(2*PI*659.25*t)+"
        "gt(mod(t\\,8)\\,6.0)*lt(mod(t\\,8)\\,6.6)*exp(-(mod(t\\,8)-6.0)*5)*sin(2*PI*587.33*t)+"
        "gt(mod(t\\,8)\\,6.5)*lt(mod(t\\,8)\\,7.1)*exp(-(mod(t\\,8)-6.5)*5)*sin(2*PI*587.33*t)+"
        "gt(mod(t\\,8)\\,7.0)*lt(mod(t\\,8)\\,8.0)*exp(-(mod(t\\,8)-7.0)*3)*sin(2*PI*523.25*t)"
        "):s=44100:d=19.0,aecho=0.8:0.7:90:0.3", "bed", None),
    "crash": ("@mix", 0, 1.2, [
        ("oga/100-cc0-sfx/unz/glass_05.ogg", 0.0, 1.0, 0, "", False),
        ("oga/100-cc0-sfx/unz/dishes_01.ogg", 0.0, 0.8, 120, "volume=0.8", False),
    ], "shot", ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx")),
    # Magic & silly
    "toot": ("oga/synthetic-farts/unz/whoopee_2.wav", 0.0, 1.4, "", "shot", ("Synthetic farts", "PFNienow (OpenGameArt)", BY3, OGA + "synthetic-farts")),
    "slide_whistle": ("oga/slide-whistle-down/79671__joedeshon__slide-whistle-down-01.wav", 0.0, 1.2, "", "shot", ("Slide whistle down", "joedeshon (OpenGameArt)", BY3, OGA + "slide-whistle-down")),
    # Delicate ascending fairy harp/celesta glissando.
    "fairy": ("@synth", 0, 2.2, "aevalsrc=0.25*("
        "gt(t\\,0.00)*exp(-t*3.2)*sin(2*PI*1046.5*t)+"
        "gt(t\\,0.10)*exp(-(t-0.10)*3.2)*sin(2*PI*1174.7*t)+"
        "gt(t\\,0.20)*exp(-(t-0.20)*3.2)*sin(2*PI*1318.5*t)+"
        "gt(t\\,0.30)*exp(-(t-0.30)*3.2)*sin(2*PI*1568.0*t)+"
        "gt(t\\,0.40)*exp(-(t-0.40)*3.0)*sin(2*PI*1760.0*t)+"
        "gt(t\\,0.50)*exp(-(t-0.50)*2.8)*sin(2*PI*2093.0*t)+"
        "gt(t\\,0.62)*exp(-(t-0.62)*2.4)*sin(2*PI*2637.0*t)"
        "):s=44100:d=2.2,aecho=0.8:0.8:70:0.4", "shot", None),
    "cauldron": ("@mix", 0, 16.0, [
        ("oga/bubble-sound-effects/bubbles-loop1-amp.wav", 0.0, 20.0, 0, "lowpass=f=1800", True),
    ], "bed", ("Bubble sound effects", "OpenGameArt contributor", C0, OGA + "bubble-sound-effects")),
    "heartbeat": ("@mix", 0, 16.0, [
        ("oga/heartbeat-sounds/heartbeat_slow_0.wav", 0.0, 20.0, 0, "", True),
    ], "bed", ("Heartbeat sounds", "estevinho (OpenGameArt)", C0, OGA + "heartbeat-sounds")),
    "clown_horn": ("@mix", 0, 1.3, [
        ("oga/bicycle-horn/bicycle-horn-1.wav", 0.0, 0.65, 0, "", False),
        ("oga/bicycle-horn/bicycle-horn-1.wav", 0.0, 0.65, 440, "asetrate=44100*1.08,aresample=44100", False),
    ], "shot", ("Bicycle horn", "OpenGameArt contributor", C0, OGA + "bicycle-horn")),
})

BY25 = "CC BY 2.5"
YSL = "Yellowstone Sound Library (NPS, Wikimedia Commons)"
# 2026-11-23 additions: 100 new sounds across all 8 categories (241 cues total).
SOUNDS.update({
    # Wild animals (14)
    "rhino": ("commons/Rhinoceros sound effect.wav", 39.5, 3.2, "", "shot", ("Rhinoceros sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Rhinoceros_sound_effect.wav")),
    "polar_bear": ("commons/Polar bear sound effect.wav", 35.0, 3.2, "", "shot", ("Polar bear sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Polar_bear_sound_effect.wav")),
    "walrus": ("commons/Walrus sound effect.wav", 94.5, 3.2, "", "shot", ("Walrus sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Walrus_sound_effect.wav")),
    "moose": ("commons/Moose sound effect.wav", 8.5, 3.2, "", "shot", ("Moose sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Moose_sound_effect.wav")),
    "bison": ("commons/Buffalo and bison sound effect.wav", 10.5, 3.2, "", "shot", ("Buffalo and bison sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Buffalo_and_bison_sound_effect.wav")),
    "orca": ("commons/Killer whale.ogg", 0.5, 3.4, "", "shot", ("Killer whale", "Wikimedia Commons contributor", PD, WM + "Killer_whale.ogg")),
    "otter": ("commons/Rosa (sea otter).ogg", 250.5, 2.8, "", "shot", ("Rosa (sea otter)", "Wikimedia Commons contributor", BY4, WM + "Rosa_(sea_otter).ogg")),
    "raccoon": ("@mix", 0, 2.1, [
        ("commons/Baby Raccoon Chatter 1.flac", 0.0, 1.0, 0, "", False),
        ("commons/Baby Raccoon Chatter 1.flac", 0.0, 1.0, 1050, "asetrate=44100*1.04,aresample=44100", False),
    ], "shot", ("Baby Raccoon Chatter 1", "Wikimedia Commons contributor", BY3, WM + "Baby_Raccoon_Chatter_1.flac")),
    "cheetah": ("commons/Acoustic-Structure-and-Contextual-Use-of-Calls-by-Captive-Male-and-Female-Cheetahs-(Acinonyx-pone.0158546.s001.oga", 21.0, 3.0, "", "shot", ("Cheetah calls (PLOS ONE)", "Smirnova et al. (Wikimedia Commons)", BY4, WM + "Acoustic-Structure-and-Contextual-Use-of-Calls-by-Captive-Male-and-Female-Cheetahs-(Acinonyx-pone.0158546.s001.oga")),
    "gibbon": ("commons/Hylobates syndactylus calling 3588.ogg", 0.5, 3.2, "", "shot", ("Hylobates syndactylus calling", "Wikimedia Commons contributor", PD, WM + "Hylobates_syndactylus_calling_3588.ogg")),
    "kookaburra": ("commons/Dacelo novaeguineae ANWC X00516.opus", 87.5, 3.2, "", "shot", ("Dacelo novaeguineae (ANWC X00516)", "Australian National Wildlife Collection (Wikimedia Commons)", BY3, WM + "Dacelo_novaeguineae_ANWC_X00516.opus")),
    "loon": ("commons/Yellowstone sound library - Common Loon - 001.mp3", 79.5, 3.4, "", "shot", ("Common Loon", YSL, PD, WM + "Yellowstone_sound_library_-_Common_Loon_-_001.mp3")),
    "crane": ("commons/Yellowstone sound library - Sandhill Crane - 001.mp3", 9.5, 3.0, "", "shot", ("Sandhill Crane", YSL, PD, WM + "Yellowstone_sound_library_-_Sandhill_Crane_-_001.mp3")),
    "toucan": ("commons/Toco Toucan call (Ramphastos toco).ogg", 7.0, 3.0, "", "shot", ("Toco Toucan call", "Wikimedia Commons contributor", BY4, WM + "Toco_Toucan_call_(Ramphastos_toco).ogg")),

    # Farm friends (10)
    "swan": ("commons/Black Swan call (Cygnus atratus).ogg", 3.5, 3.0, "", "shot", ("Black Swan call", "Wikimedia Commons contributor", BY4, WM + "Black_Swan_call_(Cygnus_atratus).ogg")),
    "quail": ("commons/Bobwhite.ogg", 3.5, 3.0, "", "shot", ("Bobwhite quail", "Wikimedia Commons contributor", PD, WM + "Bobwhite.ogg")),
    "canary": ("commons/Long-range-Order-in-Canary-Song-pcbi.1003052.s001.oga", 73.5, 3.0, "", "shot", ("Canary song (PLOS Comput Biol)", "Markowitz et al. (Wikimedia Commons)", BY25, WM + "Long-range-Order-in-Canary-Song-pcbi.1003052.s001.oga")),
    "cowbell": ("commons/Cowbell.ogg", 4.0, 2.8, "", "shot", ("Cowbell", "Wikimedia Commons contributor", PD, WM + "Cowbell.ogg")),
    "barn_door": ("oga/door-open-door-close-set/unz/qubodup-DoorSet/flac/qubodup-DoorOpen01.flac", 0.0, 1.8, "asetrate=44100*0.82,aresample=44100", "shot", ("Door open, door close set", "qubodup (OpenGameArt)", C0, OGA + "door-open-door-close-set")),
    "wood_chop": ("@mix", 0, 2.2, [
        ("oga/100-cc0-metal-and-wood-sfx/unz/wood_hit_01.ogg", 0.0, 0.7, 0, "", False),
        ("oga/100-cc0-metal-and-wood-sfx/unz/wood_hit_02.ogg", 0.0, 0.7, 680, "", False),
        ("oga/100-cc0-metal-and-wood-sfx/unz/wood_hit_03.ogg", 0.0, 0.7, 1360, "", False),
    ], "shot", ("100 CC0 metal & wood SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-metal-and-wood-sfx")),
    "beehive": ("@mix", 0, 18.0, [
        ("commons/Bombus buzz.ogg", 0.0, 22.0, 0, "volume=0.75", True),
        ("commons/Bombus buzz.ogg", 1.5, 22.0, 0, "asetrate=44100*1.12,aresample=44100,volume=0.55", True),
    ], "bed", ("Bombus buzz", "Mysid (Wikimedia Commons)", PD, WM + "Bombus_buzz.ogg")),
    "bull": ("commons/Sound Ideas, COW - SINGLE MOO, ANIMAL 02.wav", 0.0, 3.2, "asetrate=44100*0.8,aresample=44100", "shot", ("Cow single moo", "Wikimedia Commons contributor", PD, WM + "Sound_Ideas,_COW_-_SINGLE_MOO,_ANIMAL_02.wav")),
    "dinner_bell": ("@mix", 0, 2.2, [
        ("oga/100-cc0-sfx/unz/bell_01.ogg", 0.0, 0.7, 0, "", False),
        ("oga/100-cc0-sfx/unz/bell_02.ogg", 0.0, 0.7, 360, "", False),
        ("oga/100-cc0-sfx/unz/bell_01.ogg", 0.0, 0.7, 720, "", False),
        ("oga/100-cc0-sfx/unz/bell_03.ogg", 0.0, 1.0, 1080, "", False),
    ], "shot", ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx")),
    "anvil": ("commons/WWS Blacksmith8217sanvil.ogg", 18.0, 3.0, "", "shot", ("Blacksmith's anvil", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_Blacksmith8217sanvil.ogg")),

    # Little critters (10)
    "rattlesnake": ("commons/Rattlesnake.ogg", 0.0, 2.8, "", "shot", ("Rattlesnake", "Wikimedia Commons contributor", PD, WM + "Rattlesnake.ogg")),
    "gecko": ("commons/Mating call of a male Tokay gecko (Gekko gecko).ogg", 6.5, 3.0, "", "shot", ("Tokay gecko call", "Wikimedia Commons contributor", PD, WM + "Mating_call_of_a_male_Tokay_gecko_(Gekko_gecko).ogg")),
    "hedgehog": ("commons/Їжак білочеревий, звуки їжаченят 3-4 тижні.ogg", 0.0, 2.8, "", "shot", ("Hedgehog sounds", "Wikimedia Commons contributor", BY4, WM + "Їжак_білочеревий,_звуки_їжаченят_3-4_тижні.ogg")),
    "magpie": ("commons/Yellowstone sound library - Pica hudsonia - 001.mp3", 8.5, 2.8, "", "shot", ("Black-billed Magpie", YSL, PD, WM + "Yellowstone_sound_library_-_Pica_hudsonia_-_001.mp3")),
    "bluebird": ("commons/Yellowstone sound library - Mountain Bluebird - 001.mp3", 8.0, 2.8, "", "shot", ("Mountain Bluebird", YSL, PD, WM + "Yellowstone_sound_library_-_Mountain_Bluebird_-_001.mp3")),
    "blackbird": ("commons/Yellowstone sound library - Red-Winged Blackbird - 001.mp3", 5.0, 2.8, "", "shot", ("Red-Winged Blackbird", YSL, PD, WM + "Yellowstone_sound_library_-_Red-Winged_Blackbird_-_001.mp3")),
    "grouse": ("commons/Yellowstone sound library - Ruffed Grouse - 001.mp3", 8.0, 3.0, "", "shot", ("Ruffed Grouse", YSL, PD, WM + "Yellowstone_sound_library_-_Ruffed_Grouse_-_001.mp3")),
    "grasshopper": ("commons/Grasshoppers.ogg", 3.5, 2.8, "", "shot", ("Grasshoppers", "Wikimedia Commons contributor", PD, WM + "Grasshoppers.ogg")),
    "crab": ("commons/Clicking (Gravity Sound).wav", 0.0, 2.0, "", "shot", ("Clicking", "Gravity Sound (Wikimedia Commons)", BY4, WM + "Clicking_(Gravity_Sound).wav")),
    "bug": ("@mix", 0, 1.8, [
        ("oga/80-cc0-creture-sfx-2/unz/bug_05.ogg", 0.0, 0.9, 0, "", False),
        ("oga/80-cc0-creture-sfx-2/unz/bug_07.ogg", 0.0, 0.9, 650, "", False),
    ], "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),

    # Weather & nature (10)
    "waterfall": ("@mix", 0, 18.0, [
        ("commons/Cascade de Syratu.ogg", 0.5, 22.0, 0, "", True),
    ], "bed", ("Cascade de Syratu", "Wikimedia Commons contributor", BY4, WM + "Cascade_de_Syratu.ogg")),
    "geyser": ("commons/Yellowstone sound library - Big Anemone Geyser - 001.mp3", 0.0, 3.4, "", "shot", ("Big Anemone Geyser", YSL, PD, WM + "Yellowstone_sound_library_-_Big_Anemone_Geyser_-_001.mp3")),
    "volcano": ("@mix", 0, 3.6, [
        ("commons/Yellowstone sound library - Artist Paint Pots - 001.mp3", 11.5, 3.6, 0, "volume=0.8", False),
        ("oga/100-cc0-sfx/unz/explosion.ogg", 0.0, 2.5, 100, "lowpass=f=350,volume=0.85", False),
    ], "shot", [
        ("Artist Paint Pots", YSL, PD, WM + "Yellowstone_sound_library_-_Artist_Paint_Pots_-_001.mp3"),
        ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx"),
    ]),
    "ice_crack": ("commons/Bones breaking wood fire ice crackling.ogg", 24.0, 2.8, "", "shot", ("Ice crackling", "Wikimedia Commons contributor", PD, WM + "Bones_breaking_wood_fire_ice_crackling.ogg")),
    "leaves": ("commons/Rustling leaves (Gravity Sound).wav", 14.5, 2.8, "", "shot", ("Rustling leaves", "Gravity Sound (Wikimedia Commons)", BY4, WM + "Rustling_leaves_(Gravity_Sound).wav")),
    "mud": ("@mix", 0, 1.8, [
        ("oga/8-wet-squish-slurp-impacts/unz/impsplat/impactsplat01.mp3.flac", 0.0, 0.7, 0, "", False),
        ("oga/8-wet-squish-slurp-impacts/unz/impsplat/impactsplat03.mp3.flac", 0.0, 0.7, 520, "", False),
        ("oga/8-wet-squish-slurp-impacts/unz/impsplat/impactsplat05.mp3.flac", 0.0, 0.7, 1040, "", False),
    ], "shot", ("8 wet squish, slurp impacts", "OpenGameArt contributor", C0, OGA + "8-wet-squish-slurp-impacts")),
    "earthquake": ("oga/earthquake-and-open-sesame/shake.flac", 0.0, 3.8, "lowpass=f=450", "shot", ("Earthquake and Open Sesame", "OpenGameArt contributor", C0, OGA + "earthquake-and-open-sesame")),
    "tornado": ("oga/strong-wind-blowing/strong wind blowing_0.mp3", 13.5, 3.8, "bandpass=f=420:w=600", "shot", ("Strong wind blowing", "Power_SFML (OpenGameArt)", BY4, OGA + "strong-wind-blowing")),
    "avalanche": ("@mix", 0, 3.6, [
        ("oga/100-cc0-sfx/unz/explosion.ogg", 0.0, 2.4, 0, "lowpass=f=500,volume=0.8", False),
        ("oga/earthquake-and-open-sesame/shake.flac", 0.5, 3.4, 200, "volume=0.85", False),
    ], "shot", [
        ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx"),
        ("Earthquake and Open Sesame", "OpenGameArt contributor", C0, OGA + "earthquake-and-open-sesame"),
    ]),
    "rain_roof": ("@mix", 0, 20.0, [
        ("oga/amb-rain-loop-1/amb_rain_loop_1.wav", 4.0, 24.0, 0, "lowpass=f=1100,highpass=f=120,volume=0.9", True),
        ("oga/dripping-water/Dripping Water.wav", 0.0, 24.0, 0, "volume=0.35", True),
    ], "bed", [
        ("Ambient rain loop", "Kresiek The Furry (OpenGameArt)", C0, OGA + "amb-rain-loop-1"),
        ("Dripping water", "WolfTech (OpenGameArt)", BY3, OGA + "dripping-water"),
    ]),

    # Places (10 ambient beds)
    "harbor": ("commons/Boat by a wharf 1.ogg", 1.0, 22.0, "", "bed", ("Boat by a wharf", "Wikimedia Commons contributor", PD, WM + "Boat_by_a_wharf_1.ogg")),
    "market": ("@mix", 0, 20.0, [
        ("oga/crowd-shoutingspeaking-ambience/crowd_shouting_0.ogg", 0.5, 24.0, 0, "", True),
    ], "bed", ("Crowd shouting / speaking ambience", "OpenGameArt contributor", C0, OGA + "crowd-shoutingspeaking-ambience")),
    "kitchen": ("@mix", 0, 20.0, [
        ("oga/kitchen-ambience-sfx/water_boiling_in_pot.wav", 2.0, 24.0, 0, "volume=0.7", True),
        ("oga/kitchen-ambience-sfx/fast_chops_on_cutting_board.wav", 0.5, 24.0, 1200, "volume=0.45", True),
        ("oga/kitchen-ambience-sfx/cookware_clatter.wav", 2.0, 24.0, 3500, "volume=0.4", True),
    ], "bed", ("Kitchen ambience SFX", "MedicineStorm (OpenGameArt)", BY4, OGA + "kitchen-ambience-sfx")),
    "stadium": ("oga/free-crowd-cheering-sounds/unz/Gregor Quendel - Free Crowd Cheering Sounds - MP3/Gregor Quendel - Crowd Cheering Sounds - 09 - Ambience and cheering.mp3", 1.0, 20.0, "", "bed", ("Free crowd cheering sounds", "Gregor Quendel (OpenGameArt)", BY4, OGA + "free-crowd-cheering-sounds")),
    "desert": ("oga/strong-wind-blowing/strong wind blowing_0.mp3", 5.0, 20.0, "highpass=f=220,lowpass=f=1800", "bed", ("Strong wind blowing", "Power_SFML (OpenGameArt)", BY4, OGA + "strong-wind-blowing")),
    "arctic": ("@synth", 0, 20.0, "anoisesrc=color=pink:r=44100:d=20:a=0.5,bandpass=f=900:w=700,volume='0.45+0.35*sin(2*PI*0.17*t)+0.2*sin(2*PI*0.43*t)':eval=frame", "bed", None),
    "swamp": ("@mix", 0, 20.0, [
        ("commons/Grasshoppers.ogg", 0.0, 24.0, 0, "volume=0.55", True),
        ("oga/bubble-sound-effects/bubbles-loop1-amp.wav", 0.0, 24.0, 0, "lowpass=f=1200,volume=0.5", True),
        ("commons/27alligator2bellow.ogg", 12.5, 3.0, 7000, "lowpass=f=700,volume=0.35", False),
    ], "bed", [
        ("Grasshoppers", "Wikimedia Commons contributor", PD, WM + "Grasshoppers.ogg"),
        ("Bubble sound effects", "OpenGameArt contributor", C0, OGA + "bubble-sound-effects"),
        ("Alligator bellow", "Wikimedia Commons contributor", PD, WM + "27alligator2bellow.ogg"),
    ]),
    "pirate_ship": ("@mix", 0, 20.0, [
        ("commons/Boat by a wharf 1.ogg", 0.5, 24.0, 0, "volume=0.8", True),
        ("oga/creaky-door-hinge-spooky/creaky_door_hinge.wav", 0.0, 4.0, 3500, "asetrate=44100*0.75,aresample=44100,volume=0.35", False),
        ("oga/creaky-door-hinge-spooky/creaky_door_hinge.wav", 0.5, 3.5, 13000, "asetrate=44100*0.7,aresample=44100,volume=0.3", False),
    ], "bed", [
        ("Boat by a wharf", "Wikimedia Commons contributor", PD, WM + "Boat_by_a_wharf_1.ogg"),
        ("Creaky door hinge (spooky)", "OpenGameArt contributor", C0, OGA + "creaky-door-hinge-spooky"),
    ]),
    "haunted_house": ("@mix", 0, 20.0, [
        ("oga/loopable-dungeon-ambience/dungeon_ambient_1_0.ogg", 0.0, 24.0, 0, "volume=0.7", True),
        ("oga/creaky-door-hinge-spooky/creaky_door_hinge.wav", 0.0, 3.8, 5000, "volume=0.3", False),
        ("oga/ghost-breath/ghostbreath.flac", 0.0, 3.0, 12500, "volume=0.35", False),
    ], "bed", [
        ("Loopable dungeon ambience", "OpenGameArt contributor", C0, OGA + "loopable-dungeon-ambience"),
        ("Ghost breath", "Pixel Processor (OpenGameArt)", C0, OGA + "ghost-breath"),
    ]),
    "spaceship_bridge": ("@mix", 0, 18.0, [
        ("oga/50-cc0-sci-fi-sfx/unz/loop_ambient_01.ogg", 0.0, 22.0, 0, "volume=0.8", True),
        ("oga/50-cc0-sci-fi-sfx/unz/terminal_01.ogg", 0.0, 1.5, 3000, "volume=0.45", False),
        ("oga/50-cc0-sci-fi-sfx/unz/terminal_03.ogg", 0.0, 1.5, 11000, "volume=0.4", False),
    ], "bed", ("50 CC0 sci-fi SFX", "rubberduck (OpenGameArt)", C0, OGA + "50-cc0-sci-fi-sfx")),

    # Things that go & machines (14)
    "trolley": ("commons/WWS 102Ntrambackofthecar.ogg", 52.0, 3.4, "", "shot", ("102N tram", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_102Ntrambackofthecar.ogg")),
    "steam_whistle": ("oga/steam-whistle/steam_whistle.wav", 0.0, 2.4, "", "shot", ("Steam whistle", "OpenGameArt contributor", C0, OGA + "steam-whistle")),
    "race_car": ("oga/car-acceleration/car acceleration.wav", 0.0, 3.2, "", "shot", ("Car acceleration", "OpenGameArt contributor", C0, OGA + "car-acceleration")),
    "engine_start": ("oga/car-engine-start-01/generic_car_startengine.wav", 0.0, 2.8, "", "shot", ("Car engine start", "OpenGameArt contributor", C0, OGA + "car-engine-start-01")),
    "hammer": ("@mix", 0, 2.0, [
        ("oga/100-cc0-metal-and-wood-sfx/unz/hammer_01.ogg", 0.0, 0.6, 0, "", False),
        ("oga/100-cc0-metal-and-wood-sfx/unz/hammer_02.ogg", 0.0, 0.6, 520, "", False),
        ("oga/100-cc0-metal-and-wood-sfx/unz/hammer_03.ogg", 0.0, 0.6, 1040, "", False),
    ], "shot", ("100 CC0 metal & wood SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-metal-and-wood-sfx")),
    "saw": ("commons/WWS Hacksaw.ogg", 33.0, 3.0, "", "shot", ("Hacksaw", WWS + " / Technical Museum of Slovenia", BY4, WM + "WWS_Hacksaw.ogg")),
    "camera": ("oga/camera/photo.ogg", 0.0, 0.9, "", "shot", ("Camera", "OpenGameArt contributor", C0, OGA + "camera")),
    "typewriter": ("commons/406243 stubb typewriter-ding-near-mono.wav", 0.0, 1.1, "", "shot", ("Typewriter ding (freesound 406243)", "stubb (via Wikimedia Commons)", C0, WM + "406243_stubb_typewriter-ding-near-mono.wav")),
    "cash_register": ("commons/WWS Cashregister.ogg", 4.5, 2.8, "", "shot", ("Cash register", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_Cashregister.ogg")),
    "elevator": ("oga/elevator-ding/elevatording_0.ogg", 0.0, 0.9, "", "shot", ("Elevator ding", "OpenGameArt contributor", C0, OGA + "elevator-ding")),
    "alarm_clock": ("commons/WWS Alarmclockringing.ogg", 1.5, 2.8, "", "shot", ("Alarm clock ringing", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_Alarmclockringing.ogg")),
    "grandfather_clock": ("commons/415061 gsb1039 clock-chime-tubebells-handbells-vibes.wav", 12.0, 3.5, "", "shot", ("Clock chime (freesound 415061)", "gsb1039 (via Wikimedia Commons)", C0, WM + "415061_gsb1039_clock-chime-tubebells-handbells-vibes.wav")),
    "church_bell": ("commons/WWS Bellfoundry8211firsttrialofthebell.ogg", 1.5, 3.4, "", "shot", ("Bell foundry, first trial of the bell", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_Bellfoundry8211firsttrialofthebell.ogg")),
    "iron_gate": ("oga/iron-door/iron_door_0.ogg", 0.0, 2.4, "", "shot", ("Iron door", "OpenGameArt contributor", C0, OGA + "iron-door")),

    # Around the house, people & instruments (17)
    "keys": ("@mix", 0, 1.6, [
        ("oga/100-cc0-metal-and-wood-sfx/unz/keys_01.ogg", 0.0, 0.8, 0, "", False),
        ("oga/100-cc0-metal-and-wood-sfx/unz/keys_03.ogg", 0.0, 0.8, 550, "", False),
    ], "shot", ("100 CC0 metal & wood SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-metal-and-wood-sfx")),
    "lock": ("oga/100-cc0-metal-and-wood-sfx/unz/lock_open_01.ogg", 0.0, 0.9, "", "shot", ("100 CC0 metal & wood SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-metal-and-wood-sfx")),
    "dishes": ("@mix", 0, 1.6, [
        ("oga/100-cc0-sfx/unz/dishes_01.ogg", 0.0, 0.8, 0, "", False),
        ("oga/100-cc0-sfx/unz/dishes_02.ogg", 0.0, 0.8, 450, "", False),
    ], "shot", ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx")),
    "microwave": ("@mix", 0, 1.8, [
        ("oga/beep-sound/beep.ogg", 0.0, 0.5, 0, "", False),
        ("oga/beep-sound/beep.ogg", 0.0, 0.5, 500, "", False),
        ("oga/100-cc0-sfx/unz/microwave_door_open.ogg", 0.0, 0.7, 1050, "", False),
    ], "shot", [
        ("Beep sound", "OpenGameArt contributor", C0, OGA + "beep-sound"),
        ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx"),
    ]),
    "bottle_pop": ("oga/liquid-bottle-drink-set/unz/qubodup-bottle-and-drink-sounds/bottle-open-01.flac", 0.0, 0.8, "", "shot", ("Liquid, bottle and drink set", "qubodup (OpenGameArt)", C0, OGA + "liquid-bottle-drink-set")),
    "pour": ("commons/Boiling water being poured into a mug for tea.ogg", 2.5, 2.8, "", "shot", ("Boiling water being poured into a mug for tea", "Wikimedia Commons contributor", PD, WM + "Boiling_water_being_poured_into_a_mug_for_tea.ogg")),
    "kettle": ("commons/Electric kettle and a gastherme.ogg", 145.0, 3.0, "", "shot", ("Electric kettle", "Wikimedia Commons contributor", PD, WM + "Electric_kettle_and_a_gastherme.ogg")),
    "scissors": ("@mix", 0, 1.6, [
        ("oga/scissors/scissors_0.ogg", 0.0, 0.8, 0, "", False),
        ("oga/scissors/scissors_0.ogg", 0.0, 0.8, 550, "", False),
    ], "shot", ("Scissors", "OpenGameArt contributor", C0, OGA + "scissors")),
    "toothbrush": ("commons/Brushing teeth.ogg", 27.5, 2.8, "", "shot", ("Brushing teeth", "Wikimedia Commons contributor", PD, WM + "Brushing_teeth.ogg")),
    "cough": ("@mix", 0, 1.3, [
        ("commons/The-description-of-cough-sounds-by-healthcare-professionals-1745-9974-2-1-S1.ogg", 0.0, 0.6, 0, "", False),
        ("commons/The-description-of-cough-sounds-by-healthcare-professionals-1745-9974-2-1-S1.ogg", 0.0, 0.6, 520, "asetrate=44100*0.97,aresample=44100", False),
    ], "shot", ("Cough sound (Cough journal)", "Smith et al. (Wikimedia Commons)", BY2, WM + "The-description-of-cough-sounds-by-healthcare-professionals-1745-9974-2-1-S1.ogg")),
    "burp": ("commons/Burp.ogg", 0.0, 1.8, "", "shot", ("Burp", "Wikimedia Commons contributor", PD, WM + "Burp.ogg")),
    "sigh": ("commons/Four sighs.ogg", 0.0, 2.6, "", "shot", ("Four sighs", "Wikimedia Commons contributor", PD, WM + "Four_sighs.ogg")),
    "gasp": ("oga/ghost-breath/ghostbreath.flac", 0.0, 1.4, "asetrate=44100*1.35,aresample=44100,highpass=f=300", "shot", ("Ghost breath", "Pixel Processor (OpenGameArt)", C0, OGA + "ghost-breath")),
    "piano": ("oga/piano-hits/Piano Hits.mp3", 30.0, 2.6, "", "shot", ("Piano hits", "OpenGameArt contributor", BY3, OGA + "piano-hits")),
    "guitar": ("commons/Audio files of spanish guitar chords 05.wav", 17.5, 2.8, "", "shot", ("Spanish guitar chords", "Wikimedia Commons contributor", C0, WM + "Audio_files_of_spanish_guitar_chords_05.wav")),
    # Bright ascending wooden xylophone scale (C5-D5-E5-G5-A5-C6).
    "xylophone": ("@synth", 0, 1.8, "aevalsrc=0.3*("
        "gt(t\\,0.00)*exp(-t*10)*(sin(2*PI*523.25*t)+0.35*sin(2*PI*1569.75*t))+"
        "gt(t\\,0.16)*exp(-(t-0.16)*10)*(sin(2*PI*587.33*t)+0.35*sin(2*PI*1762.0*t))+"
        "gt(t\\,0.32)*exp(-(t-0.32)*10)*(sin(2*PI*659.25*t)+0.35*sin(2*PI*1977.8*t))+"
        "gt(t\\,0.48)*exp(-(t-0.48)*10)*(sin(2*PI*783.99*t)+0.35*sin(2*PI*2352.0*t))+"
        "gt(t\\,0.64)*exp(-(t-0.64)*10)*(sin(2*PI*880.0*t)+0.35*sin(2*PI*2640.0*t))+"
        "gt(t\\,0.80)*exp(-(t-0.80)*6)*(sin(2*PI*1046.5*t)+0.35*sin(2*PI*3139.5*t))"
        "):s=44100:d=1.8", "shot", None),
    "popcorn": ("@mix", 0, 2.4, [
        ("oga/100-cc0-sfx/unz/plop_01.ogg", 0.0, 0.3, 0, "asetrate=44100*1.7,aresample=44100", False),
        ("oga/100-cc0-sfx/unz/plop_02.ogg", 0.0, 0.3, 280, "asetrate=44100*1.5,aresample=44100", False),
        ("oga/liquid-bottle-drink-set/unz/qubodup-bottle-and-drink-sounds/bottle-open-01.flac", 0.0, 0.3, 520, "asetrate=44100*1.8,aresample=44100", False),
        ("oga/100-cc0-sfx/unz/plop_01.ogg", 0.0, 0.3, 740, "asetrate=44100*1.6,aresample=44100", False),
        ("oga/100-cc0-sfx/unz/plop_02.ogg", 0.0, 0.3, 980, "asetrate=44100*1.75,aresample=44100", False),
        ("oga/liquid-bottle-drink-set/unz/qubodup-bottle-and-drink-sounds/bottle-open-01.flac", 0.0, 0.3, 1280, "asetrate=44100*1.65,aresample=44100", False),
        ("oga/100-cc0-sfx/unz/plop_01.ogg", 0.0, 0.3, 1580, "asetrate=44100*1.8,aresample=44100", False),
        ("oga/100-cc0-sfx/unz/plop_02.ogg", 0.0, 0.3, 1900, "asetrate=44100*1.6,aresample=44100", False),
    ], "shot", [
        ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx"),
        ("Liquid, bottle and drink set", "qubodup (OpenGameArt)", C0, OGA + "liquid-bottle-drink-set"),
    ]),

    # Magic, adventure & silly (15)
    "explosion": ("oga/100-cc0-sfx/unz/explosion.ogg", 0.0, 2.4, "", "shot", ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx")),
    "arrow": ("oga/archers-shooting/Archers-shooting.flac", 0.0, 0.8, "", "shot", ("Archers shooting", "pawelpdg9 (OpenGameArt)", C0, OGA + "archers-shooting")),
    "shield": ("@mix", 0, 1.4, [
        ("oga/100-cc0-metal-and-wood-sfx/unz/metal_hit_02.ogg", 0.0, 0.8, 0, "", False),
        ("oga/100-cc0-metal-and-wood-sfx/unz/metal_hit_04.ogg", 0.0, 0.8, 320, "volume=0.8", False),
    ], "shot", ("100 CC0 metal & wood SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-metal-and-wood-sfx")),
    "portal": ("oga/50-cc0-sci-fi-sfx/unz/weird_01.ogg", 0.0, 2.2, "", "shot", ("50 CC0 sci-fi SFX", "rubberduck (OpenGameArt)", C0, OGA + "50-cc0-sci-fi-sfx")),
    "teleport": ("oga/50-cc0-sci-fi-sfx/unz/teleport_01.ogg", 0.0, 1.6, "", "shot", ("50 CC0 sci-fi SFX", "rubberduck (OpenGameArt)", C0, OGA + "50-cc0-sci-fi-sfx")),
    "victory": ("commons/Win sound effect.wav", 0.0, 1.6, "", "shot", ("Win sound effect", "Wikimedia Commons contributor", C0, WM + "Win_sound_effect.wav")),
    # Classic cartoon wah-wah-wah-waaah descending brass.
    "sad_trombone": ("@synth", 0, 2.6, "aevalsrc=0.28*("
        "between(t\\,0.0\\,0.42)*(sin(2*PI*311.13*t)+0.5*sin(4*PI*311.13*t)+0.25*sin(6*PI*311.13*t))+"
        "between(t\\,0.48\\,0.90)*(sin(2*PI*293.66*t)+0.5*sin(4*PI*293.66*t)+0.25*sin(6*PI*293.66*t))+"
        "between(t\\,0.96\\,1.38)*(sin(2*PI*277.18*t)+0.5*sin(4*PI*277.18*t)+0.25*sin(6*PI*277.18*t))+"
        "between(t\\,1.44\\,2.45)*exp(-(t-1.44)*0.8)*(sin(2*PI*(261.63-14*(t-1.44)+5*sin(2*PI*6*t))*t)+0.5*sin(4*PI*(261.63-14*(t-1.44))*t))"
        "):s=44100:d=2.6,lowpass=f=1800", "shot", None),
    "spring": ("oga/100-cc0-metal-and-wood-sfx/unz/metal_spring_01.ogg", 0.0, 1.4, "", "shot", ("100 CC0 metal & wood SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-metal-and-wood-sfx")),
    "squish": ("@mix", 0, 1.5, [
        ("oga/80-cc0-creture-sfx-2/unz/slime_01.ogg", 0.0, 0.8, 0, "", False),
        ("oga/80-cc0-creture-sfx-2/unz/slime_03.ogg", 0.0, 0.8, 480, "", False),
    ], "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),
    "evil_laugh": ("oga/evil-cackle-laugh-1/evil_cackle_laugh_1.ogg", 0.0, 2.8, "", "shot", ("Evil cackle laugh", "OpenGameArt contributor", C0, OGA + "evil-cackle-laugh-1")),
    "zombie": ("oga/80-cc0-creture-sfx-2/unz/monster_08.ogg", 0.0, 2.2, "", "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),
    "unicorn": ("@mix", 0, 1.8, [
        ("oga/shimmer-glitter-magic/shimmer_1.flac", 0.0, 0.7, 0, "", False),
        ("oga/shimmer-glitter-magic/shimmer_1.flac", 0.0, 0.7, 450, "asetrate=44100*1.18,aresample=44100,volume=0.8", False),
    ], "shot", ("Shimmer glitter magic", "zero23408 (OpenGameArt)", BY3, OGA + "shimmer-glitter-magic")),
    # Cheerful rubber-ducky double squeak.
    "squeaky_toy": ("@synth", 0, 1.0, "aevalsrc=0.45*("
        "exp(-pow((t-0.18)/0.07\\,2))*sin(2*PI*(1500+950*sin(2*PI*3.5*t))*t)+"
        "exp(-pow((t-0.62)/0.08\\,2))*sin(2*PI*(1650+900*sin(2*PI*3.2*(t-0.44)))*t)"
        "):s=44100:d=1.0,bandpass=f=2200:w=1800", "shot", None),
    "drumroll": ("@mix", 0, 2.4, [
        ("oga/an-interesting-snare-drum-sound/best_snare_0.wav", 0.0, 0.25, i * 110, f"volume={0.45 + 0.03 * i:.2f}", False)
        for i in range(18)
    ], "shot", ("An interesting snare drum sound", "OpenGameArt contributor", C0, OGA + "an-interesting-snare-drum-sound")),
    "gong": ("oga/100-cc0-sfx/unz/gong_01.ogg", 0.0, 3.0, "", "shot", ("100 CC0 SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-sfx")),
})

# 2026-11-23 batch 2 additions: 200 new sounds across all 8 categories (441 cues total).
SOUNDS.update({
    'antelope': ('commons/Impala (Aepyceros melampus) (W1CDR0000514 BD37).ogg', 32.5, 2.8, '', 'shot', ('Impala call', 'Wikimedia Commons contributor', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Impala_(Aepyceros_melampus)_(W1CDR0000514_BD37).ogg')),
    'deer': ('commons/Mountain Reedbuck (Redunca fulvorufula) (W1CDR0001145 BD24).ogg', 3.5, 2.6, '', 'shot', ('Mountain Reedbuck', 'Wikimedia Commons contributor', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Mountain_Reedbuck_(Redunca_fulvorufula)_(W1CDR0001145_BD24).ogg')),
    'stork': ('commons/Baby Wood Storks (Mycteria americana).ogg', 10.0, 2.8, '', 'shot', ('Baby Wood Storks', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Baby_Wood_Storks_(Mycteria_americana).ogg')),
    'kingfisher': ('commons/Call of Stork-billed kingfisher (Pelargopsis capensis) 01.wav', 6.5, 2.8, '', 'shot', ('Stork-billed kingfisher call', 'Wikimedia Commons contributor', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Call_of_Stork-billed_kingfisher_(Pelargopsis_capensis)_01.wav')),
    'coot': ('commons/Yellowstone sound library - American Coots - 001.mp3', 433.0, 2.8, '', 'shot', ('American Coots', 'Yellowstone Sound Library (NPS, Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_American_Coots_-_001.mp3')),
    'baboon': ('commons/Yawn vocalisation by a Gelada.wav', 0.0, 1.1, '', 'shot', ('Gelada vocalisation', 'Wikimedia Commons contributor', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Yawn_vocalisation_by_a_Gelada.wav')),
    'panther': ('commons/Acoustic-Structure-and-Contextual-Use-of-Calls-by-Captive-Male-and-Female-Cheetahs-(Acinonyx-pone.0158546.s001.oga', 4.0, 2.6, 'asetrate=44100*0.78,aresample=44100', 'shot', ('Cheetah calls (PLOS ONE)', 'Smirnova et al. (Wikimedia Commons)', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Acoustic-Structure-and-Contextual-Use-of-Calls-by-Captive-Male-and-Female-Cheetahs-(Acinonyx-pone.0158546.s001.oga')),
    'grizzly_eat': ('commons/Polar bear sound effect.wav', 12.5, 2.8, 'asetrate=44100*0.9,aresample=44100', 'shot', ('Polar bear sound effect', 'Zagzav12 (Wikimedia Commons)', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Polar_bear_sound_effect.wav')),
    'alligator_hiss': ('commons/Alligatorhiss.ogg', 0.0, 2.4, '', 'shot', ('Alligator hiss', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Alligatorhiss.ogg')),
    'sea_lion': ('commons/Arctocephalus forsteri - sound.ogg', 5.0, 2.8, 'asetrate=44100*0.92,aresample=44100', 'shot', ('Arctocephalus forsteri sound', 'Department of Conservation (Wikimedia Commons)', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Arctocephalus_forsteri_-_sound.ogg')),
    'elephant_calf': ('commons/Elephant voice - trumpeting.ogg', 0.0, 1.5, 'asetrate=44100*1.28,aresample=44100', 'shot', ('Elephant voice, trumpeting', 'தகவலுழவன் (Wikimedia Commons)', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Elephant_voice_-_trumpeting.ogg')),
    'wolf_pack': ('@mix', 0, 3.4, [('commons/Fennec Singing.ogg', 2.5, 2.4, 0, 'asetrate=44100*0.65,aresample=44100', False), ('commons/Fennec Singing.ogg', 3.0, 2.4, 700, 'asetrate=44100*0.58,aresample=44100,volume=0.8', False)], 'shot', ('Fennec Singing', 'Eosin-Y (Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Fennec_Singing.ogg')),
    'lion_cub': ('commons/Polar bear sound effect.wav', 35.0, 2.2, 'asetrate=44100*1.45,aresample=44100', 'shot', ('Polar bear sound effect', 'Zagzav12 (Wikimedia Commons)', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Polar_bear_sound_effect.wav')),
    'bear_cub': ('commons/Polar bear sound effect.wav', 12.5, 2.2, 'asetrate=44100*1.38,aresample=44100', 'shot', ('Polar bear sound effect', 'Zagzav12 (Wikimedia Commons)', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Polar_bear_sound_effect.wav')),
    'dino_stomp': ('@mix', 0, 2.4, [('oga/mech-stomp-step-sound/stomp.flac', 0.0, 0.7, 0, 'asetrate=44100*0.55,aresample=44100', False), ('oga/mech-stomp-step-sound/stomp.flac', 0.0, 0.7, 820, 'asetrate=44100*0.52,aresample=44100', False), ('oga/mech-stomp-step-sound/stomp.flac', 0.0, 0.7, 1640, 'asetrate=44100*0.5,aresample=44100', False)], 'shot', ('Mech stomp step sound', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/mech-stomp-step-sound')),
    'whale_pod': ('commons/Killer whale.ogg', 10.0, 3.4, 'asetrate=44100*0.8,aresample=44100', 'shot', ('Killer whale', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Killer_whale.ogg')),
    'dolphin_click': ('commons/161691 felixblume dolphin-screaming-underwater-in-caribbean-sea-mexico.wav', 5.0, 2.8, '', 'shot', ('Dolphin screaming underwater, Caribbean Sea (freesound 161691)', 'Felix Blume (via Wikimedia Commons)', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:161691_felixblume_dolphin-screaming-underwater-in-caribbean-sea-mexico.wav')),
    'jungle_monkey': ('commons/Hylobates syndactylus calling 3588.ogg', 6.0, 3.0, 'asetrate=44100*0.82,aresample=44100', 'shot', ('Hylobates syndactylus calling', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Hylobates_syndactylus_calling_3588.ogg')),
    'coyote': ('commons/Fennec Singing.ogg', 6.0, 2.8, 'asetrate=44100*0.78,aresample=44100', 'shot', ('Fennec Singing', 'Eosin-Y (Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Fennec_Singing.ogg')),
    'eagle_cry': ('commons/Screaming Hawk.wav', 0.0, 2.4, 'asetrate=44100*1.12,aresample=44100', 'shot', ('Screaming Hawk', 'PsychoBird (Wikimedia Commons)', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Screaming_Hawk.wav')),
    'milking': ('commons/WWS Handmilking.ogg', 59.0, 3.0, '', 'shot', ('Hand milking', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Handmilking.ogg')),
    'barn_owl': ('commons/Cape Eagle Owl (Bubo capensis) (W1CDR0001437 BD2).ogg', 5.0, 3.0, '', 'shot', ('Cape Eagle Owl', 'Wikimedia Commons contributor', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Cape_Eagle_Owl_(Bubo_capensis)_(W1CDR0001437_BD2).ogg')),
    'farm_tractor': ('commons/WWS TractorLanzBuldogHL12driving.ogg', 10.0, 3.2, '', 'shot', ('Lanz Bulldog HL12 tractor driving', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_TractorLanzBuldogHL12driving.ogg')),
    'hay_cart': ('@mix', 0, 2.8, [('commons/Six Horses Galloping By.ogg', 2.0, 2.8, 0, 'volume=0.7', False), ('oga/creaky-door-hinge-spooky/creaky_door_hinge.wav', 0.0, 2.2, 300, 'volume=0.35', False)], 'shot', [('Six Horses Galloping By', 'Freesound Community (via Wikimedia Commons)', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Six_Horses_Galloping_By.ogg'), ('Creaky door hinge (spooky)', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/creaky-door-hinge-spooky')]),
    'horse_gallop': ('commons/Six Horses Galloping By.ogg', 5.0, 3.2, '', 'shot', ('Six Horses Galloping By', 'Freesound Community (via Wikimedia Commons)', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Six_Horses_Galloping_By.ogg')),
    'sheep_flock': ('@mix', 0, 2.6, [('oga/baby-animals-sounds-pack/unz/Baa.ogg', 0.0, 1.0, 0, '', False), ('oga/baby-animals-sounds-pack/unz/Baa.ogg', 0.0, 1.0, 650, 'asetrate=44100*1.12,aresample=44100', False), ('oga/baby-animals-sounds-pack/unz/Baa.ogg', 0.0, 1.0, 1300, 'asetrate=44100*0.92,aresample=44100', False)], 'shot', ('Baby animals sounds pack', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/baby-animals-sounds-pack')),
    'pig_oink': ('@mix', 0, 1.6, [('commons/Pig grunt - Erdie.ogg', 0.0, 0.7, 0, 'asetrate=44100*1.25,aresample=44100', False), ('commons/Pig grunt - Erdie.ogg', 0.0, 0.7, 620, 'asetrate=44100*1.32,aresample=44100', False)], 'shot', ('Pig grunt', 'Erdie (Wikimedia Commons)', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Pig_grunt_-_Erdie.ogg')),
    'hen_cluck': ('commons/Chickens demanding food.ogg', 0.0, 2.8, '', 'shot', ('Chickens demanding food', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Chickens_demanding_food.ogg')),
    'duck_splash': ('commons/Ducks landing in water.ogg', 0.0, 2.8, '', 'shot', ('Ducks landing in water', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Ducks_landing_in_water.ogg')),
    'dog_pant': ('@mix', 0, 1.5, [('oga/baby-animals-sounds-pack/unz/Bark.ogg', 0.0, 0.6, 0, 'asetrate=44100*1.25,aresample=44100', False), ('oga/baby-animals-sounds-pack/unz/Bark.ogg', 0.0, 0.6, 550, 'asetrate=44100*1.3,aresample=44100', False)], 'shot', ('Baby animals sounds pack', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/baby-animals-sounds-pack')),
    'cat_purr': ('@mix', 0, 1.6, [('oga/baby-animals-sounds-pack/unz/Meow.ogg', 0.0, 0.7, 0, 'asetrate=44100*1.22,aresample=44100', False), ('oga/baby-animals-sounds-pack/unz/Meow.ogg', 0.0, 0.7, 720, 'asetrate=44100*1.28,aresample=44100', False)], 'shot', ('Baby animals sounds pack', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/baby-animals-sounds-pack')),
    'goat_kid': ('@mix', 0, 1.5, [('oga/baby-animals-sounds-pack/unz/Bleat.ogg', 0.0, 0.7, 0, 'asetrate=44100*1.2,aresample=44100', False), ('oga/baby-animals-sounds-pack/unz/Bleat.ogg', 0.0, 0.7, 650, 'asetrate=44100*1.25,aresample=44100', False)], 'shot', ('Baby animals sounds pack', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/baby-animals-sounds-pack')),
    'donkey_hooves': ('oga/donkey-bray/donkey_bray_-_starninjas_0.ogg', 0.0, 2.2, '', 'shot', ('Donkey bray', 'starninjas (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/donkey-bray')),
    'stable_bell': ('oga/100-cc0-sfx/unz/bell_02.ogg', 0.0, 1.5, 'asetrate=44100*0.85,aresample=44100', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'pitchfork': ('commons/WWS Shovelingcoalintheboiler.ogg', 22.0, 2.6, 'highpass=f=400', 'shot', ('Shoveling coal in the boiler', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Shovelingcoalintheboiler.ogg')),
    'robin': ('commons/Yellowstone sound library - American Robin - 001.mp3', 33.0, 2.8, '', 'shot', ('American Robin', 'Yellowstone Sound Library (NPS, Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_American_Robin_-_001.mp3')),
    'nutcracker': ('commons/Yellowstone sound library - Clark’s Nutcracker - 001.mp3', 2.5, 2.8, '', 'shot', ("Clark's Nutcracker", 'Yellowstone Sound Library (NPS, Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Clark’s_Nutcracker_-_001.mp3')),
    'killdeer': ('commons/Yellowstone sound library - Killdeer - 001.mp3', 29.0, 2.8, '', 'shot', ('Killdeer', 'Yellowstone Sound Library (NPS, Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Killdeer_-_001.mp3')),
    'bunting': ('commons/Yellowstone sound library - Lazuli Bunting - 001.mp3', 7.5, 2.8, '', 'shot', ('Lazuli Bunting', 'Yellowstone Sound Library (NPS, Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Lazuli_Bunting_-_001.mp3')),
    'warbler': ('commons/Yellowstone sound library - Common Yellowthroat - 001.mp3', 15.0, 2.8, '', 'shot', ('Common Yellowthroat', 'Yellowstone Sound Library (NPS, Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Common_Yellowthroat_-_001.mp3')),
    'palm_squirrel': ('commons/Jungle palm squirrel1.oga', 0.0, 2.6, '', 'shot', ('Jungle palm squirrel', 'Wikimedia Commons contributor', 'CC BY 2.5', 'https://commons.wikimedia.org/wiki/File:Jungle_palm_squirrel1.oga')),
    'frog_chorus': ('commons/Night Chorus of Frogs and Toads in Niger Delta.ogg', 2.0, 18.0, '', 'bed', ('Night Chorus of Frogs and Toads', 'Wikimedia Commons contributor', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Night_Chorus_of_Frogs_and_Toads_in_Niger_Delta.ogg')),
    'beetle_bite': ('@mix', 0, 1.2, [('oga/rpg-sound-pack/unz/RPG Sound Pack/NPC/beetle/bite-small.wav', 0.0, 0.5, 0, '', False), ('oga/rpg-sound-pack/unz/RPG Sound Pack/NPC/beetle/bite-small2.wav', 0.0, 0.5, 420, '', False)], 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'cricket_chirp': ('@synth', 0, 1.4, 'aevalsrc=0.35*(exp(-pow((t-0.15)/0.04\\,2))+exp(-pow((t-0.30)/0.04\\,2))+exp(-pow((t-0.45)/0.04\\,2))+exp(-pow((t-0.85)/0.04\\,2))+exp(-pow((t-1.00)/0.04\\,2)))*sin(2*PI*4200*t)*(0.5+0.5*sin(2*PI*45*t)):s=44100:d=1.4', 'shot', None),
    'mosquito': ('commons/Bombus buzz.ogg', 1.0, 2.2, 'asetrate=44100*1.85,aresample=44100,highpass=f=600', 'shot', ('Bombus buzz', 'Mysid (Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Bombus_buzz.ogg')),
    'wasp': ('commons/Bombus buzz.ogg', 2.0, 2.2, 'asetrate=44100*0.82,aresample=44100', 'shot', ('Bombus buzz', 'Mysid (Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Bombus_buzz.ogg')),
    'firefly_hum': ('oga/swishes-sound-pack/unz/swishes/swish-1.wav', 0.0, 0.8, 'asetrate=44100*1.7,aresample=44100,highpass=f=800', 'shot', ('Swishes sound pack', 'qubodup (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/swishes-sound-pack')),
    'hamster': ('commons/Guinea Pig Feeding Wheek.ogg', 0.0, 1.8, 'asetrate=44100*1.3,aresample=44100', 'shot', ('Guinea Pig Feeding Wheek', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Guinea_Pig_Feeding_Wheek.ogg')),
    'gerbil': ('@mix', 0, 1.2, [('oga/cute-cartoon-jump-sound-effect/qubodup-cfork-ccby3-jump.flac', 0.0, 0.5, 0, 'asetrate=44100*1.2,aresample=44100', False), ('oga/cute-cartoon-jump-sound-effect/qubodup-cfork-ccby3-jump.flac', 0.0, 0.5, 520, 'asetrate=44100*1.28,aresample=44100', False)], 'shot', ('Cute cartoon jump sound effect', 'looneybits (OpenGameArt)', 'CC BY 3.0', 'https://opengameart.org/content/cute-cartoon-jump-sound-effect')),
    'spider_crawl': ('oga/80-cc0-creture-sfx-2/unz/bug_09.ogg', 0.0, 1.2, '', 'shot', ('80 CC0 creature SFX #2', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-creture-sfx-2')),
    'snail_slime': ('oga/80-cc0-creture-sfx-2/unz/slime_05.ogg', 0.0, 1.2, 'lowpass=f=1500', 'shot', ('80 CC0 creature SFX #2', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-creture-sfx-2')),
    'bat_flutter': ('@mix', 0, 1.4, [('oga/swishes-sound-pack/unz/swishes/swish-2.wav', 0.0, 0.4, 0, '', False), ('oga/swishes-sound-pack/unz/swishes/swish-3.wav', 0.0, 0.4, 240, '', False), ('oga/swishes-sound-pack/unz/swishes/swish-4.wav', 0.0, 0.4, 480, '', False), ('oga/swishes-sound-pack/unz/swishes/swish-2.wav', 0.0, 0.4, 720, '', False)], 'shot', ('Swishes sound pack', 'qubodup (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/swishes-sound-pack')),
    'owl_wings': ('commons/Bombus buzz.ogg', 0.5, 1.8, 'asetrate=44100*0.95,aresample=44100,lowpass=f=900', 'shot', ('Bombus buzz', 'Mysid (Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Bombus_buzz.ogg')),
    'pigeon_wings': ('oga/park-ambiences/park_ambience_birds.wav', 2.0, 3.0, '', 'shot', ('Park ambiences', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/park-ambiences')),
    'sparrow_flock': ('oga/bird-chirping-sounds/birdchirping071414.wav', 0.5, 2.2, 'asetrate=44100*1.18,aresample=44100', 'shot', ('Bird chirping sounds', 'syncopika (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/bird-chirping-sounds')),
    'surf_crash': ('commons/Oceanwavescrushing.ogg', 87.0, 3.6, '', 'shot', ('Ocean waves crushing', 'Wikimedia Commons contributor', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Oceanwavescrushing.ogg')),
    'lightning_bolt': ('commons/Nosferatu thunderclap - Richard Humphries.wav', 0.5, 2.4, 'highpass=f=200', 'shot', ('Nosferatu thunderclap', 'Richard Humphries', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Nosferatu_thunderclap_-_Richard_Humphries.wav')),
    'heavy_rain': ('@mix', 0, 18.0, [('oga/amb-rain-loop-1/amb_rain_loop_1.wav', 0.0, 22.0, 0, 'volume=1.0', True), ('oga/amb-rain-loop-1/amb_rain_loop_1.wav', 7.0, 22.0, 0, 'highpass=f=900,volume=0.5', True)], 'bed', ('Ambient rain loop', 'Kresiek The Furry (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/amb-rain-loop-1')),
    'drizzle': ('oga/amb-rain-loop-1/amb_rain_loop_1.wav', 3.0, 18.0, 'lowpass=f=1800,volume=0.7', 'bed', ('Ambient rain loop', 'Kresiek The Furry (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/amb-rain-loop-1')),
    'gale_wind': ('oga/strong-wind-blowing/strong wind blowing_0.mp3', 20.0, 18.0, '', 'bed', ('Strong wind blowing', 'Power_SFML (OpenGameArt)', 'CC BY 4.0', 'https://opengameart.org/content/strong-wind-blowing')),
    'blizzard': ('@mix', 0, 18.0, [('oga/strong-wind-blowing/strong wind blowing_0.mp3', 10.0, 22.0, 0, 'highpass=f=300,volume=0.8', True), ('oga/walking-on-snow-sound/unz/SnowWalk/SnowWalk.ogg', 0.0, 22.0, 0, 'lowpass=f=1600,volume=0.3', True)], 'bed', [('Strong wind blowing', 'Power_SFML (OpenGameArt)', 'CC BY 4.0', 'https://opengameart.org/content/strong-wind-blowing'), ('Walking on snow sound', 'Corerupted (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/walking-on-snow-sound')]),
    'thunder_roll': ('commons/Nosferatu thunderclap - Richard Humphries.wav', 1.8, 3.8, 'lowpass=f=320', 'shot', ('Nosferatu thunderclap', 'Richard Humphries', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Nosferatu_thunderclap_-_Richard_Humphries.wav')),
    'rain_puddle': ('oga/8-wet-squish-slurp-impacts/unz/impsplat/impactsplat02.mp3.flac', 0.0, 0.9, '', 'shot', ('8 wet squish, slurp impacts', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/8-wet-squish-slurp-impacts')),
    'wind_gust': ('oga/strong-wind-blowing/strong wind blowing_0.mp3', 1.0, 2.6, '', 'shot', ('Strong wind blowing', 'Power_SFML (OpenGameArt)', 'CC BY 4.0', 'https://opengameart.org/content/strong-wind-blowing')),
    'frost_freeze': ('oga/freeze-spell-0/freeze.wav', 0.0, 2.0, '', 'shot', ('Freeze spell', 'StarNinjas (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/freeze-spell-0')),
    'icicle_drop': ('oga/100-cc0-sfx/unz/glass_02.ogg', 0.0, 1.0, 'asetrate=44100*1.2,aresample=44100', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'rockfall': ('@mix', 0, 2.4, [('oga/80-cc0-rpg-sfx/unz/stones_01.ogg', 0.0, 1.0, 0, '', False), ('oga/80-cc0-rpg-sfx/unz/stones_02.ogg', 0.0, 1.0, 420, '', False), ('oga/80-cc0-rpg-sfx/unz/stones_03.ogg', 0.0, 1.0, 900, '', False)], 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'mudslide': ('commons/Yellowstone sound library - Artist Paint Pots - 001.mp3', 25.0, 3.0, '', 'shot', ('Artist Paint Pots', 'Yellowstone Sound Library (NPS, Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Artist_Paint_Pots_-_001.mp3')),
    'sandstorm': ('oga/strong-wind-blowing/strong wind blowing_0.mp3', 35.0, 18.0, 'bandpass=f=1200:w=1100', 'bed', ('Strong wind blowing', 'Power_SFML (OpenGameArt)', 'CC BY 4.0', 'https://opengameart.org/content/strong-wind-blowing')),
    'heatwave': ('commons/Cicadas in Greece.ogg', 5.0, 18.0, 'lowpass=f=4500', 'bed', ('Cicadas in Greece', 'Channel R (Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Cicadas_in_Greece.ogg')),
    'river_rapids': ('commons/Cascade de Syratu.ogg', 2.0, 16.0, 'highpass=f=200', 'bed', ('Cascade de Syratu', 'Wikimedia Commons contributor', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:Cascade_de_Syratu.ogg')),
    'brook_babble': ('oga/park-ambiences/park_ambience_river.wav', 1.0, 18.0, '', 'bed', ('Park ambiences', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/park-ambiences')),
    'ocean_storm': ('@mix', 0, 18.0, [('commons/Oceanwavescrushing.ogg', 10.0, 22.0, 0, 'volume=0.8', True), ('oga/strong-wind-blowing/strong wind blowing_0.mp3', 5.0, 22.0, 0, 'volume=0.5', True)], 'bed', [('Ocean waves crushing', 'Wikimedia Commons contributor', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Oceanwavescrushing.ogg'), ('Strong wind blowing', 'Power_SFML (OpenGameArt)', 'CC BY 4.0', 'https://opengameart.org/content/strong-wind-blowing')]),
    'spring_breeze': ('oga/park-ambiences/park_ambience_wind.wav', 1.0, 18.0, '', 'bed', ('Park ambiences', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/park-ambiences')),
    'crackling_frost': ('oga/walking-on-snow-sound/unz/SnowWalk/SnowWalk.ogg', 0.0, 2.8, '', 'shot', ('Walking on snow sound', 'Corerupted (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/walking-on-snow-sound')),
    'train_station': ('commons/GO Train arrives at Guildwood GO Station (Freesound).ogg', 15.0, 18.0, '', 'bed', ('GO Train arrives at Guildwood GO Station', 'Wikimedia Commons contributor', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:GO_Train_arrives_at_Guildwood_GO_Station_(Freesound).ogg')),
    'park_birds': ('oga/park-ambiences/park_ambience_birds.wav', 0.5, 18.0, '', 'bed', ('Park ambiences', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/park-ambiences')),
    'park_river': ('oga/park-ambiences/park_ambience_river.wav', 4.0, 18.0, '', 'bed', ('Park ambiences', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/park-ambiences')),
    'park_wind': ('oga/park-ambiences/park_ambience_wind.wav', 3.0, 18.0, '', 'bed', ('Park ambiences', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/park-ambiences')),
    'abandoned_house': ('oga/abandoned-building-ambience/abandonedbuildingambience2.wav', 1.0, 18.0, '', 'bed', ('Abandoned building ambience', 'OpenGameArt contributor', 'CC BY 4.0', 'https://opengameart.org/content/abandoned-building-ambience')),
    'ghost_hall': ('commons/ERH - ghostly voices (cc-by) (freesound).mp3', 10.0, 18.0, '', 'bed', ('Ghostly voices (freesound)', 'ERH (via Wikimedia Commons)', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:ERH_-_ghostly_voices_(cc-by)_(freesound).mp3')),
    'blacksmith_shop': ('commons/WWS Fireoftheforge.ogg', 0.0, 16.0, '', 'bed', ('Fire of the forge', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Fireoftheforge.ogg')),
    'boiler_room': ('oga/50-cc0-sci-fi-sfx/unz/loop_machine_01.ogg', 0.0, 16.0, 'lowpass=f=1200', 'bed', ('50 CC0 sci-fi SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/50-cc0-sci-fi-sfx')),
    'sewing_room': ('commons/WWS SewingMachine.ogg', 2.0, 16.0, '', 'bed', ('Sewing machine', 'Work With Sounds / Technical Museum of Slovenia', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_SewingMachine.ogg')),
    'busy_cafe': ('@mix', 0, 18.0, [('oga/crowd-shoutingspeaking-ambience/crowd_shouting_0.ogg', 1.0, 22.0, 0, 'lowpass=f=1500,volume=0.5', True), ('oga/kitchen-ambience-sfx/cookware_clatter.wav', 5.0, 22.0, 2000, 'volume=0.35', True)], 'bed', [('Crowd shouting / speaking ambience', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/crowd-shoutingspeaking-ambience'), ('Kitchen ambience SFX', 'MedicineStorm (OpenGameArt)', 'CC BY 4.0', 'https://opengameart.org/content/kitchen-ambience-sfx')]),
    'hospital_room': ('commons/Heart Monitor Beep--freesound.org.mp3', 2.0, 16.0, '', 'bed', ('Heart Monitor Beep', 'Wikimedia Commons contributor', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Heart_Monitor_Beep--freesound.org.mp3')),
    'deep_dungeon': ('oga/dripping-water-loop/atmosbasement.mp3_.flac', 0.0, 16.0, 'lowpass=f=900', 'bed', ('Dripping water loop', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/dripping-water-loop')),
    'enchanted_forest': ('@mix', 0, 18.0, [('oga/park-ambiences/park_ambience_birds.wav', 0.0, 22.0, 0, 'volume=0.5', True), ('oga/shimmer-glitter-magic/shimmer_1.flac', 0.0, 0.7, 3000, 'volume=0.4', False), ('oga/shimmer-glitter-magic/shimmer_1.flac', 0.0, 0.7, 11000, 'asetrate=44100*1.15,aresample=44100,volume=0.4', False)], 'bed', [('Park ambiences', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/park-ambiences'), ('Shimmer glitter magic', 'zero23408 (OpenGameArt)', 'CC BY 3.0', 'https://opengameart.org/content/shimmer-glitter-magic')]),
    'crystal_cave': ('@mix', 0, 18.0, [('oga/dripping-water/Dripping Water.wav', 0.0, 22.0, 0, 'volume=0.5', True), ('oga/shimmer-glitter-magic/shimmer_1.flac', 0.0, 0.7, 4500, 'asetrate=44100*0.85,aresample=44100,volume=0.4', False)], 'bed', [('Dripping water', 'WolfTech (OpenGameArt)', 'CC BY 3.0', 'https://opengameart.org/content/dripping-water'), ('Shimmer glitter magic', 'zero23408 (OpenGameArt)', 'CC BY 3.0', 'https://opengameart.org/content/shimmer-glitter-magic')]),
    'alien_planet': ('oga/50-cc0-sci-fi-sfx/unz/loop_ambient_weird.ogg', 0.0, 16.0, '', 'bed', ('50 CC0 sci-fi SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/50-cc0-sci-fi-sfx')),
    'fire_bell': ('commons/WWS Firedepartmentbell.ogg', 7.5, 2.8, '', 'shot', ('Fire department bell', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Firedepartmentbell.ogg')),
    'sewing_machine': ('commons/WWS SewingMachine.ogg', 50.0, 2.8, '', 'shot', ('Sewing machine', 'Work With Sounds / Technical Museum of Slovenia', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_SewingMachine.ogg')),
    'steam_iron': ('commons/WWS SteamIron.ogg', 52.0, 2.6, '', 'shot', ('Steam iron', 'Work With Sounds / Technical Museum of Slovenia', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_SteamIron.ogg')),
    'bus_horn': ('commons/WWS CityBusMANSG220horn.ogg', 20.0, 2.4, '', 'shot', ('City bus MAN SG 220 horn', 'Work With Sounds / Technical Museum of Slovenia', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_CityBusMANSG220horn.ogg')),
    'phone_keypad': ('commons/WWS AutomatictelephoneIskraEta80soundofkeypad.ogg', 4.5, 2.6, '', 'shot', ('Telephone keypad', 'Work With Sounds / Technical Museum of Slovenia', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_AutomatictelephoneIskraEta80soundofkeypad.ogg')),
    'ships_bell': ('commons/WWS ShipSodekshipsbell.ogg', 2.5, 2.6, '', 'shot', ("Ship Soldek ship's bell", 'Work With Sounds / National Maritime Museum', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_ShipSodekshipsbell.ogg')),
    'ship_telegraph': ('commons/WWS ShipSodekengineordertelegraph.ogg', 1.0, 2.6, '', 'shot', ('Ship engine order telegraph', 'Work With Sounds / National Maritime Museum', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_ShipSodekengineordertelegraph.ogg')),
    'coal_shovel': ('commons/WWS Shovelingcoalintheboiler.ogg', 22.0, 2.8, '', 'shot', ('Shoveling coal in the boiler', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Shovelingcoalintheboiler.ogg')),
    'subway': ('commons/WWS Metro.ogg', 50.5, 3.2, '', 'shot', ('Metro', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Metro.ogg')),
    'monorail': ('commons/WWS OverheadmonorailWuppertalSuspensionRailway.ogg', 16.5, 3.2, '', 'shot', ('Wuppertal Suspension Railway', 'Work With Sounds / LVR-Industriemuseum', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_OverheadmonorailWuppertalSuspensionRailway.ogg')),
    'gas_pump': ('commons/WWS Fueldispenser.ogg', 11.5, 2.8, '', 'shot', ('Fuel dispenser', 'Work With Sounds / Technical Museum of Slovenia', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Fueldispenser.ogg')),
    'sandpaper': ('commons/WWS Finishingofthejoinwithsandpaperlutherie.ogg', 4.5, 2.6, '', 'shot', ('Sandpaper lutherie', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Finishingofthejoinwithsandpaperlutherie.ogg')),
    'forge_bellows': ('commons/WWS Fireoftheforge.ogg', 2.0, 2.8, '', 'shot', ('Fire of the forge', 'Work With Sounds / Museum of Municipal Engineering', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Fireoftheforge.ogg')),
    'power_down': ('oga/machine-shutting-down/MachinePowerOff.ogg', 0.0, 2.4, '', 'shot', ('Machine shutting down', 'NegativeCharisma (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/machine-shutting-down')),
    'power_up': ('oga/63-digital-sound-effects-lasers-phasers-space-etc/unz/highUp.mp3', 0.0, 1.0, '', 'shot', ('63 digital sound effects', 'Kenney (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc')),
    'cell_ring': ('oga/modern-ringtone-chirptone/chirptone.wav', 0.0, 1.2, '', 'shot', ('Modern ringtone chirptone', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/modern-ringtone-chirptone')),
    'motor_hum': ('oga/motor-sound-effect/motor_looping_0.mp3', 0.0, 2.8, '', 'shot', ('Motor sound effect', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/motor-sound-effect')),
    'vintage_horn': ('commons/Ford Thunderbird (1955) - engine and exhaust sound (YouTube KRMCr2o90FY).opus', 5.0, 3.0, '', 'shot', ('Ford Thunderbird 1955', 'Wikimedia Commons contributor', 'CC BY 3.0', 'https://commons.wikimedia.org/wiki/File:Ford_Thunderbird_(1955)_-_engine_and_exhaust_sound_(YouTube_KRMCr2o90FY).opus')),
    'air_horn': ('commons/WWS Fireenginesiren.ogg', 2.0, 3.2, '', 'shot', ('Fire engine siren', 'Work With Sounds / Konrad Gutkowski', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:WWS_Fireenginesiren.ogg')),
    'bicycle_spokes': ('oga/bicycle-sounds/unz/bicycle_spokes-1.wav', 0.0, 2.2, '', 'shot', ('Bicycle sounds', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/bicycle-sounds')),
    'chain_rattle': ('@mix', 0, 1.8, [('oga/80-cc0-rpg-sfx/unz/chain_01.ogg', 0.0, 0.9, 0, '', False), ('oga/80-cc0-rpg-sfx/unz/chain_02.ogg', 0.0, 0.9, 650, '', False)], 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'drawbridge': ('oga/chain-winch-sounds/unz/winch - Marker #3.wav', 0.0, 2.8, '', 'shot', ('Chain winch sounds', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/chain-winch-sounds')),
    'iron_latch': ('oga/80-cc0-rpg-sfx/unz/lock_01.ogg', 0.0, 0.9, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'wood_creak': ('oga/100-cc0-metal-and-wood-sfx/unz/wood_squeak_01.ogg', 0.0, 1.2, '', 'shot', ('100 CC0 metal & wood SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-metal-and-wood-sfx')),
    'crate_smash': ('oga/100-cc0-metal-and-wood-sfx/unz/wood_slam_01.ogg', 0.0, 1.0, '', 'shot', ('100 CC0 metal & wood SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-metal-and-wood-sfx')),
    'heavy_thud': ('oga/100-cc0-sfx/unz/hit_01.ogg', 0.0, 0.9, '', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'metal_clang': ('oga/100-cc0-metal-and-wood-sfx/unz/metal_falling_01.ogg', 0.0, 1.2, '', 'shot', ('100 CC0 metal & wood SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-metal-and-wood-sfx')),
    'pulley_winch': ('oga/chain-winch-sounds/unz/winch - Marker #6.wav', 0.0, 2.4, '', 'shot', ('Chain winch sounds', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/chain-winch-sounds')),
    'factory_machine': ('oga/100-cc0-sfx/unz/machine_01.ogg', 0.0, 1.8, '', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'printing_press': ('oga/100-cc0-sfx/unz/machine_02.ogg', 0.0, 1.8, '', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'radar_beep': ('@mix', 0, 2.0, [('oga/50-cc0-sci-fi-sfx/unz/beep_01.ogg', 0.0, 0.4, 0, '', False), ('oga/50-cc0-sci-fi-sfx/unz/beep_01.ogg', 0.0, 0.4, 700, '', False), ('oga/50-cc0-sci-fi-sfx/unz/beep_01.ogg', 0.0, 0.4, 1400, '', False)], 'shot', ('50 CC0 sci-fi SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/50-cc0-sci-fi-sfx')),
    'sonar_echo': ('oga/sonar-ping/sonar_ping_0.mp3', 0.0, 2.4, 'asetrate=44100*0.82,aresample=44100', 'shot', ('Sonar ping', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/sonar-ping')),
    'launch_countdown': ('@mix', 0, 2.6, [('oga/50-cc0-sci-fi-sfx/unz/beep_02.ogg', 0.0, 0.3, 0, '', False), ('oga/50-cc0-sci-fi-sfx/unz/beep_02.ogg', 0.0, 0.3, 650, '', False), ('oga/50-cc0-sci-fi-sfx/unz/beep_02.ogg', 0.0, 0.3, 1300, '', False), ('oga/50-cc0-sci-fi-sfx/unz/beep_03.ogg', 0.0, 0.7, 1950, 'asetrate=44100*1.3,aresample=44100', False)], 'shot', ('50 CC0 sci-fi SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/50-cc0-sci-fi-sfx')),
    'jet_flyby': ('commons/428086 inspectorj airplane-boeing-flyby-right-to-left-a.wav', 8.0, 3.2, 'asetrate=44100*1.35,aresample=44100', 'shot', ('Airplane, Boeing, flyby, right to left (freesound 428086)', 'InspectorJ (via Wikimedia Commons)', 'CC BY 4.0', 'https://commons.wikimedia.org/wiki/File:428086_inspectorj_airplane-boeing-flyby-right-to-left-a.wav')),
    'helicopter_blade': ('oga/helicopter-sfx/heli_0.ogg', 0.0, 3.0, '', 'shot', ('Helicopter SFX', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/helicopter-sfx')),
    'tambourine': ('commons/Tambourine.ogg', 12.0, 2.4, '', 'shot', ('Tambourine', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Tambourine.ogg')),
    'triangle': ('commons/Triangle-ar.wav', 0.0, 2.2, '', 'shot', ('Triangle', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Triangle-ar.wav')),
    'guiro': ('commons/Guiro.ogg', 3.5, 2.4, '', 'shot', ('Guiro', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Guiro.ogg')),
    'claves': ('commons/Clave pattern.ogg', 5.0, 2.4, '', 'shot', ('Clave pattern', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Clave_pattern.ogg')),
    'agogo': ('commons/Agogo.ogg', 5.0, 2.4, '', 'shot', ('Agogo', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Agogo.ogg')),
    'maracas': ('commons/Caxixi.ogg', 6.0, 2.6, '', 'shot', ('Caxixi', 'Wikimedia Commons contributor', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Caxixi.ogg')),
    'heart_monitor': ('commons/Heart Monitor Beep--freesound.org.mp3', 20.0, 2.6, '', 'shot', ('Heart Monitor Beep', 'Wikimedia Commons contributor', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Heart_Monitor_Beep--freesound.org.mp3')),
    'air_conditioner': ('oga/general-household-sound-effects/airconditioner01.wav', 1.0, 16.0, '', 'bed', ('General household sound effects', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/general-household-sound-effects')),
    'air_fryer': ('oga/general-household-sound-effects/airfryer01.wav', 1.0, 2.8, '', 'shot', ('General household sound effects', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/general-household-sound-effects')),
    'boiling_pot': ('oga/general-household-sound-effects/boilingwater01.wav', 1.0, 16.0, '', 'bed', ('General household sound effects', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/general-household-sound-effects')),
    'cutting_board': ('oga/kitchen-ambience-sfx/fast_chops_on_cutting_board.wav', 1.5, 2.6, '', 'shot', ('Kitchen ambience SFX', 'MedicineStorm (OpenGameArt)', 'CC BY 4.0', 'https://opengameart.org/content/kitchen-ambience-sfx')),
    'cookware': ('oga/kitchen-ambience-sfx/cookware_clatter.wav', 26.0, 2.4, '', 'shot', ('Kitchen ambience SFX', 'MedicineStorm (OpenGameArt)', 'CC BY 4.0', 'https://opengameart.org/content/kitchen-ambience-sfx')),
    'door_close': ('oga/door-open-door-close-set/unz/qubodup-DoorSet/flac/qubodup-DoorClose01.flac', 0.0, 1.0, '', 'shot', ('Door open, door close set', 'qubodup (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/door-open-door-close-set')),
    'heavy_door': ('oga/4-door-closes/unz/door.1.ogg', 0.0, 1.0, '', 'shot', ('4 door closes', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/4-door-closes')),
    'bottle_clink': ('oga/rpg-sound-pack/unz/RPG Sound Pack/inventory/bottle.wav', 0.0, 0.9, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'bottle_close': ('oga/liquid-bottle-drink-set/unz/qubodup-bottle-and-drink-sounds/bottle-close-01.flac', 0.0, 0.8, '', 'shot', ('Liquid, bottle and drink set', 'qubodup (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/liquid-bottle-drink-set')),
    'cork_screw': ('oga/100-cc0-sfx/unz/glass_01.ogg', 0.0, 1.0, '', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'glass_clink': ('oga/100-cc0-sfx/unz/glass_03.ogg', 0.0, 0.9, '', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'pot_lid': ('oga/100-cc0-sfx/unz/pot_01.ogg', 0.0, 1.0, '', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'paper_rip': ('oga/100-cc0-sfx/unz/paper_01.ogg', 0.0, 0.8, '', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'book_slam': ('oga/80-cc0-rpg-sfx/unz/book_01.ogg', 0.0, 0.9, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'cloth_rustle': ('oga/rpg-sound-pack/unz/RPG Sound Pack/inventory/cloth.wav', 0.0, 0.9, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'beads_rattle': ('oga/rpg-sound-pack/unz/RPG Sound Pack/inventory/beads.wav', 0.0, 1.0, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'water_plop': ('oga/100-cc0-sfx/unz/plop_01.ogg', 0.0, 0.6, '', 'shot', ('100 CC0 SFX', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/100-cc0-sfx')),
    'bubble_pop': ('@mix', 0, 1.4, [('oga/bubble-sound-effects/bubbles-single1.wav', 0.0, 0.5, 0, '', False), ('oga/bubble-sound-effects/bubbles-single2.wav', 0.0, 0.5, 420, '', False), ('oga/bubble-sound-effects/bubbles-single3.wav', 0.0, 0.5, 840, '', False)], 'shot', ('Bubble sound effects', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/bubble-sound-effects')),
    'baby_giggle': ('oga/baby-sound-effect/Baby 01_0.ogg', 0.0, 1.6, '', 'shot', ('Baby sound effect', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/baby-sound-effect')),
    'baby_yawn': ('commons/Yawning 1.ogg', 0.4, 2.8, 'asetrate=44100*1.25,aresample=44100', 'shot', ('Yawning 1', 'ezwa (Wikimedia Commons)', 'Public domain', 'https://commons.wikimedia.org/wiki/File:Yawning_1.ogg')),
    'chuckle': ('commons/Scotcampbell - clown laugh (cc0) (freesound).mp3', 2.2, 2.0, 'asetrate=44100*0.92,aresample=44100', 'shot', ('Clown laugh (freesound)', 'scotcampbell (via Wikimedia Commons)', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Scotcampbell_-_clown_laugh_(cc0)_(freesound).mp3')),
    'silly_laugh': ('commons/Scotcampbell - clown laugh (cc0) (freesound).mp3', 1.0, 2.6, '', 'shot', ('Clown laugh (freesound)', 'scotcampbell (via Wikimedia Commons)', 'CC0 1.0', 'https://commons.wikimedia.org/wiki/File:Scotcampbell_-_clown_laugh_(cc0)_(freesound).mp3')),
    'heartbeat_fast': ('@mix', 0, 16.0, [('oga/heartbeat-sounds/heartbeat_fast_0.wav', 0.0, 20.0, 0, '', True)], 'bed', ('Heartbeat sounds', 'estevinho (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/heartbeat-sounds')),
    'snore_deep': ('oga/80-cc0-creture-sfx-2/unz/snore_02.ogg', 0.0, 2.2, '', 'shot', ('80 CC0 creature SFX #2', 'rubberduck (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-creture-sfx-2')),
    'sneeze_big': ('oga/sneeze/sneeze.ogg', 0.0, 1.4, '', 'shot', ('Sneeze', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/sneeze')),
    'apple_crunch': ('oga/7-eating-crunches/unz/crunch.4.ogg', 0.0, 0.9, '', 'shot', ('7 eating crunches', 'Tito (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/7-eating-crunches')),
    'slurp_drink': ('oga/liquid-bottle-drink-set/unz/qubodup-bottle-and-drink-sounds/swallow-01.flac', 0.0, 0.9, '', 'shot', ('Liquid, bottle and drink set', 'qubodup (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/liquid-bottle-drink-set')),
    'harp': ('@synth', 0, 2.6, 'aevalsrc=0.22*(gt(t\\,0.00)*exp(-t*2.4)*sin(2*PI*261.63*t)+gt(t\\,0.12)*exp(-(t-0.12)*2.4)*sin(2*PI*329.63*t)+gt(t\\,0.24)*exp(-(t-0.24)*2.4)*sin(2*PI*392.00*t)+gt(t\\,0.36)*exp(-(t-0.36)*2.4)*sin(2*PI*523.25*t)+gt(t\\,0.48)*exp(-(t-0.48)*2.4)*sin(2*PI*659.25*t)+gt(t\\,0.60)*exp(-(t-0.60)*2.2)*sin(2*PI*783.99*t)+gt(t\\,0.72)*exp(-(t-0.72)*1.8)*sin(2*PI*1046.5*t)):s=44100:d=2.6,aecho=0.8:0.75:110:0.4', 'shot', None),
    'fireball': ('oga/80-cc0-rpg-sfx/unz/spell_fire_01.ogg', 0.0, 1.8, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'ice_spell': ('oga/freeze-spell-0/freeze.wav', 0.0, 2.0, 'asetrate=44100*1.15,aresample=44100', 'shot', ('Freeze spell', 'StarNinjas (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/freeze-spell-0')),
    'heal_spell': ('oga/80-cc0-rpg-sfx/unz/spell_01.ogg', 0.0, 2.0, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'magic_sparkle': ('oga/rpg-sound-pack/unz/RPG Sound Pack/battle/magic1.wav', 0.0, 1.6, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'sword_draw': ('oga/rpg-sound-pack/unz/RPG Sound Pack/battle/sword-unsheathe.wav', 0.0, 1.0, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'sword_swing': ('oga/rpg-sound-pack/unz/RPG Sound Pack/battle/swing.wav', 0.0, 0.8, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'dagger_slash': ('oga/80-cc0-rpg-sfx/unz/blade_01.ogg', 0.0, 0.9, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'chainmail': ('oga/rpg-sound-pack/unz/RPG Sound Pack/inventory/chainmail1.wav', 0.0, 1.0, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'knight_armor': ('oga/rpg-sound-pack/unz/RPG Sound Pack/inventory/armor-light.wav', 0.0, 0.9, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'werewolf': ('oga/rpg-sound-pack/unz/RPG Sound Pack/NPC/misc/wolfman.wav', 0.0, 1.8, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'ogre': ('oga/rpg-sound-pack/unz/RPG Sound Pack/NPC/ogre/ogre1.wav', 0.0, 1.6, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'shadow_wraith': ('oga/rpg-sound-pack/unz/RPG Sound Pack/NPC/shade/shade1.wav', 0.0, 1.8, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'slime_bounce': ('oga/rpg-sound-pack/unz/RPG Sound Pack/NPC/slime/slime1.wav', 0.0, 1.0, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'goblin': ('oga/80-cc0-rpg-sfx/unz/creature_misc_01.ogg', 0.0, 1.4, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'troll_roar': ('oga/80-cc0-rpg-sfx/unz/creature_monster_01.ogg', 0.0, 1.8, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'giant_roar': ('oga/rpg-sound-pack/unz/RPG Sound Pack/NPC/giant/giant1.wav', 0.0, 1.8, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'gem_sparkle': ('oga/80-cc0-rpg-sfx/unz/item_gem_01.ogg', 0.0, 1.2, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'coin_clink': ('oga/80-cc0-rpg-sfx/unz/item_coins_01.ogg', 0.0, 1.0, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'arcade_coin': ('oga/50-cc0-retro-synth-sfx/unz/retro_coin_01.ogg', 0.0, 0.8, '', 'shot', ('50 CC0 retro synth SFX', 'Snabisch (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/50-cc0-retro-synth-sfx')),
    'powerup_retro': ('oga/50-cc0-retro-synth-sfx/unz/power_up_01.ogg', 0.0, 1.2, '', 'shot', ('50 CC0 retro synth SFX', 'Snabisch (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/50-cc0-retro-synth-sfx')),
    'game_over': ('oga/50-cc0-retro-synth-sfx/unz/retro_die_01.ogg', 0.0, 1.4, '', 'shot', ('50 CC0 retro synth SFX', 'Snabisch (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/50-cc0-retro-synth-sfx')),
    'pixel_boom': ('oga/50-cc0-retro-synth-sfx/unz/retro_explosion_01.ogg', 0.0, 1.2, '', 'shot', ('50 CC0 retro synth SFX', 'Snabisch (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/50-cc0-retro-synth-sfx')),
    'phaser': ('oga/63-digital-sound-effects-lasers-phasers-space-etc/unz/phaserDown1.mp3', 0.0, 1.0, '', 'shot', ('63 digital sound effects', 'Kenney (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc')),
    'space_jump': ('oga/63-digital-sound-effects-lasers-phasers-space-etc/unz/phaseJump1.mp3', 0.0, 1.0, '', 'shot', ('63 digital sound effects', 'Kenney (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc')),
    'space_alert': ('oga/63-digital-sound-effects-lasers-phasers-space-etc/unz/lowThreeTone.mp3', 0.0, 1.2, '', 'shot', ('63 digital sound effects', 'Kenney (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc')),
    'cartoon_jump': ('oga/cute-cartoon-jump-sound-effect/qubodup-cfork-ccby3-jump.flac', 0.0, 0.7, '', 'shot', ('Cute cartoon jump sound effect', 'looneybits (OpenGameArt)', 'CC BY 3.0', 'https://opengameart.org/content/cute-cartoon-jump-sound-effect')),
    'cartoon_bounce': ('oga/funny-comic-cartoon-bounce-sound/BounceYoFrankie.flac', 0.0, 0.9, '', 'shot', ('Funny comic cartoon bounce sound', 'OpenGameArt contributor', 'CC BY 3.0', 'https://opengameart.org/content/funny-comic-cartoon-bounce-sound')),
    'lasso_swish': ('@mix', 0, 1.4, [('oga/swishes-sound-pack/unz/swishes/swish-5.wav', 0.0, 0.45, 0, '', False), ('oga/swishes-sound-pack/unz/swishes/swish-6.wav', 0.0, 0.45, 380, '', False), ('oga/swishes-sound-pack/unz/swishes/swish-7.wav', 0.0, 0.45, 760, '', False)], 'shot', ('Swishes sound pack', 'qubodup (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/swishes-sound-pack')),
    'cape_swoosh': ('oga/rpg-sound-pack/unz/RPG Sound Pack/inventory/cloth-heavy.wav', 0.0, 1.0, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'whip_crack': ('oga/swishes-sound-pack/unz/swishes/swish-10.wav', 0.0, 0.7, 'asetrate=44100*1.3,aresample=44100', 'shot', ('Swishes sound pack', 'qubodup (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/swishes-sound-pack')),
    'magic_wand': ('oga/rpg-sound-pack/unz/RPG Sound Pack/battle/spell.wav', 0.0, 1.4, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'crystal_chime': ('oga/63-digital-sound-effects-lasers-phasers-space-etc/unz/pepSound1.mp3', 0.0, 0.9, '', 'shot', ('63 digital sound effects', 'Kenney (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc')),
    'potion_bubble': ('oga/rpg-sound-pack/unz/RPG Sound Pack/inventory/bubble.wav', 0.0, 0.9, '', 'shot', ('RPG Sound Pack', 'HaelDB (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/rpg-sound-pack')),
    'boulder_roll': ('oga/80-cc0-rpg-sfx/unz/item_stone_01.ogg', 0.0, 1.4, 'asetrate=44100*0.75,aresample=44100', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'stone_crumble': ('oga/80-cc0-rpg-sfx/unz/stones_04.ogg', 0.0, 1.4, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'branch_snap': ('oga/80-cc0-rpg-sfx/unz/wood_01.ogg', 0.0, 0.9, '', 'shot', ('80 CC0 RPG SFX', 'NoirPhantom89 (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/80-cc0-rpg-sfx')),
    'laser_blast': ('oga/63-digital-sound-effects-lasers-phasers-space-etc/unz/laser1.mp3', 0.0, 0.9, '', 'shot', ('63 digital sound effects', 'Kenney (OpenGameArt)', 'CC0 1.0', 'https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc')),
    'ufo_hum': ('oga/alien-sounds/alien_device_0.flac', 0.0, 2.2, '', 'shot', ('Alien sounds', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/alien-sounds')),
    'robot_talk': ('oga/female-and-male-alienrobot-vocal-sfx/malealienrobotvocalsfxpack.wav', 0.0, 2.2, '', 'shot', ('Alien/robot vocal SFX', 'OpenGameArt contributor', 'CC0 1.0', 'https://opengameart.org/content/female-and-male-alienrobot-vocal-sfx')),
    'mystery_chime': ('@synth', 0, 2.2, 'aevalsrc=0.25*(gt(t\\,0.00)*exp(-t*2.5)*sin(2*PI*392.00*t)+gt(t\\,0.35)*exp(-(t-0.35)*2.5)*sin(2*PI*466.16*t)+gt(t\\,0.70)*exp(-(t-0.70)*2.5)*sin(2*PI*554.37*t)+gt(t\\,1.05)*exp(-(t-1.05)*1.8)*sin(2*PI*523.25*t)):s=44100:d=2.2,aecho=0.8:0.75:130:0.45', 'shot', None),
})

# 2026-11-23 batch 3 additions: 100 new sounds across all 8 categories (541 cues total).
SFX2 = ("100 CC0 SFX #2", "geekygnome (OpenGameArt)", C0, OGA + "100-cc0-sfx-2")
WATER40 = ("40 CC0 water / splash / slime SFX", "rockseller (OpenGameArt)", C0, OGA + "40-cc0-water-splash-slime-sfx")
SOUNDS.update({
    # Wild animals (15)
    "chimpanzee": ("commons/Pant-hoot call made by a male chimpanzee.ogg", 6.5, 3.2, "", "shot", ("Pant-hoot call made by a male chimpanzee", "Wikimedia Commons contributor", BY4, WM + "Pant-hoot_call_made_by_a_male_chimpanzee.ogg")),
    "orangutan": ("commons/Speech-Like-Rhythm-in-a-Voiced-and-Voiceless-Orangutan-Call-pone.0116136.s001.oga", 0.0, 3.0, "", "shot", ("Orangutan call (PLOS ONE)", "Lameira et al. (Wikimedia Commons)", BY4, WM + "Speech-Like-Rhythm-in-a-Voiced-and-Voiceless-Orangutan-Call-pone.0116136.s001.oga")),
    "bald_eagle": ("commons/Yellowstone sound library - Bald Eagle - 003.mp3", 0.5, 3.0, "", "shot", ("Bald Eagle", YSL, PD, WM + "Yellowstone_sound_library_-_Bald_Eagle_-_003.mp3")),
    "raven": ("commons/Yellowstone sound library - Common Raven - 001.mp3", 6.0, 3.0, "", "shot", ("Common Raven", YSL, PD, WM + "Yellowstone_sound_library_-_Common_Raven_-_001.mp3")),
    "vulture": ("oga/vulture-imitation/vulture-1_0.ogg", 0.0, 1.2, "", "shot", ("Vulture imitation", "megaboots (OpenGameArt)", C0, OGA + "vulture-imitation")),
    "grizzly_roar": ("commons/Yellowstone sound library - Grizzly Bears Roar - 001.mp3", 2.0, 3.2, "", "shot", ("Grizzly Bears Roar", YSL, PD, WM + "Yellowstone_sound_library_-_Grizzly_Bears_Roar_-_001.mp3")),
    "tiger_snarl": ("oga/80-cc0-creture-sfx-2/unz/attack_02.ogg", 0.0, 1.8, "", "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),
    "gorilla": ("oga/80-cc0-creture-sfx-2/unz/grunt_06.ogg", 0.0, 1.8, "asetrate=44100*0.82,aresample=44100", "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),
    "mammoth": ("commons/Elephant voice - trumpeting.ogg", 0.0, 2.0, "asetrate=44100*0.72,aresample=44100,aecho=0.8:0.7:60:0.25", "shot", ("Elephant voice, trumpeting", "தகவலுழவன் (Wikimedia Commons)", C0, WM + "Elephant_voice_-_trumpeting.ogg")),
    "elk": ("commons/Moose sound effect.wav", 24.0, 3.2, "asetrate=44100*1.12,aresample=44100", "shot", ("Moose sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Moose_sound_effect.wav")),
    "buffalo_herd": ("@mix", 0, 3.4, [
        ("commons/Six Horses Galloping By.ogg", 8.0, 3.4, 0, "lowpass=f=900,volume=0.85", False),
        ("commons/Buffalo and bison sound effect.wav", 22.0, 2.6, 500, "volume=0.75", False),
    ], "shot", [
        ("Six Horses Galloping By", "Freesound Community (via Wikimedia Commons)", C0, WM + "Six_Horses_Galloping_By.ogg"),
        ("Buffalo and bison sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Buffalo_and_bison_sound_effect.wav"),
    ]),
    "leopard": ("commons/Acoustic-Structure-and-Contextual-Use-of-Calls-by-Captive-Male-and-Female-Cheetahs-(Acinonyx-pone.0158546.s001.oga", 12.0, 2.8, "asetrate=44100*0.86,aresample=44100", "shot", ("Cheetah calls (PLOS ONE)", "Smirnova et al. (Wikimedia Commons)", BY4, WM + "Acoustic-Structure-and-Contextual-Use-of-Calls-by-Captive-Male-and-Female-Cheetahs-(Acinonyx-pone.0158546.s001.oga")),
    "walrus_bark": ("commons/Walrus sound effect.wav", 48.0, 3.0, "", "shot", ("Walrus sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Walrus_sound_effect.wav")),
    "rhino_charge": ("@mix", 0, 3.2, [
        ("commons/Rhinoceros sound effect.wav", 18.0, 3.0, 0, "", False),
        ("oga/mech-stomp-step-sound/stomp.flac", 0.0, 0.7, 300, "asetrate=44100*0.75,aresample=44100,volume=0.7", False),
        ("oga/mech-stomp-step-sound/stomp.flac", 0.0, 0.7, 900, "asetrate=44100*0.72,aresample=44100,volume=0.7", False),
    ], "shot", [
        ("Rhinoceros sound effect", "Zagzav12 (Wikimedia Commons)", C0, WM + "Rhinoceros_sound_effect.wav"),
        ("Mech stomp step sound", "OpenGameArt contributor", C0, OGA + "mech-stomp-step-sound"),
    ]),
    "beluga": ("commons/Killer whale.ogg", 1.5, 3.2, "asetrate=44100*1.35,aresample=44100", "shot", ("Killer whale", "Wikimedia Commons contributor", PD, WM + "Killer_whale.ogg")),

    # Farm friends (13)
    "horse_whinny": ("oga/baby-animals-sounds-pack/unz/Whinny.ogg", 0.0, 1.8, "", "shot", ("Baby animals sounds pack", "OpenGameArt contributor", C0, OGA + "baby-animals-sounds-pack")),
    "rabbit_munch": ("oga/rabbit-eating/RabbitEating.wav", 0.5, 2.6, "", "shot", ("Rabbit eating", "kurt (OpenGameArt)", C0, OGA + "rabbit-eating")),
    "calf": ("oga/baby-animals-sounds-pack/unz/Mwa.ogg", 0.0, 1.6, "", "shot", ("Baby animals sounds pack", "OpenGameArt contributor", C0, OGA + "baby-animals-sounds-pack")),
    "sheep_baa": ("oga/baby-animals-sounds-pack/unz/Bleat.ogg", 0.0, 1.2, "asetrate=44100*1.25,aresample=44100", "shot", ("Baby animals sounds pack", "OpenGameArt contributor", C0, OGA + "baby-animals-sounds-pack")),
    "rooster_morning": ("commons/Medium rooster crowing.ogg", 8.0, 3.4, "", "shot", ("Medium rooster crowing", "alys (Wikimedia Commons)", PD, WM + "Medium_rooster_crowing.ogg")),
    "horse_trot": ("commons/Six Horses Galloping By.ogg", 2.0, 3.0, "", "shot", ("Six Horses Galloping By", "Freesound Community (via Wikimedia Commons)", C0, WM + "Six_Horses_Galloping_By.ogg")),
    "duck_pond": ("commons/Ducks landing in water.ogg", 4.0, 2.8, "", "shot", ("Ducks landing in water", "Wikimedia Commons contributor", PD, WM + "Ducks_landing_in_water.ogg")),
    "farm_gate": ("oga/100-cc0-sfx-2/unz/sfx100v2_door_01.ogg", 0.0, 1.4, "", "shot", SFX2),
    "wood_axe": ("@mix", 0, 2.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_wood_hit_01.ogg", 0.0, 0.7, 0, "", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_wood_hit_02.ogg", 0.0, 0.7, 620, "", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_wood_hit_03.ogg", 0.0, 0.7, 1240, "", False),
    ], "shot", SFX2),
    "farm_pump": ("@mix", 0, 2.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_metal_02.ogg", 0.0, 0.8, 0, "", False),
        ("oga/40-cc0-water-splash-slime-sfx/unz/splash_02.ogg", 0.0, 1.2, 500, "", False),
    ], "shot", [SFX2, WATER40]),
    "milk_bucket": ("@mix", 0, 1.8, [
        ("oga/100-cc0-metal-and-wood-sfx/unz/metal_hit_01.ogg", 0.0, 0.6, 0, "volume=0.7", False),
        ("oga/40-cc0-water-splash-slime-sfx/unz/splash_01.ogg", 0.0, 1.2, 350, "", False),
    ], "shot", [("100 CC0 metal & wood SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-metal-and-wood-sfx"), WATER40]),
    "barn_creak": ("oga/tree-creaking/tree_creak_0.ogg", 0.0, 3.0, "asetrate=44100*0.85,aresample=44100", "shot", ("Tree creaking", "OpenGameArt contributor", C0, OGA + "tree-creaking")),
    "windmill": ("@mix", 0, 18.0, [
        ("@breeze", 0, 22.0, 0, "volume=0.8", False),
        ("oga/tree-creaking/tree_creak_0.ogg", 0.0, 4.0, 2500, "asetrate=44100*0.8,aresample=44100,volume=0.35", False),
        ("oga/tree-creaking/tree_creak_0.ogg", 1.0, 4.0, 11500, "asetrate=44100*0.78,aresample=44100,volume=0.3", False),
    ], "bed", ("Tree creaking", "OpenGameArt contributor", C0, OGA + "tree-creaking")),

    # Little critters (14)
    "black_woodpecker": ("commons/Spillkråka trummar - Dendrocopos martius..ogg", 2.0, 2.8, "", "shot", ("Black woodpecker drumming", "Wikimedia Commons contributor", BY3, WM + "Spillkråka_trummar_-_Dendrocopos_martius..ogg")),
    "dawn_chorus": ("oga/ambient-bird-sounds/birds-isaiah658_0.ogg", 1.0, 22.0, "", "bed", ("Ambient bird sounds", "FacadeGaikan (OpenGameArt)", C0, OGA + "ambient-bird-sounds")),
    "tree_frog": ("commons/Night Chorus of Frogs and Toads in Niger Delta.ogg", 6.0, 2.2, "asetrate=44100*1.25,aresample=44100", "shot", ("Night Chorus of Frogs and Toads", "Wikimedia Commons contributor", BY4, WM + "Night_Chorus_of_Frogs_and_Toads_in_Niger_Delta.ogg")),
    "cricket_night": ("commons/Grasshoppers.ogg", 1.0, 2.2, "", "shot", ("Grasshoppers", "Wikimedia Commons contributor", PD, WM + "Grasshoppers.ogg")),
    "cicada_buzz": ("oga/80-cc0-creture-sfx-2/unz/bug_06.ogg", 0.0, 1.4, "", "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),
    "beetle_buzz": ("oga/80-cc0-creture-sfx-2/unz/bug_08.ogg", 0.0, 1.4, "", "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),
    "ant_march": ("@mix", 0, 1.8, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_wood_01.ogg", 0.0, 0.25, i * 160, "asetrate=44100*1.7,aresample=44100,volume=0.7", False)
        for i in range(9)
    ], "shot", SFX2),
    "caterpillar": ("oga/rabbit-eating/RabbitEating.wav", 3.0, 2.2, "asetrate=44100*1.35,aresample=44100", "shot", ("Rabbit eating", "kurt (OpenGameArt)", C0, OGA + "rabbit-eating")),
    "toad": ("commons/Night Chorus of Frogs and Toads in Niger Delta.ogg", 18.0, 2.4, "asetrate=44100*0.72,aresample=44100", "shot", ("Night Chorus of Frogs and Toads", "Wikimedia Commons contributor", BY4, WM + "Night_Chorus_of_Frogs_and_Toads_in_Niger_Delta.ogg")),
    "firefly_twinkle": ("oga/bell-arpeggio-24/24.wav", 0.0, 2.4, "highpass=f=1000,volume=0.8", "shot", ("Bell arpeggio 24", "OpenGameArt contributor", C0, OGA + "bell-arpeggio-24")),
    "scurry": ("@mix", 0, 1.6, [
        ("oga/footsteps-leather-cloth-armor/unz/footsteps/step_cloth1.ogg", 0.0, 0.3, 0, "asetrate=44100*1.6,aresample=44100", False),
        ("oga/footsteps-leather-cloth-armor/unz/footsteps/step_cloth2.ogg", 0.0, 0.3, 180, "asetrate=44100*1.6,aresample=44100", False),
        ("oga/footsteps-leather-cloth-armor/unz/footsteps/step_cloth3.ogg", 0.0, 0.3, 360, "asetrate=44100*1.6,aresample=44100", False),
        ("oga/footsteps-leather-cloth-armor/unz/footsteps/step_cloth4.ogg", 0.0, 0.3, 540, "asetrate=44100*1.6,aresample=44100", False),
        ("oga/footsteps-leather-cloth-armor/unz/footsteps/step_cloth1.ogg", 0.0, 0.3, 760, "asetrate=44100*1.65,aresample=44100", False),
        ("oga/footsteps-leather-cloth-armor/unz/footsteps/step_cloth2.ogg", 0.0, 0.3, 940, "asetrate=44100*1.65,aresample=44100", False),
    ], "shot", ("Footsteps (leather, cloth, armor)", "bart (OpenGameArt)", C0, OGA + "footsteps-leather-cloth-armor")),
    "bird_wings": ("@mix", 0, 1.6, [
        ("oga/swishes-sound-pack/unz/swishes/swish-8.wav", 0.0, 0.4, 0, "asetrate=44100*1.3,aresample=44100", False),
        ("oga/swishes-sound-pack/unz/swishes/swish-9.wav", 0.0, 0.4, 240, "asetrate=44100*1.35,aresample=44100", False),
        ("oga/swishes-sound-pack/unz/swishes/swish-11.wav", 0.0, 0.4, 480, "asetrate=44100*1.3,aresample=44100", False),
        ("oga/swishes-sound-pack/unz/swishes/swish-12.wav", 0.0, 0.4, 720, "asetrate=44100*1.4,aresample=44100", False),
    ], "shot", ("Swishes sound pack", "qubodup (OpenGameArt)", C0, OGA + "swishes-sound-pack")),
    "crab_scuttle": ("@mix", 0, 1.6, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_stones_01.ogg", 0.0, 0.7, 0, "asetrate=44100*1.35,aresample=44100", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_stones_02.ogg", 0.0, 0.7, 520, "asetrate=44100*1.4,aresample=44100", False),
    ], "shot", SFX2),
    "mouse_scurry": ("oga/80-cc0-creture-sfx-2/unz/bug_10.ogg", 0.0, 1.2, "asetrate=44100*1.4,aresample=44100", "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),

    # Weather & nature (12)
    "hot_spring": ("commons/Yellowstone sound library - Beryl Spring - 001.mp3", 10.0, 22.0, "", "bed", ("Beryl Spring", YSL, PD, WM + "Yellowstone_sound_library_-_Beryl_Spring_-_001.mp3")),
    "rain_thunder": ("oga/rain-long-thunder/rain-thunder.ogg", 2.0, 24.0, "", "bed", ("Rain long thunder", "OpenGameArt contributor", C0, OGA + "rain-long-thunder")),
    "thunder_crack": ("oga/100-cc0-sfx-2/unz/sfx100v2_thunder_01.ogg", 0.0, 3.0, "", "shot", SFX2),
    "tree_creak": ("oga/tree-creaking/tree_creak.flac", 0.0, 3.2, "", "shot", ("Tree creaking", "OpenGameArt contributor", C0, OGA + "tree-creaking")),
    "camp_crackle": ("@mix", 0, 18.0, [
        ("oga/fire-crackling/fire-1_0.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", ("Fire crackling", "Stoner Games (OpenGameArt)", C0, OGA + "fire-crackling")),
    "river_waves": ("oga/sea-and-river-wave-sounds/VistulaShort_0.mp3", 10.0, 22.0, "", "bed", ("Sea and river wave sounds", "Snabisch (OpenGameArt)", C0, OGA + "sea-and-river-wave-sounds")),
    "wet_steps": ("@mix", 0, 2.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_footstep_wet_01.ogg", 0.0, 0.7, 0, "", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_footstep_wet_02.ogg", 0.0, 0.7, 500, "", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_footstep_wet_03.ogg", 0.0, 0.7, 1000, "", False),
    ], "shot", SFX2),
    "skipping_stones": ("@mix", 0, 2.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_stones_01.ogg", 0.0, 0.4, 0, "", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_stones_02.ogg", 0.0, 0.4, 420, "", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_stones_03.ogg", 0.0, 0.4, 800, "", False),
        ("oga/40-cc0-water-splash-slime-sfx/unz/splash_03.ogg", 0.0, 0.9, 1080, "", False),
    ], "shot", [SFX2, WATER40]),
    "bubbling_spring": ("@mix", 0, 18.0, [
        ("oga/40-cc0-water-splash-slime-sfx/unz/loop_water_01.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", WATER40),
    "rain_shower": ("@mix", 0, 18.0, [
        ("oga/40-cc0-water-splash-slime-sfx/unz/loop_rain.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", WATER40),
    "wind_chime_angel": ("commons/WWS Angelchimes.ogg", 5.0, 3.2, "", "shot", ("Angel chimes", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_Angelchimes.ogg")),
    "big_splash": ("oga/40-cc0-water-splash-slime-sfx/unz/splash_04.ogg", 0.0, 1.4, "", "shot", WATER40),

    # Places (12 ambient beds)
    "construction_site": ("@mix", 0, 18.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_construction_site.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", SFX2),
    "highway": ("@mix", 0, 18.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_highway.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", SFX2),
    "bakery": ("@mix", 0, 18.0, [
        ("commons/WWS Bakeryputtingbreadintothebreadoven4.ogg", 1.5, 22.0, 0, "volume=0.8", True),
        ("oga/fire-crackling/fire-1_0.ogg", 0.0, 22.0, 0, "lowpass=f=1200,volume=0.45", True),
    ], "bed", [
        ("Bakery putting bread into oven", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_Bakeryputtingbreadintothebreadoven4.ogg"),
        ("Fire crackling", "Stoner Games (OpenGameArt)", C0, OGA + "fire-crackling"),
    ]),
    "fountain": ("@mix", 0, 18.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_water_01.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", SFX2),
    "watermill": ("@mix", 0, 18.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_water_02.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", SFX2),
    "workshop": ("@mix", 0, 18.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_machine_01.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", SFX2),
    "power_plant": ("@mix", 0, 18.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_machine_02.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", SFX2),
    "submarine_hull": ("@mix", 0, 18.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_ambient_01.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", SFX2),
    "mysterious_cave": ("@mix", 0, 18.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_ambient_02.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", SFX2),
    "night_meadow": ("@mix", 0, 18.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_ambient_03.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", SFX2),
    "cheering_crowd": ("oga/free-crowd-cheering-sounds/unz/Gregor Quendel - Free Crowd Cheering Sounds - MP3/Gregor Quendel - Crowd Cheering Sounds - 08 - Rhythmic cheering.mp3", 1.0, 18.0, "", "bed", ("Free crowd cheering sounds", "Gregor Quendel (OpenGameArt)", BY4, OGA + "free-crowd-cheering-sounds")),
    "coral_reef": ("@mix", 0, 18.0, [
        ("oga/40-cc0-water-splash-slime-sfx/unz/loop_bubbles_1.ogg", 0.0, 22.0, 0, "", True),
    ], "bed", WATER40),

    # Things that go (12)
    "tram_doors": ("commons/WWS 102Ntramdoors.ogg", 17.0, 3.0, "", "shot", ("102N tram doors", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_102Ntramdoors.ogg")),
    "leaf_blower": ("commons/WWS Backpackleafblower.ogg", 12.5, 3.0, "", "shot", ("Backpack leaf blower", WWS + " / Museum of Municipal Engineering", BY4, WM + "WWS_Backpackleafblower.ogg")),
    "propeller_plane": ("@mix", 0, 2.8, [
        ("oga/propeller-cartoon-loop/propeller_cartoon_loop_0.ogg", 0.0, 2.8, 0, "", True),
    ], "shot", ("Propeller cartoon loop", "OpenGameArt contributor", C0, OGA + "propeller-cartoon-loop")),
    "hovercraft": ("oga/sci-fi-vehicle-sound/sci-fi 1_2.wav", 0.0, 1.6, "", "shot", ("Sci-fi vehicle sound", "qubodup (OpenGameArt)", C0, OGA + "sci-fi-vehicle-sound")),
    "dynamite": ("oga/dynamite-sound-effect/Dynamite with sensor.wav", 0.0, 3.6, "", "shot", ("Dynamite sound effect", "Snabisch (OpenGameArt)", C0, OGA + "dynamite-sound-effect")),
    "windup_toy": ("oga/clock-wind-sounds/multiwind2.wav", 0.0, 1.0, "", "shot", ("Clock wind sounds", "OpenGameArt contributor", C0, OGA + "clock-wind-sounds")),
    "rotary_phone": ("commons/WWS 8220NikolaTesla8221telephone8211dialing.ogg", 1.5, 3.0, "", "shot", ("Nikola Tesla telephone dialing", WWS + " / Technical Museum of Slovenia", BY4, WM + "WWS_8220NikolaTesla8221telephone8211dialing.ogg")),
    "washing_machine": ("commons/Washing machine last spin.ogg", 6.0, 3.2, "", "shot", ("Washing machine last spin", "Wikimedia Commons contributor", PD, WM + "Washing_machine_last_spin.ogg")),
    "ship_cannon": ("oga/25-cc0-bang-firework-sfx/unz/cannon_01.ogg", 0.0, 2.0, "", "shot", ("25 CC0 bang / firework SFX", "rubberduck (OpenGameArt)", C0, OGA + "25-cc0-bang-firework-sfx")),
    "firecracker": ("@mix", 0, 1.8, [
        ("oga/25-cc0-bang-firework-sfx/unz/fw_01.ogg", 0.0, 0.7, 0, "", False),
        ("oga/25-cc0-bang-firework-sfx/unz/fw_02.ogg", 0.0, 0.7, 360, "", False),
        ("oga/25-cc0-bang-firework-sfx/unz/fw_03.ogg", 0.0, 0.7, 740, "", False),
    ], "shot", ("25 CC0 bang / firework SFX", "rubberduck (OpenGameArt)", C0, OGA + "25-cc0-bang-firework-sfx")),
    "air_brake": ("oga/100-cc0-sfx-2/unz/sfx100v2_air_01.ogg", 0.0, 1.6, "", "shot", SFX2),
    "heavy_machine": ("@mix", 0, 2.8, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_loop_machine_03.ogg", 0.0, 2.8, 0, "lowpass=f=800", True),
    ], "shot", SFX2),

    # Around the house (11)
    "accordion": ("oga/accordion-sound/accordion_squeeze.mp3", 10.5, 2.6, "", "shot", ("Accordion sound", "OpenGameArt contributor", C0, OGA + "accordion-sound")),
    "flute_drum": ("oga/flute-drums-music-tag/flute_drum_music_tag.mp3", 0.0, 3.2, "", "shot", ("Flute & drums music tag", "OpenGameArt contributor", C0, OGA + "flute-drums-music-tag")),
    "jug_band": ("oga/jug-instrument/jug-1_0.ogg", 0.0, 1.7, "", "shot", ("Jug instrument", "OpenGameArt contributor", C0, OGA + "jug-instrument")),
    "blown_bottle": ("commons/Sounds of blown bottle.ogg", 1.0, 2.6, "", "shot", ("Sounds of blown bottle", "Wikimedia Commons contributor", PD, WM + "Sounds_of_blown_bottle.ogg")),
    "stove_click": ("oga/stove-switch/turn_stove_on_01_0.ogg", 0.0, 0.6, "", "shot", ("Stove switch", "OpenGameArt contributor", C0, OGA + "stove-switch")),
    "light_switch": ("oga/100-cc0-sfx-2/unz/sfx100v2_switch_01.ogg", 0.0, 0.6, "", "shot", SFX2),
    "window_break": ("oga/100-cc0-sfx-2/unz/sfx100v2_glass_01.ogg", 0.0, 1.4, "", "shot", SFX2),
    "wooden_stairs": ("@mix", 0, 2.0, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_footstep_wood_01.ogg", 0.0, 0.5, 0, "", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_footstep_wood_02.ogg", 0.0, 0.5, 420, "", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_footstep_wood_03.ogg", 0.0, 0.5, 840, "", False),
        ("oga/100-cc0-sfx-2/unz/sfx100v2_footstep_wood_04.ogg", 0.0, 0.5, 1260, "", False),
    ], "shot", SFX2),
    "pocket_watch": ("@mix", 0, 1.6, [
        ("oga/clock-wind-sounds/singlewind1.wav", 0.0, 0.6, 0, "", False),
        ("oga/clock-wind-sounds/singlewind2.wav", 0.0, 0.6, 480, "", False),
        ("oga/clock-wind-sounds/singlewind3.wav", 0.0, 0.6, 960, "", False),
    ], "shot", ("Clock wind sounds", "OpenGameArt contributor", C0, OGA + "clock-wind-sounds")),
    "drawer_open": ("oga/100-cc0-sfx-2/unz/sfx100v2_door_02.ogg", 0.0, 1.2, "", "shot", SFX2),
    "padlock": ("oga/100-cc0-sfx-2/unz/sfx100v2_lock_open_01.ogg", 0.0, 1.0, "", "shot", SFX2),

    # Magic & silly (11)
    "mystery_sting": ("oga/mystery-sting/mystery_sting.ogg", 0.0, 3.2, "", "shot", ("Mystery sting", "OpenGameArt contributor", C0, OGA + "mystery-sting")),
    "fairy_bells": ("oga/bell-arpeggio-24/24.wav", 0.0, 2.5, "", "shot", ("Bell arpeggio 24", "OpenGameArt contributor", C0, OGA + "bell-arpeggio-24")),
    "slime_splat": ("oga/40-cc0-water-splash-slime-sfx/unz/slime_05.ogg", 0.0, 1.0, "", "shot", WATER40),
    "potion_gulp": ("@mix", 0, 1.4, [
        ("oga/40-cc0-water-splash-slime-sfx/unz/bubble_01.ogg", 0.0, 0.7, 0, "", False),
        ("oga/40-cc0-water-splash-slime-sfx/unz/bubble_02.ogg", 0.0, 0.7, 450, "", False),
    ], "shot", WATER40),
    "dragon_roar": ("oga/80-cc0-rpg-sfx/unz/creature_roar_01.ogg", 0.0, 2.2, "", "shot", ("80 CC0 RPG SFX", "NoirPhantom89 (OpenGameArt)", C0, OGA + "80-cc0-rpg-sfx")),
    "magic_book": ("oga/80-cc0-rpg-sfx/unz/book_02.ogg", 0.0, 1.2, "", "shot", ("80 CC0 RPG SFX", "NoirPhantom89 (OpenGameArt)", C0, OGA + "80-cc0-rpg-sfx")),
    "treasure_chest": ("@mix", 0, 1.8, [
        ("oga/100-cc0-sfx-2/unz/sfx100v2_door_03.ogg", 0.0, 1.0, 0, "", False),
        ("oga/80-cc0-rpg-sfx/unz/item_coins_02.ogg", 0.0, 1.0, 520, "", False),
    ], "shot", [SFX2, ("80 CC0 RPG SFX", "NoirPhantom89 (OpenGameArt)", C0, OGA + "80-cc0-rpg-sfx")]),
    "retro_jump": ("oga/50-cc0-retro-synth-sfx/unz/power_up_02.ogg", 0.0, 1.0, "", "shot", ("50 CC0 retro synth SFX", "Snabisch (OpenGameArt)", C0, OGA + "50-cc0-retro-synth-sfx")),
    "alien_chatter": ("oga/80-cc0-creture-sfx-2/unz/alien_07.ogg", 0.0, 1.6, "", "shot", ("80 CC0 creature SFX #2", "rubberduck (OpenGameArt)", C0, OGA + "80-cc0-creture-sfx-2")),
    "shield_bash": ("oga/100-cc0-metal-and-wood-sfx/unz/metal_hit_03.ogg", 0.0, 1.2, "", "shot", ("100 CC0 metal & wood SFX", "rubberduck (OpenGameArt)", C0, OGA + "100-cc0-metal-and-wood-sfx")),
    "magic_crystal": ("oga/80-cc0-rpg-sfx/unz/item_gem_02.ogg", 0.0, 1.4, "", "shot", ("80 CC0 RPG SFX", "NoirPhantom89 (OpenGameArt)", C0, OGA + "80-cc0-rpg-sfx")),
})
# Building blocks for "@mix" parts.
PARTS = {
    # A rocket's rising whistle.
    "@whizz": "aevalsrc=0.25*sin(2*PI*(900+1100*t/{dur})*t)*min(1\\,t*8)+0.05*(random(0)-0.5):s=44100:d={dur},highpass=f=600",
    # Crisp ice-pellet clicks for hail.
    "@hail": "anoisesrc=color=white:r=44100:d={dur}:a=0.5,highpass=f=2200,lowpass=f=7000,tremolo=f=17:d=0.85",
    # Howling storm wind.
    "@stormwind": "anoisesrc=color=pink:r=44100:d={dur}:a=0.65,lowpass=f=850,highpass=f=110,volume='0.55+0.35*sin(2*PI*0.14*t)+0.15*sin(2*PI*0.41*t)':eval=frame",
    # Gentle summer meadow breeze.
    "@breeze": "anoisesrc=color=pink:r=44100:d={dur}:a=0.35,lowpass=f=500,highpass=f=80,volume='0.6+0.3*sin(2*PI*0.09*t)':eval=frame",
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
    only = set(sys.argv[2:])
    tmp = os.path.join(src, "_build")
    os.makedirs(tmp, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    credits, missing = {}, []
    for name, (path, start, dur, filters, kind, credit) in SOUNDS.items():
        out = os.path.join(OUT, name + ".m4a")
        if only and name not in only:
            if os.path.exists(out):
                for c in (credit if isinstance(credit, list) else [credit] if credit else []):
                    credits[c] = credits.get(c, []) + [name]
            continue
        try:
            if path == "@synth":
                gen = os.path.join(tmp, name + ".wav")
                chain = filters
                run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", chain, gen])
                if kind == "bed":
                    seamless(["-i", gen], out, dur - 3, xfade=3)
                else:
                    encode(["-i", gen], out, kind, dur, "")
            elif path == "@mix":
                parts = filters
                inputs, chains = [], []
                for i, (p, st, d, delay, f, loop) in enumerate(parts):
                    if p in PARTS:
                        inputs += ["-f", "lavfi", "-i", PARTS[p].format(dur=d)]
                    else:
                        full = os.path.join(src, p)
                        if not os.path.exists(full):
                            raise FileNotFoundError(p)
                        inputs += (["-stream_loop", "-1"] if loop else []) + ["-ss", str(st), "-t", str(d), "-i", full]
                    chain = ",".join(x for x in [f"aresample=44100,aformat=channel_layouts=mono", f, f"adelay={delay}|{delay}" if delay else ""] if x)
                    chains.append(f"[{i}:a]{chain}[p{i}]")
                graph = ";".join(chains) + ";" + "".join(f"[p{i}]" for i in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0:duration=longest"
                gen = os.path.join(tmp, name + ".wav")
                run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", graph, "-t", str(dur + (3 if kind == "bed" else 0)), gen])
                if kind == "bed":
                    seamless(["-i", gen], out, dur, xfade=2.5)
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
            for c in (credit if isinstance(credit, list) else [credit] if credit else []):
                credits[c] = credits.get(c, []) + [name]
            print(f"ok  {name}")
        except Exception as e:  # noqa: BLE001
            missing.append(name)
            print(f"--  {name}: {e}")

    lines = [
        "Roarly's sounds come from people who share their recordings freely. Thank you!",
        "",
        "Public domain and CC0 recordings need no credit; we list them anyway. CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ CC BY 3.0: https://creativecommons.org/licenses/by/3.0/ CC BY 2.5: https://creativecommons.org/licenses/by/2.5/ CC BY 2.0: https://creativecommons.org/licenses/by/2.0/",
        "Some sounds were changed (trimmed, pitched, looped, mixed). A few are synthesized for Roarly.",
        "",
    ]
    for (title, author, lic, url), names in sorted(credits.items(), key=lambda x: x[1][0]):
        lines.append(f"{', '.join(n.split('_')[0] for n in names)}: \"{title}\" by {author}. {lic}. {url}")
    lines.append("")
    synth = sorted({n.split("_")[0] for n, s in SOUNDS.items() if s[0] == "@synth" and os.path.exists(os.path.join(OUT, n + ".m4a"))})
    lines.append("Synthesized for Roarly: " + ", ".join(synth) + ".")
    with open(os.path.join(OUT, "CREDITS.txt"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("missing:", missing)


if __name__ == "__main__":
    main()
