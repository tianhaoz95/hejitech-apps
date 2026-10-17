import Foundation
import Observation

/// Tracks which top-level tab is currently visible, purely so a "shake to
/// report" submission can record `screenName` — see `MainTabView`'s
/// `selection:` binding, which is otherwise unused (native `TabView` chrome
/// is unchanged). Not a general navigation/analytics facility; don't grow
/// scope here beyond what feedback triage needs.
@Observable
@MainActor
public final class CurrentScreenTracker {
    public var screenName: String = "Capture"
}
