import SwiftUI

public struct WhatsNewItem: Identifiable, Sendable {
    public let id = UUID()
    public let icon: String
    public let title: String
    public let description: String

    public init(icon: String, title: String, description: String) {
        self.icon = icon
        self.title = title
        self.description = description
    }
}

public struct ReleaseNotes: Identifiable, Sendable {
    public let version: String
    public let date: String
    public let items: [WhatsNewItem]
    public var id: String { version }

    public init(version: String, date: String, items: [WhatsNewItem]) {
        self.version = version
        self.date = date
        self.items = items
    }
}

public struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    public static let currentVersion = "0.6.0"
    public static let lastSeenVersionKey = "last_seen_whats_new_version"

    public static let releases: [ReleaseNotes] = [
        ReleaseNotes(version: "0.6.0", date: "November 2026", items: [
            WhatsNewItem(icon: "headphones", title: "Continuous Audio & Live Activities", description: "Play all glances or deep dives continuously with Lock Screen and Dynamic Island controls, AirPods next/previous card skipping, and automatic offline audio caching."),
            WhatsNewItem(icon: "rectangle.grid.2x2", title: "Widgets & Shortcuts", description: "Add G2 Digest Home Screen and Lock Screen widgets, or ask Siri to read today's headline or start your morning briefing."),
            WhatsNewItem(icon: "bookmark", title: "Bookmarks, Archive Search & Sharing", description: "Bookmark cards from your glasses or phone, search across kept editions, and copy revocable read-only share links."),
            WhatsNewItem(icon: "eyeglasses", title: "Smarter Glasses & Agent Diagnostics", description: "Unread dots, 5-edition offline cache, Commute Mode, and quick section/alert jumps on Even G2 — plus build-run diagnostics, scheduled delivery, and reader signals for your build agent."),
        ]),
        ReleaseNotes(version: "0.5.2", date: "November 2026", items: [
            WhatsNewItem(icon: "checkmark.seal", title: "One Pro, everywhere", description: "G2 Digest Pro now belongs to your account: buy it once, here or on the web, and it works on the web, this iPhone and your glasses wherever you sign in. Already have it? Sign in and it's there."),
            WhatsNewItem(icon: "hammer", title: "Ready for iOS 27", description: "G2 Digest is now built with the iOS 27 SDK."),
        ]),
        ReleaseNotes(version: "0.5.1", date: "November 2026", items: [
            WhatsNewItem(icon: "sparkles", title: "A new Pro screen", description: "The G2 Digest Pro screen is redesigned: it opens over a glimpse of the app, your plans in one list and one clear button for the one you pick."),
        ]),
        ReleaseNotes(version: "0.5.0", date: "November 2026", items: [
            WhatsNewItem(icon: "checkmark.seal", title: "G2 Digest Pro", description: "G2 Digest is now free to download: try everything for a week, then keep it with G2 Digest Pro, yearly or once for life. Manage it, or restore a purchase, in Settings."),
        ]),
        ReleaseNotes(version: "0.4.5", date: "November 2026", items: [
            WhatsNewItem(icon: "slider.horizontal.3", title: "Edit Your Brief on iPhone", description: "Everything the web app's brief editor does: the edition's name and budgets, delivery time and days, and every section's template, max cards, quiet days, audio, source and instructions. Add, reorder and remove sections, and keep a glossary."),
            WhatsNewItem(icon: "newspaper", title: "Read the Full Edition", description: "The new Edition tab shows the whole written edition with how each section was put together and its sources, in serif or sans, at your text size. Jump from any section to its cards."),
            WhatsNewItem(icon: "bell.badge", title: "Know When It's Ready", description: "Turn on notifications in Settings to hear the moment your agent publishes a new edition."),
            WhatsNewItem(icon: "cpu", title: "Build Agents and Podcast Feed", description: "Copy the MCP address and the build prompt, make and revoke agent tokens, disconnect assistants, and make a private podcast feed link, all from Settings.")
        ]),
        ReleaseNotes(version: "0.4.4", date: "November 2026", items: [
            WhatsNewItem(icon: "person.badge.key", title: "Cleaner Sign-In Buttons", description: "Continue with Apple and Continue with Google now sit together as a matched pair, in light and dark mode.")
        ]),
        ReleaseNotes(version: "0.4.3", date: "November 2026", items: [
            WhatsNewItem(icon: "person.crop.circle", title: "Sign In with Apple or Google", description: "Use the account you use on the web: your brief, every edition, and your glasses. Pair glasses with a code from Settings, unpair devices, or delete your data, right on your iPhone."),
            WhatsNewItem(icon: "arrow.clockwise", title: "Pull to Refresh", description: "Pull down on a card or the editions archive to check for new editions. The app also checks whenever you come back to it, and past editions show up as soon as you sign in or pair.")
        ]),
        ReleaseNotes(version: "0.4.2", date: "November 2026", items: [
            WhatsNewItem(
                icon: "checkmark.circle",
                title: "Your Editions Load After Pairing",
                description: "A paired iPhone could stay on the tour instead of showing your editions. It now opens your latest edition, with its glance and deep-dive audio."
            )
        ]),
        ReleaseNotes(version: "0.4.1", date: "November 2026", items: [
            WhatsNewItem(
                icon: "sparkles",
                title: "G2 Digest for iPhone",
                description: "Read your compiled morning brief cards before your commute, with offline storage for underground travel."
            ),
            WhatsNewItem(
                icon: "headphones",
                title: "Headphone Audio Player",
                description: "Listen to glance scripts and deep dive analysis with background audio, lock screen controls, and speed adjustments."
            ),
            WhatsNewItem(
                icon: "eyeglasses",
                title: "Even G2 HUD Simulator",
                description: "Experience the authentic green monochrome glasses layout with simulated ring swipe and tap gestures."
            ),
            WhatsNewItem(
                icon: "qrcode",
                title: "One-Tap 6-Digit Pairing",
                description: "Pair with your G2 Digest web account instantly using a 6-digit code or test immediately with the built-in tour."
            ),
        ]),
    ]

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("What's New in G2 Digest")
                            .font(.largeTitle.bold())
                        Text("Version \(Self.currentVersion)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top)

                    ForEach(Self.releases) { release in
                        VStack(alignment: .leading, spacing: 16) {
                            HStack {
                                Text("v\(release.version)")
                                    .font(.headline)
                                Spacer()
                                Text(release.date)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }

                            ForEach(release.items) { item in
                                HStack(alignment: .top, spacing: 14) {
                                    Image(systemName: item.icon)
                                        .font(.title2)
                                        .foregroundStyle(Color.accentColor)
                                        .frame(width: 32)

                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(item.title)
                                            .font(.subheadline.weight(.semibold))
                                        Text(item.description)
                                            .font(.footnote)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                        .padding()
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }
                .padding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        UserDefaults.standard.set(Self.currentVersion, forKey: Self.lastSeenVersionKey)
                        dismiss()
                    }
                }
            }
        }
    }
}
