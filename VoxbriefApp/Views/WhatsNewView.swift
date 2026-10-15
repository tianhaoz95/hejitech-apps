import SwiftUI

public enum WhatsNewItemKind: String, Sendable, CaseIterable {
    case feature = "Feature"
    case improvement = "Improvement"
    case fix = "Bug Fix"
}

public enum WhatsNewVisualization: String, Sendable, CaseIterable {
    case waveform = "waveform"
    case swipeGesture = "swipeGesture"
    case pipeline = "pipeline"
    case vwaveMark = "vwaveMark"
    case complications = "complications"
}

public struct WhatsNewItem: Identifiable, Sendable {
    public let id: UUID
    public let icon: String
    public let tint: Color
    public let title: String
    public let description: String
    public let kind: WhatsNewItemKind
    public let detailedDescription: String?
    public let highlights: [String]?
    public let screenshotName: String?
    public let visualization: WhatsNewVisualization?

    public init(
        icon: String,
        tint: Color,
        title: String,
        description: String,
        kind: WhatsNewItemKind = .feature,
        detailedDescription: String? = nil,
        highlights: [String]? = nil,
        screenshotName: String? = nil,
        visualization: WhatsNewVisualization? = nil,
        id: UUID = UUID()
    ) {
        self.id = id
        self.icon = icon
        self.tint = tint
        self.title = title
        self.description = description
        self.kind = kind
        self.detailedDescription = detailedDescription
        self.highlights = highlights
        self.screenshotName = screenshotName
        self.visualization = visualization
    }
}

public struct ReleaseHistoryItem: Identifiable, Sendable {
    public let version: String
    public let date: String
    public let tagline: String
    public let features: [WhatsNewItem]
    public let improvementsAndFixes: [WhatsNewItem]

    public var id: String { version }

    /// Combined list of features and improvements for backward compatibility.
    public var items: [WhatsNewItem] {
        features + improvementsAndFixes
    }

    public init(
        version: String,
        date: String,
        tagline: String,
        features: [WhatsNewItem],
        improvementsAndFixes: [WhatsNewItem] = []
    ) {
        self.version = version
        self.date = date
        self.tagline = tagline
        self.features = features
        self.improvementsAndFixes = improvementsAndFixes
    }

    public init(
        version: String,
        date: String,
        tagline: String,
        items: [WhatsNewItem]
    ) {
        self.version = version
        self.date = date
        self.tagline = tagline
        self.features = items
        self.improvementsAndFixes = []
    }
}

public struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    public static let currentVersion = "1.24.0"
    public static let lastSeenVersionKey = "last_seen_whats_new_version"

    public static var shouldShowAutomatically: Bool {
        let lastSeen = UserDefaults.standard.string(forKey: lastSeenVersionKey)
        return lastSeen != currentVersion
    }

    public static let releases: [ReleaseHistoryItem] = [
        ReleaseHistoryItem(
            version: "1.24.0",
            date: "October 2026",
            tagline: "Interactive Feature Details, Live Waveforms & Visual Architecture Previews",
            features: [
                WhatsNewItem(
                    icon: "hand.tap.fill",
                    tint: .blue,
                    title: "Interactive Feature Detail Pages",
                    description: "Tap any release item to open an immersive detail page with in-depth technical narratives and structured highlights.",
                    detailedDescription: "What's New entries are now fully interactive. Tapping any feature or improvement card presents an immersive sheet with architectural deep dives, visual walkthroughs, and key capability highlights.",
                    highlights: [
                        "Tap any feature or improvement card to open full-sheet deep dive",
                        "Structured key highlights with dedicated checkmark indicators",
                        "Seamless responsive layout across iPhone, iPad, and Mac"
                    ],
                    visualization: .swipeGesture
                ),
                WhatsNewItem(
                    icon: "waveform.badge.mic",
                    tint: .purple,
                    title: "Embedded Live Visualizations",
                    description: "Experience interactive SwiftUI preview widgets including live audio waveforms, watch navigation simulators, and AI pipeline flows.",
                    detailedDescription: "Feature pages now embed live, tactile SwiftUI widgets. Simulate real-time audio capture with dynamic waveforms, test watchOS horizontal swipe navigation, and inspect on-device processing stages directly within the app.",
                    highlights: [
                        "Real-time animated audio waveform equalizer with live input toggle",
                        "Interactive Apple Watch pagination and swipe transition simulator",
                        "Zero-latency interactive components built purely with SwiftUI"
                    ],
                    visualization: .waveform
                ),
                WhatsNewItem(
                    icon: "arrow.triangle.branch",
                    tint: .indigo,
                    title: "On-Device Pipeline Stage Inspector",
                    description: "Inspect each stage of Voxbrief's private on-device pipeline from audio ingest through WhisperKit ASR and Qwen3 LLM to Markdown.",
                    detailedDescription: "Gain insight into Voxbrief's completely private, on-device AI pipeline. Tap each stage in the interactive diagram to inspect how audio buffers are ingested, transcribed via Apple Neural Engine CoreML, and synthesized by quantized Qwen3.",
                    highlights: [
                        "Interactive 4-stage pipeline visualization (Ingest ➔ ASR ➔ LLM ➔ Markdown)",
                        "Detailed telemetry and model execution breakdown for each stage",
                        "Highlights Voxbrief's 100% offline, privacy-first architecture"
                    ],
                    visualization: .pipeline
                ),
                WhatsNewItem(
                    icon: "applewatch.radiowaves.left.and.right",
                    tint: .cyan,
                    title: "Complications & Brand Mark Inspector",
                    description: "Interactive showcases for Apple Watch complications and bespoke V-Wave monogram geometry across high-contrast colorways.",
                    detailedDescription: "Explore the new flat V-Wave brand identity across Apple Watch face complication form factors (Circular, Corner, Rectangular) and inspect the calibrated 1:1 geometry across custom color themes.",
                    highlights: [
                        "Live complication gallery for Circular, Corner, and Rectangular watch faces",
                        "Bespoke V-Wave monogram inspector with color theme switching",
                        "Calibrated 1:1 geometry preview with retina display guarantees"
                    ],
                    visualization: .complications
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "puzzlepiece.extension.fill",
                    tint: .green,
                    title: "Non-Breaking Rich Field Schema",
                    description: "Engineered optional metadata fields with default nil values, ensuring 100% backward compatibility for all historical releases.",
                    kind: .improvement,
                    detailedDescription: "All rich metadata parameters (detailedDescription, highlights, screenshotName, visualization) are strictly optional, preserving total backward compatibility with historical release history items."
                ),
                WhatsNewItem(
                    icon: "cursorarrow.rays",
                    tint: .teal,
                    title: "Interactive Row Affordances",
                    description: "Added subtle chevron indicators and generous tap targets across all release notes and bug fix lists.",
                    kind: .improvement,
                    detailedDescription: "Enhanced list accessibility and touch affordance with subtle trailing chevrons and full-width hit testing."
                ),
                WhatsNewItem(
                    icon: "macwindow.on.rectangle",
                    tint: .orange,
                    title: "Cross-Platform Modal Presentation",
                    description: "Calibrated presentation detents for iOS and large comfortable modal frames on macOS.",
                    kind: .improvement,
                    detailedDescription: "Configured native modal sheet presentation detents on iOS (.large) and responsive window bounds on macOS."
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "1.23.0",
            date: "October 2026",
            tagline: "High-Legibility V-Wave Brand Mark & Unclustered Multi-Scale Geometry",
            features: [
                WhatsNewItem(
                    icon: "waveform.badge.magnifyingglass",
                    tint: .blue,
                    title: "High-Legibility V-Wave Monogram",
                    description: "Refined the V-Wave logo with a 1:1 stroke-to-gap ratio and 3 bold equalizer bars, eliminating visual clustering across all screen sizes.",
                    detailedDescription: "The bespoke Voxbrief V-Wave monogram has been re-architected for maximum legibility at micro scales. By establishing a calibrated 1:1 stroke-to-gap ratio and using 3 bold frequency equalizer bars, the mark maintains distinct negative space and sharp clarity from 1024px down to 16px thumbnails.",
                    highlights: [
                        "1:1 bar-to-gap ratio preserves distinct frequency bars down to 16px",
                        "Harmonious top-line alignment between left diagonal stem and peak audio bar",
                        "100% 2D flat vector geometry with zero faux-3D glare or heavy drop shadows"
                    ],
                    visualization: .vwaveMark
                ),
                WhatsNewItem(
                    icon: "app.badge.checkmark.fill",
                    tint: .cyan,
                    title: "Crisp Multi-Scale App Icon",
                    description: "Regenerated all discrete iOS, watchOS, and macOS icon assets from 1024px down to 16px with distinct, razor-sharp negative space.",
                    detailedDescription: "Every discrete application icon size—from the full-bleed 1024×1024 master down to 16×16 Dock and Spotlight thumbnails—has been regenerated with widened inter-element spacing to ensure the brand mark is immediately recognizable on any home screen.",
                    highlights: [
                        "Over 300% wider negative space between equalizer bars",
                        "Full coverage for iOS home screen, watchOS app grid, and macOS squircle Dock",
                        "High-contrast solid royal blue background for instant recognition"
                    ],
                    visualization: .vwaveMark
                ),
                WhatsNewItem(
                    icon: "applewatch",
                    tint: .purple,
                    title: "High-Contrast Complications",
                    description: "Redesigned Apple Watch face complications with bold vector marks for instant recognition in circular, corner, and rectangular slots.",
                    detailedDescription: "Apple Watch complications now display the custom Voxbrief V-Wave brand mark with expanded padding and high-contrast styling, giving you one-tap access to voice recording directly from your favorite watch face.",
                    highlights: [
                        "Supports Circular, Corner, Rectangular, and Inline complication slots",
                        "Live recording state indicators with distinct pulsing red visual cues",
                        "One-tap wrist capture deep-linking directly into the watch recording pipeline"
                    ],
                    visualization: .complications
                ),
                WhatsNewItem(
                    icon: "sparkles",
                    tint: .orange,
                    title: "Optimized Home Header & Settings Branding",
                    description: "Balanced proportions and padding in navigation bar headers and settings cards for an elevated, clean aesthetic.",
                    detailedDescription: "The navigation bar brand header on iPhone and the watchOS resting capture screen have been optimized with calibrated optical sizing, ensuring the brand mark and typography blend seamlessly with native navigation bars.",
                    highlights: [
                        "Calibrated 28pt inline header sizing on iPhone",
                        "Refined 22pt watch header with optical inner padding",
                        "Brand mark integration in Settings and About panels"
                    ],
                    visualization: .vwaveMark
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "square.split.3x3",
                    tint: .red,
                    title: "Monogram Bar Separation Fix",
                    description: "Eliminated bar overlapping and smudging on small retina viewports by widening inter-bar spacing by over 300%.",
                    kind: .fix,
                    detailedDescription: "Resolved an issue where 4 closely packed frequency bars mathematically overlapped at small sizes (<30pt), resulting in a solid blur. Transitioning to 3 bars with 1:1 spacing guarantees clean separation at all display densities."
                ),
                WhatsNewItem(
                    icon: "slider.horizontal.2.square.badge.arrow.down",
                    tint: .green,
                    title: "Balanced Geometric Margins",
                    description: "Perfected optical centering and horizontal/vertical margins across all vector logo shapes.",
                    kind: .improvement,
                    detailedDescription: "Calibrated horizontal margins to 12% on both sides and vertical padding to 20%, ensuring visual weight is centered in square and circular badges."
                ),
                WhatsNewItem(
                    icon: "circle.circle.fill",
                    tint: .teal,
                    title: "Complication Retina Contrast",
                    description: "Increased accessory widget scaling with high-contrast accent backgrounds for glanceable outdoor legibility.",
                    kind: .improvement,
                    detailedDescription: "Reduced inset padding from 9pt to 6pt in circular complications, giving the vector mark 50% more visible surface area on Apple Watch OLED displays."
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "1.22.0",
            date: "October 2026",
            tagline: "WatchOS Paged Swipe Architecture & Flat V-Wave Brand Identity",
            features: [
                WhatsNewItem(
                    icon: "hand.draw.fill",
                    tint: .blue,
                    title: "Paged Swipe Architecture on Apple Watch",
                    description: "Effortlessly swipe between the resting capture hero and your memo vault with native watchOS pagination dots.",
                    detailedDescription: "Apple Watch navigation now uses a streamlined horizontal swipe architecture. Swipe left to capture voice memos; swipe right to inspect your saved memo vault.",
                    highlights: [
                        "Native watchOS pagination dots indicator",
                        "Zero idle waveform animations before capture begins",
                        "Ergonomic, thumb-friendly sync capsule buttons"
                    ],
                    visualization: .swipeGesture
                ),
                WhatsNewItem(
                    icon: "sparkles",
                    tint: .purple,
                    title: "Auto-First Tagging on Wrist",
                    description: "Voice memos default to ✨ Auto-triage, with one-tap wrist switching between Idea, Task, and Meeting categories.",
                    detailedDescription: "Recordings default to ✨ Auto categorization, with smart automatic tag triage during the AI processing pipeline. A single tap on the wrist tag badge cycles between Auto, Idea, Task, and Meeting.",
                    highlights: [
                        "Default ✨ Auto classification with on-device AI tagging",
                        "Instant wrist tag cycling without opening sub-menus",
                        "Seamless metadata transfer to iPhone via WatchConnectivity"
                    ],
                    visualization: .swipeGesture
                ),
                WhatsNewItem(
                    icon: "app.badge.checkmark.fill",
                    tint: .cyan,
                    title: "Bespoke Flat V-Wave Brand Identity",
                    description: "New geometric V-Wave monogram across iOS, watchOS, and macOS icons—100% clean and flat with zero 3D glare or skeuomorphic gloss.",
                    detailedDescription: "Replaced generic SF Symbols with the custom Voxbrief V-Wave brand mark across all apps and platforms.",
                    highlights: [
                        "Pure 2D flat aesthetic matching modern Apple design languages",
                        "Seamless rendering across watchOS, iOS, and macOS",
                        "Integrated across splash screens, headers, and app icons"
                    ],
                    visualization: .vwaveMark
                ),
                WhatsNewItem(
                    icon: "gearshape.fill",
                    tint: .indigo,
                    title: "Dedicated Apple Watch Settings & Storage",
                    description: "Inspect companion sync health, check local audio cache size, and purge synced recordings directly from your wrist.",
                    detailedDescription: "A dedicated settings page on your Apple Watch lets you inspect companion connection health, check real-time audio storage consumption, and purge synced recordings.",
                    highlights: [
                        "Real-time local audio storage calculation",
                        "One-tap synced audio cache purging",
                        "Direct pipeline diagnostics (WhisperKit ASR + Qwen3 LLM)"
                    ],
                    visualization: .pipeline
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "waveform.slash",
                    tint: .orange,
                    title: "Resting Waveform Elimination",
                    description: "Removed idle waveform animations before recording starts; audio-reactive wave visualizers now appear strictly during active capture.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "capsule.portrait.fill",
                    tint: .green,
                    title: "Ergonomic Watch-Friendly Sync Button",
                    description: "Replaced cramped section-header sync links with prominent, touch-friendly capsule action buttons in the watch vault.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "applewatch",
                    tint: .teal,
                    title: "Bespoke V-Wave Watch Face Complications",
                    description: "Apple Watch complications now display the custom flat Voxbrief V-Wave brand mark for instant one-tap voice capture.",
                    kind: .improvement
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "1.21.0",
            date: "October 2026",
            tagline: "Secondary Release Notes & ASR Token Sanitization",
            features: [
                WhatsNewItem(
                    icon: "wrench.and.screwdriver.fill",
                    tint: .blue,
                    title: "Dedicated Bug Fixes & Improvements Sheet",
                    description: "Tap the prominent new action button in What's New to open a dedicated secondary modal inspecting all bug fixes and system enhancements."
                ),
                WhatsNewItem(
                    icon: "tag.fill",
                    tint: .purple,
                    title: "Categorized Change Badges",
                    description: "All changes in the secondary UI are classified with distinct visual badges: Feature, Improvement, or Bug Fix."
                ),
                WhatsNewItem(
                    icon: "sparkle.magnifyingglass",
                    tint: .teal,
                    title: "ASR Non-Speech Token Sanitization",
                    description: "WhisperKit audio event annotations are automatically stripped before sending transcripts to on-device models, ensuring perfectly clean outputs."
                ),
                WhatsNewItem(
                    icon: "menubar.rectangle",
                    tint: .orange,
                    title: "Toolbar Quick-Access Button",
                    description: "Quickly view bug fixes and performance notes directly from the navigation bar without scrolling."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "speaker.slash.fill",
                    tint: .red,
                    title: "Speech Annotation Hallucination Suppression",
                    description: "Fixed issue where on-device proofreading models could echo non-speech annotations like '[ breathing heavily ]'.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "uiwindow.split.2x1",
                    tint: .blue,
                    title: "Presentation Detents & Window Layout",
                    description: "Configured adaptive sheet detents on iOS and verified minimum window constraints for macOS dialogs.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "clock.arrow.circlepath",
                    tint: .green,
                    title: "Multi-Version History Preservation",
                    description: "Preserved full release changelog archives across past versions with independent feature and bug fix sections.",
                    kind: .improvement
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "1.20.0",
            date: "October 2026",
            tagline: "Productivity, Audio Navigation & Full Backups",
            features: [
                WhatsNewItem(
                    icon: "pin.fill",
                    tint: .blue,
                    title: "Pinned Notes & Archiving",
                    description: "Pin your most important voice notes to the top of the list, or swipe to archive notes into a dedicated archive view without deleting them."
                ),
                WhatsNewItem(
                    icon: "gobackward.15",
                    tint: .purple,
                    title: "15s Audio Skip & Loop Playback",
                    description: "Navigate long audio memos effortlessly with 15-second skip forward/backward buttons and loop mode for rehearsing or transcribing."
                ),
                WhatsNewItem(
                    icon: "clock",
                    tint: .orange,
                    title: "Reading Time & Word Count Metrics",
                    description: "Live word count and estimated reading time badges are calculated automatically on every voice note brief."
                ),
                WhatsNewItem(
                    icon: "checklist",
                    tint: .green,
                    title: "Action Items Progress Tracking",
                    description: "Visualize task completion at a glance with progress bars and badges showing completed vs total action items."
                ),
                WhatsNewItem(
                    icon: "doc.plaintext",
                    tint: .teal,
                    title: "Plain Text (.txt) & HTML Export",
                    description: "Export notes as clean plain text (.txt) or standalone, beautifully styled responsive HTML documents with dark mode support."
                ),
                WhatsNewItem(
                    icon: "text.quote",
                    tint: .indigo,
                    title: "Granular Copy Snippets",
                    description: "Quickly copy just the Summary, Action Items, or verbatim Speech Transcript to your clipboard from the actions menu."
                ),
                WhatsNewItem(
                    icon: "square.and.arrow.up.on.square",
                    tint: .pink,
                    title: "Full JSON Library Backup & Restore",
                    description: "Export an encrypted, complete backup package of your entire notes collection and restore notes anytime from Settings."
                ),
                WhatsNewItem(
                    icon: "lock.shield",
                    tint: .red,
                    title: "Color Categories & Privacy Shield",
                    description: "Organize notes with vibrant color tags and hide sensitive note content behind a privacy shield lock."
                ),
                WhatsNewItem(
                    icon: "tag",
                    tint: .cyan,
                    title: "Interactive Tagging & Tag Bar",
                    description: "Add and remove tags directly from note details, and filter your library using horizontal tag chips with live note counts."
                ),
                WhatsNewItem(
                    icon: "line.3.horizontal.decrease.circle",
                    tint: .mint,
                    title: "Search Scopes & Multi-Criteria Sort",
                    description: "Target your searches by Title, Content, Tags, or Action Items, and sort notes by date, title, audio duration, or tasks."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "text.cursor",
                    tint: .blue,
                    title: "Punctuation & Linebreak Preservation",
                    description: "Fixed whitespace regular expression handling in voice command processor to preserve double newlines and formatting commands.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "externaldrive.badge.checkmark",
                    tint: .green,
                    title: "Backward-Compatible JSON Storage",
                    description: "Added resilient decoding fallbacks for existing notes_store.json databases missing new pin, archive, color, and lock attributes.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "repeat.circle",
                    tint: .purple,
                    title: "Looping Playback Seamless Replay",
                    description: "Resolved race condition during playback termination so looped audio restarts without delay or stutter.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "moon.circle",
                    tint: .indigo,
                    title: "Responsive HTML Dark Mode Styling",
                    description: "Styled HTML exports with dynamic CSS system variables adapting seamlessly to light and dark reader appearances.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "checkmark.shield",
                    tint: .teal,
                    title: "Backup Package Integrity Verification",
                    description: "Added payload validation for imported JSON backups to reject damaged or incomplete archive files.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "number.circle",
                    tint: .orange,
                    title: "Memoized Tag Count Performance",
                    description: "Optimized tag badge count computation across large note libraries to prevent UI frame drops.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "checklist.checked",
                    tint: .mint,
                    title: "Action Item Markdown Sync",
                    description: "Corrected checkbox state toggles in note details to update persisted markdown while leaving raw audio intact.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "macwindow",
                    tint: .pink,
                    title: "Window Bounds & Presentation Parity",
                    description: "Set minimum desktop window dimensions on macOS and resolved letterboxing constraints on iOS compatibility views.",
                    kind: .improvement
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "1.19.0",
            date: "October 2026",
            tagline: "Scrubbing, Speeds, Calendars & Storage",
            features: [
                WhatsNewItem(
                    icon: "waveform.badge.magnifyingglass",
                    tint: .blue,
                    title: "Audio Scrubbing & Transcript Sync",
                    description: "Tap any timing chip in the verbatim transcript to scrub audio playback directly to that spoken moment."
                ),
                WhatsNewItem(
                    icon: "gauge.with.needle",
                    tint: .purple,
                    title: "Variable Playback Speeds",
                    description: "Listen to voice notes at 0.8x, 1x, 1.25x, 1.5x, or 2x speed with high-fidelity pitch preservation."
                ),
                WhatsNewItem(
                    icon: "calendar.badge.plus",
                    tint: .red,
                    title: "Apple Calendar & Reminders Export",
                    description: "Export action items to Apple Reminders and schedule meetings directly into Apple Calendar with one tap."
                ),
                WhatsNewItem(
                    icon: "checkmark.square",
                    tint: .green,
                    title: "Interactive Checklist Toggling",
                    description: "Tap action item checkboxes directly in your structured brief to mark tasks done, automatically syncing your note markdown."
                ),
                WhatsNewItem(
                    icon: "trash",
                    tint: .pink,
                    title: "Storage Management Dashboard",
                    description: "Inspect total audio storage and clean up old recordings in Settings while preserving all text notes."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "waveform",
                    tint: .blue,
                    title: "Scrubber Precision Snapping",
                    description: "Upgraded audio scrubber response to 10-millisecond precision for crisp sentence boundary matching.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "calendar",
                    tint: .red,
                    title: "Calendar Permission Fallback",
                    description: "Provided direct recovery instructions when calendar or reminder access permissions are denied.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "music.note",
                    tint: .purple,
                    title: "Spectral Pitch Preservation",
                    description: "Employed high-quality spectral time pitch compensation to eliminate audio distortion at 2x playback.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "lock.doc",
                    tint: .orange,
                    title: "Active Audio Deletion Protection",
                    description: "Prevented deletion of recording files that are currently active in the audio playback engine.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "memorychip",
                    tint: .teal,
                    title: "Transcript Memory Management",
                    description: "Eliminated memory retention cycles when scrubbing back and forth across long multi-minute recordings.",
                    kind: .fix
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "1.18.0",
            date: "October 2026",
            tagline: "Voice Commands & Multi-Language Whisper",
            features: [
                WhatsNewItem(
                    icon: "bubble.left.and.exclamationmark.bubble.right",
                    tint: .orange,
                    title: "Voice Editing Commands",
                    description: "Say 'scratch that' or 'strike that' to erase preceding thoughts, or say 'Title:' and 'Action item:' while dictating."
                ),
                WhatsNewItem(
                    icon: "globe",
                    tint: .teal,
                    title: "Multi-Language Whisper STT",
                    description: "Select custom dictation languages (Spanish, French, German, Chinese, Japanese, etc.) or let Whisper auto-detect."
                ),
                WhatsNewItem(
                    icon: "doc.richtext",
                    tint: .indigo,
                    title: "Obsidian & Styled PDF Export",
                    description: "Export notes with Obsidian YAML frontmatter (.md) or share beautifully styled PDF documents."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "speaker.slash",
                    tint: .teal,
                    title: "Silence Hallucination Suppression",
                    description: "Prevented Whisper STT token repetition loops during silent pauses or low ambient audio.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "quote.bubble",
                    tint: .indigo,
                    title: "YAML Frontmatter Quotes Escaping",
                    description: "Correctly escaped quotation marks in note titles during Obsidian Markdown exports.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "doc.on.doc",
                    tint: .purple,
                    title: "Multi-Page PDF Layout Engine",
                    description: "Calculated intelligent page break thresholds so action items and headers are never awkwardly severed.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "character.cursor.ibeam",
                    tint: .orange,
                    title: "Verbal Title Boundary Detection",
                    description: "Improved inline title extraction accuracy when voice commands are spoken rapidly.",
                    kind: .improvement
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "1.17.0",
            date: "October 2026",
            tagline: "Audio Interruption & Background Sync Recovery",
            features: [
                WhatsNewItem(
                    icon: "headphones",
                    tint: .blue,
                    title: "Audio Interruption Recovery",
                    description: "Automatic pause and recovery when phone calls arrive or AirPods/headphones disconnect."
                ),
                WhatsNewItem(
                    icon: "bolt.badge.clock",
                    tint: .purple,
                    title: "Background Task Safeguards",
                    description: "Zero data loss with proactive state preservation when background execution time expires."
                ),
                WhatsNewItem(
                    icon: "applewatch.badge.checkmark",
                    tint: .green,
                    title: "Watch Storage Auto-Purge",
                    description: "Older synced voice memos on Apple Watch are purged automatically after successful transfer to iPhone."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "phone.down",
                    tint: .red,
                    title: "Cellular Call Interruption Reset",
                    description: "Restored audio recording state automatically upon dismissal of incoming phone calls.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "antenna.radiowaves.left.and.right",
                    tint: .blue,
                    title: "WatchConnectivity Queue Backoff",
                    description: "Added exponential backoff and retry for watch-to-phone audio sync transfers.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "internaldrive",
                    tint: .gray,
                    title: "Storage Threshold Safeguards",
                    description: "Verified device free space before initiating Whisper model loads to prevent out-of-disk errors.",
                    kind: .fix
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "1.16.0",
            date: "October 2026",
            tagline: "Apple Watch UI & Complications Overhaul",
            features: [
                WhatsNewItem(
                    icon: "applewatch",
                    tint: .orange,
                    title: "Redesigned Apple Watch Companion",
                    description: "Completely overhauled watch app with fluid haptic recording, live waveforms, and ambient countdowns."
                ),
                WhatsNewItem(
                    icon: "circle.grid.2x2",
                    tint: .teal,
                    title: "All Complication Families",
                    description: "Circular, Corner, Rectangular, and Inline watch complications launch instant audio capture from any watch face."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "hand.tap",
                    tint: .orange,
                    title: "Watch Haptic Synchronization",
                    description: "Calibrated haptic tap feedback to synchronize precisely with watch audio capture start.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "arrow.up.right.square",
                    tint: .teal,
                    title: "Complication Cold-Boot Routing",
                    description: "Fixed deep link routing when launching record flow from watch complications on a cold launch.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "battery.100",
                    tint: .green,
                    title: "Watch Display Sleep Efficiency",
                    description: "Lowered watch display refresh rate when the wrist is lowered to conserve watch battery.",
                    kind: .improvement
                )
            ]
        )
    ]

    @State private var selectedVersion: String = WhatsNewView.currentVersion
    @State private var showingImprovements: Bool = false
    @State private var selectedFeature: WhatsNewItem? = nil

    public var currentRelease: ReleaseHistoryItem {
        Self.releases.first(where: { $0.version == selectedVersion }) ?? Self.releases[0]
    }

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        header

                        versionSelector

                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Text(currentRelease.tagline)
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Spacer()
                                Text(currentRelease.date)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.top, 4)

                            // MARK: - New Features (Shown Up Front)
                            VStack(alignment: .leading, spacing: 14) {
                                HStack(spacing: 6) {
                                    Image(systemName: "sparkles")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(Color.accentColor)
                                    Text("NEW FEATURES")
                                        .font(.subheadline.weight(.bold))
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.bottom, 2)

                                ForEach(currentRelease.features) { item in
                                    itemRow(item)
                                }
                            }

                            // MARK: - Secondary UI Button for Bug Fixes & Improvements
                            if !currentRelease.improvementsAndFixes.isEmpty {
                                Button {
                                    showingImprovements = true
                                } label: {
                                    HStack(spacing: 12) {
                                        ZStack {
                                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                .fill(Color.accentColor.opacity(0.12))
                                                .frame(width: 38, height: 38)
                                            Image(systemName: "wrench.and.screwdriver.fill")
                                                .font(.system(size: 15, weight: .semibold))
                                                .foregroundStyle(Color.accentColor)
                                        }

                                        VStack(alignment: .leading, spacing: 3) {
                                            Text("Bug Fixes & Improvements")
                                                .font(.headline)
                                                .foregroundStyle(.primary)
                                            Text("\(currentRelease.improvementsAndFixes.count) fixes and system enhancements in v\(currentRelease.version)")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }

                                        Spacer()

                                        Image(systemName: "chevron.right")
                                            .font(.system(size: 13, weight: .bold))
                                            .foregroundStyle(.tertiary)
                                    }
                                    .padding(12)
                                    .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                                            .stroke(Color.primary.opacity(0.06), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                                .padding(.top, 6)
                            }
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
                }

                Divider()

                VStack {
                    Button {
                        UserDefaults.standard.set(Self.currentVersion, forKey: Self.lastSeenVersionKey)
                        dismiss()
                    } label: {
                        Text("Continue")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            #if os(iOS)
                            .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .foregroundStyle(.white)
                            #endif
                    }
                    #if os(macOS)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    #endif
                }
                .padding(20)
            }
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        UserDefaults.standard.set(Self.currentVersion, forKey: Self.lastSeenVersionKey)
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    if !currentRelease.improvementsAndFixes.isEmpty {
                        Button {
                            showingImprovements = true
                        } label: {
                            Image(systemName: "wrench.and.screwdriver")
                        }
                        .help("View Bug Fixes & Improvements")
                    }
                }
            }
            .sheet(isPresented: $showingImprovements) {
                WhatsNewImprovementsView(release: currentRelease)
            }
            .sheet(item: $selectedFeature) { item in
                WhatsNewFeatureDetailView(item: item, releaseVersion: currentRelease.version)
            }
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "sparkles")
                .font(.system(size: 40, weight: .bold))
                .foregroundStyle(Color.accentColor)
                .padding(.bottom, 2)

            Text("What's New in Voxbrief")
                .font(.title2.bold())
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }

    private var versionSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Self.releases) { release in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selectedVersion = release.version
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Text("v\(release.version)")
                                .font(.subheadline.weight(.semibold))
                            if release.version == Self.currentVersion {
                                Text("LATEST")
                                    .font(.system(size: 9, weight: .bold))
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 2)
                                    .background(selectedVersion == release.version ? Color.white.opacity(0.25) : Color.accentColor.opacity(0.15))
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .background {
                            Capsule()
                                .fill(selectedVersion == release.version ? Color.accentColor : Color.appTertiaryFill)
                        }
                        .foregroundStyle(selectedVersion == release.version ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func itemRow(_ item: WhatsNewItem) -> some View {
        Button {
            selectedFeature = item
        } label: {
            HStack(alignment: .top, spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(item.tint.opacity(0.15))
                        .frame(width: 36, height: 36)
                    Image(systemName: item.icon)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(item.tint)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.headline)
                        .foregroundStyle(.primary)

                    Text(item.description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 4)

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.tertiary)
                    .padding(.top, 10)
            }
            .contentShape(Rectangle())
            .padding(.vertical, 2)
        }
        .buttonStyle(.plain)
    }
}

/// Secondary UI displaying Bug Fixes and Performance Improvements for a release.
public struct WhatsNewImprovementsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedItem: WhatsNewItem? = nil
    public let release: ReleaseHistoryItem

    public init(release: ReleaseHistoryItem) {
        self.release = release
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: 8) {
                            Image(systemName: "wrench.and.screwdriver.fill")
                                .font(.title3)
                                .foregroundStyle(Color.accentColor)
                            Text("Bug Fixes & Improvements")
                                .font(.title2.bold())
                        }

                        Text("Voxbrief v\(release.version) • \(release.date)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 4)

                    if release.improvementsAndFixes.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "checkmark.seal")
                                .font(.system(size: 40))
                                .foregroundStyle(.secondary)
                            Text("No additional bug fixes reported for this version.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 32)
                    } else {
                        VStack(alignment: .leading, spacing: 14) {
                            ForEach(release.improvementsAndFixes) { item in
                                improvementRow(item)
                            }
                        }
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 20)
            }
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .sheet(item: $selectedItem) { item in
                WhatsNewFeatureDetailView(item: item, releaseVersion: release.version)
            }
        }
        #if os(iOS)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        #elseif os(macOS)
        .frame(minWidth: 480, minHeight: 460)
        #endif
    }

    private func improvementRow(_ item: WhatsNewItem) -> some View {
        Button {
            selectedItem = item
        } label: {
            HStack(alignment: .top, spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(item.tint.opacity(0.15))
                        .frame(width: 36, height: 36)
                    Image(systemName: item.icon)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(item.tint)
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(item.title)
                            .font(.headline)
                            .foregroundStyle(.primary)

                        Text(item.kind.rawValue)
                            .font(.system(size: 10, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(item.kind == .fix ? Color.red.opacity(0.15) : Color.blue.opacity(0.15))
                            .foregroundStyle(item.kind == .fix ? Color.red : Color.blue)
                            .clipShape(Capsule())
                    }

                    Text(item.description)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 4)

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.tertiary)
                    .padding(.top, 10)
            }
            .contentShape(Rectangle())
            .padding(.vertical, 2)
        }
        .buttonStyle(.plain)
    }
}

/// Interactive visualizations rendered within feature detail views
public struct WhatsNewVisualizationView: View {
    public let visualization: WhatsNewVisualization
    public let tint: Color

    @State private var waveformHeights: [CGFloat] = [0.2, 0.45, 0.7, 0.35, 0.85, 0.5, 0.9, 0.65, 0.4, 0.8, 0.55, 0.3, 0.75, 0.4, 0.6]
    @State private var isRecordingSimulated: Bool = true
    @State private var watchTabSelection: Int = 0
    @State private var pipelineActiveStage: Int = 1
    @State private var selectedThemeIndex: Int = 0

    public init(visualization: WhatsNewVisualization, tint: Color = .blue) {
        self.visualization = visualization
        self.tint = tint
    }

    public var body: some View {
        VStack(spacing: 12) {
            switch visualization {
            case .waveform:
                waveformVisualization
            case .swipeGesture:
                swipeGestureVisualization
            case .pipeline:
                pipelineVisualization
            case .vwaveMark:
                vwaveMarkVisualization
            case .complications:
                complicationsVisualization
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
        )
    }

    // MARK: - Waveform Visualization
    private var waveformVisualization: some View {
        VStack(spacing: 14) {
            HStack {
                Label(isRecordingSimulated ? "Live Input Active" : "Input Paused", systemImage: isRecordingSimulated ? "waveform.badge.mic" : "mic.slash")
                    .font(.caption.bold())
                    .foregroundStyle(isRecordingSimulated ? Color.red : Color.secondary)
                Spacer()
                Text("32kHz AAC Mono")
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 4) {
                ForEach(0..<waveformHeights.count, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(tint)
                        .frame(width: 6, height: isRecordingSimulated ? 50 * waveformHeights[index] : 8)
                        .animation(.easeInOut(duration: 0.25).repeatForever(autoreverses: true).delay(Double(index) * 0.04), value: waveformHeights[index])
                }
            }
            .frame(height: 56)
            .frame(maxWidth: .infinity)

            Button {
                withAnimation {
                    isRecordingSimulated.toggle()
                    if isRecordingSimulated {
                        for i in 0..<waveformHeights.count {
                            waveformHeights[i] = CGFloat.random(in: 0.2...1.0)
                        }
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: isRecordingSimulated ? "pause.fill" : "play.fill")
                    Text(isRecordingSimulated ? "Pause Live Waveform" : "Simulate Live Audio")
                }
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.appTertiaryFill, in: Capsule())
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Swipe Gesture Visualization
    private var swipeGestureVisualization: some View {
        VStack(spacing: 12) {
            HStack(spacing: 16) {
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        watchTabSelection = 0
                    }
                } label: {
                    Text("Capture Screen")
                        .font(.caption.weight(watchTabSelection == 0 ? .bold : .medium))
                        .foregroundStyle(watchTabSelection == 0 ? tint : .secondary)
                        .padding(.vertical, 4)
                        .padding(.horizontal, 10)
                        .background(watchTabSelection == 0 ? tint.opacity(0.12) : Color.clear, in: Capsule())
                }
                .buttonStyle(.plain)

                Button {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        watchTabSelection = 1
                    }
                } label: {
                    Text("Memo Vault")
                        .font(.caption.weight(watchTabSelection == 1 ? .bold : .medium))
                        .foregroundStyle(watchTabSelection == 1 ? tint : .secondary)
                        .padding(.vertical, 4)
                        .padding(.horizontal, 10)
                        .background(watchTabSelection == 1 ? tint.opacity(0.12) : Color.clear, in: Capsule())
                }
                .buttonStyle(.plain)
            }

            // Watch Face Mockup
            ZStack {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(Color.black)
                    .frame(width: 170, height: 180)
                    .overlay(
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 2)
                    )

                VStack(spacing: 8) {
                    // Time header
                    HStack {
                        Text("10:09")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                        Spacer()
                        Image(systemName: "battery.100")
                            .font(.system(size: 9))
                            .foregroundStyle(.green)
                    }
                    .padding(.horizontal, 14)
                    .padding(.top, 8)

                    Spacer(minLength: 0)

                    if watchTabSelection == 0 {
                        // Resting Capture UI
                        VStack(spacing: 6) {
                            Text("✨ Auto")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Color.accentColor.opacity(0.3), in: Capsule())

                            Circle()
                                .fill(Color.red)
                                .frame(width: 44, height: 44)
                                .overlay(
                                    Image(systemName: "mic.fill")
                                        .font(.system(size: 18, weight: .bold))
                                        .foregroundStyle(.white)
                                )

                            Text("Tap to Record")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.gray)
                        }
                    } else {
                        // Memo Vault UI
                        VStack(spacing: 4) {
                            HStack {
                                Text("Vault (3)")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white)
                                Spacer()
                            }
                            .padding(.horizontal, 12)

                            VStack(spacing: 3) {
                                HStack {
                                    Text("• Product Sync")
                                        .font(.system(size: 9))
                                        .foregroundStyle(.white)
                                    Spacer()
                                    Text("Synced")
                                        .font(.system(size: 8))
                                        .foregroundStyle(.green)
                                }
                                .padding(4)
                                .background(Color.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))

                                HStack {
                                    Text("• Architecture Note")
                                        .font(.system(size: 9))
                                        .foregroundStyle(.white)
                                    Spacer()
                                    Text("Synced")
                                        .font(.system(size: 8))
                                        .foregroundStyle(.green)
                                }
                                .padding(4)
                                .background(Color.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
                            }
                            .padding(.horizontal, 10)
                        }
                    }

                    Spacer(minLength: 0)

                    // Native WatchOS Pagination Indicator
                    HStack(spacing: 5) {
                        Circle()
                            .fill(watchTabSelection == 0 ? Color.white : Color.white.opacity(0.3))
                            .frame(width: 5, height: 5)
                        Circle()
                            .fill(watchTabSelection == 1 ? Color.white : Color.white.opacity(0.3))
                            .frame(width: 5, height: 5)
                    }
                    .padding(.bottom, 8)
                }
                .frame(width: 170, height: 180)
            }

            Text("Horizontal swipe transitions seamlessly between capture and saved memos.")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Pipeline Visualization
    private var pipelineVisualization: some View {
        VStack(spacing: 14) {
            Text("On-Device Processing Stages")
                .font(.caption.bold())
                .foregroundStyle(.secondary)

            HStack(spacing: 6) {
                pipelineNode(index: 0, title: "Audio", icon: "waveform", color: .blue)
                Image(systemName: "arrow.right")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                pipelineNode(index: 1, title: "WhisperKit", icon: "cpu", color: .purple)
                Image(systemName: "arrow.right")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                pipelineNode(index: 2, title: "Qwen3 LLM", icon: "brain.head.profile", color: .indigo)
                Image(systemName: "arrow.right")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                pipelineNode(index: 3, title: "Markdown", icon: "doc.text.fill", color: .green)
            }

            VStack(alignment: .leading, spacing: 4) {
                switch pipelineActiveStage {
                case 0:
                    Text("Stage 1: Capture Ingest")
                        .font(.caption.bold())
                        .foregroundStyle(.blue)
                    Text("32kHz AAC mono audio captured directly from Watch or iPhone, buffered locally with zero telemetry.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                case 1:
                    Text("Stage 2: CoreML WhisperKit ASR")
                        .font(.caption.bold())
                        .foregroundStyle(.purple)
                    Text("Whisper base.en executed on Apple Neural Engine. Fast, 100% offline speech-to-text with zero cloud calls.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                case 2:
                    Text("Stage 3: On-Device Qwen3 via MLX")
                        .font(.caption.bold())
                        .foregroundStyle(.indigo)
                    Text("Extracts title, concise summary, checklist requirements, and condition tags using 4-bit quantized Qwen3.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                default:
                    Text("Stage 4: Structured Markdown")
                        .font(.caption.bold())
                        .foregroundStyle(.green)
                    Text("Deterministic assembler produces clean GitHub-flavored markdown stored locally in JSON format.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(Color.appTertiaryFill, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    private func pipelineNode(index: Int, title: String, icon: String, color: Color) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                pipelineActiveStage = index
            }
        } label: {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(pipelineActiveStage == index ? color : color.opacity(0.15))
                        .frame(width: 32, height: 32)
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(pipelineActiveStage == index ? .white : color)
                }
                Text(title)
                    .font(.system(size: 9, weight: pipelineActiveStage == index ? .bold : .medium))
                    .foregroundStyle(pipelineActiveStage == index ? .primary : .secondary)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - V-Wave Mark Visualization
    private var vwaveMarkVisualization: some View {
        VStack(spacing: 12) {
            let colors: [(name: String, color: Color)] = [
                ("Royal Blue", Color(red: 0.055, green: 0.392, blue: 0.965)),
                ("Pure Black", Color.black),
                ("Slate", Color.gray),
                ("Indigo", Color.indigo)
            ]

            HStack(spacing: 8) {
                ForEach(0..<colors.count, id: \.self) { idx in
                    Button {
                        selectedThemeIndex = idx
                    } label: {
                        Text(colors[idx].name)
                            .font(.caption2.weight(selectedThemeIndex == idx ? .bold : .regular))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(selectedThemeIndex == idx ? colors[idx].color.opacity(0.18) : Color.appTertiaryFill, in: Capsule())
                            .foregroundStyle(selectedThemeIndex == idx ? colors[idx].color : .secondary)
                    }
                    .buttonStyle(.plain)
                }
            }

            ZStack {
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(colors[selectedThemeIndex].color)
                    .frame(width: 80, height: 80)

                VWaveMarkView(color: .white)
                    .frame(width: 60, height: 60)
            }
            .padding(.vertical, 4)

            VStack(spacing: 2) {
                Text("Left Stem: 10% diagonal stroke • Right Arm: 3 equalizer bars")
                    .font(.caption2.bold())
                    .foregroundStyle(.primary)
                Text("Widened 1:1 bar spacing eliminates smudging on high-density OLED and retina displays.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    // MARK: - Complications Visualization
    private var complicationsVisualization: some View {
        VStack(spacing: 12) {
            Text("Apple Watch Complications")
                .font(.caption.bold())
                .foregroundStyle(.secondary)

            HStack(spacing: 16) {
                // Circular
                VStack(spacing: 6) {
                    ZStack {
                        Circle()
                            .fill(Color.black)
                            .frame(width: 44, height: 44)
                            .overlay(Circle().stroke(Color.accentColor.opacity(0.4), lineWidth: 1.5))
                        VWaveMarkView(color: Color.accentColor)
                            .frame(width: 26, height: 26)
                    }
                    Text("Circular")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.secondary)
                }

                // Corner
                VStack(spacing: 6) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(Color.black)
                            .frame(width: 44, height: 44)
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.accentColor.opacity(0.4), lineWidth: 1.5))
                        VWaveMarkView(color: Color.accentColor)
                            .frame(width: 22, height: 22)
                    }
                    Text("Corner")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.secondary)
                }

                // Rectangular
                VStack(spacing: 6) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(Color.black)
                            .frame(width: 90, height: 44)
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.accentColor.opacity(0.4), lineWidth: 1.5))
                        HStack(spacing: 6) {
                            VWaveMarkView(color: Color.accentColor)
                                .frame(width: 18, height: 18)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Voxbrief")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundStyle(.white)
                                Text("Tap to Record")
                                    .font(.system(size: 7))
                                    .foregroundStyle(.gray)
                            }
                        }
                    }
                    Text("Rectangular")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundStyle(.secondary)
                }
            }

            Text("One-tap memo capture from any watch face slot via deep link.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

/// Dedicated interactive detail page for a single feature, improvement, or bug fix.
public struct WhatsNewFeatureDetailView: View {
    @Environment(\.dismiss) private var dismiss
    public let item: WhatsNewItem
    public let releaseVersion: String

    public init(item: WhatsNewItem, releaseVersion: String) {
        self.item = item
        self.releaseVersion = releaseVersion
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    // Header Section
                    headerSection

                    // Summary Overview Card
                    overviewCard

                    // Optional Interactive Visualization
                    if let visualization = item.visualization {
                        VStack(alignment: .leading, spacing: 8) {
                            Label("Interactive Preview", systemImage: "hand.tap.fill")
                                .font(.subheadline.bold())
                                .foregroundStyle(item.tint)
                            WhatsNewVisualizationView(visualization: visualization, tint: item.tint)
                        }
                    }

                    // Optional Screenshot Asset
                    if let screenshotName = item.screenshotName {
                        screenshotCard(screenshotName)
                    }

                    // Optional Detailed Narrative
                    if let detailed = item.detailedDescription {
                        detailedCard(detailed)
                    }

                    // Optional Highlights List
                    if let highlights = item.highlights, !highlights.isEmpty {
                        highlightsCard(highlights)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 20)
            }
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                    .font(.body.weight(.semibold))
                }
            }
        }
        #if os(iOS)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        #elseif os(macOS)
        .frame(minWidth: 520, minHeight: 600)
        #endif
    }

    private var headerSection: some View {
        HStack(alignment: .top, spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(item.tint.opacity(0.15))
                    .frame(width: 52, height: 52)
                Image(systemName: item.icon)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(item.tint)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(item.title)
                    .font(.title3.bold())
                    .foregroundStyle(.primary)

                HStack(spacing: 6) {
                    Text(item.kind.rawValue.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(badgeBackground, in: Capsule())
                        .foregroundStyle(badgeForeground)

                    Text("v\(releaseVersion)")
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(Color.appTertiaryFill, in: Capsule())
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var badgeBackground: Color {
        switch item.kind {
        case .feature:
            return item.tint.opacity(0.15)
        case .fix:
            return Color.red.opacity(0.15)
        case .improvement:
            return Color.blue.opacity(0.15)
        }
    }

    private var badgeForeground: Color {
        switch item.kind {
        case .feature:
            return item.tint
        case .fix:
            return Color.red
        case .improvement:
            return Color.blue
        }
    }

    private var overviewCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(item.description)
                .font(.body)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func detailedCard(_ detailed: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Deep Dive", systemImage: "text.alignleft")
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)

            Text(detailed)
                .font(.body)
                .foregroundStyle(.primary)
                .fixedSize(horizontal: false, vertical: true)
                .lineSpacing(3)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func highlightsCard(_ highlights: [String]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Key Highlights", systemImage: "checkmark.circle.fill")
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 10) {
                ForEach(highlights, id: \.self) { highlight in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(item.tint)
                            .padding(.top, 4)

                        Text(highlight)
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func screenshotCard(_ name: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Visual Preview", systemImage: "photo")
                .font(.subheadline.bold())
                .foregroundStyle(.secondary)

            #if os(iOS)
            if UIImage(named: name) != nil {
                Image(name)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                screenshotFallback(name)
            }
            #elseif os(macOS)
            if NSImage(named: name) != nil {
                Image(nsImage: NSImage(named: name)!)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                screenshotFallback(name)
            }
            #endif
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSecondaryBackground, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func screenshotFallback(_ name: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "photo.on.rectangle.angled")
                .font(.title2)
                .foregroundStyle(.tertiary)
            VStack(alignment: .leading, spacing: 2) {
                Text("Asset: \(name)")
                    .font(.caption.monospaced())
                    .foregroundStyle(.primary)
                Text("Referenced preview asset")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appTertiaryFill, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

