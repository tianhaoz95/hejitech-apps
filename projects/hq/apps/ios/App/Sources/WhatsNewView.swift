import SwiftUI

/// The in-app What's New. `scripts/cut_release.sh hq` refuses until `currentVersion` and the top
/// release entry describe the version being released (projects/hq/release.env).
enum WhatsNew {
    static let currentVersion = "0.1.0"
    static let releases: [(version: String, notes: [String])] = [
        (version: "0.1.0", notes: [
            "Your inbox: approve, reject with a reason, or discuss what HQ's agents propose.",
            "Every card shows its evidence, the plan and how HQ will know it worked.",
            "Health for every project, recent runs, and a kill switch.",
        ]),
    ]
    private static let key = "hq.whats-new-seen"
    static var shouldShow: Bool { UserDefaults.standard.string(forKey: key) != currentVersion && Connection.isConfigured }
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
