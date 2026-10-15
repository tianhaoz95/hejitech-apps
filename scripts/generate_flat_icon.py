#!/usr/bin/env python3
"""Generates the flat bespoke Voxbrief V-Wave app icon at 1024x1024.

Strictly 2D flat:
- Background: Pure solid Apple Royal Blue (#0E64F6)
- Foreground: Pure crisp white (#FFFFFF) V-Wave monogram
- No 3D shadows, no gloss, no specular highlights, no bevels
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

# Destinations
IOS_ICON = ROOT / "VoxbriefApp/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
WATCH_ICON = ROOT / "VoxbriefWatch/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"
DOCS_ICON = ROOT / "docs/assets/icon.png"

def render_vwave_icon(size: int = 1024) -> Image.Image:
    # 4x supersampling for razor sharp vector antialiasing
    scale = 4
    canvas_size = size * scale
    
    # Flat Apple Royal Blue
    bg_color = (14, 100, 246, 255)
    fg_color = (255, 255, 255, 255)
    
    img = Image.new("RGBA", (canvas_size, canvas_size), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Scale relative to 1024
    w = 64 * scale
    r = w / 2
    
    # Left diagonal stem of the 'V'
    p1 = (276 * scale, 290 * scale)
    vertex = (454 * scale, 730 * scale)
    
    draw.line([p1, vertex], fill=fg_color, width=int(w))
    draw.ellipse([p1[0]-r, p1[1]-r, p1[0]+r, p1[1]+r], fill=fg_color)
    draw.ellipse([vertex[0]-r, vertex[1]-r, vertex[0]+r, vertex[1]+r], fill=fg_color)
    
    # Right arm: 4 stepped equalizer waveform bars ascending along the V contour
    bar_w = 58 * scale
    br = bar_w / 2
    
    bars = [
        (536, 650, 160),  # Bar 1: shortest, near vertex
        (616, 530, 300),  # Bar 2: mid-height
        (696, 410, 420),  # Bar 3: peak voice bar
        (776, 320, 280),  # Bar 4: top-right exit
    ]
    
    for (bx, by, bh) in bars:
        bx_s = bx * scale
        by_s = by * scale
        bh_s = bh * scale
        x0 = bx_s - br
        x1 = bx_s + br
        y0 = by_s - bh_s / 2
        y1 = by_s + bh_s / 2
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
    print(f"Saved docs icon to {DOCS_ICON}")

if __name__ == "__main__":
    main()
