#!/usr/bin/env python3
"""Generates the flat bespoke Voxbrief V-Wave app icon at 1024x1024.

Strictly 2D flat with high legibility across all display sizes:
- Background: Pure solid Apple Royal Blue (#0E64F6)
- Foreground: Pure crisp white (#FFFFFF) V-Wave monogram
- Wide 1:1 stroke-to-gap ratio ensuring zero clustering even at 16x16
- No 3D shadows, no gloss, no specular highlights, no bevels
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

# Destinations
IOS_ICON = ROOT / "VoxbriefApp/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
WATCH_ICON = ROOT / "VoxbriefWatch/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
DOCS_ICON = ROOT / "site/assets/icon.png"

def render_vwave_icon(size: int = 1024) -> Image.Image:
    # 4x supersampling for razor sharp vector antialiasing
    scale = 4
    canvas_size = size * scale
    
    # Flat Apple Royal Blue
    bg_color = (14, 100, 246, 255)
    fg_color = (255, 255, 255, 255)
    
    img = Image.new("RGBA", (canvas_size, canvas_size), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Left diagonal stem of the 'V'
    stem_w = int(0.10 * canvas_size)
    r = stem_w / 2
    
    p1 = (int(0.18 * canvas_size), int(0.24 * canvas_size))
    vertex = (int(0.36 * canvas_size), int(0.76 * canvas_size))
    
    draw.line([p1, vertex], fill=fg_color, width=stem_w)
    draw.ellipse([p1[0]-r, p1[1]-r, p1[0]+r, p1[1]+r], fill=fg_color)
    draw.ellipse([vertex[0]-r, vertex[1]-r, vertex[0]+r, vertex[1]+r], fill=fg_color)
    
    # Right arm: 3 bold, widely spaced equalizer bars (1:1 stroke to gap ratio)
    bar_w = int(0.08 * canvas_size)
    br = bar_w / 2
    
    bars = [
        (int(0.52 * canvas_size), int(0.63 * canvas_size), int(0.20 * canvas_size)),
        (int(0.68 * canvas_size), int(0.53 * canvas_size), int(0.32 * canvas_size)),
        (int(0.84 * canvas_size), int(0.44 * canvas_size), int(0.44 * canvas_size)),
    ]
    
    for (bx, by, bh) in bars:
        x0 = bx - br
        x1 = bx + br
        y0 = by - bh / 2
        y1 = by + bh / 2
        draw.rounded_rectangle([x0, y0, x1, y1], radius=br, fill=fg_color)
        
    return img.resize((size, size), Image.LANCZOS)

def main():
    icon = render_vwave_icon(1024)
    
    IOS_ICON.parent.mkdir(parents=True, exist_ok=True)
    icon.save(IOS_ICON, "PNG")
    print(f"Saved iOS icon to {IOS_ICON}")
    
    WATCH_ICON.parent.mkdir(parents=True, exist_ok=True)
    icon.save(WATCH_ICON, "PNG")
    print(f"Saved watchOS icon to {WATCH_ICON}")
    
    DOCS_ICON.parent.mkdir(parents=True, exist_ok=True)
    icon.save(DOCS_ICON, "PNG")
    print(f"Saved site icon to {DOCS_ICON}")

if __name__ == "__main__":
    main()
