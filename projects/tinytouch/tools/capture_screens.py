#!/usr/bin/env python3
import subprocess
import time
import os

DEVICE_ID = "62C1FAD5-5800-4137-AEFD-7D43D3F5F6F2"
BUNDLE_ID = "com.tianhaoz.tinytouch"
OUT_DIR = "/Users/tianhaoz/GitHub/watch_game/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

modes = [
    ("bubble_pop", ["--with-timer"]),
    ("animal_friends", ["--mode-animals", "--with-timer"]),
    ("sound_garden", ["--mode-soundgarden", "--with-timer"]),
    ("magic_sparkles", ["--mode-sparkles", "--with-timer"]),
    ("sleepy_moon", ["--mode-lullaby"]),
    ("parent_dashboard", ["--parent-menu", "--with-timer"]),
    ("parent_guide", ["--parent-guide", "--with-timer"]),
]

for name, args in modes:
    print(f"Capturing {name}...")
    subprocess.run(["xcrun", "simctl", "terminate", DEVICE_ID, BUNDLE_ID], capture_output=True)
    time.sleep(0.5)
    launch_cmd = ["xcrun", "simctl", "launch", DEVICE_ID, BUNDLE_ID] + args
    subprocess.run(launch_cmd, check=True)
    time.sleep(2.0)
    shot_path = os.path.join(OUT_DIR, f"{name}.png")
    subprocess.run(["xcrun", "simctl", "io", DEVICE_ID, "screenshot", shot_path], check=True)
    print(f"Captured {shot_path}")

print("All screenshots captured!")
