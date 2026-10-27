#!/usr/bin/env python3
import re
import os
import sys

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from craft_exquisite_grids import grids

# 1. Update round2_cands.py
r2_path = os.path.join(script_dir, "round2_cands.py")
with open(r2_path, "r", encoding="utf-8") as f:
    content = f.read()

updated = 0
for cid, g in grids.items():
    if cid in ("current", "vital-sprout"):
        continue
    pattern = rf'(add_r2\(\s*"{cid}"[\s\S]*?""")([\s#.]+?)("""\s*\))'
    match = re.search(pattern, content)
    if match:
        content = content[:match.start(2)] + "\n" + g + "\n" + content[match.end(2):]
        updated += 1
    else:
        print("Missing match in round2_cands for", cid)

with open(r2_path, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Updated {updated} grids in round2_cands.py")

# 2. Update even_grids.py
eg_path = os.path.join(script_dir, "even_grids.py")
with open(eg_path, "r", encoding="utf-8") as f:
    eg = f.read()

v_grid = grids["vital-sprout"]
c_grid = grids["current"]

eg = re.sub(r'(grids\["vital-sprout"\]\s*=\s*""")[^"]+(""")', rf'\g<1>\n{v_grid}\n\g<2>', eg)
eg = re.sub(r'(grids\["current"\]\s*=\s*""")[^"]+(""")', rf'\g<1>\n{c_grid}\n\g<2>', eg)

with open(eg_path, "w", encoding="utf-8") as f:
    f.write(eg)

print("Updated vital-sprout and current in even_grids.py")
