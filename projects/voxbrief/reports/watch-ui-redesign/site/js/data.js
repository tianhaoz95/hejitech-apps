/**
 * Voxbrief Watch OS & Wear OS UI Redesign
 * 20 NEW Focused Candidates: Top Segmented Switcher + Tag-First Quick Triage Fusions
 * Incorporating: 1. Bespoke Voxbrief Brand Complications, 2. Default ✨ Auto Tag, 3. Folded Settings
 * Designed specifically for Voxbrief: Native iOS Continuity, Flat Simplicity, Zero 3D Effects
 */

const CANDIDATES = [
  {
    "id": 1,
    "name": "Paged Swipe Architecture (Auto-First)",
    "paradigm": "Paged Swipe",
    "tagline": "WatchOS paged swipe (Capture ⟷ Vault) with tag rail defaulting to ✨ Auto; zero cramped tabs",
    "accentColor": "#00E5FF",
    "accentGradient": "linear-gradient(135deg, #00E5FF, #0070F3)",
    "iosContinuity": "Direct Baseline (Native Pager)",
    "iosComponentMapping": "Maps to watchOS TabView(style: .page) and iOS UIPageViewController.",
    "iosBackportIdea": "Adopt a clean two-page swipe architecture on iOS between Quick Record and Recent Notes.",
    "secondaryStrategy": "Horizontal paged swipe (TabView .page): Page 1 is 100% dedicated to Capture. Swiping left glides seamlessly to Page 2 (Vault), where a header gear icon (⚙️) opens the Settings page.",
    "primaryScreenDescription": "WatchOS page dots [ ● ○ ] with 'Vault (4) ›' hint. Below is a slim tag strip defaulting to '✨ Auto' (Idea, Task overrides) and centered large mic disc.",
    "recordingStateDescription": "Active banner 'RECORDING [AUTO-DETECT]' with AI intent analysis, electric cyan oscilloscope, mono timer, and flat red stop button.",
    "secondaryViewDescription": "Page 2 reached via swipe left: scrollable memo vault with tag badges (Auto/Idea/Task), sync checkmarks, and top Settings (⚙️) button.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Classic monogram: left diagonal arm meeting 3 stepped vertical audio frequency bars",
      "rectangular": "Modular widget with Voxbrief V-Wave brand mark, 'AUTO READY', and synced count",
      "corner": "Curved corner V-Wave glyph with 'VOX AUTO' label",
      "inline": "VOX [✨ Auto] • Ready",
      "wearOsTile": "Dual-segment Wear OS tile with direct V-Wave capture button"
    },
    "watchOsAdaptation": "TabView with .tabViewStyle(.page); tag selector defaults to .auto; Settings opens via NavigationLink.",
    "wearOsAdaptation": "HorizontalPager in Wear OS Compose with default AutoChip selected.",
    "bestFor": "Users who want zero friction: 1 tap to record with AI auto-detecting format, and natural swipe to browse notes.",
    "pros": [
      "100% of vertical display dedicated to large capture controls without wasting ~32px on tab bars",
      "Native watchOS TabView .page swipe gesture feels fluid and natural on wrist",
      "Defaults to 'Auto' so you speak immediately with zero decision fatigue"
    ],
    "cons": [
      "Requires horizontal swipe gesture instead of static tab buttons"
    ]
  },
  {
    "id": 2,
    "name": "Tag-First Quick Triage (Paged Swipe)",
    "paradigm": "Paged Swipe",
    "tagline": "Horizontal tag strip pinned above mic, resting on ✨ Auto; swipe left for vault and folded settings",
    "accentColor": "#FF9F0A",
    "accentGradient": "linear-gradient(135deg, #FF9F0A, #FF375F)",
    "iosContinuity": "High Progressive (AI Intent)",
    "iosComponentMapping": "Direct watchOS extension of iOS VoiceNote tag metadata and LLMCopywriterService auto-tagging prompts.",
    "iosBackportIdea": "Introduce an Auto-first tag chip bar above the iOS record button to preview what the Stage 2 LLM pipeline will extract.",
    "secondaryStrategy": "Page 2 reached via horizontal swipe left (or tapping the top dots), separating audio playback and connection settings from daily capture.",
    "primaryScreenDescription": "Page dots [ ● ○ ], horizontal tag row resting on [✨ Auto] (with Idea, Task, Meet options), large central capture disc, and bottom swipe hint.",
    "recordingStateDescription": "Top banner displays 'AI AUTO-STRUCTURING', pulsing amber soundwave dots, live mono timer, and flat red stop button.",
    "secondaryViewDescription": "Vault feed categorized by detected tags, with top right gear icon opening folded settings (WCSession sync, haptic clicks, cache purge).",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Convergent mark: symmetrical audio frequency bars tapering into a sharp V vertex",
      "rectangular": "Modular card with V-Wave convergent monogram, 'AI AUTO', and memo count",
      "corner": "Curved V-Wave corner badge with active Auto indicator",
      "inline": "VOX [Auto] • 4 Synced",
      "wearOsTile": "Tag-first Wear OS tile with Auto chip pre-selected and one-tap record"
    },
    "watchOsAdaptation": "TabView with .tabViewStyle(.page); horizontal tag ScrollView defaulting to .auto.",
    "wearOsAdaptation": "HorizontalPager with ChipRow in Wear OS Compose.",
    "bestFor": "Users who value AI automation but occasionally want to force a specific tag like Meeting or Checklist.",
    "pros": [
      "Rests on 'Auto' so capture remains 100% instant",
      "Manual overrides (Idea, Task) available in 1 tap right above the mic",
      "Swipe separates capture from playback with zero tab bar clutter"
    ],
    "cons": [
      "Horizontal chip row requires thumb scrolling if custom user tags are added"
    ]
  },
  {
    "id": 3,
    "name": "Paged Swipe + Quick Tag Bar (Auto | Idea | Task)",
    "paradigm": "Paged Swipe",
    "tagline": "WatchOS paged swipe separates Capture from Vault, freeing the top bar for a spacious 3-tag selector",
    "accentColor": "#1E6BF0",
    "accentGradient": "linear-gradient(135deg, #1E6BF0, #3894FA)",
    "iosContinuity": "Direct Baseline (Swipe Navigation)",
    "iosComponentMapping": "Combines iOS SwiftUI TabView .page with VoiceNote auto-classification architecture.",
    "iosBackportIdea": "Replace the static title in iOS QuickRecordSheet with a 3-tag pill selector, swiping down for vault.",
    "secondaryStrategy": "Vault is cleanly moved off the top tab bar into Page 2 via horizontal swipe, leaving the top bar uncluttered for tag selection.",
    "primaryScreenDescription": "Top page dots [ ● ○ ], spacious 3-tag selector [ ✨ Auto | Idea | Task ], and royal cobalt mic disc ready for instant capture.",
    "recordingStateDescription": "Header highlights 'RECORDING [AUTO]', live multi-stop Siri gradient waveform, running timer, and flat stop square.",
    "secondaryViewDescription": "Directly accessible via swipe left; clean list of saved memos with tag badges, sync checkmarks, and top Settings (⚙️) button.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Squircle: signature Voxbrief blue rounded squircle enclosing the white V-Wave sound monogram",
      "rectangular": "Modular widget with V-Wave squircle badge, 'VOXBRIEF AUTO', and synced status",
      "corner": "V-Wave corner notch icon with VOX label",
      "inline": "VOX: [✨ Auto] Ready",
      "wearOsTile": "Swipeable Wear OS interactive tile with direct capture launcher"
    },
    "watchOsAdaptation": "TabView with .tabViewStyle(.page), tag selector defaulting to .auto.",
    "wearOsAdaptation": "HorizontalPager with 3-segment TagRow in Wear OS Compose.",
    "bestFor": "Users who want one unified capture screen that handles auto-tagging and manual overrides without cramping the vault.",
    "pros": [
      "Moving Vault to swipe gives the 3 tags ample space to be easily tapped",
      "Defaults to 'Auto' for zero-friction daily voice capture",
      "Settings neatly folded into Vault header without cluttering capture"
    ],
    "cons": [
      "Vault is reached via horizontal swipe rather than a visible tab on Page 1"
    ]
  },
  {
    "id": 4,
    "name": "Dynamic Header Capsule (Swipeable)",
    "paradigm": "Paged Swipe",
    "tagline": "Balanced header capsule defaulting to ✨ Auto with page dots; swipe left for Vault with folded Settings",
    "accentColor": "#AF52DE",
    "accentGradient": "linear-gradient(135deg, #AF52DE, #5E5CE6)",
    "iosContinuity": "High Progressive (Split Action)",
    "iosComponentMapping": "Maps to iOS split navigation bar with Menu button on left and NavigationLink on right.",
    "iosBackportIdea": "Adopt this balanced split header in the iPhone recording sheet for quick context selection without obscuring the audio wave.",
    "secondaryStrategy": "Right segment is 'Vault (4)'. Tapping it opens the memos list with a folded Settings drawer for WCSession sync, haptics, and cache cleanup.",
    "primaryScreenDescription": "Split top bar: [ \u2728 Auto \u25be ] on left, [ \ud83d\udcc1 Vault (4) ] on right. Center stage is a large flat capture disc with resting soundwave.",
    "recordingStateDescription": "Pinned active tag pill '\u2728 Auto', vibrant purple audio wave cluster, live timer, and flat stop square.",
    "secondaryViewDescription": "Full memo feed accessed by tapping the right 'Vault' segment, complete with search, sync logs, and a dedicated Settings (\u2699\ufe0f) page.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Chevron: sharp vector chevrons forming a dynamic voice funnel converging at the base",
      "rectangular": "Split modular card: left side shows V-Wave monogram, right side shows sync health",
      "corner": "V-Wave chevron corner bracket with VOX text",
      "inline": "VOX: \u2728 Auto \u2022 4 Memos",
      "wearOsTile": "Split pill Wear OS tile with instant record and vault buttons"
    },
    "watchOsAdaptation": "Menu on left segment defaulting to 'Auto', NavigationLink on right segment inside a ToolbarItem.",
    "wearOsAdaptation": "Two-slot SplitButton component with Material 3 styling.",
    "bestFor": "Users who want a clean 2-button header that defaults to Auto while supporting unlimited custom tags in the dropdown.",
    "pros": [
      "Clean 50/50 visual balance on both squircle and circular displays",
      "Supports unlimited tags via the left dropdown without crowding the header",
      "Right tab displays live saved memo count and folded settings"
    ],
    "cons": [
      "Changing tag away from Auto requires tapping the dropdown menu"
    ]
  },
  {
    "id": 5,
    "name": "Pinned Segment + Sub-Tag Rail (Auto Default)",
    "paradigm": "Layered Rails",
    "tagline": "Two-tier hierarchy: primary top segment switches Capture vs. Vault, micro-tag rail sits below resting on \u2728 Auto",
    "accentColor": "#30D158",
    "accentGradient": "linear-gradient(135deg, #30D158, #00E5FF)",
    "iosContinuity": "Direct Baseline (Hierarchy Mirror)",
    "iosComponentMapping": "Direct equivalent to iOS segmented control with secondary category filter rail.",
    "iosBackportIdea": "Provide this exact two-level layout on iOS for categorizing notes inside the recording sheet.",
    "secondaryStrategy": "Top segment toggles 'Capture' and 'Vault'. Settings (manual sync, cache cleanup, haptics) are folded into a dedicated tab inside Vault.",
    "primaryScreenDescription": "Tier 1: [ Capture | Vault ]. Tier 2: Micro-chips [ \u25cf Auto | Idea | Task ]. Center: Royal green capture disc.",
    "recordingStateDescription": "Active green waveform bars, running mono timer, 'AUTO' intent tag, and full-width flat red stop button.",
    "secondaryViewDescription": "Vault view where the sub-tag rail turns into a filter rail to browse notes by category, with Settings folded at the top.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Beacon: solid left stroke + 4 vertical frequency bars forming an illuminated V",
      "rectangular": "Two-line modular complication with V-Wave beacon and 'AUTO READY' status",
      "corner": "Step-ladder V-Wave corner icon with VOX label",
      "inline": "VOX: Cap/Auto \u2022 Synced",
      "wearOsTile": "Two-tier glanceable tile with mode switch and tag triggers"
    },
    "watchOsAdaptation": "VStack with segmented Picker and horizontal ScrollView of Capsule chips defaulting to .auto.",
    "wearOsAdaptation": "TabRow with secondary HorizontalChipCarousel.",
    "bestFor": "Users who appreciate structured visual hierarchy and want tags to filter the vault as well as tag recordings.",
    "pros": [
      "Tag rail defaults to Auto, requiring zero interaction to record immediately",
      "Tag rail does double-duty: tags recordings on Capture tab, filters notes on Vault tab",
      "Settings neatly isolated from daily capture"
    ],
    "cons": [
      "Uses slightly more vertical space (~50px total header height)"
    ]
  },
  {
    "id": 6,
    "name": "Tag-Segmented Crown Switcher (Auto Snapped)",
    "paradigm": "Layered Rails",
    "tagline": "Digital Crown physically clicks through segmented tag categories, snapping to \u2728 Auto as initial home position",
    "accentColor": "#0A84FF",
    "accentGradient": "linear-gradient(135deg, #0A84FF, #5E5CE6)",
    "iosContinuity": "High Progressive (Rotary Input)",
    "iosComponentMapping": "watchOS-native rotary interaction translating into iOS swipeable tab view.",
    "iosBackportIdea": "Use horizontal swipe gestures on the iPhone record button to flick between triage tags with haptic ticks.",
    "secondaryStrategy": "Rotating the crown all the way to the right scrolls into Vault; a gear icon at the bottom of the vault opens folded settings.",
    "primaryScreenDescription": "Segmented tag bar resting on [\u2728 Auto]. Turning the Digital Crown jumps between Auto, Idea, Task, and Vault with haptic clicks.",
    "recordingStateDescription": "Locked 'AUTO' tag badge, high-contrast blue wave envelope, giant live mono timer, and flat red stop square.",
    "secondaryViewDescription": "Smoothly reached by rotating the crown to the last segment; displays memo archive with folded settings sheet.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Rotary: circular dial with inset V soundwave cutouts and notch ticks",
      "rectangular": "Modular card with rotary V-Wave progress bar and active Auto tag",
      "corner": "Crown indicator arc with V monogram",
      "inline": "VOX [Crown: Auto]",
      "wearOsTile": "Rotating bezel-optimized Wear OS tile with rotary tag snapping"
    },
    "watchOsAdaptation": "SwiftUI .digitalCrownRotation() with haptic feedback (.selection) defaulting index to 0 (.auto).",
    "wearOsAdaptation": "Rotary input handler modifier on Wear OS Compose component.",
    "bestFor": "Users who love tactile hardware controls (Digital Crown on Apple Watch, rotating bezel on Galaxy Watch).",
    "pros": [
      "Snaps to Auto on launch for instant capture without touching the screen",
      "Satisfying tactile haptic click when rotating between categories",
      "Keeps the screen clean since fingers don't block the display while scrolling"
    ],
    "cons": [
      "Requires familiarity with Digital Crown or rotating bezel navigation"
    ]
  },
  {
    "id": 7,
    "name": "Action-Outcome Segment (Auto | Note | Task | Brief)",
    "paradigm": "Layered Rails",
    "tagline": "Outcome-oriented top segments: defaults to \u2728 Auto-Detect, with overrides for Quick Note, Checklist, or Executive Brief",
    "accentColor": "#FF375F",
    "accentGradient": "linear-gradient(135deg, #FF375F, #FF9F0A)",
    "iosContinuity": "High Progressive (LLM Directive)",
    "iosComponentMapping": "Maps directly to LLMCopywriterService prompt formatting directives.",
    "iosBackportIdea": "Expose outcome format buttons on iOS so users specify note formatting style before recording.",
    "secondaryStrategy": "Vault is the rightmost segment. Folded Settings page lets users configure custom prompt templates for each outcome mode.",
    "primaryScreenDescription": "Top segmented bar [ \u2728 Auto | Note | Todo | Brief ]. 'Auto' is selected by default. Center is large flat magenta capture button.",
    "recordingStateDescription": "Template badge 'AI DETERMINING OUTCOME FORMAT', magenta audio frequency bars, running timer, and stop button.",
    "secondaryViewDescription": "Notes archive showing icons representing which output format was generated, with folded Settings for AI templates.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Checklist: left stroke forms a V, right stroke forms an audio checkmark",
      "rectangular": "Modular complication showing V-Wave checklist mark, 'AUTO FORMAT', and sync status",
      "corner": "V-Wave checklist corner glyph with VOX text",
      "inline": "VOX: Format [Auto] Ready",
      "wearOsTile": "Outcome-driven Wear OS quick launch tile with direct format buttons"
    },
    "watchOsAdaptation": "SwiftUI Picker with .segmented style, defaultSelection: .autoFormat.",
    "wearOsAdaptation": "Material 3 SegmentedButton with custom iconography.",
    "bestFor": "Users who rely heavily on on-device LLM copywriting and want the AI to automatically pick or manually override output templates.",
    "pros": [
      "Defaults to Auto so the on-device AI decides whether bullets or checklists fit best",
      "Manual overrides available right in the top bar when specific output is required",
      "Settings neatly holds model tier and prompt customizations"
    ],
    "cons": [
      "Adds cognitive decision of outcome format prior to capturing"
    ]
  },
  {
    "id": 8,
    "name": "Split Horizon 50/50 (Auto Tag Grid / Massive Mic)",
    "paradigm": "Layered Rails",
    "tagline": "Ergonomic 50/50 split: top half is a 2x2 segmented context grid with \u2728 Auto active; bottom half is a massive capture pad",
    "accentColor": "#007AFF",
    "accentGradient": "linear-gradient(135deg, #007AFF, #5856D6)",
    "iosContinuity": "High Progressive (Ergonomic Split)",
    "iosComponentMapping": "Translates to a split-card layout in iOS QuickRecordSheet.",
    "iosBackportIdea": "Provide this thumb-friendly split interface on iPhone for reliable 1-handed capture on the go.",
    "secondaryStrategy": "One of the 4 segmented tiles in the top half is 'Vault (4)'. Tapping it opens the archive, with folded Settings accessible at the bottom.",
    "primaryScreenDescription": "Top 50%: 2x2 grid [ \u2728 Auto | \ud83d\udca1 Idea ] [ \ud83d\udccb Task | \ud83d\udcc1 Vault ]. Auto active by default. Bottom 50%: Giant thumb-friendly record pad.",
    "recordingStateDescription": "Top 50% turns into big timer and 'AUTO-STRUCTURING' badge; bottom 50% becomes an oversized red stop button.",
    "secondaryViewDescription": "Full-screen vault feed with large readable note rows and folded Settings button for sync diagnostics.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Split Horizon: split circle with top V-Wave sound bars and solid lower hemisphere",
      "rectangular": "Modular widget with V-Wave split horizon and Auto status",
      "corner": "Split angle V-Wave corner glyph with VOX text",
      "inline": "VOX [Auto: Split] Ready",
      "wearOsTile": "Split 50/50 Wear OS tile with tag buttons on top, giant mic on bottom"
    },
    "watchOsAdaptation": "VStack(spacing: 0) with top LazyVGrid defaulting to .auto selection, bottom Button taking full remaining frame.",
    "wearOsAdaptation": "Column layout with two equal 1.weight() sections in Compose.",
    "bestFor": "Users capturing voice memos while running, walking, or wearing gloves who need giant hit targets.",
    "pros": [
      "Impossible to miss the record button: bottom half is 100% hitzone",
      "Top half defaults to Auto, meaning zero setup needed before tapping",
      "Settings and sync management folded cleanly into the Vault tile"
    ],
    "cons": [
      "Differs visually from traditional centered-circle watch layouts"
    ]
  },
  {
    "id": 9,
    "name": "Dynamic Capsule Segment (\u2728 Auto \u2022 Synced)",
    "paradigm": "Adaptive & Capsules",
    "tagline": "Dynamic Island on watch: top segmented capsule displays \u2728 Auto by default and expands into tag/settings sheet on tap",
    "accentColor": "#32ADE6",
    "accentGradient": "linear-gradient(135deg, #32ADE6, #007AFF)",
    "iosContinuity": "Direct Baseline (Dynamic Island Mirror)",
    "iosComponentMapping": "Direct watchOS translation of iOS Dynamic Island / Live Activity VoiceNoteActivityAttributes.",
    "iosBackportIdea": "Unify the Live Activity capsule presentation on iPhone lockscreen with this watch top capsule.",
    "secondaryStrategy": "Tapping the top capsule smoothly expands a segmented sheet to switch tags, open the memo vault, or access folded Settings.",
    "primaryScreenDescription": "Top dynamic capsule showing [ ✨ Auto • 4 Synced ]. Center hosts clean, prominent primary mic disc.",
    "recordingStateDescription": "Capsule expands into a live audio meter with active timer, while center shows pulsating waveform and red stop button.",
    "secondaryViewDescription": "Vault revealed smoothly from the expanded capsule, with folded Settings for connection health and cache purge.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Capsule: miniature dynamic pill enclosing the bespoke V-Wave sound mark",
      "rectangular": "Modular card mimicking the Dynamic Island recording state with V-Wave icon",
      "corner": "Curved capsule corner badge with V-Wave monogram",
      "inline": "VOX: [\u2728 Auto \u2022 4M]",
      "wearOsTile": "Dynamic pill Wear OS tile with smooth expand animation"
    },
    "watchOsAdaptation": "SwiftUI matchedGeometryEffect() transitioning top capsule into modal settings/tag picker.",
    "wearOsAdaptation": "AnimatedContent / ExpandableCard in Wear OS Compose.",
    "bestFor": "Users who love modern iOS Dynamic Island aesthetics and fluid micro-animations.",
    "pros": [
      "Rests on 'Auto' so you never need to tap the capsule unless you want to override",
      "Extremely compact resting state gives maximum screen space to the capture hero",
      "100% visual consistency with iOS Live Activity and Dynamic Island"
    ],
    "cons": [
      "Changing tag away from Auto requires tapping capsule first"
    ]
  },
  {
    "id": 10,
    "name": "Bento Segment Grid (Auto-Tag Hero + Settings Tile)",
    "paradigm": "Adaptive & Capsules",
    "tagline": "Apple Bento Grid: top segmented bar (Studio | Vault) over modular bento tiles with \u2728 Auto pre-selected",
    "accentColor": "#34C759",
    "accentGradient": "linear-gradient(135deg, #34C759, #30B0C7)",
    "iosContinuity": "High Progressive (Bento Grid)",
    "iosComponentMapping": "Maps to iOS 18 Control Center and WidgetKit bento layouts.",
    "iosBackportIdea": "Bring this modular bento dashboard to the iOS app home tab for simultaneous capture, tagging, and sync monitoring.",
    "secondaryStrategy": "The top segment switches between 'Studio' and 'Vault'. Settings (sync diagnostics, storage purge, haptics) are folded into a dedicated mini bento tile.",
    "primaryScreenDescription": "Top segment [ Studio | Vault ]. Below: 60% Hero Capture Tile (defaults to Auto) + 40% column of Tag Tiles (Idea, Task) and Settings gear tile.",
    "recordingStateDescription": "Bento tiles consolidate into a unified recording studio with live frequency bars, large timer, and red stop tile.",
    "secondaryViewDescription": "Switching top segment to 'Vault' renders the bento archive feed with note duration and folded Settings tile.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Bento: 2x2 asymmetric bento partition glyph with V-Wave in primary tile",
      "rectangular": "Bento modular card with separate metric partitions and V-Wave mark",
      "corner": "Bento corner bracket with V monogram",
      "inline": "VOX Bento: Auto \u2022 Synced",
      "wearOsTile": "Full Wear OS bento tile with interactive sub-tiles"
    },
    "watchOsAdaptation": "SwiftUI Grid with asymmetric column spans, defaulting activeTag to .auto.",
    "wearOsAdaptation": "Row / Column weight-based bento layout in Wear OS Compose.",
    "bestFor": "Users who appreciate structured visual hierarchy, clean partition lines, and modular information design.",
    "pros": [
      "Both Auto capture and manual tag overrides visible and interactive simultaneously",
      "Dedicated mini-tile for Settings keeps low-frequency controls folded but accessible",
      "Modern Apple design language mirroring watchOS 10 Smart Stack"
    ],
    "cons": [
      "More visual elements on screen than minimalist single-button concepts"
    ]
  },
  {
    "id": 11,
    "name": "Swiss Typographic Tabs (AUTO \u2022 IDEA \u2022 TASK // VAULT)",
    "paradigm": "Adaptive & Capsules",
    "tagline": "Stark modernist Swiss typography: pure uppercase segmented header defaulting to AUTO, zero skeuomorphism",
    "accentColor": "#FF3B30",
    "accentGradient": "linear-gradient(135deg, #FF3B30, #FF453A)",
    "iosContinuity": "High Progressive (Typographic)",
    "iosComponentMapping": "Translates to a clean typographic header in iOS SwiftUI views.",
    "iosBackportIdea": "Offer a minimalist Swiss typographic theme option in iOS app Settings.",
    "secondaryStrategy": "'// VAULT' is the final typographic segment. Tapping it opens the archive, with '// SETTINGS' folded at the bottom of the ledger.",
    "primaryScreenDescription": "Top typographic line: AUTO \u2022 IDEA \u2022 TASK // VAULT. 'AUTO' underlined by default. Center is giant bold type: 'TAP TO RECORD'.",
    "recordingStateDescription": "Gigantic 52px red monospaced timer numerals, 'FORMAT: AUTO' tag, and full-width flat red stop bar.",
    "secondaryViewDescription": "Typographic ledger listing memos with bold timestamps, duration, monochrome checkmarks, and bottom '// SETTINGS' link.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Swiss: stark sans-serif V monogram constructed from 3 vertical solid rectangles",
      "rectangular": "Typographic modular card with bold uppercase 'VOX AUTO' and count",
      "corner": "Bold corner letter 'V' indicating Voxbrief brand",
      "inline": "VOX: AUTO // 4 MEMOS",
      "wearOsTile": "Bauhaus typographic Wear OS tile with high-contrast text"
    },
    "watchOsAdaptation": "Custom font modifier with .monospacedDigit() and strict tracking, defaultSelection: 'AUTO'.",
    "wearOsAdaptation": "Material 3 Typography with sans-serif-black font family.",
    "bestFor": "Design purists, typography fans, and architects who love Dieter Rams, Bauhaus, and Vignelli minimalism.",
    "pros": [
      "100% distraction-free; pure information with zero visual noise",
      "Rests on 'AUTO' so capture is completely instant",
      "Settings and sync management folded into an austere typographic ledger"
    ],
    "cons": [
      "No colorful icons or graphical waveforms; relies entirely on type hierarchy"
    ]
  },
  {
    "id": 12,
    "name": "Circular Bezel Arc Tags (Peripheral Auto Arc)",
    "paradigm": "Adaptive & Capsules",
    "tagline": "Engineered for round screens: peripheral arc segments hug the bezel with \u2728 AUTO resting at 12 o'clock",
    "accentColor": "#00E5FF",
    "accentGradient": "linear-gradient(135deg, #00E5FF, #007AFF)",
    "iosContinuity": "High Progressive (Bezel-Hugging)",
    "iosComponentMapping": "Specialized wearable design translating to iOS circular progress widgets.",
    "iosBackportIdea": "Use curved progress rings in iOS widgets to display daily voice note goal and category distribution.",
    "secondaryStrategy": "Bottom 90\u00b0 arc segment is 'Vault & Settings'. Top arc segments hold AUTO, IDEA, TASK, keeping the center 100% open for mic.",
    "primaryScreenDescription": "Three 60\u00b0 arc segments along top bezel with 'AUTO' active. Center circular disc triggers instant capture. Bottom arc has Vault icon.",
    "recordingStateDescription": "Peripheral arc becomes a live circular audio level meter, center displays big timer, 'AUTO' tag, and stop button.",
    "secondaryViewDescription": "Circular list of memos tailored for 360\u00b0 round watch viewports with smooth radial scrolling and folded Settings button.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Arc: 270\u00b0 circular arc gauge encircling a central V-Wave glyph",
      "rectangular": "Modular widget with arc level indicator and V-Wave monogram",
      "corner": "Curved bezel corner arc with V-Wave icon",
      "inline": "VOX Arc: Auto Active",
      "wearOsTile": "Round-first Wear OS tile with peripheral arc segments and center mic"
    },
    "watchOsAdaptation": "SwiftUI Circle().strokeBorder() with strokeDashArray for arc segments, defaulting to .auto segment.",
    "wearOsAdaptation": "CurvedLayout and CircularProgressIndicator in Wear OS Compose.",
    "bestFor": "Pixel Watch 3 and Galaxy Watch 7 users with circular displays who want edge-to-edge hardware harmony.",
    "pros": [
      "Naturally hugs the round hardware display silhouette with zero wasted corner space",
      "Defaults to 'AUTO' at 12 o'clock for zero-friction capture",
      "Settings and vault accessible via bottom bezel segment"
    ],
    "cons": [
      "Slightly less natural on squircle Apple Watch screens"
    ]
  },
  {
    "id": 13,
    "name": "Two-Way Ingest Filter (Auto [All] | Idea | Task)",
    "paradigm": "Workflow & Ingest",
    "tagline": "Two-way synchronization: default 'Auto' captures untagged and views all memos; specific tags filter both capture and vault",
    "accentColor": "#BF5AF2",
    "accentGradient": "linear-gradient(135deg, #BF5AF2, #5E5CE6)",
    "iosContinuity": "Direct Baseline (Two-Way Filter)",
    "iosComponentMapping": "Directly mirrors NoteRepository tag filtering and VoiceNote persistence.",
    "iosBackportIdea": "Unify the iOS search bar and recording tag selectors so tapping a tag filters the list and primes the recorder simultaneously.",
    "secondaryStrategy": "The top segmented switcher selects the active context (Auto [All] | Idea | Task). Vault tab displays notes matching that tag, with Settings folded at bottom.",
    "primaryScreenDescription": "Top segment [ Auto (All) | Idea | Task | Vault ]. Active segment sets both the recording tag and pre-filters the Vault tab.",
    "recordingStateDescription": "Active 'AUTO-DETECT' tag locked, smooth violet audio frequency wave, running timer, and flat red stop button.",
    "secondaryViewDescription": "Pre-filtered vault showing notes matching the active top segment, plus a Settings (\u2699\ufe0f) button to manage WCSession transfer logs.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Funnel: filter funnel geometry echoing the V monogram with central audio core",
      "rectangular": "Modular card showing filtered category count, V-Wave brand mark, and sync health",
      "corner": "Filter funnel V-Wave icon with active tag letter",
      "inline": "VOX Filter: [Auto 4M]",
      "wearOsTile": "Filter-enabled Wear OS tile showing category counts and quick capture"
    },
    "watchOsAdaptation": "EnvironmentObject NoteRepository filtering @Published var notes by selected tag; defaults to .all / .auto.",
    "wearOsAdaptation": "StateFlow-backed filtering in Wear OS ViewModel.",
    "bestFor": "Users with many voice notes who frequently need to review previous thoughts in a specific category before recording a new one.",
    "pros": [
      "Defaults to 'Auto (All)' so daily voice capture needs zero clicks",
      "Two-way functionality: tags your new note AND organizes your existing notes",
      "Settings and diagnostics folded neatly into the Vault toolbar"
    ],
    "cons": [
      "Must remember to switch back to 'Auto (All)' to view other categories"
    ]
  },
  {
    "id": 14,
    "name": "Smart Tag Pill with Telemetry (\u2728 Auto | \u2699\ufe0f 3 Sync)",
    "paradigm": "Workflow & Ingest",
    "tagline": "Telemetry-driven segment: left pill shows \u2728 Auto tag, right pill shows pending sync badge with 1-tap folded Settings",
    "accentColor": "#FF9500",
    "accentGradient": "linear-gradient(135deg, #FF9500, #FF3B30)",
    "iosContinuity": "Direct Baseline (WCSession Status)",
    "iosComponentMapping": "Maps to WatchSyncService WCSession transfer queue and pending sync badges.",
    "iosBackportIdea": "Expose live WatchConnectivity file transfer telemetry directly in the iPhone status bar.",
    "secondaryStrategy": "The right segment is an active status badge showing '[ \u2699\ufe0f 3 Sync \u25be ]'. Tapping it navigates directly to folded Settings and transfer diagnostics.",
    "primaryScreenDescription": "Top bar: Left pill [ ✨ Auto ▾ ], Right pill [ ⚙️ 3 Pending ▾ ]. Center has large amber mic disc with calm ready prompt.",
    "recordingStateDescription": "Pending badge updates live to [ Recording... ], amber audio waveform bars, running timer, and stop button.",
    "secondaryViewDescription": "Dedicated WatchConnectivity transfer hub showing each audio file's sync progress, with folded Settings for manual re-sync and cache purge.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Sync: dual sync transfer arrows forming a stylized circular V around an audio core",
      "rectangular": "Modular widget with V-Wave sync mark, pending count, and Auto tag",
      "corner": "Sync status badge with pending number and V monogram",
      "inline": "VOX: Auto \u2022 3 Pending \u26a1",
      "wearOsTile": "Sync health and quick-record Wear OS tile"
    },
    "watchOsAdaptation": "Observe WatchSyncService.shared.pendingTransfers count directly in the top right pill.",
    "wearOsAdaptation": "DataClient sync state listener in Wear OS background service.",
    "bestFor": "Users who record offline frequently (on runs, off-grid) and want immediate reassurance that notes are syncing to iPhone.",
    "pros": [
      "Rests on 'Auto' on the left for instant 1-tap capture",
      "Direct 1-tap access to folded Settings and sync diagnostics on the right",
      "Immediate glanceable peace of mind regarding audio sync status"
    ],
    "cons": [
      "Badge color shifts based on sync state, adding visual activity"
    ]
  },
  {
    "id": 15,
    "name": "Slide-Up Palette with Auto Anchor",
    "paradigm": "Workflow & Ingest",
    "tagline": "Two-phase workflow: top segment toggles Capture vs. Vault; a bottom tag pull-tab defaults to \u2728 Auto and slides up palette on demand",
    "accentColor": "#5856D6",
    "accentGradient": "linear-gradient(135deg, #5856D6, #AF52DE)",
    "iosContinuity": "Direct Baseline (Sheet Presentation)",
    "iosComponentMapping": "Maps to SwiftUI .sheet() presentation in iOS QuickRecordSheet.",
    "iosBackportIdea": "Adopt this slide-up tag palette in the iOS app to let users customize custom tag labels.",
    "secondaryStrategy": "Top segment handles 'Capture | Vault'. Settings (sync diagnostics, haptic preferences, storage purge) are folded into a gear icon in Vault.",
    "primaryScreenDescription": "Top segment [ Capture | Vault ]. Center: Indigo capture hero. Bottom: Slide-up tag handle showing default [ \u2728 Auto \u25b2 ].",
    "recordingStateDescription": "Tag locked in header as 'AUTO-DETECT', vibrant indigo waveform sweep, running mono timer, and flat red stop button.",
    "secondaryViewDescription": "Clean vault list showing tag badges, duration, and phone transfer checkmarks, with top Settings (\u2699\ufe0f) button.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Palette: document memo card with embossed V-Wave emblem and 4 colored tag dots",
      "rectangular": "Modular complication showing V-Wave palette and 'AUTO READY' status",
      "corner": "V-Wave palette corner bracket with VOX label",
      "inline": "VOX: [Palette: Auto] Ready",
      "wearOsTile": "Palette-driven Wear OS tile with expandable tag grid"
    },
    "watchOsAdaptation": "SwiftUI .sheet(isPresented:) defaulting tag to .auto.",
    "wearOsAdaptation": "ModalBottomSheet component in Wear OS Compose.",
    "bestFor": "Power users with 4+ context tags who want the primary screen to rest on Auto, but want an expandable palette when needed.",
    "pros": [
      "Rests on 'Auto' so you never need to open the palette for daily notes",
      "Accommodates rich tag sets (Idea, Task, Meeting, Personal, Bug, Journal) cleanly",
      "Settings and sync management folded completely out of the daily capture screen"
    ],
    "cons": [
      "Opening the palette requires an intentional swipe or tap"
    ]
  },
  {
    "id": 16,
    "name": "Chromatic Audio Scope (Adaptive Auto Gradient)",
    "paradigm": "Workflow & Ingest",
    "tagline": "Color-coded audio feedback: active scope uses multi-stop Siri gradient in \u2728 Auto mode; shifts to solid color only on manual override",
    "accentColor": "#30B0C7",
    "accentGradient": "linear-gradient(135deg, #30B0C7, #007AFF)",
    "iosContinuity": "High Progressive (Reactive Theming)",
    "iosComponentMapping": "Maps to dynamic color tokens in iOS CaptureWaveformView.",
    "iosBackportIdea": "Theme the iOS waveform color based on the selected tag category (Cobalt for Ideas, Amber for Tasks, Multi-color for Auto).",
    "secondaryStrategy": "Right segment is 'Vault'. Settings are folded into a gear button inside the Vault header, preserving the clean chromatic capture screen.",
    "primaryScreenDescription": "Top segment bar with color-coded pips, resting on [✨ Auto]. Center features a clean capture disc ready to record.",
    "recordingStateDescription": "Real-time oscilloscope dancing in the multi-stop Auto gradient, with digital timer and flat red stop button.",
    "secondaryViewDescription": "Color-coded memo vault where each card has a left accent border matching its detected tag color, with folded Settings button.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Spectrum: chromatic 5-bar vertical audio spectrum forming a V-Wave silhouette",
      "rectangular": "Modular widget with color-coded V-Wave oscilloscope preview and Auto status",
      "corner": "Chromatic corner tick with V monogram",
      "inline": "VOX [Chromatic: Auto] Active",
      "wearOsTile": "Color-reactive Wear OS tile adapting to active tag"
    },
    "watchOsAdaptation": "Dynamic Color state animating smoothly via .animation(.easeInOut, value: activeTag), defaulting to multi-color gradient.",
    "wearOsAdaptation": "Material 3 dynamic color theming in Compose.",
    "bestFor": "Visual learners who appreciate responsive color feedback: multi-color for Auto, solid tint for manual tag overrides.",
    "pros": [
      "Instant visual confirmation of recording mode through color",
      "Multi-stop gradient indicates AI Auto mode matching the iOS CaptureWaveformView",
      "Settings neatly folded away in Vault view"
    ],
    "cons": [
      "Requires learning the color associations (e.g. Multi-color = Auto, Cyan = Idea, Amber = Task)"
    ]
  },
  {
    "id": 17,
    "name": "AI Pipeline Preset Segment (\u2728 Auto-AI | Fast | Deep)",
    "paradigm": "High-Speed & Power",
    "tagline": "On-device AI configuration: top segments default to \u2728 Auto-AI (dynamic Qwen3 tier selection), with Fast and Deep overrides",
    "accentColor": "#64D2FF",
    "accentGradient": "linear-gradient(135deg, #64D2FF, #0A84FF)",
    "iosContinuity": "High Progressive (Pipeline Telemetry)",
    "iosComponentMapping": "Directly controls ASRService Whisper model preset and OnDeviceLLMService prompt complexity.",
    "iosBackportIdea": "Allow users to pick pipeline presets in iOS Settings to balance battery life vs. summary depth.",
    "secondaryStrategy": "'Vault' is the 4th segment. Folded Settings page manages on-device CoreML model caching and WhisperKit offline downloads.",
    "primaryScreenDescription": "Top segment [ \u2728 Auto-AI | Fast | Deep | Vault ]. 'Auto-AI' active by default. Center shows pipeline readiness pip and capture disc.",
    "recordingStateDescription": "Live token indicator, 'AUTO-AI SELECTING MODEL', audio waveform bars, running mono timer, and flat red stop button.",
    "secondaryViewDescription": "Vault with AI status badges indicating transcription latency and LLM formatting status, plus folded CoreML Settings.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' AI Spark: 4-point neural spark forming the vertex of a V-Wave sound monogram",
      "rectangular": "Modular card showing V-Wave AI spark, 'AUTO-AI READY', and memo count",
      "corner": "AI preset indicator (A / F / D) in corner with V glyph",
      "inline": "VOX: AI [Auto] Ready",
      "wearOsTile": "AI pipeline-configured Wear OS tile with direct preset triggers"
    },
    "watchOsAdaptation": "Segmented Picker passing NoteProcessingPipeline preset options in SyncPayload, defaulting to .autoAI.",
    "wearOsAdaptation": "SegmentedButton sending pipeline metadata via Wear OS Data Layer.",
    "bestFor": "Technical power users who want the AI to automatically balance latency vs. depth, with manual overrides for deep analysis.",
    "pros": [
      "Defaults to 'Auto-AI' so on-device models dynamically optimize battery and accuracy",
      "Manual overrides available for quick dictation vs. deep meeting synthesis",
      "CoreML cache management and WhisperKit downloads folded into Settings"
    ],
    "cons": [
      "More technical concept than simple category tagging"
    ]
  },
  {
    "id": 18,
    "name": "Linear Hairline Vector Tabs ([ AUTO ] [ REC ] [ SETTINGS ])",
    "paradigm": "High-Speed & Power",
    "tagline": "Precision drafting aesthetic: 1px vector lines for segmented tabs, crosshairs, and a dedicated folded Settings ledger",
    "accentColor": "#E5E5EA",
    "accentGradient": "linear-gradient(135deg, #E5E5EA, #8E8E93)",
    "iosContinuity": "High Progressive (Architectural)",
    "iosComponentMapping": "Translates to a hairline border aesthetic in iOS SwiftUI views.",
    "iosBackportIdea": "Offer an architectural 1px hairline dark mode theme in the iOS app.",
    "secondaryStrategy": "Header has hairline tabs: [ AUTO ] [ REC ] [ SETTINGS ]. Settings tab folds away WCSession sync diagnostics and cache purge.",
    "primaryScreenDescription": "Hairline 1px segmented header [ AUTO | CAPTURE | SETTINGS ]. 'AUTO' active by default. Center has vector crosshair reticle target.",
    "recordingStateDescription": "Razor-sharp 1px oscilloscope box with grid lines, 'MODE: AUTO' tag, running mono timer, and outlined red stop button.",
    "secondaryViewDescription": "Technical ledger view with 1px border dividers, timestamp readouts, and sync hashes, with dedicated folded Settings page.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Hairline: 1px precision drafting vector V with crosshair intersection and center pip",
      "rectangular": "Technical modular widget with V-Wave hairline mark and 1px vector grid dividers",
      "corner": "Hairline corner bracket with V monogram",
      "inline": "VOX // LINEAR [AUTO]",
      "wearOsTile": "Technical hairline Wear OS tile with high-precision vector lines"
    },
    "watchOsAdaptation": "Custom shape drawing with .stroke(lineWidth: 1) and exact pixel alignment, defaultSelection: 'AUTO'.",
    "wearOsAdaptation": "Canvas drawing modifiers in Wear OS Compose.",
    "bestFor": "Engineers, architects, and minimalist purists who love technical instrumentation and crisp lines.",
    "pros": [
      "Zero blur, zero drop shadows; maximum sharpness on high-DPI OLED screens",
      "Rests on 'AUTO' so capture is completely instant",
      "Dedicated folded Settings tab for deep technical telemetry"
    ],
    "cons": [
      "Monochrome vector look may feel clinical to users who prefer colorful interfaces"
    ]
  },
  {
    "id": 19,
    "name": "Instant Trigger Matrix (\u2728 Auto-Record Hero)",
    "paradigm": "High-Speed & Power",
    "tagline": "Zero friction: primary hero is a massive 1-tap \u2728 Auto-Record button; smaller override buttons and folded Settings above",
    "accentColor": "#FF2D55",
    "accentGradient": "linear-gradient(135deg, #FF2D55, #FF375F)",
    "iosContinuity": "High Progressive (Instant Capture)",
    "iosComponentMapping": "Maps to iOS Quick Actions / App Shortcuts with pre-tagged recording intents.",
    "iosBackportIdea": "Add iOS Lock Screen widgets and Home Screen Quick Action shortcuts for 1-tap tagged recording.",
    "secondaryStrategy": "A dedicated 'Vault & Settings' tab is pinned in the header, containing memo playback and folded sync controls.",
    "primaryScreenDescription": "Top bar: [ Override: Idea | Task ] [ \ud83d\udcc1 Vault ]. Center: Massive 1-tap [ \u2728 AUTO-RECORD ] hero disc with resting wave.",
    "recordingStateDescription": "Full-screen live recording active with '\u2728 AUTO-DETECT' prominently displayed, live timer, and giant red stop button.",
    "secondaryViewDescription": "Clean vault list accessed via the header, with one-tap playback and folded Settings sheet for sync diagnostics.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Lightning: lightning bolt angle converging with soundwave bars in a dynamic V form",
      "rectangular": "Modular widget with V-Wave lightning mark and instant Auto capture trigger",
      "corner": "V-Wave lightning trigger corner icon",
      "inline": "VOX: 1-Tap Auto Record",
      "wearOsTile": "Instant Auto-trigger Wear OS tile with direct capture launcher"
    },
    "watchOsAdaptation": "Hero Button directly invokes RecordingCoordinator.shared.startRecording(tag: .auto).",
    "wearOsAdaptation": "Direct Wear OS service start on button tap.",
    "bestFor": "Users who want the fastest possible capture speed: 1 tap both records and lets AI auto-detect the category.",
    "pros": [
      "Absolute fastest capture: 1 tap on the giant center button starts Auto recording",
      "Manual overrides available right in the header for specific tasks",
      "Settings and sync management folded completely out of the way"
    ],
    "cons": [
      "Accidental taps immediately trigger recording (though easily canceled)"
    ]
  },
  {
    "id": 20,
    "name": "HUD Corner Tag Matrix (Center Auto + Folded Settings)",
    "paradigm": "High-Speed & Power",
    "tagline": "Spatial four-corner ergonomics: giant center mic operates in \u2728 Auto mode; 4 corners offer overrides; top bar has folded Settings",
    "accentColor": "#10B981",
    "accentGradient": "linear-gradient(135deg, #10B981, #059669)",
    "iosContinuity": "High Progressive (Spatial Corner)",
    "iosComponentMapping": "Maps to screen edge swipe affordances in iOS camera and voice apps.",
    "iosBackportIdea": "Use corner gesture anchors on iPhone for one-handed category selection while driving or walking.",
    "secondaryStrategy": "Top header switches between 'HUD Studio' and 'Vault (4)'. A gear icon (\u2699\ufe0f) folds away WCSession sync diagnostics, storage cleanup, and haptics.",
    "primaryScreenDescription": "Top bar [ Studio | Vault (4) ]. Center: Giant mic disc resting in \u2728 Auto mode. 4 corners host manual overrides (Idea, Task, Meet, Note).",
    "recordingStateDescription": "Center displays giant mono timer, audio waveform bars, 'AUTO INTENT' badge, and flat red stop button.",
    "secondaryViewDescription": "Full-screen vault feed with note duration, timestamps, and folded Settings button for manual sync and cache purge.",
    "complications": {
      "circular": "Voxbrief 'V-Wave' Viewfinder: 4-corner HUD brackets framing the central V-Wave sound monogram",
      "rectangular": "Modular widget with 4-corner status indicators and V-Wave mark",
      "corner": "Corner viewfinder bracket with V monogram",
      "inline": "VOX HUD: [Auto Active]",
      "wearOsTile": "4-corner touchpoint Wear OS tile with central Auto record button"
    },
    "watchOsAdaptation": "ZStack with alignment: .topLeading, .topTrailing, .bottomLeading, .bottomTrailing, center defaulting to .auto.",
    "wearOsAdaptation": "Box with corner alignments in Wear OS Compose.",
    "bestFor": "Users who want maximum screen space dedicated to the primary capture area while retaining instant tag switching.",
    "pros": [
      "85% of the screen remains completely uncluttered for the primary Auto capture hero",
      "Tapping center records in Auto mode instantly",
      "Settings and sync diagnostics folded cleanly into the top Vault toolbar"
    ],
    "cons": [
      "Corner touch targets require precise touch boundary calibration on smaller 40mm bezels"
    ]
  }
]
;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { candidates: CANDIDATES };
}
