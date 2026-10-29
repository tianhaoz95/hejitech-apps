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

    static let currentVersion = "0.2.3"
    static let lastSeenVersionKey = "last_seen_whats_new_version"

    static let releases: [ReleaseNotes] = [
        ReleaseNotes(version: "0.2.3", date: "October 2026", items: [
            WhatsNewItem(icon: "applewatch.watchface", title: "Apple Watch face complications", description: "Glance at your watch face for a live 'Leave in X' countdown to your next Caltrain, departure times, and destination arrival status on Modular, Infograph, and Ultra watch faces."),
        ]),
        ReleaseNotes(version: "0.2.2", date: "October 2026", items: [
            WhatsNewItem(icon: "slider.horizontal.3", title: "Trains tab polish", description: "Aligned filter controls, edge-to-edge status cards matching schedule width, and fully rounded departures card corners."),
        ]),
        ReleaseNotes(version: "0.2.1", date: "October 2026", items: [
            WhatsNewItem(icon: "eyeglasses", title: "Even G2 glasses HUD labels & ETA", description: "Clear column headers (TRN, TYPE, DEP, ETA, STAT, IN), explicit Express (EXP) / Limited (LTD) / Local (LOC) service types, and destination arrival ETAs on your Even G2 glasses."),
        ]),
        ReleaseNotes(version: "0.2.0", date: "October 2026", items: [
            WhatsNewItem(icon: "square.and.arrow.up", title: "Share my live ETA", description: "Send friends or family an ephemeral link to follow your train live on the web with arrival countdowns, stop timeline, and delay updates. Link revokes automatically when you arrive or untrack."),
            WhatsNewItem(icon: "bolt.badge.clock.fill", title: "Wait for the express", description: "Spot when a later-departing express train arrives at your stop sooner. See arrival insights directly on the board and get a heads-up push before taking a delayed local."),
            WhatsNewItem(icon: "figure.walk", title: "Catch it: leave-by times", description: "Know exactly when to walk out the door. Headway subtracts your walk from live delays, highlights the best train to leave for, and warns when a train needs a run."),
            WhatsNewItem(icon: "dot.radiowaves.left.and.right", title: "Lock Screen Live Activity", description: "Follow your tracked train right on your Lock Screen and in the Dynamic Island with live arrival times, countdowns, and upcoming stops."),
        ]),
        ReleaseNotes(version: "0.1.2", date: "October 2026", items: [
            WhatsNewItem(icon: "applewatch", title: "Watch companion app", description: "Glance at Caltrain departures, live countdowns, and delays from your wrist. Tap to track your train, flip direction, or filter for express trips."),
            WhatsNewItem(icon: "bolt.fill", title: "Express train preferences", description: "Choose to only take express trains or prefer faster express departures in your commute settings and directly on the departures board."),
            WhatsNewItem(icon: "tag.fill", title: "Prominent express train badges", description: "Caltrain Express trains now stand out with high-visibility badges and faster trip indicators across the iPhone app, web board, and glasses HUD."),
        ]),
        ReleaseNotes(version: "0.1.1", date: "October 2026", items: [
            WhatsNewItem(icon: "globe", title: "Refined web commute & board UI", description: "Redesigned web settings with morning/evening toggles, quick route mirroring, interactive weekday pills, structured alert controls, and an upgraded departure board and G2 waveguide preview."),
        ]),
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
