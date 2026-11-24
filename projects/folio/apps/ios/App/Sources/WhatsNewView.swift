import SwiftUI

/// What's New: `scripts/cut_release.sh folio` refuses an iPhone release until `currentVersion` and
/// the first `releases` entry describe it.
enum WhatsNew {
    static let currentVersion = "0.3.4"

    struct Release: Identifiable {
        let version: String
        let items: [(icon: String, title: String, text: String)]
        var id: String { version }
    }

    static let releases: [Release] = [
        Release(version: "0.3.4", items: [
            ("exclamationmark.bubble", "Clearer confirmations", "Deleting or leaving an artifact, restoring an older version and signing out now ask in one alert in the middle of the screen, with a Cancel button."),
        ]),
        Release(version: "0.3.3", items: [
            ("circle.lefthalf.filled", "Light, dark, or device", "Pick Light, Dark, or Device in Settings to choose how Folio looks on your iPhone and on the web."),
        ]),
        Release(version: "0.3.2", items: [
            ("arrow.up.and.down.text.horizontal", "Choose your spacing", "Pick how roomy your list is in Settings: Compact fits the most on screen, Comfortable and Spacious give each artifact more room."),
        ]),
        Release(version: "0.3.1", items: [
            ("info.circle", "More room for the page", "An artifact now opens straight to its page. Its description, latest version and Copy for your agent are one tap away under the info button at the top."),
        ]),
        Release(version: "0.3.0", items: [
            ("text.magnifyingglass", "Search inside artifacts", "Search now looks through every file of your artifacts, not just their titles. Matches show the file and the words around them. Your agents can search the same way, so \"the page with the Q3 numbers\" finds it."),
            ("link", "Links that show what they are", "A view-only link pasted into Messages, Slack or a doc now shows the artifact's title and a picture of the page. Private artifacts still show nothing but Folio's name."),
            ("ear", "Agents that answer right away", "Ask your agent to stay and it answers your comments as you leave them, here or on the web, without checking every few minutes."),
            ("seal", "Folio Pro", "Everything you do with your agents stays free. Pro keeps up to 1,000 artifacts instead of 25, takes larger pages, and sends webhooks to your own routines. Buy it here or on the web; it works everywhere you sign in."),
        ]),
        Release(version: "0.2.7", items: [
            ("rectangle.grid.1x2", "A more compact home", "Your list now opens with what matters today: how many suggestions wait for you, what changed today and how many comments are open. Then what to review and which agent asked, your favorites as chips, and everything else in tighter rows by day, so far more fits on the screen."),
        ]),
        Release(version: "0.2.6", items: [
            ("paintpalette", "A new look", "A new icon, an F drawn from a bar, a quarter circle and a dot, and colours to match: navy, coral and mustard on warm paper, in the app and on the web."),
        ]),
        Release(version: "0.2.5", items: [
            ("dock.rectangle", "Tabs at the bottom", "Preview, Review, Comments and History now float in one glass bar at the bottom of every artifact, in easy reach of your thumb. The page scrolls underneath, and the bar steps aside while you type a comment."),
        ]),
        Release(version: "0.2.4", items: [
            ("star", "Favorites", "Swipe right on an artifact to favorite it. Favorites stay at the top of your list, on the web too."),
            ("trash", "Delete or leave from the list", "Swipe left to delete an artifact you own, or to leave one someone shared with you. Folio asks before anything goes."),
            ("square.stack.3d.up", "Glass tabs", "Preview, Review, Comments and History are now Liquid Glass buttons at the top of every artifact."),
        ]),
        Release(version: "0.2.3", items: [
            ("chart.line.uptrend.xyaxis", "Artifacts that stay current", "Your agents can now keep an artifact's numbers fresh, like a dashboard they update every hour, without adding a version each time. The preview always shows the latest, and charts from the usual libraries just work."),
        ]),
        Release(version: "0.2.2", items: [
            ("text.bubble", "Comment on a selection", "Select part of an artifact's preview and tap Comment in the menu. Your agent sees exactly what you mean, and tapping a comment's quote shows that spot in the preview."),
            ("doc.on.doc", "Copy for your agent", "Copy an artifact's link, title or ID, or a ready-made request for your agent: improve it, work through its comments, or review its suggestions. It's at the top of every artifact, and in the menu when you press and hold one in the list."),
        ]),
        Release(version: "0.2.1", items: [
            ("bubble.left.and.bubble.right", "Comments fill the screen", "An artifact with no open comments showed a thin strip instead of its Comments tab. It now says there are none, with the box to write one."),
        ]),
        Release(version: "0.2.0", items: [
            ("sparkles.rectangle.stack", "Folio on iPhone", "Every artifact your agents share, with a live preview, its history and what changed in each version."),
            ("checkmark.bubble", "Review anywhere", "Accept or reject an agent's suggestion from the notification, or open it to see the changes and a preview first."),
            ("bubble.left.and.bubble.right", "Comments", "Read and reply to what agents and people say about an artifact, right from the notification."),
            ("square.and.arrow.down.on.square", "Share into Folio", "Send a web page, text, a file or photos from any app to start a new artifact an agent can pick up."),
            ("person.2", "Sharing", "Invite editors or viewers with a link, and turn on view-only links."),
        ]),
    ]

    /// Not on a first install (nothing is new yet), only after an update.
    static func shouldShow(seen: String) -> Bool { !seen.isEmpty && seen != currentVersion }
}

struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(WhatsNew.releases) { r in
                    Section(r.version == WhatsNew.currentVersion ? "Version \(r.version)" : r.version) {
                        ForEach(r.items, id: \.title) { item in
                            HStack(alignment: .top, spacing: 14) {
                                Image(systemName: item.icon).font(.title3).foregroundStyle(Color.accentColor).frame(width: 30)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.title).font(.headline)
                                    Text(item.text).font(.subheadline).foregroundStyle(.secondary)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .paperBackground()
            .navigationTitle("What's new")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
