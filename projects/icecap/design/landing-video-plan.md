# Icecap Landing Video — Production Plan

## Overview

A silent-first product video for the Icecap waitlist landing page and YouTube/social ads. No voiceover — driven entirely by on-screen text overlays, product footage, and background music. Designed to work muted (autoplay) and with sound equally well.

---

## Deliverables

| Format | Duration | Aspect Ratio | Use Case |
|---|---|---|---|
| Hero (master) | 75s | 16:9 | Landing page, waitlist site |
| Ad cut | 5s | 16:9 | YouTube, Instagram, TikTok ads |
| Social cut | 30s | 9:16 | Instagram Reels, TikTok organic |

The 5s ad has no logo — branding is handled by the click-through to the waitlist site. The master and social cut are derived from the same edit. Produce master first, then cut down.

---

## Tools

| Category | Tool | Cost |
|---|---|---|
| Mockup pages | HTML/CSS/JS (hand-coded) | Free |
| Mockup recording | OpenScreen | Free |
| B-roll (local) | HunyuanVideo 1.5 + Wan2.1 via ComfyUI | Free (DGX Spark) |
| B-roll (online, optional) | Runway Gen-4 | ~$20–30 in credits |
| Music | Pixabay Music | Free |
| Video editor | DaVinci Resolve | Free |
| Social cut | CapCut | Free |

**Total cost: $0** (or ~$20–30 if using Runway for premium B-roll shots)

---

## Production Phases

| Phase | Task | Manual Labor | Time Estimate |
|---|---|---|---|
| 1 | Storyboard already done (this doc) | None | Done |
| 2 | Build static HTML mockup pages | **Yes — you do this** | 1 day |
| 3 | Record mockups with OpenScreen | Light — mockups are scripted | 1–2 hours |
| 4 | B-roll generation on DGX Spark | Prompt setup only, runs unattended | 1–2 days |
| 5 | Music selection from Pixabay | Curation only (~15 min) | 15–30 min |
| 6 | Edit master cut in DaVinci Resolve | **Yes — you do this** | 2–3 days |
| 7 | Export cuts (5s ad, 30s social 9:16) | Mechanical once edit is done | Half day |

**Only two phases require real manual effort: building the mockups and the DaVinci Resolve edit.** Recording becomes trivial once mockups are built — no retakes, no real extension needed, no risk of third-party site layout changes.

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

#### Scene 7 — Close (1:05–1:15)
**Visual:** Final product shot — Icecap overlay on a listing, metrics visible, clean and confident. No logo, no CTA — the click-through to the waitlist site handles that.

**Text overlay (center, large, bold):**
```
Real estate math, at the speed of browsing.
```
*Fades in at 1:07, holds to end.*

**Music:** Resolves cleanly on the final beat.

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

---

## Static HTML Mockup Guide

Instead of recording the real product (which is at the mercy of third-party layouts, real data quality, and extension loading reliability), build self-contained HTML pages that look identical to the real thing but are fully controlled. Record those instead.

**Advantages:**
- Hardcode ideal metrics — all green checkmarks, clean numbers
- No extension, no Firestore, no network calls needed
- Animations are scripted — the overlay "reveals" on cue every time
- Zero retakes — it works the same way every recording

---

### File Structure

Create a `mockup/` folder at the repo root (do not ship this in any app build):

```
mockup/
  redfin.html       — fake Redfin listing with Icecap overlay
  zillow.html       — fake Zillow listing with Icecap overlay
  realtor.html      — fake Realtor.com listing with Icecap overlay
  hub.html          — fake Hub dashboard with saved deals + AI summary
  shared.css        — shared Icecap overlay styles across all listing pages
```

---

### Hardcoded Data to Use

Pick one fictional property and use it consistently across all listing mockups.

```
Address:    2847 Maplewood Drive, Austin, TX 78704
Price:      $485,000
Beds/Baths: 3 bed / 2 bath
Sq Ft:      1,620 sqft
Est. Rent:  $2,950/mo

Icecap Metrics:
  Cap Rate:    6.8%   ✓  (green)
  CoC Return:  9.2%   ✓  (green)
  1% Rule:     0.61   ~  (yellow — realistic, not all-green)
  GRM:         13.7
  Monthly NOI: $1,872
```

Using the same property across all three listing sites reinforces the "works everywhere" message without looking made-up.

---

### mockup/redfin.html

Build a simplified Redfin listing page. You do not need to replicate the full Redfin UI — just enough that it reads as "a property listing" to a viewer watching a 30s video.

**Must include:**
- Redfin logo (top left, use a simple text wordmark or SVG)
- A hero photo of the property (use a royalty-free house photo from Unsplash)
- Address, price, bed/bath/sqft stats in the standard listing card layout
- Redfin's characteristic red color (`#d9232d`) in the nav
- The Icecap sidepanel on the right side, **hidden by default**

**Icecap sidepanel behavior:**
- Hidden on page load (`display: none` or `opacity: 0`)
- Triggered by pressing `Space` or clicking a visible "Open Icecap" button (you'll cut the button out in editing)
- On trigger: panel slides in from the right, then each metric row fades in sequentially with a 300ms delay between rows
- Use CSS transitions, no JS libraries needed

**Metric row animation order:**
1. Panel slides in (200ms)
2. "Cap Rate 6.8% ✓" fades in (300ms delay)
3. "CoC Return 9.2% ✓" fades in (600ms delay)
4. "1% Rule 0.61 ~" fades in (900ms delay)
5. "GRM 13.7" fades in (1200ms delay)
6. "Monthly NOI $1,872" fades in (1500ms delay)

**Icecap panel style:** Match the real extension — white panel, Icecap blue (`#2563eb`) header, metric rows with label on left and value + badge on right. Green badge for ✓, yellow for ~.

---

### mockup/zillow.html and mockup/realtor.html

Same structure as `redfin.html` but reskinned for each platform:

**Zillow:** Blue nav (`#006aff`), Zillow logo, slightly different listing card layout. Same property, same Icecap panel.

**Realtor.com:** Red nav (`#d9232d`, different shade from Redfin), Realtor.com logo. Same property, same panel.

You only need the nav color, logo, and rough card layout to differ. The Icecap panel is identical on all three — that's the point.

---

### mockup/hub.html

A fake version of the Icecap Hub dashboard. Two views needed:

**View 1 — Deals List (for SR-6):**
- Nav with Icecap logo, "Portfolio", "Compare", "Settings" tabs
- A list/grid of 5–6 saved deal cards, each showing:
  - Property address (use realistic fake addresses)
  - Thumbnail photo
  - Key metric badges (Cap Rate, CoC)
  - A "Saved" timestamp
- One card highlighted/hovered

**View 2 — Deal Detail + AI Summary (for SR-7):**
- Shows the Maplewood Drive property in full detail
- Full metrics panel
- An "Analyze with AI" button
- Below the button: an empty text area that fills with a typewriter animation when the button is clicked

**AI summary typewriter content** (hardcode this, animate character-by-character at ~30ms/char):
```
This property at 2847 Maplewood Drive presents a compelling 
investment case. With a cap rate of 6.8% and cash-on-cash 
return of 9.2%, it outperforms the Austin market average by 
approximately 1.4 points. The 1% rule shortfall is typical 
for this submarket and is offset by strong appreciation 
trends. Recommended for buy-and-hold strategy.
```

Trigger: clicking "Analyze with AI" starts the typewriter. Build this with vanilla JS `setInterval`.

---

### Recording the Mockups with OpenScreen

Once all mockup pages are built, recording is fast and mechanical — one take per shot.

**OpenScreen setup:**
- Record window (not full screen)
- Enable cursor highlight + click visualization
- Output: MP4, 1440p

**Shot list:**

| ID | File | Trigger | Duration | Notes |
|---|---|---|---|---|
| SR-1 | Real Google Sheets | Type manually | 20s | Still use real Sheets for the pain scene — the messiness is the point |
| SR-2 | mockup/redfin.html | Press Space | 30s | Hero shot — let each metric row animate in fully |
| SR-3 | mockup/zillow.html | Press Space | 15s | Supporting shot |
| SR-4 | mockup/realtor.html | Press Space | 10s | Even shorter |
| SR-5 | mockup/hub.html (View 1) | Scroll + hover | 20s | Pan across deal cards |
| SR-6 | mockup/hub.html (View 2) | Click "Analyze with AI" | 15s | Let typewriter run to completion |

**For SR-2 (hero shot):** Use OpenScreen's zoom to punch into the Cap Rate row as it fades in. This is the single most important moment in the video — frame it so the metric fills ~60% of the zoomed frame.

---

## B-Roll Generation Prompts

Run locally on DGX Spark with HunyuanVideo 1.5 (via ComfyUI). Generate 5–10s clips, 8–10 total.

| # | Use In Scene | Prompt |
|---|---|---|
| BR-1 | Scene 1 | `Aerial drone shot slowly gliding over a quiet suburban neighborhood at golden hour, warm light on rooftops, green lawns, cinematic, photorealistic, smooth camera motion` |
| BR-2 | Scene 1 alt | `Wide establishing shot of a tree-lined residential street in autumn, soft sunlight, gentle camera drift, cinematic depth of field` |
| BR-3 | Scene 3 | `Close-up of hands typing on a laptop keyboard in a bright modern home office, clean desk, shallow depth of field, natural light` |
| BR-4 | Scene 3 alt | `Young professional at a minimal white desk looking at a laptop screen, focused expression, warm ambient light, cinematic` |
| BR-5 | Scene 7 / 5s ad | `Clean abstract background with subtle blue gradient, soft bokeh light particles drifting slowly, minimal, premium tech aesthetic` |
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
- Close (65–75s): static hold on product shot, tagline lands

---

## Export Settings

| Deliverable | Resolution | Format | Notes |
|---|---|---|---|
| Master | 1920×1080 | H.264 MP4 | Landing page |
| Ad cut | 1920×1080 | H.264 MP4 | 5s — problem + demo, no logo |
| Social (9:16) | 1080×1920 | H.264 MP4 | Reframed in CapCut from master |

---

## Cut Derivation

**5s ad cut:** Standalone — not derived from the master. Two shots only:
- 0:00–0:02: Text overlay "Is this listing a good deal?" over B-roll
- 0:02–0:05: Pre-zoomed Icecap overlay on a Redfin listing, one metric appearing (Cap Rate)
- No logo, no CTA — click-through handles it

**30s social cut (9:16):** Compress the master as follows:
- Scene 1 (hook): 0:00–0:05
- Scene 4 (demo, Redfin only): 0:05–0:18
- Scene 6 (Hub, abbreviated): 0:18–0:25
- Scene 7 (close): 0:25–0:30

Reframe in CapCut for vertical. Keep text in center 70% of frame height to avoid safe zone overlap.
