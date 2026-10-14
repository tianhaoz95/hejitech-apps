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

public struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    public static let currentVersion = "1.19.0"
    public static let lastSeenVersionKey = "last_seen_whats_new_version"

    public static var shouldShowAutomatically: Bool {
        let lastSeen = UserDefaults.standard.string(forKey: lastSeenVersionKey)
        return lastSeen != currentVersion
    }

    public static let items: [WhatsNewItem] = [
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
        ),
        WhatsNewItem(
            icon: "trash",
            tint: .pink,
            title: "Storage Management Dashboard",
            description: "Inspect total audio storage and clean up old recordings in Settings while preserving all text notes."
        )
    ]

    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        header

                        VStack(alignment: .leading, spacing: 20) {
                            ForEach(Self.items) { item in
                                itemRow(item)
                            }
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 20)
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
                .font(.system(size: 44, weight: .bold))
                .foregroundStyle(Color.accentColor)
                .padding(.bottom, 4)

            Text("What's New in Voxbrief")
                .font(.title.bold())
                .multilineTextAlignment(.center)

            Text("Version \(Self.currentVersion)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private func itemRow(_ item: WhatsNewItem) -> some View {
        HStack(alignment: .top, spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(item.tint.opacity(0.15))
                    .frame(width: 38, height: 38)
                Image(systemName: item.icon)
                    .font(.system(size: 18, weight: .semibold))
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
    }
}
