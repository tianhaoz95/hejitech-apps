import SwiftUI

public struct WhatsNewItem: Identifiable {
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

public struct ReleaseNotes: Identifiable {
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

    public static let currentVersion = "0.1.6"
    public static let lastSeenVersionKey = "last_seen_whats_new_version_tradeboard"

    public static let releases: [ReleaseNotes] = [
        ReleaseNotes(version: "0.1.6", date: "November 2026", items: [
            WhatsNewItem(icon: "key.fill", title: "Stay Signed In Across Launches", description: "Your verified Tradeboard session is now securely saved in the iOS Keychain so you stay signed in when you close and reopen the app."),
            WhatsNewItem(icon: "number.square", title: "Two-Factor Code AutoFill", description: "Tapping the 6-digit verification code field now triggers iOS Passwords and authenticator AutoFill and automatically verifies once 6 digits are entered.")
        ]),
        ReleaseNotes(version: "0.1.5", date: "November 2026", items: [
            WhatsNewItem(icon: "checkmark.shield", title: "Google and Apple Sign-In Fixed", description: "Signing in with Google (and Apple) could fail with \"404 page not found\" after you picked your account. It now finishes and goes on to your two-factor code.")
        ]),
        ReleaseNotes(version: "0.1.4", date: "November 2026", items: [
            WhatsNewItem(icon: "person.badge.key", title: "Cleaner Sign-In Buttons", description: "Continue with Apple and Continue with Google now sit side by side as a matched pair, in light and dark mode.")
        ]),
        ReleaseNotes(version: "0.1.3", date: "November 2026", items: [
            WhatsNewItem(icon: "applelogo", title: "Sign in with Apple Works", description: "Continue with Apple no longer fails with an error on the sign-in screen."),
            WhatsNewItem(icon: "globe", title: "Continue with Google", description: "Sign in with the Google account you use on the Tradeboard website, then confirm with your two-factor code as before.")
        ]),
        ReleaseNotes(version: "0.1.2", date: "November 2026", items: [
            WhatsNewItem(icon: "text.bubble", title: "Plans with Comments Open Again", description: "A plan with agent comments or questions could get stuck loading. It now opens with its whole discussion, and open questions show as open.")
        ]),
        ReleaseNotes(version: "0.1.1", date: "November 2026", items: [
            WhatsNewItem(icon: "trash", title: "Delete Your Board in the App", description: "Settings now has Delete My Board: it removes every plan, receipt, policy, strategy, agent and executor credential on your board, as the website does."),
            WhatsNewItem(icon: "envelope", title: "Sign In with Email", description: "Accounts Tradeboard hands out can sign in with email from the sign-in screen. Everyone else keeps using Apple and a two-factor code.")
        ]),
        ReleaseNotes(version: "0.1.0", date: "November 2026", items: [
            WhatsNewItem(icon: "shield.lefthalf.filled", title: "Autonomous Trading Plan Board", description: "Review and approve structured trade plans drafted and debated by your hosted AI discussion agents."),
            WhatsNewItem(icon: "lock.shield", title: "Two-Factor Safety Verification", description: "Every session is secured with TOTP two-factor authentication, ensuring only the owner can authorize live or dry-run orders."),
            WhatsNewItem(icon: "doc.text.magnifyingglass", title: "Structured Order Tickets", description: "Examine clear order tickets with symbol, limit price, estimated notional, and expiration before approving."),
            WhatsNewItem(icon: "bubble.left.and.exclamationmark.bubble.right", title: "Agent Discussion & In-line Questions", description: "Track real-time agent debate, dissenting viewpoints, and ask questions directly to AI agents."),
            WhatsNewItem(icon: "exclamationmark.octagon", title: "Emergency Kill Switch & Dry-Run", description: "Instantly halt execution or switch between dry-run simulation and live execution with one tap."),
            WhatsNewItem(icon: "cpu", title: "Local Executor Status", description: "Monitor your local execution daemon, Ollama/vLLM sanity model checks, and Robinhood connectivity.")
        ])
    ]

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("What's New in Tradeboard")
                            .font(.largeTitle.bold())
                        Text("Version \(Self.currentVersion)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 12)

                    ForEach(Self.releases) { release in
                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(release.items) { item in
                                HStack(alignment: .top, spacing: 16) {
                                    Image(systemName: item.icon)
                                        .font(.title2)
                                        .foregroundStyle(Color.accentColor)
                                        .frame(width: 36, height: 36)
                                        .background(Color.accentColor.opacity(0.12))
                                        .clipShape(RoundedRectangle(cornerRadius: 8))

                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(item.title)
                                            .font(.headline)
                                        Text(item.description)
                                            .font(.subheadline)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(24)
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
