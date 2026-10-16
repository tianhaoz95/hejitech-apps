# Voxbrief Watch OS & Wear OS UI Redesign Studio (Paged Swipe Architecture)

Interactive redesign exploration and candidate visualization tool for Voxbrief's next-generation **watchOS (Apple Watch Ultra, Series 10)** and **Wear OS (Pixel Watch 3, Galaxy Watch 7/Ultra)** companion apps.

Focused specifically on **Horizontal Paged Swipe Architecture (Capture ⟷ Vault)** with **Tag-First Quick Triage** (defaulting to `✨ Auto`) and a dedicated **watchOS Settings Page**.

---

## 🎯 Core Requirements & Improvements in This Set

1. **Horizontal Paged Swipe Architecture (Capture ⟷ Vault)**:
   - **Zero cramped tab bars**: Eliminates top tab segments that consume ~32px of valuable vertical screen height on small watch displays.
   - **Page 1 (Capture)**: 100% of the screen is dedicated to instant voice capture, default auto-tag intent (`✨ Auto`), and optional override chips.
   - **Page 2 (Vault & Settings)**: Reached seamlessly via natural horizontal swipe (SwiftUI `TabView(style: .page)` / Wear OS `HorizontalPager`) or page dot taps (`[ ● ○ ]`).
2. **Bespoke Voxbrief Brand Complications ("V-Wave" Monogram)**:
   - Replaced generic SF Symbols (`mic.fill`, `waveform`) with a proprietary **Voxbrief "V-Wave" Brand Mark**: a geometric `V` whose left arm acts as a sleek diagonal stem and right arm unfolds into stepped audio frequency equalizer bars.
   - 20 distinct geometric interpretations across the candidates.
3. **Tag Defaults to "✨ Auto" Across All Candidates**:
   - Zero decision fatigue: the default capture mode is always `✨ Auto` (Auto-Detect). The user can tap and speak immediately without choosing a category.
   - The on-device WhisperKit ASR and Qwen3 copywriting pipeline (`LLMCopywriterService`) automatically infers whether the speech represents requirements, meeting notes, or actionable tasks.
4. **Dedicated WatchOS Settings Page & Watch-Friendly Sync**:
   - Low-frequency diagnostics, background sync controls (`WCSession` status, pending sync count), storage cache purge, and haptic preferences are housed in a dedicated Settings page accessible via a top gear icon (⚙️) inside the Vault.
   - All buttons are large, touch-friendly watch capsules (minimum 28px–32px height) with active tactile feedback.
5. **Pure Flat Simplicity (Zero 3D Effects)**:
   - Pure OLED blacks (`#000000`), crisp vector lines, and zero fake glass, specular gloss, or heavy drop shadows.

---

## 🚀 How to Run the Visualizer Locally

Run the launcher script in `./reports/watch-ui-redesign/script/`:

```bash
./reports/watch-ui-redesign/script/serve.sh
```

Or run via Python directly:

```bash
python3 ./reports/watch-ui-redesign/script/serve.py
```

- **Interactive Swipe Simulation**: Drag left/right with your mouse or finger directly inside the watch display to swipe between **Page 1 (Capture)** and **Page 2 (Vault)**!
- **Auto Port Discovery**: Automatically selects an available port (defaults to `8080`, falls back to `8081+`).
- **Auto Browser Launch**: Automatically opens your default web browser on macOS (`http://localhost:8080`).

---

## 🧭 The 20 Focused Candidates (Paged Swipe + Auto Triage + Bespoke V-Wave)

### Paradigm 1: Paged Swipe Fusions (#01 - #04)
- **#01 Paged Swipe Architecture (Auto-First)**: Native watchOS paged swipe (`Capture ⟷ Vault`) with tag rail defaulting to `✨ Auto`; zero cramped tab bars.
- **#02 Tag-First Quick Triage (Paged Swipe)**: Contextual tag strip pinned above large mic; swipe left for vault and folded settings.
- **#03 Paged Swipe + Quick Tag Bar (Auto | Idea | Task)**: Vault is moved off the tab bar into Page 2 via swipe, giving the 3 tags ample space to be easily tapped without cramping.
- **#04 Dynamic Header Capsule (Swipeable)**: Balanced header capsule defaulting to `✨ Auto` with page dots; swipe left for Vault with folded Settings.

### Paradigm 2: Layered Rails (#05 - #08)
- **#05 Pinned Segment with Auto Sub-Rail**: Pinned top control (`Capture | Vault`) with compact sub-rail highlighting active `✨ Auto` intent. V-Wave Beacon complication.
- **#06 Crown Rotary Dial (Auto Resting)**: Digital Crown / rotary bezel defaults to `✨ Auto`, allowing tactile detent cycling through override tags. Split-Pill V-Wave complication.
- **#07 Intent-Segmented Matrix (`Auto | Task | Meeting | Vault`)**: Direct output format selector defaulting to AI auto-structuring. Folded settings drawer inside Vault. Diamond Core V-Wave complication.
- **#08 Split Horizon Pad (Auto Intent + Tap Anywhere)**: Top half shows active Auto intent pill and tag switcher; bottom half is an expansive tap-anywhere capture pad. Arc Radar V-Wave complication.

### Paradigm 3: Adaptive & Capsules (#09 - #12)
- **#09 Dynamic Capsule Segment (Auto-Active Island)**: Dynamic Island capsule displaying `[✨ Auto]` that expands on tap for manual triage. Vault features folded sync strip. Waveform Monogram complication.
- **#10 Bento Studio Grid (Header + Auto Bento Tile)**: Asymmetric bento grid with `✨ Auto` active hero card and folded settings header button in Vault. Minimalist Outline V-Wave complication.
- **#11 Swiss Typographic Tabs (`AUTO • IDEA • TASK // VAULT`)**: Stark typographic hierarchy with `AUTO` highlighted. Monospaced timer and folded diagnostics. Swiss Dual-Bar V-Wave complication.
- **#12 Circular Bezel Arc Segment**: Peripheral circular arc segments optimized for round bezels (Pixel Watch / Galaxy Watch) with top arc on Auto. Orbital Ring V-Wave complication.

### Paradigm 4: Workflow & Ingest (#13 - #16)
- **#13 Dual-Context Filter (Auto Mode + Vault Folded Settings)**: Dual synchronization where recording in Auto structures the note, and Vault filters by AI tags with folded Settings button. Studio Sound V-Wave complication.
- **#14 Smart Status Segment (`[✨ Auto] | Ready [●]`)**: Left half shows active Auto mode; right half shows real-time WCSession sync readiness. Pulse Dot V-Wave complication.
- **#15 Slide-Up Tag Palette (Auto-Primed Sheet)**: Top segment controls `Capture | Vault`, resting in Auto mode with an optional pull-tab for expansive tag drawer. Gradient Fade V-Wave complication.
- **#16 Chromatic Spectrum (Auto Dynamic Scope)**: Electric cyan oscilloscope active in Auto mode, dynamically shifting tint if manual tags are selected. Vector Crown V-Wave complication.

### Paradigm 5: High-Speed & Power (#17 - #20)
- **#17 AI Pipeline Preset (`Auto AI | Fast Whisper | Deep Qwen`)**: Direct pipeline preset segment defaulting to balanced Auto AI processing. Neural Spark V-Wave complication.
- **#18 Technical Hairline Studio (1px Precision + Auto Dock)**: Precision 1px vector lines with centered Auto reticle and folded Settings drawer in Vault. Linear Hairline V-Wave complication.
- **#19 Instant Auto-Trigger (1-Tap Direct Record)**: Giant primary button captures in Auto mode instantly, with quick override chips underneath. Lightning Trigger V-Wave complication.
- **#20 HUD Corner Tag Matrix (Center Auto + Folded Settings)**: Four peripheral corner anchors for manual tags, leaving central 85% of display for giant Auto capture hero and folded Settings in Vault. Viewfinder HUD V-Wave complication.

---

## 🛠️ Studio Features

- **All 4 Screens on One Screen (Default View)**:
  - Simultaneously displays all 4 states together side-by-side:
    1. **`1. Idle / Daily`**: Interactive screen with live recording trigger.
    2. **`2. Recording Spec`**: The bespoke audio-reactive capture screen with live waveforms & timer.
    3. **`3. Secondary Vault`**: The separated screen for note playback, sync logs, and iPhone connectivity.
    4. **`4. Complications & Tile`**: Authentic Watch Face Complications Suite (Modular, Circular, Corner) with bespoke icon geometry.
- **Interactive Live Recording on Screen 1**:
  - Tap the microphone on Screen 1 to begin recording live with active animated waveforms, real-time timer counting, and stop button.
- **Hardware Bezel Switcher**:
  - Apple Watch Ultra 2 (Titanium case)
  - Apple Watch Series 10 (Edge-to-edge curved OLED)
  - Pixel Watch 3 (Circular 360° display)
  - Galaxy Watch 7 / Ultra (Cushion case circular display)
- **Side-by-Side Comparison Mode**:
  - Compare any two candidates simultaneously with synchronized states.
- **Rating & Shortlisting**:
  - 1–5 star ratings and shortlist bookmarks persisted in browser `localStorage`.
- **Export Evaluation Report**:
  - Generates a Markdown report of your ratings and shortlist for easy sharing and roadmap planning.
