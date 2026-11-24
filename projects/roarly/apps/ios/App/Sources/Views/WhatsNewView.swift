import SwiftUI

/// What changed in each version. `scripts/cut_release.sh roarly` refuses a release until
/// `currentVersion` and the top entry describe it.
struct WhatsNewView: View {
    static let currentVersion = "0.5.0"
    static let seenKey = "whatsNewSeen"

    struct Release: Identifiable {
        let version: String
        let items: [(String, String, String)]
        var id: String { version }
    }

    static let releases: [Release] = [
        Release(version: "0.5.0", items: [
            ("🌍", "Smarter in Spanish and Mandarin", "Roarly now understands what's happening in stories told in Spanish and Mandarin, not just English, so the right sound plays at the right moment."),
            ("🌙", "Bedtime mode", "Choose a quiet time in Settings and Roarly gently fades out and stops listening once the story winds down."),
            ("🔒", "On your Lock Screen", "While Roarly is listening, you can see it on the Lock Screen and in the Dynamic Island."),
            ("📦", "A lighter download", "The experimental story model is now an optional download in Settings instead of part of every install."),
        ]),
        Release(version: "0.4.0", items: [
            ("🦏", "300 new sounds", "Rhinos, polar bears, walruses, moose, orcas, otters, deer, kookaburras, rattlesnakes, volcanoes, geysers, trolleys, subways, pianos, guitars, harps, tambourines, fireballs, unicorns, werewolves and more. 441 sounds in all."),
            ("⚓", "25 new worlds", "Harbors, train stations, sunny parks, busy markets, kitchens, cozy cafes, stadiums, deserts, the arctic, swamps, pirate ships, enchanted woods, crystal caves and alien planets."),
        ]),
        Release(version: "0.3.0", items: [
            ("🦭", "50 new sounds", "Seals, penguins, foxes, hippos, eagles, crocodiles, peacocks, geese, parrots, woodpeckers, bats, cannons, sleigh bells, bath splashes, zippers, hiccups, music boxes, toots and more. 141 sounds in all."),
            ("🌴", "New worlds and weather", "Jungles, meadows, playgrounds, castles, outer space, train rides, fairgrounds, storms, hail and dripping rain."),
        ]),
        Release(version: "0.2.1", items: [
            ("🛠️", "Ready for iOS 27", "Roarly is now built with the iOS 27 SDK."),
        ]),
        Release(version: "0.2.0", items: [
            ("🚜", "Twice the sounds", "Tractors, bikes, trucks, sirens, diggers and helicopters; pigs, ducks, roosters and donkeys; creaky doors, sneezes, yawns and hoorays; ghosts, robots, giants and treasure. 91 sounds in all."),
            ("🌊", "New places", "A farmyard, a busy city, under the sea and a dripping cave play softly under the story."),
            ("🐘", "Truer sounds", "The car, train, boat, cow, elephant and bee are real recordings now."),
        ]),
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
