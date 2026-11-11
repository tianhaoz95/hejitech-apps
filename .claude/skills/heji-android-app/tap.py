#!/usr/bin/env python3
"""Tap or list what is on the connected Android phone's screen, by text instead of coordinates.

  .claude/skills/heji-android-app/tap.py "Sign out"        tap the element whose text or content
                                                           description is exactly that, else the first
                                                           one containing it (case-insensitive)
  .claude/skills/heji-android-app/tap.py --list            print every text / description on screen
  .claude/skills/heji-android-app/tap.py --has "Saved"     exit 0 if it is on screen, 1 if not

It reads the accessibility tree (`uiautomator dump`), so Compose needs real text or a
contentDescription on what you want to reach; a Switch next to a label is a separate element: tap it
by coordinates from a screenshot, or give it a testTag and read the tree with --list. A locked phone
has no tree to read.
"""
import re
import subprocess
import sys

NODE = re.compile(r'<node[^>]*?text="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')


def nodes():
    subprocess.run(["adb", "shell", "uiautomator", "dump", "/sdcard/.heji_ui.xml"], capture_output=True)
    xml = subprocess.run(["adb", "shell", "cat", "/sdcard/.heji_ui.xml"], capture_output=True, text=True).stdout
    out = []
    for m in NODE.finditer(xml):
        text, desc, x1, y1, x2, y2 = m.groups()
        label = (text or desc).replace("&amp;", "&").replace("&#10;", " ")
        if label:
            out.append((label, (int(x1) + int(x2)) // 2, (int(y1) + int(y2)) // 2))
    return out


def find(want, found):
    want = want.lower()
    exact = [n for n in found if n[0].lower() == want]
    return (exact or [n for n in found if want in n[0].lower()] or [None])[0]


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    found = nodes()
    if args[0] == "--list":
        print(" | ".join(n[0] for n in found))
        return
    if args[0] == "--has":
        sys.exit(0 if find(args[1], found) else 1)
    hit = find(args[0], found)
    if not hit:
        print(f"not on screen: {args[0]}\n" + " | ".join(n[0] for n in found)[:800])
        sys.exit(1)
    subprocess.run(["adb", "shell", "input", "tap", str(hit[1]), str(hit[2])])
    print(f"tapped {hit[0]!r} at {hit[1]},{hit[2]}")


if __name__ == "__main__":
    main()
