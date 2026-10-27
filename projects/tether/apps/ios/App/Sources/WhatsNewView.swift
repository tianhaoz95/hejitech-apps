import SwiftUI

struct WhatsNewItem: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let description: String
}

struct ReleaseNotes: Identifiable {
    let version: String
    let date: String
    let items: [WhatsNewItem]
    var id: String { version }
}

struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    static let currentVersion = "0.1.0"
    static let lastSeenVersionKey = "last_seen_whats_new_version"

    static let releases: [ReleaseNotes] = [
        ReleaseNotes(version: "0.1.0", date: "October 2026", items: [
            WhatsNewItem(
                icon: "rectangle.split.2x2",
                title: "Tiling Split-Pane Desktop Shell",
                description: "Split your workspace horizontally and vertically up to 4 panes, drag dividers, or switch between 4 built-in layout presets without losing open tabs."
            ),
            WhatsNewItem(
                icon: "globe",
                title: "Desktop Browser Per Tab",
                description: "Independent native WKWebView instances with desktop user-agent, shared cookies, search fallback, and file downloads."
            ),
            WhatsNewItem(
                icon: "terminal",
                title: "SSH-Only Terminal & Keychain Keys",
                description: "256-color ANSI terminal with mandatory SHA-256 host key verification, on-device Ed25519 key generation in Keychain, and dynamic PTY resize."
            ),
            WhatsNewItem(
                icon: "folder",
                title: "Local & SFTP File Browser",
                description: "Browse device Documents and remote SFTP directories, preview text files in Web tabs, and insert quoted paths directly into your focused terminal."
            ),
        ]),
    ]

    static var shouldShowAutomatically: Bool {
        let seen = UserDefaults.standard.string(forKey: lastSeenVersionKey)
        if seen == nil { markSeen(); return false }
        return seen != currentVersion
    }

    static func markSeen() {
        UserDefaults.standard.set(currentVersion, forKey: lastSeenVersionKey)
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(Self.releases) { r in
                    Section("\(r.version) · \(r.date)") {
                        ForEach(r.items) { item in
                            HStack(alignment: .top, spacing: 14) {
                                Image(systemName: item.icon)
                                    .font(.title2)
                                    .foregroundStyle(Color.accentColor)
                                    .frame(width: 34)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.title).font(.headline)
                                    Text(item.description).font(.subheadline).foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("What's New in Tether")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
