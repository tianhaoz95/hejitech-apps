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
# Building blocks for "@mix" parts.
PARTS = {
    # A rocket's rising whistle.
    "@whizz": "aevalsrc=0.25*sin(2*PI*(900+1100*t/{dur})*t)*min(1\\,t*8)+0.05*(random(0)-0.5):s=44100:d={dur},highpass=f=600",
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
        "Public domain and CC0 recordings need no credit; we list them anyway. CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ CC BY 3.0: https://creativecommons.org/licenses/by/3.0/",
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
