import SwiftUI

/// The in-app release notes, shown once after an update and from Settings → About. Every release
/// adds an entry at the top of `releases` and sets `currentVersion` to it (release.env's
/// release_check refuses to cut a version What's New doesn't describe). See CLAUDE.md.
enum WhatsNewItemKind: String {
    case feature = "Feature"
    case improvement = "Improvement"
    case fix = "Bug Fix"
}

struct WhatsNewItem: Identifiable {
    let id = UUID()
    let icon: String
    let tint: Color
    let title: String
    let description: String
    var kind: WhatsNewItemKind = .feature
    var detailedDescription: String? = nil
    var highlights: [String]? = nil
}

struct ReleaseHistoryItem: Identifiable {
    let version: String
    let date: String
    let tagline: String
    let features: [WhatsNewItem]
    var improvementsAndFixes: [WhatsNewItem] = []
    var id: String { version }
}

struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    static let currentVersion = "0.8.0"
    static let lastSeenVersionKey = "last_seen_whats_new_version"

    /// After an update, not on a fresh install: `markSeen()` runs during sign-in and setup.
    static var shouldShowAutomatically: Bool {
        UserDefaults.standard.string(forKey: lastSeenVersionKey) != currentVersion
    }

    static func markSeen() {
        UserDefaults.standard.set(currentVersion, forKey: lastSeenVersionKey)
    }

    static let releases: [ReleaseHistoryItem] = [
        ReleaseHistoryItem(
            version: "0.8.0",
            date: "October 2026",
            tagline: "Speak in Spanish or Chinese",
            features: [
                WhatsNewItem(
                    icon: "globe",
                    tint: Color(red: 0.45, green: 0.72, blue: 0.95),
                    title: "Speak in Spanish or Chinese",
                    description: "Log by voice in Español or 中文. Your iPhone translates what you say into English before logging it, so entries work the same as in English.",
                    detailedDescription: "Choose the language in Settings → Voice. The first time, Wee Hours downloads a 216 MB speech model, and on iOS 26 offers Apple’s on-device translation for the language; English needs nothing extra and works exactly as before. Each iPhone has its own setting, so every caregiver can speak their own language. Notes you dictate stay in the language you spoke.",
                    highlights: ["Settings → Voice → Language", "Translated on this iPhone", "Dictated notes keep your words"]
                ),
            ]
        ),
        ReleaseHistoryItem(
            version: "0.7.0",
            date: "October 2026",
            tagline: "Tilt Mode on Apple Watch",
            features: [
                WhatsNewItem(
                    icon: "gyroscope",
                    tint: Color(red: 0.98, green: 0.70, blue: 0.45),
                    title: "Tilt Mode on Apple Watch",
                    description: "Log with only the arm wearing the watch while the other holds the baby: tilt your wrist so the ball rolls into feed, diaper, sleep or a care action, hold it for a second, then double pinch. Nothing is asked on the watch.",
                    detailedDescription: "Turn it on in Settings → Apple Watch, where you also choose what sits forward, right, back and left. Either screen on the watch has a button to switch to the other. Double pinch needs Apple Watch Series 9, Ultra 2 or later; on other watches, tap Log.",
                    highlights: ["Hold a direction for a second to lock it", "Double pinch to log, or tilt away to cancel", "Double pinch again right after to undo"]
                ),
                WhatsNewItem(
                    icon: "applewatch",
                    tint: Color(red: 0.45, green: 0.75, blue: 0.95),
                    title: "Needs Details",
                    description: "A diaper or a bottle logged with a tilt waits on Now with one-tap answers for its kind or how much went down, for when your hands are free."
                ),
            ]
        ),
        ReleaseHistoryItem(
            version: "0.6.0",
            date: "October 2026",
            tagline: "Night Screen, Lock Screen Bottles & Shift Notes",
            features: [
                WhatsNewItem(
                    icon: "moon.fill",
                    tint: Color(red: 1.0, green: 0.62, blue: 0.17),
                    title: "Night Screen",
                    description: "A true-black screen with four big amber or red buttons (feed, nursing, diaper, sleep) that won't light up the nursery. Turn it on, or schedule it (11 PM to 6 AM by default), in Settings → Night & one-handed. Swipe down for the full app."
                ),
                WhatsNewItem(
                    icon: "lock.iphone",
                    tint: Theme.feed,
                    title: "Finish a Bottle from the Lock Screen",
                    description: "The Lock Screen and Dynamic Island now finish a bottle with how much was drunk (½, ¾, All) and switch nursing to the named side, without unlocking."
                ),
                WhatsNewItem(
                    icon: "hand.point.up.left.fill",
                    tint: Theme.accent,
                    title: "One-Handed Dock",
                    description: "Feed, diaper and sleep on an arc around the mic, within reach of your thumb while the other arm holds the baby. Right or left hand, in Settings → Night & one-handed."
                ),
                WhatsNewItem(
                    icon: "note.text",
                    tint: Color(red: 0.90, green: 0.72, blue: 0.20),
                    title: "Notes for the Next Shift",
                    description: "Leave a short typed or dictated note from the pencil next to Hand off. It's pinned at the top of Now on everyone's phone until the next hand-off. Entirely optional."
                ),
                WhatsNewItem(
                    icon: "person.wave.2.fill",
                    tint: .teal,
                    title: "See What Your Partner Is Doing",
                    description: "Now shows when another caregiver started a feed or put the baby down, and long-pressing Start bottle tells everyone \"I'm making it\", so nobody makes a second bottle. Other phones also update within a second of each entry."
                ),
                WhatsNewItem(
                    icon: "chart.bar.xaxis",
                    tint: Theme.sleep,
                    title: "Today vs Yesterday",
                    description: "The Timeline compares today with yesterday on two 24-hour ribbons: sleep, feeds and diapers, totals against the same time yesterday, and cluster feeding marked. Tap a mark to open the entry."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "square.grid.3x3",
                    tint: Theme.accent,
                    title: "Timeline Detail Levels",
                    description: "Pinch the Timeline, or use the new switch, for a whole-day hour grid, the usual cards, or Audit, with each entry's id, where it came from and whether it has uploaded.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "icloud.slash",
                    tint: .orange,
                    title: "Offline Badge",
                    description: "When entries can't upload, Now shows how many are saved on this iPhone. Tap it to see them and sync again.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "humidity.fill",
                    tint: Theme.diaper,
                    title: "Diaper Colour in the Details",
                    description: "Open a diaper entry to change its kind with big buttons and, for a dirty one, note the colour. Logging a diaper still takes one tap.",
                    kind: .improvement
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.5.0",
            date: "October 2026",
            tagline: "Shift Hand-offs, Milk Stash, Solids & Doctor Visits",
            features: [
                WhatsNewItem(
                    icon: "arrow.triangle.2.circlepath.circle.fill",
                    tint: Theme.accent,
                    title: "Duty Hand-off Digest",
                    description: "Tap I've got it or Hand off to see a factual summary of the last shift: feeds, bottle ml, wet and dirty diapers, sleep time, medicines and notes."
                ),
                WhatsNewItem(
                    icon: "drop.triangle.fill",
                    tint: Theme.other,
                    title: "Optional Milk Stash & Bottle Ledger",
                    description: "Turn on Settings → Tracking → Track milk stash to track pumped milk in the fridge and freezer, with oldest-bag age and automatic deduction when a breast-milk bottle is finished."
                ),
                WhatsNewItem(
                    icon: "qrcode.viewfinder",
                    tint: .teal,
                    title: "Temporary Caregiver Pass",
                    description: "Share an expiring QR or web link from Settings → Household → Temporary caregiver pass so a grandparent, nanny or sitter can see live status and log with one tap in their browser."
                ),
                WhatsNewItem(
                    icon: "fork.knife",
                    tint: Theme.feed,
                    title: "Solids First-Foods & Reactions",
                    description: "Log specific foods, track Top-9 allergen exposures, and record any reaction from the Solids sheet or by voice."
                ),
                WhatsNewItem(
                    icon: "stethoscope",
                    tint: .red,
                    title: "Doctor Visit Fact Sheet & Question Queue",
                    description: "Doctor Visit builds a 7-day fact sheet (feeds, diapers, sleep, growth deltas and health entries since the last visit) alongside questions you've saved for the pediatrician."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "pills.fill",
                    tint: .pink,
                    title: "Medication Last-Dose & 1-Tap Repeat",
                    description: "The Medication tile shows the last medicine, time elapsed and 24-hour count, and its sheet repeats recent medicine + dose pairs in one tap.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "clock.arrow.circlepath",
                    tint: .orange,
                    title: "Long-Press to Backdate Any Tile",
                    description: "Hold any Now tile to log it 5, 10, 15 or 30 minutes ago, or pick an exact time.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "calendar.day.timeline.left",
                    tint: .blue,
                    title: "Timeline Search, Category Chips & 24h Rhythm Strip",
                    description: "Filter the timeline by category, search medicines, notes or foods, paired sessions, and compare Today vs Yesterday on a 24-hour rhythm strip.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "waveform",
                    tint: Theme.accent,
                    title: "Live Transcript Preview & Optional Auto-Log",
                    description: "Watch your words and parsed fields appear live while speaking, and optionally turn on Settings → Voice → Auto-log when you stop speaking.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "applewatch",
                    tint: .green,
                    title: "Apple Watch Bottle Amounts, Both Target & Care Tiles",
                    description: "Pick bottle fractions (¼, ½, ¾, All), log for Both/All children, and tap enabled care trackers right from your wrist.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "moon.zzz.fill",
                    tint: .indigo,
                    title: "Quiet Hours, Adaptive Reminders & Notification Snooze",
                    description: "Set personal quiet hours in Settings → Household → You, adapt feed intervals to your last 3 days, and snooze or start a feed directly from reminder notifications.",
                    kind: .improvement
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.4.5",
            date: "October 2026",
            tagline: "Clearer Icons",
            features: [],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "bubbles.and.sparkles.fill",
                    tint: .teal,
                    title: "New Tooth Brushing and Teething Icons",
                    description: "Tooth brushing and teething have clearer icons on Now and in Settings.",
                    kind: .improvement
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.4.4",
            date: "October 2026",
            tagline: "At a Glance",
            features: [
                WhatsNewItem(
                    icon: "square.grid.2x2.fill",
                    tint: Theme.accent,
                    title: "Icons in Tracking Settings",
                    description: "Every feed, diaper, sleep, care, health and activity type in Settings now has the icon and colour of its Now button, so the list is easier to scan."
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.4.3",
            date: "October 2026",
            tagline: "Who's Who",
            features: [
                WhatsNewItem(
                    icon: "person.crop.circle",
                    tint: Theme.accent,
                    title: "Your Name and Role",
                    description: "Settings → Household → You: change the name your household sees, and add a role like Mom, Dad or Nanny. It shows next to your name for everyone."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "person.text.rectangle",
                    tint: .orange,
                    title: "Child Details Save Right Away",
                    description: "Changing a child's name, birthday, colour or feeding settings now saves as soon as you go back, instead of waiting for a Save button further down.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "key",
                    tint: .purple,
                    title: "Tidy Up Old Agent Tokens",
                    description: "Revoked tokens in Settings → AI agents (and on your account page) can now be deleted, and the MCP server address shown there is the right one.",
                    kind: .fix
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.4.2",
            date: "October 2026",
            tagline: "From Your Wrist",
            features: [
                WhatsNewItem(
                    icon: "applewatch.watchface",
                    tint: .orange,
                    title: "Speak From the Watch Face",
                    description: "Add the Wee Hours complication to your watch face. One tap opens Wee Hours already listening; tap Stop and your iPhone logs it.",
                    highlights: ["Circular, corner, rectangular and inline styles", "Starts recording straight away"]
                ),
                WhatsNewItem(
                    icon: "mic.circle.fill",
                    tint: Theme.accent,
                    title: "Speak From Your Home Screen",
                    description: "Add the Speak widget to your Home Screen or Lock Screen, or the Speak control to Control Center: one tap opens Wee Hours already listening."
                ),
                WhatsNewItem(
                    icon: "waveform",
                    tint: .green,
                    title: "Say It for Any Tracker",
                    description: "Baths, medicine, temperatures, tummy time and every other tracker you've turned on can now be logged by voice too: \"just gave her a bath\", \"tummy time for ten minutes\".",
                    highlights: ["Only the trackers you turned on are listened for", "Asks when it isn't sure, and every entry can be undone"]
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "bell.badge",
                    tint: .orange,
                    title: "Forgot to Stop? We'll Ask",
                    description: "If a feed, a nap or a timed activity runs well past the usual, Wee Hours sends one gentle \"still going?\" so a forgotten timer doesn't stretch all day.",
                    kind: .improvement,
                    highlights: ["Bottle after 45 min, nursing after an hour", "Daytime naps after 3 hours (never at night)",
                                 "Tummy time after 30 min, play after an hour, walks after 2 hours"]
                ),
                WhatsNewItem(
                    icon: "stopwatch",
                    tint: .green,
                    title: "Time Tummy Time, Play and Walks",
                    description: "Start them from their button on Now and tap again to stop: the minutes are logged for you, and your partner sees the timer too.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "timer",
                    tint: .purple,
                    title: "Clearer Live Activity",
                    description: "The Dynamic Island and Lock Screen show what's being timed (bottle, nursing with the next side, or sleep), for which child, and for how long, with Finish, Switch side or Woke up a tap away.",
                    kind: .improvement
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.4.1",
            date: "October 2026",
            tagline: "Fewer Questions, More to Track",
            features: [
                WhatsNewItem(
                    icon: "list.bullet.clipboard",
                    tint: .pink,
                    title: "Track More Than Feeds and Sleep",
                    description: "Bath, lotion, tooth brushing, potty, teething, medication, symptoms, temperature, doctor visits, vaccinations, tummy time, play time and walks. Turn on what you need in Settings → Tracking and each gets a button on Now.",
                    detailedDescription: "Everything here is logged with a tap for now: one tap for a bath, a quick menu for a symptom or how long tummy time lasted, and a short form for a medicine, a vaccine or a temperature (in °C or °F). Medicines you've logged before are one tap away. Saying them out loud comes in a later update.",
                    highlights: [
                        "All off until you turn them on",
                        "Shared with everyone in the household",
                        "Shows in your timeline and to your AI assistant"
                    ]
                ),
                WhatsNewItem(
                    icon: "note.text",
                    tint: .teal,
                    title: "Not Everything Is a Log Entry",
                    description: "Say \"grandma is coming at noon\" or \"we're out of wipes\" and Wee Hours keeps it as a note instead of asking you to pick an entry. Tap Log it if it was one after all.",
                    highlights: [
                        "No list to dismiss for plans, errands, questions or milestones",
                        "Kept in your timeline as a note, never lost",
                        "Better at telling \"we need more nappies\" from a diaper change"
                    ]
                ),
                WhatsNewItem(
                    icon: "bolt.fill",
                    tint: .yellow,
                    title: "Quick Capture",
                    description: "Turn on Settings → Voice → Quick capture and Wee Hours logs its best guess instead of asking when it isn't sure. Tap Change on the confirmation to fix it.",
                    highlights: [
                        "Off by default, set per phone",
                        "Guesses are marked so you can spot them",
                        "Change takes the guess back and shows the choices"
                    ]
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.4.0",
            date: "October 2026",
            tagline: "Voice That Speaks Baby",
            features: [
                WhatsNewItem(
                    icon: "waveform.badge.mic",
                    tint: Theme.accent,
                    title: "Voice Understands You Better",
                    description: "The on-device model behind voice logging was trained on thousands of the things parents actually say, so most entries now log straight away instead of asking you to pick.",
                    detailedDescription: "Wee Hours still understands speech entirely on your iPhone: nothing you say leaves the phone. The model that turns a sentence into a log entry was fine-tuned for baby logging, which takes it from guessing at about four in five entries to getting nearly all of them right in our tests. When it isn't sure, it still asks with one tap.",
                    highlights: [
                        "Feeds, sides, diapers, sleep, pumping and solids, in your own words",
                        "Logs right away far more often, and asks when it's unsure",
                        "Still fully on-device and offline"
                    ]
                ),
                WhatsNewItem(
                    icon: "waveform",
                    tint: .orange,
                    title: "Tap Once to Speak",
                    description: "No more holding the mic button. Tap it once, say what happened while a waveform follows your voice, then tap Done to log it, or Cancel.",
                    highlights: [
                        "Hands free while you hold the baby",
                        "Done logs it, Cancel throws the audio away",
                        "Finishes by itself after 30 seconds",
                        "The Action Button and Siri open the same screen"
                    ]
                ),
                WhatsNewItem(
                    icon: "sparkles",
                    tint: .purple,
                    title: "What's New",
                    description: "See what changed after each update, and browse earlier versions any time from Settings → About."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "waterbottle",
                    tint: .blue,
                    title: "Past Bottles Log as One Entry",
                    description: "\"She had a bottle an hour ago, drank half\" logs a finished bottle feed with its amount, instead of starting or ending a timer.",
                    kind: .fix
                ),
                WhatsNewItem(
                    icon: "text.bubble",
                    tint: .orange,
                    title: "Chores Aren't Logged",
                    description: "Sentences that aren't a log entry, like \"need to wash the bottles\" or \"remember to buy more formula\", are recognised as such far more reliably.",
                    kind: .improvement
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.3.2",
            date: "October 2026",
            tagline: "Your Mic, Your Side",
            features: [
                WhatsNewItem(
                    icon: "mic.circle",
                    tint: Theme.accent,
                    title: "Choose Where the Mic Sits",
                    description: "Put the mic button on the left, in the middle or on the right: Settings → Voice → Mic button."
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.3.1",
            date: "October 2026",
            tagline: "Adding a Child, Simpler",
            features: [
                WhatsNewItem(
                    icon: "person.badge.plus",
                    tint: .pink,
                    title: "Add a Child From a Sheet",
                    description: "Adding a child opens a sheet with Cancel and Add. Add stays off until the child has a name, and saves right away."
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.3.0",
            date: "October 2026",
            tagline: "More Than One Little One",
            features: [
                WhatsNewItem(
                    icon: "person.2.fill",
                    tint: .pink,
                    title: "Several Children",
                    description: "Every child's status on Now, with a Log-for bar to log for one child, both or all.",
                    highlights: [
                        "Settings → Children: add, colour, bottle size, show on this iPhone, archive",
                        "Say the child's name when logging by voice",
                        "Per-child widgets, reminders, Live Activities, watch and glasses",
                        "AI agents (MCP) know which child an entry is for"
                    ]
                ),
                WhatsNewItem(
                    icon: "ruler",
                    tint: .green,
                    title: "A Tile per Measurement",
                    description: "Growth shows weight, height and head size as their own tiles."
                )
            ]
        ),
        ReleaseHistoryItem(
            version: "0.2.0",
            date: "October 2026",
            tagline: "Growing Up",
            features: [
                WhatsNewItem(
                    icon: "chart.line.uptrend.xyaxis",
                    tint: .green,
                    title: "Growth Tracking",
                    description: "Log weight, height and head size from the Growth tile or by voice."
                )
            ],
            improvementsAndFixes: [
                WhatsNewItem(
                    icon: "mic.fill",
                    tint: Theme.accent,
                    title: "Liquid Glass Mic Button",
                    description: "The mic button uses Liquid Glass on iOS 26.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "list.bullet.rectangle",
                    tint: .blue,
                    title: "Friendlier Empty Timeline",
                    description: "An empty timeline explains how to log your first entry.",
                    kind: .improvement
                ),
                WhatsNewItem(
                    icon: "person.crop.circle",
                    tint: .gray,
                    title: "Sign-in First",
                    description: "A fresh install starts at sign-in, with a way to switch accounts during setup.",
                    kind: .improvement
                )
            ]
        )
    ]

    @State private var selectedVersion = WhatsNewView.currentVersion
    @State private var showingImprovements = false
    @State private var selectedItem: WhatsNewItem?

    private var release: ReleaseHistoryItem {
        Self.releases.first { $0.version == selectedVersion } ?? Self.releases[0]
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(spacing: 8) {
                            Image(systemName: "sparkles").font(.system(size: 40, weight: .bold)).foregroundStyle(Theme.accent)
                            Text("What's New in Wee Hours").font(.title2.bold()).multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        versionSelector
                        HStack {
                            Text(release.tagline).font(.headline)
                            Spacer()
                            Text(release.date).font(.caption).foregroundStyle(.secondary)
                        }
                        if !release.features.isEmpty {
                            VStack(alignment: .leading, spacing: 14) {
                                Label("NEW FEATURES", systemImage: "sparkles")
                                    .font(.subheadline.weight(.bold)).foregroundStyle(.secondary)
                                ForEach(release.features) { item in
                                    WhatsNewRow(item: item) { selectedItem = item }
                                }
                            }
                        }
                        if !release.improvementsAndFixes.isEmpty { improvementsCard }
                    }
                    .padding(24)
                }
                Divider()
                Button {
                    Self.markSeen()
                    dismiss()
                } label: {
                    Text("Continue").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .padding(20)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { Self.markSeen(); dismiss() }
                }
            }
            .sheet(isPresented: $showingImprovements) { WhatsNewImprovementsView(release: release) }
            .sheet(item: $selectedItem) { WhatsNewDetailView(item: $0, version: release.version) }
        }
    }

    private var versionSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Self.releases) { r in
                    let on = r.version == selectedVersion
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { selectedVersion = r.version }
                    } label: {
                        HStack(spacing: 5) {
                            Text("v\(r.version)").font(.subheadline.weight(.semibold))
                            if r.version == Self.currentVersion {
                                Text("LATEST").font(.system(size: 9, weight: .bold))
                                    .padding(.horizontal, 5).padding(.vertical, 2)
                                    .background(on ? Color.white.opacity(0.25) : Theme.accent.opacity(0.15), in: Capsule())
                            }
                        }
                        .padding(.horizontal, 14).padding(.vertical, 7)
                        .background(on ? Theme.accent : Color(.tertiarySystemFill), in: Capsule())
                        .foregroundStyle(on ? .white : .primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var improvementsCard: some View {
        Button { showingImprovements = true } label: {
            HStack(spacing: 12) {
                Image(systemName: "wrench.and.screwdriver.fill").font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 38, height: 38)
                    .background(Theme.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text("Bug Fixes & Improvements").font(.headline)
                    Text("\(release.improvementsAndFixes.count) more in v\(release.version)").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).foregroundStyle(.tertiary)
            }
            .padding(12)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

/// One feature or fix: icon, title, description; tapping opens its detail sheet.
private struct WhatsNewRow: View {
    let item: WhatsNewItem
    var showsKind = false
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: item.icon).font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(item.tint)
                    .frame(width: 36, height: 36)
                    .background(item.tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(item.title).font(.headline)
                        if showsKind { KindBadge(item: item) }
                    }
                    Text(item.description).font(.subheadline).foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.tertiary).padding(.top, 10)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct KindBadge: View {
    let item: WhatsNewItem

    var body: some View {
        let color: Color = switch item.kind {
        case .feature: item.tint
        case .improvement: .blue
        case .fix: .red
        }
        Text(item.kind.rawValue.uppercased()).font(.system(size: 10, weight: .bold))
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }
}

/// The secondary list: a release's bug fixes and improvements.
struct WhatsNewImprovementsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedItem: WhatsNewItem?
    let release: ReleaseHistoryItem

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 6) {
                        Label("Bug Fixes & Improvements", systemImage: "wrench.and.screwdriver.fill").font(.title2.bold())
                        Text("Wee Hours v\(release.version) · \(release.date)").font(.subheadline).foregroundStyle(.secondary)
                    }
                    ForEach(release.improvementsAndFixes) { item in
                        WhatsNewRow(item: item, showsKind: true) { selectedItem = item }
                    }
                }
                .padding(24)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(item: $selectedItem) { WhatsNewDetailView(item: $0, version: release.version) }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

/// One item in full: its description, the optional deep dive and highlights.
struct WhatsNewDetailView: View {
    @Environment(\.dismiss) private var dismiss
    let item: WhatsNewItem
    let version: String

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    HStack(alignment: .top, spacing: 16) {
                        Image(systemName: item.icon).font(.system(size: 24, weight: .semibold))
                            .foregroundStyle(item.tint)
                            .frame(width: 52, height: 52)
                            .background(item.tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        VStack(alignment: .leading, spacing: 6) {
                            Text(item.title).font(.title3.bold())
                            HStack(spacing: 6) {
                                KindBadge(item: item)
                                Text("v\(version)").font(.system(size: 10, weight: .semibold))
                                    .padding(.horizontal, 7).padding(.vertical, 3)
                                    .background(Color(.tertiarySystemFill), in: Capsule())
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    card { Text(item.description).font(.body).fixedSize(horizontal: false, vertical: true) }
                    if let detailed = item.detailedDescription {
                        card {
                            Label("Deep Dive", systemImage: "text.alignleft").font(.subheadline.bold()).foregroundStyle(.secondary)
                            Text(detailed).font(.body).lineSpacing(3).fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    if let highlights = item.highlights, !highlights.isEmpty {
                        card {
                            Label("Key Highlights", systemImage: "checkmark.circle.fill").font(.subheadline.bold()).foregroundStyle(.secondary)
                            ForEach(highlights, id: \.self) { h in
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: "checkmark").font(.system(size: 11, weight: .bold))
                                        .foregroundStyle(item.tint).padding(.top, 4)
                                    Text(h).font(.subheadline).fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                }
                .padding(24)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func card<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10, content: content)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
