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

    static let currentVersion = "0.1.10"
    static let lastSeenVersionKey = "last_seen_whats_new_version"

    static let releases: [ReleaseNotes] = [
        ReleaseNotes(version: "0.1.10", date: "October 2026", items: [
            WhatsNewItem(
                icon: "hand.draw.fill",
                title: "Configurable Dragging Gestures",
                description: "Choose between Double-Tap Drag and 3-Finger Drag in Settings to fluidly drag split dividers and windows on your external display."
            ),
            WhatsNewItem(
                icon: "hand.point.up.left.and.text.fill",
                title: "3-Finger Swipe Pane Navigation",
                description: "Swipe anywhere with 3 fingers in any direction (left, right, up, down) to instantly shift focus across workspace panes."
            ),
            WhatsNewItem(
                icon: "gearshape.2.fill",
                title: "Trackpad & AssistiveTouch Settings",
                description: "Clean, distraction-free trackpad UI with dedicated mode configuration in Settings: choose between Phone as Trackpad and Physical Mouse."
            ),
            WhatsNewItem(
                icon: "aspectratio.fill",
                title: "Full Monitor 1:1 Absolute Mapping",
                description: "Overcomes iOS AssistiveTouch bounds: maps 100% of the phone controller directly to 100% of the external monitor so every edge and corner is reachable."
            ),
        ]),
        ReleaseNotes(version: "0.1.9", date: "October 2026", items: [
            WhatsNewItem(
                icon: "computermouse.fill",
                title: "Physical Mouse & Trackpad Support",
                description: "Full support for Bluetooth and USB-C mice and trackpads connected to your iPhone or dock, with smooth dynamic pointer acceleration and scroll wheel control."
            ),
            WhatsNewItem(
                icon: "hand.point.up.left.fill",
                title: "AssistiveTouch Setup Guide",
                description: "Built-in interactive guide with 3-step setup and pro tips on hiding the menu button, tuning pointer speed, and mapping mouse buttons."
            ),
            WhatsNewItem(
                icon: "display",
                title: "Direct External Monitor Mouse Routing",
                description: "Support for direct pointer hover, clicks, and scrolling on external monitors and extended iPad displays."
            ),
        ]),
        ReleaseNotes(version: "0.1.8", date: "October 2026", items: [
            WhatsNewItem(
                icon: "server.rack",
                title: "Preset SSH Hosts & Passwords in Settings",
                description: "Configure and manage SSH hosts directly in Settings with secure Keychain-backed preset passwords."
            ),
            WhatsNewItem(
                icon: "bolt.fill",
                title: "Auto-Connect SSH Sessions",
                description: "Enable auto-connect on any host to instantly connect and authenticate with your preset password as soon as an SSH tab opens."
            ),
            WhatsNewItem(
                icon: "lock.shield",
                title: "Strict Secret Isolation",
                description: "Passwords and private keys are saved exclusively in your device's Keychain (PRD §14) and are never uploaded to the cloud or server."
            ),
        ]),
        ReleaseNotes(version: "0.1.7", date: "October 2026", items: [
            WhatsNewItem(
                icon: "keyboard",
                title: "Physical Keyboard Input in Web Pages",
                description: "Type smoothly into any web text input, search box, or textarea with full support for hardware typing, backspace, enter, and cursor navigation."
            ),
            WhatsNewItem(
                icon: "safari",
                title: "Streamlined Web Toolbar",
                description: "Removed the redundant Safari button to keep the web toolbar focused, clean, and distraction-free."
            ),
        ]),
        ReleaseNotes(version: "0.1.6", date: "October 2026", items: [
            WhatsNewItem(
                icon: "app.badge.checkmark",
                title: "Nord Frost Brand & App Icon",
                description: "Adopted the winning Nordic slate and polar ice blue split-pane design as Tether's official app icon and brand identity."
            ),
            WhatsNewItem(
                icon: "key.fill",
                title: "Reliable Web Authentication",
                description: "Seamless iCloud Keychain Face ID / Touch ID AutoFill in web views, with graceful guidance on iOS embedded passkey sandbox rules."
            ),
            WhatsNewItem(
                icon: "safari",
                title: "One-Tap Safari Handoff",
                description: "Dedicated Safari launch button in the web toolbar to open any active page in system Safari with full passkey and extension access."
            ),
        ]),
        ReleaseNotes(version: "0.1.5", date: "October 2026", items: [
            WhatsNewItem(
                icon: "cursorarrow.rays",
                title: "Cursor Control for Command Palette",
                description: "The mouse cursor and phone trackpad now freely move over, hover, and click every command palette item, search bar, and button."
            ),
            WhatsNewItem(
                icon: "keyboard.fill",
                title: "Physical Keyboard Input & Navigation",
                description: "Type search queries directly from your connected hardware keyboard with live filtering, backspace support, arrow navigation, and Enter to execute."
            ),
            WhatsNewItem(
                icon: "xmark.circle.fill",
                title: "Quick Palette Dismissal",
                description: "Close the command palette effortlessly using the new dedicated '×' button, clicking anywhere outside, pressing Escape, or toggling ⌘K."
            ),
            WhatsNewItem(
                icon: "arrow.up.and.down",
                title: "Scrollable Phone Sidebar",
                description: "The phone controller's action sidebar is now scrollable in both landscape and portrait, ensuring every control remains reachable on any device."
            ),
        ]),
        ReleaseNotes(version: "0.1.4", date: "October 2026", items: [
            WhatsNewItem(
                icon: "command",
                title: "Global Command Palette & Shortcuts",
                description: "Press ⌘K, Ctrl+K, or tap the sidebar to fuzzy-search and jump to any tab, host, bookmark, or layout preset without touching the mouse."
            ),
            WhatsNewItem(
                icon: "rectangle.portrait.and.arrow.forward",
                title: "Phone Orientation Options",
                description: "Toggle between Landscape, Portrait (Up/Down), or Flipped orientation in settings or with a 1-tap sidebar rotation button."
            ),
            WhatsNewItem(
                icon: "key.fill",
                title: "Keychain AutoFill & Safari Handoff",
                description: "Seamless Face ID / Touch ID credential AutoFill in web views, with direct Safari handoff for external passkeys."
            ),
            WhatsNewItem(
                icon: "house.fill",
                title: "English Starter Web Dashboard",
                description: "New browser tabs open directly to an English-only dashboard with web search, popular developer links, and shortcut cheat sheets."
            ),
        ]),
        ReleaseNotes(version: "0.1.3", date: "October 2026", items: [
            WhatsNewItem(
                icon: "rectangle.landscape.rotate",
                title: "Landscape-First Phone Controller",
                description: "The phone controller is now locked in landscape mode for a wider, natural, ergonomic trackpad surface."
            ),
            WhatsNewItem(
                icon: "keyboard.badge.ellipsis",
                title: "Hardware Keyboard Auto-Detection",
                description: "Clicking text fields on monitor tabs will not interrupt you when a physical dock keyboard is connected."
            ),
            WhatsNewItem(
                icon: "hand.draw",
                title: "Gesture-First Trackpad",
                description: "Touchpad buttons are hidden by default for maximum glass area; use intuitive gestures or tap-and-hold to drag."
            ),
            WhatsNewItem(
                icon: "sidebar.left",
                title: "Configurable Vertical Icon Sidebar",
                description: "Space-saving icon-only vertical sidebar with quick actions, dockable to either the left or right side in settings."
            ),
        ]),
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
