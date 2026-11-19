import SwiftUI

/// What changed in each version. `scripts/cut_release.sh roarly` refuses a release until
/// `currentVersion` and the top entry describe it.
struct WhatsNewView: View {
    static let currentVersion = "0.1.3"
    static let seenKey = "whatsNewSeen"

    struct Release: Identifiable {
        let version: String
        let items: [(String, String, String)]
        var id: String { version }
    }

    static let releases: [Release] = [
        Release(version: "0.1.3", items: [
            ("🌏", "中文 and Español", "Tell stories in Mandarin or Spanish too. Pick the story language in Settings; every sound has its words in all three."),
        ]),
        Release(version: "0.1.2", items: [
            ("❓", "Bedtime or Playtime?", "Tap the ? next to the modes to see how they differ: how loud big sounds and loops get, when it asks first, and a button to hear each."),
        ]),
        Release(version: "0.1.1", items: [
            ("👂", "Listening stays put", "Starting a story no longer flips between \"Getting ready\" and \"Listening\"."),
            ("🌑", "Pocket mode", "With Pro, the screen goes black and locks while Roarly keeps listening: put the phone face down or in a pocket. Tap, then hold the moon to unlock."),
            ("📖", "Clear about Pro", "Roarly is free for good with 12 sounds. Pro is optional, and its screen says what it adds and opens only when you tap a sound with a lock."),
        ]),
        Release(version: "0.1.0", items: [
            ("🦁", "Stories that roar back", "Tell any story out loud and Roarly adds the sounds: animals, weather, doors, trains and magic."),
            ("🐯", "It follows the story", "A tiger chasing you growls; a tiger running away stays quiet. Unsure moments become a sound to tap."),
            ("🌙", "Bedtime and Playtime", "Bedtime keeps big sounds soft and asks before surprises; Playtime is full volume. \"Good night\" fades the loops out in both."),
            ("⌚️", "Apple Watch remote", "Tap suggested sounds from your wrist, or play them on the watch."),
        ]),
    ]

    static var shouldShowAutomatically: Bool {
        let seen = UserDefaults.standard.string(forKey: seenKey)
        if seen == nil {
            UserDefaults.standard.set(currentVersion, forKey: seenKey)
            return false
        }
        return seen != currentVersion
    }

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                NightSky()
                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        ForEach(Self.releases) { release in
                            VStack(alignment: .leading, spacing: 14) {
                                Text("Version \(release.version)").font(Theme.title(22)).foregroundStyle(Theme.moon)
                                ForEach(release.items, id: \.1) { emoji, title, text in
                                    HStack(alignment: .top, spacing: 14) {
                                        Text(emoji).font(.system(size: 30))
                                        VStack(alignment: .leading, spacing: 3) {
                                            Text(title).font(Theme.label(16)).foregroundStyle(Theme.moon)
                                            Text(text).font(Theme.body(15)).foregroundStyle(Theme.ink)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(22)
                }
            }
            .navigationTitle("What's new")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .onAppear { UserDefaults.standard.set(Self.currentVersion, forKey: Self.seenKey) }
        }
    }
}
