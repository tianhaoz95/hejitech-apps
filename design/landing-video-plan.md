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
| Screen recording | OpenScreen | Free |
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
| 2 | Screen recordings with OpenScreen | **Yes — you do this** | Half day |
| 3 | B-roll generation on DGX Spark | Prompt setup only, runs unattended | 1–2 days |
| 4 | Music selection from Pixabay | Curation only (~15 min) | 15–30 min |
| 5 | Edit master cut in DaVinci Resolve | **Yes — you do this** | 2–3 days |
| 6 | Export cuts (5s ad, 30s social 9:16) | Mechanical once edit is done | Half day |

**Only two phases require real manual effort: screen recording and the DaVinci Resolve edit.** Everything else is either automated or low-effort curation.

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

## Screen Recording Guide

This is the only phase that requires sustained manual effort. Follow each step exactly — the quality of these recordings determines the quality of the entire video.

### Before You Start (Do Once)

1. **Create a clean Chrome profile**
   - Open Chrome → top-right avatar → Add → name it "Icecap Demo"
   - Sign into the Icecap extension on this profile only
   - Hide the bookmarks bar: View → Always Show Bookmarks Bar → off
   - Remove all other extensions from this profile
   - Set zoom to 100% (Cmd+0)
   - Use a light system theme — no dark mode

2. **Set your display resolution**
   - Set to 1440p (2560×1440) or 1080p if that's your native res
   - Do not record at 4K — too much detail makes the UI hard to read on smaller screens

3. **Open OpenScreen**
   - Set to record a window (not full screen)
   - Enable cursor highlight
   - Enable click visualization
   - Set output to MP4

4. **Pre-pick your listings**
   Find and bookmark 3 real listings before you start recording:
   - One on Redfin with a cap rate likely above 5% (single-family or small multi)
   - One on Zillow, different property type
   - One on Realtor.com
   
   Pick listings with round, clean numbers. Avoid listings where the overlay would show all-red or broken metrics — you want green checkmarks on screen.

5. **Pre-seed the Hub**
   Make sure the Icecap Hub already has 4–6 saved deals before recording Scene 6. The portfolio view should look full and active, not empty.

---

### SR-1 — The Spreadsheet Pain (Scene 2) — ~20s

This is the "before" moment. Make it feel slow and tedious.

**Steps:**
1. Open a new browser tab and navigate to a Redfin listing (the same one you'll use in SR-3)
2. Start recording
3. Open a new tab → go to Google Sheets → open a blank sheet
4. Click cell A1, type "Purchase Price" slowly
5. Tab to B1, switch back to the Redfin tab, find the price, switch back, type it in
6. Click A2, type "Monthly Rent Estimate" slowly
7. Switch to the Redfin tab again, look around as if searching for rent data, switch back
8. Type a rough number in B2
9. Open a new tab, type "cap rate formula real estate" in the search bar — stop there, don't press enter
10. Stop recording

**What to capture:** The tab-switching, the manual typing, the searching. Don't rush. Every moment of friction is content.

---

### SR-2 — Extension Install (Scene 3) — ~15s

**Steps:**
1. On the clean Chrome profile, make sure the Icecap extension is already installed but temporarily disabled (Chrome → Extensions → toggle off)
2. Start recording
3. Open a new tab → navigate to the Chrome Web Store (search "Icecap" or go direct)
4. Click "Add to Chrome" — pause 1 second — click "Add extension" on the dialog
5. Wait for the success toast to appear
6. Slowly move your cursor to the toolbar — the Icecap icon should be there
7. Click the icon once to open the sidepanel briefly, then stop recording

**What to capture:** The install button click, the dialog, the icon appearing. Keep the cursor movement slow and deliberate.

---

### SR-3 — Redfin Demo (Scene 4) — ~30s

This is the hero moment of the whole video. Take multiple takes.

**Steps:**
1. Open the Redfin listing you pre-picked. Make sure the page is fully loaded before recording.
2. Start recording with the listing already visible — don't show navigation to it
3. Wait 1 full second (static hold)
4. Slowly scroll down the listing just slightly — enough to show you're on a real page
5. Click the Icecap extension icon in the toolbar
6. Wait for the overlay/sidepanel to fully load — do not cut this short, let every metric appear
7. Once all metrics are visible, hold still for 3 seconds
8. Use OpenScreen's zoom: click to zoom into the cap rate metric specifically, hold 2s, zoom back out
9. Stop recording

**What to capture:** The overlay appearing and populating. The zoom-in on the cap rate number is the single most important shot in the video.

**Take at least 3 takes.** Use the one where the overlay loads cleanest and the metrics look best.

---

### SR-4 — Zillow Demo (Scene 5) — ~15s

**Steps:**
1. Open the Zillow listing you pre-picked. Page fully loaded before recording.
2. Start recording — listing already visible
3. Wait 1 second
4. Click the Icecap icon
5. Let overlay load, hold for 2s once complete
6. Stop recording

Shorter and faster than SR-3 — this is a supporting shot to show cross-site support, not the hero.

---

### SR-5 — Realtor.com Demo (Scene 5 continued) — ~10s

Same as SR-4 but even faster. Just enough to show the overlay appears on Realtor.com too.

**Steps:**
1. Open the Realtor.com listing. Already loaded before recording.
2. Start recording
3. Click the Icecap icon immediately
4. Let overlay load, hold 2s
5. Stop recording

---

### SR-6 — Hub Portfolio View (Scene 6) — ~20s

**Steps:**
1. Open the Icecap Hub in a full browser tab. Make sure 4–6 deals are already saved.
2. Start recording — Hub already open on the deals/portfolio list
3. Slowly scroll down the list so all saved deals are visible
4. Move cursor to one of the deals and hover (don't click) — let the hover state show
5. Click into one deal to show its detail view — pause 2s
6. Hit back to return to the list
7. Stop recording

**What to capture:** A full, active portfolio. The viewer needs to see this isn't an empty demo — it's a real tool people are using.

---

### SR-7 — AI Deal Summary (Scene 6 continued) — ~15s

Record this as a separate clip from SR-6.

**Steps:**
1. Open one of the saved deals in the Hub
2. Start recording — deal detail view already open
3. Find the "AI Summary" or "Analyze Deal" button — pause 1 second before clicking
4. Click it
5. Let the AI summary generate in real time — do not cut while it's generating
6. Once complete, hold for 2s so the viewer can see the output
7. Stop recording

**What to capture:** The generation happening live. This is the most impressive moment in the Hub section — the real-time generation is the point.

---

### Shot Summary

| ID | Scene | Target Duration | Takes |
|---|---|---|---|
| SR-1 | Spreadsheet pain | 20s | 1–2 |
| SR-2 | Extension install | 15s | 1–2 |
| SR-3 | Redfin overlay | 30s | 3+ (pick best) |
| SR-4 | Zillow overlay | 15s | 1–2 |
| SR-5 | Realtor.com overlay | 10s | 1–2 |
| SR-6 | Hub portfolio | 20s | 1–2 |
| SR-7 | AI summary generation | 15s | 1–2 |

**Total recording session: ~2–3 hours including setup and retakes.**

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
