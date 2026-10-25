import SwiftUI

/// The in-app release notes, shown once after an update and from Settings → What's New. Every
/// release adds an entry at the top of `releases` and sets `currentVersion` to it (release.env's
/// release_check refuses to cut a version What's New doesn't describe).
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
            WhatsNewItem(icon: "tram.fill", title: "Your commute, live", description: "Save a morning and an evening pair of stations. Headway opens on the right one for the time of day, with live delays from Caltrain's feed."),
            WhatsNewItem(icon: "eyeglasses", title: "On your Even G2", description: "Pair the Headway plugin with a code. Swipe the R1 ring through the next trains, tap to flip direction, hold to track a train."),
            WhatsNewItem(icon: "bell.badge.fill", title: "Alerts that matter", description: "Delays, cancellations, Caltrain service alerts, a leave-now reminder for your usual train, and a heads-up minutes before your stop."),
        ]),
    ]

    /// After an update, not on a fresh install's first sign-in.
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
                                Image(systemName: item.icon).font(.title2).foregroundStyle(Color.accentColor).frame(width: 34)
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
            .navigationTitle("What's New")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
