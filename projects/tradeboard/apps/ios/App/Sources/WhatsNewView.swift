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

    public static let currentVersion = "0.1.13"
    public static let lastSeenVersionKey = "last_seen_whats_new_version_tradeboard"

    public static let releases: [ReleaseNotes] = [
        ReleaseNotes(version: "0.1.13", date: "November 2026", items: [
            WhatsNewItem(icon: "square.grid.2x2", title: "Cleaner Plan Tabs", description: "A plan's Thesis, Discussion, Receipts and Audit tabs are now icons, so they fit on any iPhone."),
            WhatsNewItem(icon: "laptopcomputer", title: "Robinhood Stays on Your Computer", description: "Robinhood on This iPhone is gone. Your executor on a computer (the Mac app or the command line) connects to Robinhood; the iPhone app is for your board and approvals. Any Robinhood sign-in the preview left on this iPhone is deleted.")
        ]),
        ReleaseNotes(version: "0.1.12", date: "November 2026", items: [
            WhatsNewItem(icon: "tray.and.arrow.down.fill", title: "Strategy Drafts from Your Agents", description: "When an agent interviews you and drafts a trading strategy, it now shows on the board and in Trading Strategy. Adopt it as is, edit it first, or dismiss it; agents can't change your strategy without you."),
            WhatsNewItem(icon: "sparkles", title: "Trading Strategy Fixed", description: "The Trading Strategy screen now shows your saved strategy and its earlier versions, and saving works.")
        ]),
        ReleaseNotes(version: "0.1.11", date: "November 2026", items: [
            WhatsNewItem(icon: "key.horizontal.fill", title: "Tokens for Agents Without OAuth", description: "Connect an Agent now shows both ways to connect: OAuth for apps like Claude and ChatGPT, and a token for everything else. Type the agent's name and tap Create Token; you get the token with a ready Claude Code command and MCP config.")
        ]),
        ReleaseNotes(version: "0.1.10", date: "November 2026", items: [
            WhatsNewItem(icon: "laptopcomputer.and.iphone", title: "Connect Robinhood from Your Computer", description: "Robinhood only allows connecting from a computer's browser. Robinhood on This iPhone now gives you a link (and QR code, or AirDrop it to your Mac): sign in there and the iPhone finishes the connection by itself. The connection's tokens stay on this iPhone.")
        ]),
        ReleaseNotes(version: "0.1.9", date: "November 2026", items: [
            WhatsNewItem(icon: "switch.2", title: "Dry-Run / Live Toggle", description: "The top of the board now has a toggle: yellow for dry-run, green for live. Switching back to dry-run is one tap; going live asks once and needs the live-mode checklist done."),
            WhatsNewItem(icon: "wrench.and.screwdriver", title: "Pause, Resume and Kill Work Again", description: "The mode switch, Pause/Resume and the emergency kill switch on the iPhone failed with an error. They now reach your board.")
        ]),
        ReleaseNotes(version: "0.1.8", date: "November 2026", items: [
            WhatsNewItem(icon: "link", title: "Connect an Agent from Your iPhone", description: "Settings → Connect an Agent shows your Board MCP address with a Copy button, registers agents, and makes tokens you can copy as-is or as a ready Claude Code command or MCP config. Revoke tokens and disconnect apps there too."),
            WhatsNewItem(icon: "iphone.and.arrow.forward", title: "Robinhood on This iPhone (Preview)", description: "Try signing in to Robinhood's official MCP straight from the phone and run a read-only check of your accounts, trade approvals and a quote. It never places or changes anything; orders still go through your executor.")
        ]),
        ReleaseNotes(version: "0.1.7", date: "November 2026", items: [
            WhatsNewItem(icon: "desktopcomputer", title: "Tradeboard Executor for Mac", description: "Run your executor from a Mac app instead of the terminal: it installs the executor, walks you through setup and Robinhood sign-in, shows its status in a window and the menu bar, and keeps itself up to date. Download it from the Executor page on the web.")
        ]),
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
