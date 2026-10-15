import SwiftUI

public enum WhatsNewItemKind: String, Sendable, CaseIterable {
    case feature = "Feature"
    case improvement = "Improvement"
    case fix = "Bug Fix"
}

public struct WhatsNewItem: Identifiable, Sendable {
    public let id: UUID
    public let icon: String
    public let tint: Color
    public let title: String
    public let description: String
    public let kind: WhatsNewItemKind

    public init(
        icon: String,
        tint: Color,
        title: String,
        description: String,
        kind: WhatsNewItemKind = .feature,
        id: UUID = UUID()
    ) {
        self.id = id
        self.icon = icon
        self.tint = tint
        self.title = title
        self.description = description
        self.kind = kind
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

    public static let currentVersion = "1.23.0"
    public static let lastSeenVersionKey = "last_seen_whats_new_version"

    public static var shouldShowAutomatically: Bool {
        let lastSeen = UserDefaults.standard.string(forKey: lastSeenVersionKey)
        return lastSeen != currentVersion
    }

    public static let releases: [ReleaseHistoryItem] = [
        ReleaseHistoryItem(
            version: "1.23.0",
            date: "October 2026",
            tagline: "High-Legibility V-Wave Brand Mark & Unclustered Multi-Scale Geometry",
            features: [
                WhatsNewItem(
                    icon: "waveform.badge.magnifyingglass",
                    tint: .blue,
                    title: "High-Legibility V-Wave Monogram",
                    description: "Refined the V-Wave logo with a 1:1 stroke-to-gap ratio and 3 bold equalizer bars, eliminating visual clustering across all screen sizes."
                ),
                WhatsNewItem(
                    icon: "app.badge.checkmark.fill",
                    tint: .cyan,
                    title: "Crisp Multi-Scale App Icon",
                    description: "Regenerated all discrete iOS, watchOS, and macOS icon assets from 1024px down to 16px with distinct, razor-sharp negative space."
                ),
                WhatsNewItem(
                    icon: "applewatch",
                    tint: .purple,
                    title: "High-Contrast Complications",
                    description: "Redesigned Apple Watch face complications with bold vector marks for instant recognition in circular, corner, and rectangular slots."
                ),
                WhatsNewItem(
                    icon: "sparkles",
                    tint: .orange,
                    title: "Optimized Home Header & Settings Branding",
                    description: "Balanced proportions and padding in navigation bar headers and settings cards for an elevated, clean aesthetic."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "square.split.3x3",
                    tint: .red,
                    title: "Monogram Bar Separation Fix",
                    description: "Eliminated bar overlapping and smudging on small retina viewports by widening inter-bar spacing by over 300%.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "slider.horizontal.2.square.badge.arrow.down",
                    tint: .green,
                    title: "Balanced Geometric Margins",
                    description: "Perfected optical centering and horizontal/vertical margins across all vector logo shapes.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "circle.circle.fill",
                    tint: .teal,
                    title: "Complication Retina Contrast",
                    description: "Increased accessory widget scaling with high-contrast accent backgrounds for glanceable outdoor legibility.",
                    kind: .improvement
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
                    description: "Effortlessly swipe between the resting capture hero and your memo vault with native watchOS pagination dots."
                ),
                WhatsNewItem(
                    icon: "sparkles",
                    tint: .purple,
                    title: "Auto-First Tagging on Wrist",
                    description: "Voice memos default to ✨ Auto-triage, with one-tap wrist switching between Idea, Task, and Meeting categories."
                ),
                WhatsNewItem(
                    icon: "app.badge.checkmark.fill",
                    tint: .cyan,
                    title: "Bespoke Flat V-Wave Brand Identity",
                    description: "New geometric V-Wave monogram across iOS, watchOS, and macOS icons—100% clean and flat with zero 3D glare or skeuomorphic gloss."
                ),
                WhatsNewItem(
                    icon: "gearshape.fill",
                    tint: .indigo,
                    title: "Dedicated Apple Watch Settings & Storage",
                    description: "Inspect companion sync health, check local audio cache size, and purge synced recordings directly from your wrist."
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
        }
        .padding(.vertical, 2)
    }
}

/// Secondary UI displaying Bug Fixes and Performance Improvements for a release.
public struct WhatsNewImprovementsView: View {
    @Environment(\.dismiss) private var dismiss
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
        }
        #if os(iOS)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        #elseif os(macOS)
        .frame(minWidth: 480, minHeight: 460)
        #endif
    }

    private func improvementRow(_ item: WhatsNewItem) -> some View {
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
        }
        .padding(.vertical, 2)
    }
}
