import SwiftUI

public struct WhatsNewItem: Identifiable, Sendable {
    public let id = UUID()
    public let icon: String
    public let tint: Color
    public let title: String
    public let description: String

    public init(icon: String, tint: Color, title: String, description: String) {
        self.icon = icon
        self.tint = tint
        self.title = title
        self.description = description
    }
}

public struct ReleaseHistoryItem: Identifiable, Sendable {
    public let version: String
    public let date: String
    public let tagline: String
    public let items: [WhatsNewItem]

    public var id: String { version }

    public init(version: String, date: String, tagline: String, items: [WhatsNewItem]) {
        self.version = version
        self.date = date
        self.tagline = tagline
        self.items = items
    }
}

public struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    public static let currentVersion = "1.20.0"
    public static let lastSeenVersionKey = "last_seen_whats_new_version"

    public static var shouldShowAutomatically: Bool {
        let lastSeen = UserDefaults.standard.string(forKey: lastSeenVersionKey)
        return lastSeen != currentVersion
    }

    public static let releases: [ReleaseHistoryItem] = [
        ReleaseHistoryItem(
            version: "1.20.0",
            date: "October 2026",
            tagline: "Productivity, Audio Navigation & Full Backups",
            items: [
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
            ]
        ),
        ReleaseHistoryItem(
            version: "1.19.0",
            date: "October 2026",
            tagline: "Scrubbing, Speeds, Calendars & Storage",
            items: [
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
            ]
        ),
        ReleaseHistoryItem(
            version: "1.18.0",
            date: "October 2026",
            tagline: "Voice Commands & Multi-Language Whisper",
            items: [
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
            ]
        ),
        ReleaseHistoryItem(
            version: "1.17.0",
            date: "October 2026",
            tagline: "Audio Interruption & Background Sync Recovery",
            items: [
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
            ]
        ),
        ReleaseHistoryItem(
            version: "1.16.0",
            date: "October 2026",
            tagline: "Apple Watch UI & Complications Overhaul",
            items: [
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
            ]
        )
    ]

    @State private var selectedVersion: String = WhatsNewView.currentVersion

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

                            ForEach(currentRelease.items) { item in
                                itemRow(item)
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
