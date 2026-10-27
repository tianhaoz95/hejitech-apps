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

    static let currentVersion = "0.1.2"
    static let lastSeenVersionKey = "last_seen_whats_new_version"

    static let releases: [ReleaseNotes] = [
        ReleaseNotes(version: "0.1.2", date: "October 2026", items: [
            WhatsNewItem(
                icon: "text.cursor",
                title: "Direct URL Bar Input Focus",
                description: "Clicking the URL field with the touchpad focuses the address bar and immediately opens the keyboard for seamless typing."
            ),
            WhatsNewItem(
                icon: "menubar.rectangle",
                title: "Full-Screen Cursor Reach",
                description: "The mouse cursor now reaches all the way to the top edge to select layout presets (1, 2, 1+2, 2×2), split controls, and settings."
            ),
            WhatsNewItem(
                icon: "arrow.left.and.right",
                title: "Interactive Boundary Dragging",
                description: "Resize split panes effortlessly by dragging boundaries with the cursor or using the new Resize toggle on the phone trackpad."
            ),
            WhatsNewItem(
                icon: "macwindow",
                title: "Native Desktop Dialogs",
                description: "Alerts, path popups, folder creation, and rename prompts now render natively on the monitor and are fully clickable by the cursor."
            ),
        ]),
        ReleaseNotes(version: "0.1.1", date: "October 2026", items: [
            WhatsNewItem(
                icon: "display.2",
                title: "Independent External Monitor Desktop",
                description: "External monitors connected via USB-C or dock now host the full desktop workspace independently without mirroring the phone."
            ),
            WhatsNewItem(
                icon: "hand.tap",
                title: "Phone Touchpad & Keyboard Controller",
                description: "Your phone acts as an alternating smooth trackpad and developer keyboard, letting you move the cursor, scroll, and type into active monitor tabs."
            ),
            WhatsNewItem(
                icon: "keyboard",
                title: "Dock Keyboard & Mouse Support",
                description: "Physical USB and Bluetooth keyboards and mice connected to your dock now directly type, click, and scroll inside active monitor panes."
            ),
            WhatsNewItem(
                icon: "slider.horizontal.3",
                title: "Phone-Only Workspace Controls",
                description: "Launch websites, manage SSH hosts, and adjust tiling layouts directly from the phone controller without obscuring your external monitor."
            ),
        ]),
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
