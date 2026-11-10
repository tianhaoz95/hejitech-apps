import SwiftUI

/// The in-app What's New. `scripts/cut_release.sh hq` refuses until `currentVersion` and the top
/// release entry describe the version being released (projects/hq/release.env).
enum WhatsNew {
    static let currentVersion = "0.1.2"
    static let releases: [(version: String, notes: [String])] = [
        (version: "0.1.2", notes: [
            "The kill switch is now a switch: turn Pause HQ on or off and see at a glance whether HQ is running.",
            "Settings shows whether the digest notification is on, with a shortcut to turn it back on.",
        ]),
        (version: "0.1.1", notes: [
            "Sign-in now offers Google and Apple. The GitHub button is gone until GitHub sign-in is ready.",
        ]),
        (version: "0.1.0", notes: [
            "Your inbox: approve, reject with a reason, or discuss what HQ's agents propose.",
            "Every card shows its evidence, the plan and how HQ will know it worked.",
            "Health for every project, recent runs, and a kill switch.",
            "Sign in with Google or Apple; one workspace per repo, shared with your team (admin, approver, viewer).",
        ]),
    ]
    private static let key = "hq.whats-new-seen"
    static var shouldShow: Bool { UserDefaults.standard.string(forKey: key) != currentVersion && Backend.shared.session != nil }
    static func markSeen() { UserDefaults.standard.set(currentVersion, forKey: key) }
}

struct WhatsNewView: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List(WhatsNew.releases, id: \.version) { r in
                Section("Version \(r.version)") { ForEach(r.notes, id: \.self) { Text($0) } }
            }
            .navigationTitle("What's New")
            .toolbar { Button("Done") { WhatsNew.markSeen(); dismiss() } }
        }
    }
}
