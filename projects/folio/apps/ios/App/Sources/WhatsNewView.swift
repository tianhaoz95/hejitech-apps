import SwiftUI

/// What's New: `scripts/cut_release.sh folio` refuses an iPhone release until `currentVersion` and
/// the first `releases` entry describe it.
enum WhatsNew {
    static let currentVersion = "0.2.4"

    struct Release: Identifiable {
        let version: String
        let items: [(icon: String, title: String, text: String)]
        var id: String { version }
    }

    static let releases: [Release] = [
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
            .navigationTitle("What's new")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }
}
