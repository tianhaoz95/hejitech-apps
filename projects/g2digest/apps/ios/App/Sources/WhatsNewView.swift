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

    public static let currentVersion = "0.4.4"
    public static let lastSeenVersionKey = "last_seen_whats_new_version"

    public static let releases: [ReleaseNotes] = [
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
