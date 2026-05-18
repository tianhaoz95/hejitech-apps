# Icecap Landing Video — Production Plan

## Overview

A silent-first product video for the Icecap waitlist landing page and YouTube/social ads. No voiceover — driven entirely by on-screen text overlays, product footage, and background music. Designed to work muted (autoplay) and with sound equally well.

---

## Deliverables

| Format | Duration | Aspect Ratio | Use Case |
|---|---|---|---|
| Hero (master) | 75s | 16:9 | Landing page, waitlist site |
| YouTube pre-roll | 60s | 16:9 | Skippable ad (hook in first 5s) |
| YouTube bumper | 6s | 16:9 | Non-skippable bumper |
| Social cut | 30s | 9:16 | Instagram Reels, TikTok |

All cuts are derived from the master. Produce master first.

---

## Tools

| Category | Tool | Cost |
|---|---|---|
| Screen recording | OpenScreen | Free |
| B-roll (local) | HunyuanVideo 1.5 + Wan2.1 via ComfyUI | Free (DGX Spark) |
| B-roll (online, optional) | Runway Gen-4 | ~$20–30 in credits |
| Music | Pixabay Music | Free |
| Video editor | DaVinci Resolve | Free |
| Social cut | CapCut | Free |

**Total cost: $0** (or ~$20–30 if using Runway for premium B-roll shots)

---

## Production Phases

| Phase | Task | Time Estimate |
|---|---|---|
| 1 | Script & storyboard (text overlays mapped to visuals) | 1–2 days |
| 2 | Screen recordings with OpenScreen | Half day |
| 3 | B-roll generation (local + optional Runway) | 1–2 days |
| 4 | Music selection from Pixabay | 1–2 hours |
| 5 | Edit master cut in DaVinci Resolve (text overlays, timing) | 2–3 days |
| 6 | Export cuts (6s bumper, 30s, 9:16 social) | 1 day |

---

## Storyboard & Text Overlays

### Narrative Arc

```
HOOK (pain) → PROBLEM (spreadsheets) → SOLUTION (extension) → PRODUCT DEMO → HUB → CTA
```

Tone: calm, confident, slightly editorial. Think Linear or Vercel product videos — no hype, just clarity.

---

### Scene-by-Scene Breakdown

#### Scene 1 — Hook (0:00–0:08)
**Visual:** Cinematic B-roll. Aerial drone gliding slowly over a suburban neighborhood at golden hour. Wide shot, warm tones.

**Text overlay (center, large):**
```
You found a listing.
```
*Fade in at 0:02, hold 3s, fade out.*

**Text overlay (center, large):**
```
Is it actually a good deal?
```
*Fade in at 0:05, hold 3s.*

**Music:** Starts quiet, ambient. Builds slightly.

---

#### Scene 2 — Pain (0:08–0:20)
**Visual:** Screen recording. Someone opens a blank Excel/Google Sheets spreadsheet. Starts typing numbers. Tabs between browser and spreadsheet. Looks tedious and slow.

**Text overlay (bottom third, smaller):**
```
Most investors open a spreadsheet.
```
*Appears at 0:09.*

**Text overlay (bottom third):**
```
Copy price. Paste rent estimate. Google the cap rate formula.
```
*Appears at 0:13, words appear one beat apart.*

**Text overlay (bottom third, fades to next):**
```
Every. Single. Listing.
```
*Appears at 0:17, slight pause before cut.*

---

#### Scene 3 — Solution Intro (0:20–0:28)
**Visual:** B-roll. Clean close-up of someone opening Chrome, typing in the Chrome Web Store. Extension installs — the Icecap icon appears in the toolbar. Simple, satisfying.

**Text overlay (center, large, bold):**
```
There's a better way.
```
*Fades in at 0:21, holds.*

**Text overlay (center, smaller, appears below):**
```
Icecap — real estate math at the speed of browsing.
```
*Fades in at 0:24.*

---

#### Scene 4 — Product Demo: Redfin (0:28–0:45)
**Visual:** Screen recording. Browser navigates to a real Redfin listing. The Icecap sidebar/overlay smoothly slides in. Key metrics appear: Cap Rate, Cash-on-Cash Return, 1% Rule indicator, GRM.

*Use OpenScreen's zoom effect to punch in on the overlay as each metric appears.*

**Text overlay (right side, card-style, appears as each metric loads):**
```
Cap Rate      6.2%  ✓
CoC Return    8.1%  ✓
1% Rule       0.91  ~
GRM           14.2
```
*Each line fades in sequentially, 0.5s apart.*

**Text overlay (bottom, small):**
```
Live metrics. No spreadsheet.
```
*Appears at 0:40.*

---

#### Scene 5 — Product Demo: Zillow (0:45–0:55)
**Visual:** Screen recording. Switch to Zillow. Navigate to a different listing. Icecap overlay appears again — same metrics, different property. Quick cuts between 2–3 listings to show it works across sites.

**Text overlay (top left, small label):**
```
Works on Zillow, Redfin, Realtor.com
```
*Static label, appears at start of scene.*

**Text overlay (center, appears mid-scene):**
```
50 deals analyzed.
5 minutes.
```
*Words appear one beat apart at 0:50.*

---

#### Scene 6 — Hub Dashboard (0:55–1:05)
**Visual:** Screen recording. Switch from extension to the Icecap Hub web app. Show the portfolio/deals list — saved properties with their metrics. Pan across the comparison view. Then trigger the AI deal summary — it generates on screen.

**Text overlay (top, label):**
```
The Icecap Hub
```
*Appears at start of scene, fades after 2s.*

**Text overlay (bottom third):**
```
Save deals. Compare them side by side.
```
*Appears at 0:57.*

**Text overlay (bottom third, replaces previous):**
```
AI-powered deal summaries — on demand.
```
*Appears at 1:01 as the AI summary generates on screen.*

---

#### Scene 7 — CTA (1:05–1:15)
**Visual:** Clean white or deep blue background. Icecap logo centered. No product footage — just the brand.

**Text overlay (center, large, bold):**
```
Icecap
```
*Logo fades in.*

**Text overlay (center, medium, appears below logo):**
```
Real estate math, at the speed of browsing.
```
*Fades in at 1:07.*

**Text overlay (center, button-style box):**
```
Add to Chrome — Free  →
```
*Appears at 1:10, slight pulse animation.*

**Music:** Resolves cleanly on the final beat as CTA appears.

---

### Condensed Text Overlay Script (in order)

| Timecode | Text |
|---|---|
| 0:02 | You found a listing. |
| 0:05 | Is it actually a good deal? |
| 0:09 | Most investors open a spreadsheet. |
| 0:13 | Copy price. Paste rent estimate. Google the cap rate formula. |
| 0:17 | Every. Single. Listing. |
| 0:21 | There's a better way. |
| 0:24 | Icecap — real estate math at the speed of browsing. |
| 0:40 | Live metrics. No spreadsheet. |
| 0:45 | Works on Zillow, Redfin, Realtor.com |
| 0:50 | 50 deals analyzed. 5 minutes. |
| 0:57 | Save deals. Compare them side by side. |
| 1:01 | AI-powered deal summaries — on demand. |
| 1:07 | Real estate math, at the speed of browsing. |
| 1:10 | Add to Chrome — Free → |

---

## Screen Recording Shot List

Record each as a separate clip in OpenScreen. Slow and deliberate — no rushing.

| # | Scene | Duration | Notes |
|---|---|---|---|
| SR-1 | Opening blank spreadsheet, copying numbers from browser | 20s | Show the tedium — slow, realistic |
| SR-2 | Installing Icecap from Chrome Web Store | 15s | Show the icon appearing in toolbar |
| SR-3 | Redfin listing → Icecap overlay slides in, metrics appear | 30s | Use OpenScreen zoom on overlay |
| SR-4 | Zillow listing → overlay | 15s | Quick cut version |
| SR-5 | Realtor.com listing → overlay | 10s | Even quicker |
| SR-6 | Icecap Hub — deals list, portfolio view | 20s | Pan slowly across the UI |
| SR-7 | Hub — AI deal summary generating | 15s | Let it generate in real time |

**Recording tips:**
- Use a clean browser profile — no other extensions, bookmarks bar hidden
- Pick real listings with strong metrics so the numbers look compelling
- Record at 1440p minimum
- Use OpenScreen cursor highlight so clicks are visible

---

## B-Roll Generation Prompts

Run locally on DGX Spark with HunyuanVideo 1.5 (via ComfyUI). Generate 5–10s clips, 8–10 total.

| # | Use In Scene | Prompt |
|---|---|---|
| BR-1 | Scene 1 | `Aerial drone shot slowly gliding over a quiet suburban neighborhood at golden hour, warm light on rooftops, green lawns, cinematic, photorealistic, smooth camera motion` |
| BR-2 | Scene 1 alt | `Wide establishing shot of a tree-lined residential street in autumn, soft sunlight, gentle camera drift, cinematic depth of field` |
| BR-3 | Scene 3 | `Close-up of hands typing on a laptop keyboard in a bright modern home office, clean desk, shallow depth of field, natural light` |
| BR-4 | Scene 3 alt | `Young professional at a minimal white desk looking at a laptop screen, focused expression, warm ambient light, cinematic` |
| BR-5 | Scene 7 | `Clean abstract background with subtle blue gradient, soft bokeh light particles drifting slowly, minimal, premium tech aesthetic` |
| BR-6 | Transition | `Smooth slow push into a modern craftsman house front door, green lawn, sunny day, real estate photography style` |

**ComfyUI setup on DGX Spark:**
1. Install ComfyUI: `git clone https://github.com/comfyanonymous/ComfyUI`
2. Install HunyuanVideo node: `ComfyUI-HunyuanVideoWrapper` from the ComfyUI Manager
3. Download model weights from HuggingFace: `tencent/HunyuanVideo-1.5`
4. Run at 720p, 10s, CFG 6.0, 50 steps as a starting point

For Wan2.1 (better text rendering if needed):
- Weights: `Wan-AI/Wan2.1-T2V-14B` on HuggingFace
- Use the official inference script from `github.com/Wan-Video/Wan2.1`

---

## Music Selection

Browse [Pixabay Music](https://pixabay.com/music/) and filter by:
- **Genre:** Cinematic, Corporate, Ambient
- **Mood:** Uplifting, Inspiring, Focused
- **Tempo:** Medium (not too energetic, not too slow)

Target feel: calm confidence — like a tool that just works. Avoid anything with drops, heavy beats, or overt "startup hype" energy.

Download 3–4 candidates, cut them to 75s in DaVinci Resolve, and test against a rough assembly before committing.

---

## DaVinci Resolve Edit Structure

### Timeline Tracks (top to bottom)

| Track | Content |
|---|---|
| V4 | Text overlays (Fusion titles) |
| V3 | B-roll (blend mode: normal, cut over screen recordings where needed) |
| V2 | Screen recordings |
| V1 | Base B-roll / background |
| A1 | Music (volume ducked slightly at text-heavy moments) |

### Text Overlay Style

- **Font:** Inter or SF Pro Display (match the Icecap brand)
- **Color:** White on dark scenes, dark gray (#1a1a1a) on light scenes
- **Animation:** Fade in over 8 frames, hold, fade out over 8 frames. No slides or bounces.
- **Large text:** 72–96pt, bold, center aligned
- **Small labels:** 28–32pt, regular weight, bottom third

### Pacing Guidelines

- Hook (0–20s): slower cuts, let B-roll breathe
- Demo (20–55s): quicker cuts synced to metric reveals
- Hub (55–65s): medium pace, let AI generation play out in real time
- CTA (65–75s): static hold, let the logo land

---

## Export Settings

| Deliverable | Resolution | Format | Notes |
|---|---|---|---|
| Master | 1920×1080 | H.264 MP4 | Landing page |
| YouTube pre-roll | 1920×1080 | H.264 MP4 | Same as master, trimmed to 60s |
| YouTube bumper | 1920×1080 | H.264 MP4 | 6s — Scene 1 hook + logo |
| Social (9:16) | 1080×1920 | H.264 MP4 | Reframed in CapCut from master |

---

## Cut Derivation

**6s bumper:** Scenes 1 + 7 only. First overlay line + logo + CTA. No product footage.

**30s YouTube pre-roll:** Compress as follows:
- Scene 1 (hook): 0:00–0:05
- Scene 4 (demo, Redfin only): 0:05–0:18
- Scene 6 (Hub, abbreviated): 0:18–0:25
- Scene 7 (CTA): 0:25–0:30

**9:16 social cut:** Use the 30s cut, reframe in CapCut for vertical. Adjust text position so overlays don't overlap the safe zone (keep text in center 70% of frame height).
