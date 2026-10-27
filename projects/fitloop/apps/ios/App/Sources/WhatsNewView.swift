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

    static let currentVersion = "0.1.6"
    static let lastSeenVersionKey = "last_seen_whats_new_version"

    static let releases: [ReleaseNotes] = [
        ReleaseNotes(version: "0.1.6", date: "October 2026", items: [
            WhatsNewItem(icon: "arrow.up.doc.fill", title: "FitLoop-hosted exercise GIFs", description: "Coaching agents can now upload and host exercise demonstration GIFs directly on FitLoop with permanent edge caching and CORS."),
            WhatsNewItem(icon: "list.bullet", title: "Resilient workout steps", description: "Movement steps and cues display gracefully even without an animated demonstration GIF, and with clean step numbering."),
        ]),
        ReleaseNotes(version: "0.1.5", date: "October 2026", items: [
            WhatsNewItem(icon: "eyeglasses", title: "Even G2 on-glasses GIFs", description: "Watch exercise animation GIFs directly on your Even G2 glasses waveguide display alongside step cues."),
            WhatsNewItem(icon: "globe", title: "Web workout GIFs", description: "Animated workout exercise demonstration GIFs now display seamlessly in the FitLoop web app."),
        ]),
        ReleaseNotes(version: "0.1.4", date: "October 2026", items: [
            WhatsNewItem(icon: "play.rectangle.fill", title: "High-resolution animated GIF demos", description: "Follow exercises with smooth, high-resolution demonstration GIFs directly in the workout player, with step-by-step cues and manual or auto-stepping."),
            WhatsNewItem(icon: "eyeglasses", title: "Paced Even G2 instructions", description: "Step through comfortable, paced form cues on your Even G2 glasses at a relaxed rhythm so instructions never flash through too fast."),
        ]),
        ReleaseNotes(version: "0.1.3", date: "October 2026", items: [
            WhatsNewItem(icon: "figure.walk.motion", title: "Animated workout instructions", description: "Follow exercises with animated ASCII form keyframes designed by your agent for both your phone and Even G2 glasses."),
            WhatsNewItem(icon: "eyeglasses", title: "Even G2 How-to & Demo", description: "Step through exercise motion frames on your Even G2 glasses or let them cycle at a steady pace to learn the form."),
        ]),
        ReleaseNotes(version: "0.1.2", date: "October 2026", items: [
            WhatsNewItem(icon: "doc.on.doc", title: "One-tap MCP & token copy", description: "Copy your FitLoop MCP server URL and personal agent tokens with one click in Settings."),
        ]),
        ReleaseNotes(version: "0.1.1", date: "October 2026", items: [
            WhatsNewItem(icon: "person.wave.2", title: "Your agent interviews you", description: "No intake forms to fill out first: connect your agent over MCP and it interviews you for your goals, limits, equipment, schedule and diet, saving them to your profile."),
            WhatsNewItem(icon: "heart.text.square", title: "Clearer health & safety notes", description: "Explicit Apple Health sharing disclosures, Terms and Privacy links, and immediate safety reminders when logging pain."),
        ]),
        ReleaseNotes(version: "0.1.0", date: "October 2026", items: [
            WhatsNewItem(icon: "sparkles", title: "Your agent writes the plan", description: "Connect Claude or any MCP agent: it builds your workouts and meals around your goals, time and limits, and publishes them here."),
            WhatsNewItem(icon: "figure.strengthtraining.traditional", title: "Follow it set by set", description: "A workout player with rest timers and how-to cues, heart rate from your Apple Watch, and the same on your Even G2."),
            WhatsNewItem(icon: "bubble.left.and.text.bubble.right", title: "Tell your agent, right then", description: "Too hard, knee hurt, still hungry: leave a note on any workout or meal. Your agent reads it and replies."),
            WhatsNewItem(icon: "switch.2", title: "Your data, your switches", description: "Live heart rate, Apple Health, manual entries and progress photos are each optional, and so is what your agent sees."),
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
