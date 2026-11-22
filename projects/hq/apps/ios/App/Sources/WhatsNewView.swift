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

/// The in-app What's New, shown once after an update and from Settings. `scripts/cut_release.sh hq`
/// refuses until `currentVersion` and the top release entry describe the version being released
/// (projects/hq/release.env).
enum WhatsNew {
    static let currentVersion = "0.4.2"
    static let releases: [ReleaseNotes] = [
        ReleaseNotes(version: "0.4.2", date: "November 2026", items: [
            WhatsNewItem(icon: "hammer", title: "Ready for iOS 27", description: "HQ is now built with the iOS 27 SDK."),
        ]),
        ReleaseNotes(version: "0.4.1", date: "November 2026", items: [
            WhatsNewItem(icon: "sparkles", title: "What's New, any time", description: "Every release's changes, with a clearer look, now open from Settings too."),
        ]),
        ReleaseNotes(version: "0.4.0", date: "November 2026", items: [
            WhatsNewItem(icon: "sparkles", title: "Everything from a connected agent", description: "Nothing to install: “Do a sweep for HQ” also builds the cards you approved (each on its own branch, checked with the project’s verify), reviews cards another session built, answers your comments, runs the verbs you asked for and checks health."),
            WhatsNewItem(icon: "arrow.triangle.2.circlepath", title: "No more hq sync", description: "The sweep refreshes HQ’s copy of your .hq/ policy straight from GitHub."),
            WhatsNewItem(icon: "arrowshape.turn.up.right.fill", title: "Handed back, not failed", description: "A sweep that can’t do something hands it back for another session or a runner instead of failing it."),
        ]),
        ReleaseNotes(version: "0.3.0", date: "November 2026", items: [
            WhatsNewItem(icon: "wand.and.stars", title: "Sweeps", description: "Say “Do a sweep for HQ” to any agent connected to HQ, or schedule it in the Claude app. It answers waiting requests, runs the scouts that are due and ranks your inbox, right in that session, with no runner to keep going."),
            WhatsNewItem(icon: "gearshape.2.fill", title: "Sweeps in Runs", description: "Sweeps show up in Runs like any other run, with what each scout found, and count toward the schedule and the weekly budget."),
        ]),
        ReleaseNotes(version: "0.2.0", date: "November 2026", items: [
            WhatsNewItem(icon: "bubble.left.and.text.bubble.right.fill", title: "Ask HQ", description: "Tap the new bubble to ask for a proposal in your own words, like “Propose a redesign of the logo”. An agent looks into the repo and answers with a card, a question or a reason, and you follow up in the thread."),
            WhatsNewItem(icon: "tray.2.fill", title: "A Requests tab", description: "Requests has its own tab, and cards you asked for are marked and never held back in the inbox."),
            WhatsNewItem(icon: "text.alignleft", title: "Cards read better", description: "Headings, lists, tables and code are formatted, and agents can draw diagrams right on the card."),
        ]),
        ReleaseNotes(version: "0.1.2", date: "November 2026", items: [
            WhatsNewItem(icon: "pause.circle.fill", title: "The kill switch is a switch", description: "Turn Pause HQ on or off and see at a glance whether HQ is running."),
            WhatsNewItem(icon: "bell.badge.fill", title: "Digest notification status", description: "Settings shows whether the digest notification is on, with a shortcut to turn it back on."),
        ]),
        ReleaseNotes(version: "0.1.1", date: "November 2026", items: [
            WhatsNewItem(icon: "person.badge.key.fill", title: "Google and Apple sign-in", description: "Sign-in now offers Google and Apple. The GitHub button is gone until GitHub sign-in is ready."),
        ]),
        ReleaseNotes(version: "0.1.0", date: "November 2026", items: [
            WhatsNewItem(icon: "tray.full.fill", title: "Your inbox", description: "Approve, reject with a reason, or discuss what HQ's agents propose."),
            WhatsNewItem(icon: "doc.text.magnifyingglass", title: "Evidence on every card", description: "Every card shows its evidence, the plan and how HQ will know it worked."),
            WhatsNewItem(icon: "heart.text.square.fill", title: "Health and runs", description: "Health for every project, recent runs, and a kill switch."),
            WhatsNewItem(icon: "person.2.fill", title: "Workspaces for your team", description: "Sign in with Google or Apple; one workspace per repo, shared with your team (admin, approver, viewer)."),
        ]),
    ]
    private static let key = "hq.whats-new-seen"
    static var shouldShow: Bool {
        #if DEBUG
        if UserDefaults.standard.bool(forKey: "whatsNew") { return true } // -whatsNew YES, for screenshots
        #endif
        return UserDefaults.standard.string(forKey: key) != currentVersion && Backend.shared.session != nil
    }
    static func markSeen() { UserDefaults.standard.set(currentVersion, forKey: key) }
}

struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("What's New in HQ").font(.system(.largeTitle, design: .rounded).bold())
                        Text("Version \(WhatsNew.currentVersion)").font(.subheadline).foregroundStyle(.secondary)
                    }
                    .padding(.top, 8)

                    ForEach(WhatsNew.releases) { release in
                        VStack(alignment: .leading, spacing: 16) {
                            if release.version != WhatsNew.currentVersion {
                                Divider()
                                Text("\(release.version) · \(release.date)")
                                    .font(.system(.footnote, design: .rounded).weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            ForEach(release.items) { item in
                                HStack(alignment: .top, spacing: 16) {
                                    Image(systemName: item.icon)
                                        .font(.title3)
                                        .foregroundStyle(Color.accentColor)
                                        .frame(width: 40, height: 40)
                                        .background(Color.accentColor.opacity(0.12))
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                        .accessibilityHidden(true)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(item.title).font(.system(.headline, design: .rounded))
                                        Text(item.description).font(.subheadline).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(24)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { WhatsNew.markSeen(); dismiss() } } }
        }
    }
}
